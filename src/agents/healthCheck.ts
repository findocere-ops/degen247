import { state } from '../state';
import { capitalBuckets } from '../risk/capitalBuckets';
import { logger } from '../logger';
import { Connection } from '@solana/web3.js';
import Database from 'better-sqlite3';

export async function healthCheck(db: Database.Database, connection: Connection) {
  logger.info('RISK', 'Starting hourly portfolio health check');

  let totalPositionsSol = 0;
  for (const pos of state.positions.values()) {
    const row = db.prepare('SELECT entry_value FROM positions WHERE id = ?').get(pos.id) as any;
    totalPositionsSol += (row ? row.entry_value : 1.0); // Mock current valuation
  }

  const totalPortfolioSol = state.walletBalanceSol + totalPositionsSol;

  logger.info('RISK', `Total Portfolio: ${totalPortfolioSol} SOL. Wallet: ${state.walletBalanceSol}, Positions: ${totalPositionsSol}`);

  if (totalPortfolioSol > state.highWaterMark) {
    state.highWaterMark = totalPortfolioSol;
    logger.info('RISK', `New High-Water Mark reached: ${state.highWaterMark} SOL`);
  }

  const drawdownPct = ((state.highWaterMark - totalPortfolioSol) / state.highWaterMark) * 100;

  if (drawdownPct > 10) {
    logger.warn('RISK', `🚨 EMERGENCY: Drawdown > 10% (${drawdownPct.toFixed(2)}%). Pausing Hunter.`);
    state.paused = true;
    // In full impl, this would trigger emergency close across all positions
  } else if (drawdownPct > 5) {
    logger.warn('RISK', `Drawdown Warning: ${drawdownPct.toFixed(2)}% off HWM.`);
  } else {
    // Resume safely if recovered
    if (state.paused) {
      logger.info('RISK', 'Drawdown recovered below 10%. Hunter remains paused until manual resume/safemode expiry.');
    }
  }

  // Log to SQLite portfolio snapshot
  db.prepare(`
    INSERT INTO portfolio (total_value_sol, ops_reserve_sol, active_capital_sol, safety_buffer_sol, owner_payout_reserve_sol)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    totalPortfolioSol,
    totalPortfolioSol * 0.05,
    totalPortfolioSol * 0.75,
    totalPortfolioSol * 0.10,
    totalPortfolioSol * 0.10
  );
}
