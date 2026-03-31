import Database from 'better-sqlite3';
import { PoolHistoryRecord } from './types';

export class PoolMemory {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  getPoolHistory(poolAddress: string): PoolHistoryRecord | null {
    const row = this.db.prepare('SELECT * FROM pool_history WHERE pool_address = ?').get(poolAddress) as any;
    if (!row) return null;
    return {
      poolAddress: row.pool_address,
      tokenPair: row.token_pair,
      totalDeploys: row.total_deploys,
      wins: row.wins,
      losses: row.losses,
      totalPnlSol: row.total_pnl_sol,
      avgHoldMinutes: row.avg_hold_minutes,
      lastDeployed: row.last_deployed,
      lastExitReason: row.last_exit_reason,
      blacklisted: row.blacklisted === 1
    };
  }

  recordDeploy(poolAddress: string, tokenPair: string) {
    this.db.prepare(`
      INSERT INTO pool_history (pool_address, token_pair, total_deploys, last_deployed)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(pool_address) DO UPDATE SET 
        total_deploys = total_deploys + 1,
        last_deployed = excluded.last_deployed
    `).run(poolAddress, tokenPair, Date.now());
    this.enforceLimits();
  }

  private enforceLimits() {
    // Keep max 2000 pools in history to prevent SQLite database exhaustion
    this.db.prepare(`
      DELETE FROM pool_history 
      WHERE pool_address IN (
        SELECT pool_address FROM pool_history 
        ORDER BY last_deployed DESC 
        LIMIT -1 OFFSET 2000
      )
    `).run();
  }

  recordExit(poolAddress: string, pnlSol: number, holdMinutes: number, exitReason: string) {
    const isWin = pnlSol > 0 ? 1 : 0;
    const isLoss = pnlSol <= 0 ? 1 : 0;

    // We do an upsert or update. Use direct update since recordDeploy should've run first
    this.db.prepare(`
      UPDATE pool_history SET
        wins = wins + ?,
        losses = losses + ?,
        total_pnl_sol = total_pnl_sol + ?,
        avg_hold_minutes = (COALESCE(avg_hold_minutes, 0) * total_deploys + ?) / (total_deploys + 1),
        last_exit_reason = ?
      WHERE pool_address = ?
    `).run(isWin, isLoss, pnlSol, holdMinutes, exitReason, poolAddress);
  }

  markBlacklisted(poolAddress: string) {
    this.db.prepare('UPDATE pool_history SET blacklisted = 1 WHERE pool_address = ?').run(poolAddress);
  }
}
