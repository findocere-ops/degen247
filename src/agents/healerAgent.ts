import { state } from '../state';
import { PositionRecord } from '../positions/types';
import { config } from '../config';
import { MemoryManager } from '../learning/memoryManager';
import { PoolMemory } from '../pools/poolMemory';
import { chatCompletion } from '../api/openrouter';
import { healerTools } from './healerTools';
import { MeteoraClient } from '../positions/meteoraClient';
import { evaluatePositionHealth } from '../positions/exitSignals';
import { logger } from '../logger';
import { Connection } from '@solana/web3.js';
import Database from 'better-sqlite3';

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
  const positionEvaluations = [];

  for (const [id, pos] of state.positions.entries()) {
    const posRow = db.prepare('SELECT * FROM positions WHERE id = ?').get(id) as any;
    if (!posRow) continue;
    
    // Map db row to PositionRecord
    const fullPos: PositionRecord = {
      id: posRow.id,
      poolAddress: posRow.pool_address,
      amountSol: posRow.amount_sol,
      entryValue: posRow.entry_value,
      status: posRow.status,
      openedAt: posRow.opened_at,
      feesSol: posRow.fees_sol || 0
    };
    const health = await evaluatePositionHealth(fullPos, connection);
    positionEvaluations.push({
      id,
      poolAddress: pos.poolAddress,
      health
    });
  }

  const memories = memoryManager.getRelevantMemories('healer', ['exit', 'stop', 'target']);

  const systemPrompt = `
You are the DEGEN247 Healer Agent. Your goal is to manage open positions to maximize yield while aggressively protecting capital.
For EVERY open position provided, you MUST output ONE tool call: close_position, redeploy_position, or stay_position.

CURRENT POSITIONS AND HEALTH:
${JSON.stringify(positionEvaluations, null, 2)}

Relevant Past Memories:
${JSON.stringify(memories, null, 2)}

HARD RULES:
1. If stopLossTriggered IS TRUE, YOU MUST CALL close_position.
2. If takeProfitTriggered IS TRUE, CONSIDER closing or redeploying to lock profits.
3. If no signals triggered, default to stay_position unless memory indicates a risk.
`;

  logger.info('HEALER', 'Pinging LLM for position management decisions...');
  const msgResponse = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Evaluate all current positions and execute the appropriate status tool calls.' }
  ], healerTools, config.managementModel, 1500);

  if (!msgResponse || !msgResponse.tool_calls) {
    logger.warn('HEALER', 'LLM response invalid or missing tool_calls.');
    return;
  }

  for (const call of msgResponse.tool_calls) {
    const args = JSON.parse(call.function.arguments);
    const posId = args.positionId;
    const pos = state.positions.get(posId);

    if (!pos) {
      logger.warn('HEALER', `LLM called ${call.function.name} on unknown position ${posId}`);
      continue;
    }

    logger.info('HEALER', `Executing ${call.function.name} on ${posId} - Reason: ${args.reason}`);

    if (call.function.name === 'close_position') {
      try {
        await meteoraClient.closePosition({
          poolAddress: pos.poolAddress,
          positionPubkey: posId,
          lowerBinId: -20, // dummy logic for simplification
          upperBinId: 20
        });

        // Delete from state and update db
        state.positions.delete(posId);
        db.prepare("UPDATE positions SET status = 'closed' WHERE id = ?").run(posId);

        const pm = new PoolMemory(db);
        // We mock PNL for closure mapping
        pm.recordExit(pos.poolAddress, 0.5, 60, args.reason);
        memoryManager.addMemory('healer', `Closed ${posId} for ${args.reason}`, 'Healer_ReAct', 0.9, 24);
      } catch (e: any) {
        logger.error('HEALER', `Failed to close position: ${e.message}`);
      }
    } else if (call.function.name === 'stay_position') {
      // Just record reasoning
      memoryManager.addMemory('healer', `Holding ${posId}: ${args.reason}`, 'Healer_ReAct', 0.5, 6);
    } else if (call.function.name === 'redeploy_position') {
       // Same as close, but in full impl it opens a new one
       try {
        await meteoraClient.closePosition({
          poolAddress: pos.poolAddress,
          positionPubkey: posId,
          lowerBinId: -20, 
          upperBinId: 20
        });
        state.positions.delete(posId);
        db.prepare("UPDATE positions SET status = 'closed' WHERE id = ?").run(posId);
        // ... (deployment logic omitted for brevity, handled by Hunter next cycle theoretically in simple bot mode)
       } catch (e: any) {}
    }
  }
}
