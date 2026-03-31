import { state } from '../state';
import { config } from '../config';
import { MemoryManager } from '../learning/memoryManager';
import { sanitizeMemories } from '../utils/sanitizer';
import { PoolMemory } from '../pools/poolMemory';
import { chatCompletion } from '../api/openrouter';
import { healerTools } from './healerTools';
import { MeteoraClient } from '../positions/meteoraClient';
import { evaluatePositionHealth } from '../positions/exitSignals';
import { PayoutManager } from '../owner/payoutManager';
import { logger } from '../logger';
import { Connection } from '@solana/web3.js';
import Database from 'better-sqlite3';
import { PositionRecord } from '../positions/types';

export async function healerReActLoop(
  db: Database.Database,
  connection: Connection,
  meteoraClient: MeteoraClient
) {
  logger.info('HEALER', 'Starting Healer ReAct Loop');

  if (state.positions.size === 0) {
    logger.info('HEALER', 'No open positions to manage.');
    return;
  }

  const memoryManager = new MemoryManager(db);
  const payoutManager = new PayoutManager(db, connection, meteoraClient.dryRun);
  const positionEvaluations = [];

  for (const [id, pos] of state.positions.entries()) {
    const posRow = db
      .prepare('SELECT * FROM positions WHERE id = ?')
      .get(id) as any;
    if (!posRow) continue;

    const fullPos: PositionRecord = {
      id: posRow.id,
      poolAddress: posRow.pool_address,
      amountSol: posRow.amount_sol,
      entryValue: posRow.entry_value,
      status: posRow.status,
      openedAt: posRow.opened_at,
      feesSol: posRow.fees_sol ?? 0,
    };

    // Pass meteoraClient so we get real on-chain PnL
    const health = await evaluatePositionHealth(fullPos, connection, meteoraClient);

    positionEvaluations.push({
      id,
      poolAddress: pos.poolAddress,
      // Store bin IDs from DB so we can pass them to close
      lowerBinId: posRow.lower_bin_id ?? -20,
      upperBinId: posRow.upper_bin_id ?? 20,
      health,
    });
  }

  const memories = memoryManager.getRelevantMemories('healer', ['exit', 'stop', 'target']);
  const safeMemories = sanitizeMemories(memories);

  const systemPrompt = `
You are the DEGEN247 Healer Agent. Your goal is to manage open positions to maximize yield while aggressively protecting capital.
For EVERY open position provided, you MUST output ONE tool call: close_position, redeploy_position, or stay_position.

CURRENT POSITIONS AND HEALTH:
${JSON.stringify(positionEvaluations, null, 2)}

Relevant Past Memories:
${JSON.stringify(safeMemories, null, 2)}

HARD RULES:
1. If stopLossTriggered IS TRUE, YOU MUST CALL close_position immediately.
2. If takeProfitTriggered IS TRUE, call close_position to lock in profits.
3. If outOfRangeForWait IS TRUE and pnlPct is negative, consider redeploy_position.
4. If no signals triggered, default to stay_position.
`;

  logger.info('HEALER', 'Pinging LLM for position management decisions...');
  const msgResponse = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: 'Evaluate all current positions and execute the appropriate tool calls.',
      },
    ],
    healerTools,
    config.managementModel,
    1500
  );

  if (!msgResponse || !msgResponse.tool_calls) {
    logger.warn('HEALER', 'LLM response invalid or missing tool_calls.');
    return;
  }

  for (const call of msgResponse.tool_calls) {
    const args = JSON.parse(call.function.arguments);
    const posId = args.positionId;
    const pos = state.positions.get(posId);
    const evalData = positionEvaluations.find(e => e.id === posId);

    if (!pos || !evalData) {
      logger.warn('HEALER', `LLM called ${call.function.name} on unknown position ${posId}`);
      continue;
    }

    logger.info('HEALER', `Executing ${call.function.name} on ${posId} — Reason: ${args.reason}`);

    const shouldClose =
      call.function.name === 'close_position' ||
      call.function.name === 'redeploy_position';

    if (shouldClose) {
      try {
        await meteoraClient.closePosition({
          poolAddress: pos.poolAddress,
          positionPubkey: posId,
          lowerBinId: evalData.lowerBinId,
          upperBinId: evalData.upperBinId,
        });

        // Compute realized PnL
        const entryValue = (db.prepare('SELECT entry_value FROM positions WHERE id = ?').get(posId) as any)?.entry_value ?? 0;
        const realizedPnl = evalData.health.currentValueSol - entryValue;

        state.positions.delete(posId);
        db.prepare(
          "UPDATE positions SET status = 'closed', closed_at = CURRENT_TIMESTAMP, pnl_sol = ?, exit_reason = ? WHERE id = ?"
        ).run(realizedPnl, args.reason, posId);

        const pm = new PoolMemory(db);
        const holdMinutes =
          (Date.now() - new Date((db.prepare('SELECT opened_at FROM positions WHERE id = ?').get(posId) as any)?.opened_at ?? Date.now()).getTime()) / 60000;
        pm.recordExit(pos.poolAddress, realizedPnl, holdMinutes, args.reason);
        memoryManager.addMemory(
          'healer',
          `Closed ${posId.substring(0, 8)} PnL: ${realizedPnl.toFixed(4)} SOL Reason: ${args.reason}`,
          'Healer_ReAct',
          0.9,
          48
        );

        // Distribute profit to owner wallet
        if (realizedPnl > 0) {
          await payoutManager.distributeProfit(realizedPnl);
        }

        logger.info('HEALER', `Position ${posId.substring(0, 8)} closed. PnL: ${realizedPnl.toFixed(4)} SOL`);
      } catch (e: any) {
        logger.error('HEALER', `Failed to close/redeploy position: ${e.message}`);
      }
    } else if (call.function.name === 'stay_position') {
      memoryManager.addMemory(
        'healer',
        `Holding ${posId.substring(0, 8)}: ${args.reason}`,
        'Healer_ReAct',
        0.5,
        6
      );
    }
  }
}
