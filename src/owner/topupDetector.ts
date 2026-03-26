import { state } from '../state';
import { logger } from '../logger';
import Database from 'better-sqlite3';

export class TopupDetector {
  private db: Database.Database;
  private expectedBalance: number;

  constructor(db: Database.Database) {
    this.db = db;
    this.expectedBalance = state.walletBalanceSol;
  }

  public checkBalance(currentBalance: number) {
    // Topup condition: balance unexpectedly jumped > 0.001 SOL
    if (currentBalance - this.expectedBalance > 0.001) {
      const topupAmount = currentBalance - this.expectedBalance;
      logger.info('OWNER', `📥 Detected Top-Up of ${topupAmount.toFixed(4)} SOL`);
      
      this.db.prepare('INSERT INTO topups (amount_sol, timestamp) VALUES (?, CURRENT_TIMESTAMP)').run(topupAmount);

      // Adjust high water mark
      state.highWaterMark = (state.highWaterMark || 0) + topupAmount;
      state.walletBalanceSol = currentBalance;
      this.expectedBalance = currentBalance;
    } else {
      // Sync expected balance on regular burns
      this.expectedBalance = currentBalance;
      state.walletBalanceSol = currentBalance;
    }
  }
}
