import { PositionRecord } from './types';
import { config } from '../config';
import DLMM from '@meteora-ag/dlmm'; // wait, it needs default import
// Re-executing accurately for the full chunk:
import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../logger';

export interface ExitSignalResult {
  inRange: boolean;
  takeProfitTriggered: boolean;
  stopLossTriggered: boolean;
  outOfRangeForWait: boolean;
  pnlPct: number;
  feePct: number;
  triggeredSignals: string[];
}

export async function evaluatePositionHealth(
  position: PositionRecord,
  connection: Connection
): Promise<ExitSignalResult> {
  const result: ExitSignalResult = {
    inRange: true, // We assume true if we can't fetch it
    takeProfitTriggered: false,
    stopLossTriggered: false,
    outOfRangeForWait: false,
    pnlPct: 0,
    feePct: 0,
    triggeredSignals: []
  };

  try {
    // In a real implementation this would deserialize the position account and fetch current value.
    // For V3 MVP we simulate based on standard inputs.
    
    // Simulate current value calculation
    const currentValue = position.entryValue * 1.02; // Mock 2% gain
    const pnlPct = ((currentValue - position.entryValue) / position.entryValue) * 100;
    result.pnlPct = pnlPct;

    const fees = position.feesSol || 0;
    const feePct = (fees / position.entryValue) * 100;
    result.feePct = feePct;

    if (feePct >= config.takeProfitFeePct) {
      result.takeProfitTriggered = true;
      result.triggeredSignals.push('Fee take-profit');
    }

    if (pnlPct <= -config.stopLossPct) {
      result.stopLossTriggered = true;
      result.triggeredSignals.push('Stop-loss breached');
    }

    // Time checks for out-of-range simulations constraint
    const holdMinutes = (Date.now() - new Date(position.openedAt || Date.now()).getTime()) / 60000;
    if (holdMinutes > config.outOfRangeWaitMinutes) {
      // Logic would check meteora bin mapping here. Simulated as false positive for demo LLM.
    }

  } catch (err: any) {
    logger.error('SIGNALS', `Failed to evaluate health for ${position.id}: ${err.message}`);
  }

  return result;
}
