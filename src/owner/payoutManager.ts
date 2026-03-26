import { state } from '../state';
import { capitalBuckets } from '../risk/capitalBuckets';
import { config } from '../config';
import { logger } from '../logger';
import Database from 'better-sqlite3';

export class PayoutManager {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public distributeProfit(profitSol: number) {
    if (profitSol <= 0) return;

    // We assume capitalBuckets has been tracked with absolute values or we derive it
    // For V3 MVP we simulate bucket allocations:
    const opsNeed = 0; // Simplified assumption: ops is fully replenished
    
    // Remaining profit after ops
    const remaining = profitSol - opsNeed;
    if (remaining <= 0) return;

    const ownerShare = remaining * config.ownerPayoutPct;
    const activeShare = remaining - ownerShare;

    // Track internal accounting (simplified)
    logger.info('OWNER', `Distributed ${profitSol.toFixed(4)} SOL profit: ${ownerShare.toFixed(4)} to Owner Reserve, ${activeShare.toFixed(4)} to Active Capital`);
    
    // Check auto payout limit
    // Assuming we track owner reserve globally, mocked as triggering instantly for test
    if (ownerShare >= config.ownerPayoutThresholdSol) {
      this.executePayout(ownerShare);
    }
  }

  public executePayout(amountSol: number) {
    if (amountSol <= 0) return;

    logger.info('OWNER', `Executing payout of ${amountSol} SOL to Owner`);
    // Mock blockchain transfer logic:
    // await connection.sendTransaction(Transfer(wallet.pubkey, OWNER_WALLET_ADDRESS, amountSol))

    this.db.prepare('INSERT INTO payouts (tx_signature, amount_sol, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)').run(
      'mock_tx_sig_' + Date.now(),
      amountSol
    );
  }
}
