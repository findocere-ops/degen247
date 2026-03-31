import { PositionRecord } from './types';
import { config } from '../config';
import { Connection } from '@solana/web3.js';
import { logger } from '../logger';
import { MeteoraClient } from './meteoraClient';

export interface ExitSignalResult {
  inRange: boolean;
  takeProfitTriggered: boolean;
  stopLossTriggered: boolean;
  outOfRangeForWait: boolean;
  pnlPct: number;
  feePct: number;
  currentValueSol: number;
  triggeredSignals: string[];
}

/**
 * Evaluates position health using real on-chain data from the Meteora DLMM SDK.
 * Falls back gracefully if RPC fails — defaults to safe assumptions.
 */
export async function evaluatePositionHealth(
  position: PositionRecord,
  connection: Connection,
  meteoraClient?: MeteoraClient
): Promise<ExitSignalResult> {
  const result: ExitSignalResult = {
    inRange: true,
    takeProfitTriggered: false,
    stopLossTriggered: false,
    outOfRangeForWait: false,
    pnlPct: 0,
    feePct: 0,
    currentValueSol: position.entryValue,
    triggeredSignals: [],
  };

  try {
    // ── Real on-chain fetch ─────────────────────────────────────────────────
    if (meteoraClient && !meteoraClient.dryRun) {
      const posValue = await meteoraClient.getPositionValue(
        position.poolAddress,
        position.id
      );

      if (posValue) {
        result.currentValueSol = posValue.currentValueSol;

        const feesSol = posValue.feeY.toNumber() / 1e9;
        result.feePct = (feesSol / position.entryValue) * 100;

        const pnlSol = posValue.currentValueSol - position.entryValue;
        result.pnlPct = (pnlSol / position.entryValue) * 100;

        logger.info(
          'SIGNALS',
          `[${position.id.substring(0, 8)}] Current: ${posValue.currentValueSol.toFixed(4)} SOL | PnL: ${result.pnlPct.toFixed(2)}% | Fees: ${result.feePct.toFixed(2)}%`
        );
      }
    } else {
      // ── Dry-run / fallback: use stored feesSol if available ───────────────
      const feesSol = position.feesSol ?? 0;
      result.feePct = (feesSol / position.entryValue) * 100;
      // Simulate neutral PnL in dry-run
      result.pnlPct = 0;
      result.currentValueSol = position.entryValue;
    }

    // ── Signal evaluation ───────────────────────────────────────────────────
    if (result.feePct >= config.takeProfitFeePct) {
      result.takeProfitTriggered = true;
      result.triggeredSignals.push(`Fee take-profit (${result.feePct.toFixed(2)}% >= ${config.takeProfitFeePct}%)`);
    }

    if (result.pnlPct <= -config.stopLossPct) {
      result.stopLossTriggered = true;
      result.triggeredSignals.push(`Stop-loss breached (${result.pnlPct.toFixed(2)}% <= -${config.stopLossPct}%)`);
    }

    // Out-of-range time check
    const holdMinutes =
      (Date.now() - new Date(position.openedAt ?? Date.now()).getTime()) / 60000;
    if (holdMinutes > config.outOfRangeWaitMinutes) {
      result.outOfRangeForWait = true;
      // Don't auto-trigger — pass to LLM healer for decision
    }
  } catch (err: any) {
    logger.error(
      'SIGNALS',
      `Failed to evaluate health for ${position.id}: ${err.message}`
    );
    // On error: safe defaults — don't trigger any exit
  }

  return result;
}
