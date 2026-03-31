import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { state } from '../state';
import { config } from '../config';
import { logger } from '../logger';
import { loadWallet } from '../wallet';
import Database from 'better-sqlite3';

/** Owner wallet that receives profit payouts */
const OWNER_WALLET = new PublicKey('BPjNvrMKdkvGx6iMrLoKsdcACvgPjtnZWXm31HmTRygs');

export class PayoutManager {
  private db: Database.Database;
  private connection: Connection;
  private isDryRun: boolean;

  constructor(db: Database.Database, connection: Connection, isDryRun: boolean) {
    this.db = db;
    this.connection = connection;
    this.isDryRun = isDryRun;
  }

  /**
   * Distributes realized profit:
   *   ownerPayoutPct  → accumulated in reserve
   *   remainder       → stays as active capital
   * Triggers a real SOL transfer when reserve exceeds ownerPayoutThresholdSol.
   */
  public async distributeProfit(profitSol: number): Promise<void> {
    if (profitSol <= 0) return;

    const ownerShare = profitSol * config.ownerPayoutPct;
    const activeShare = profitSol - ownerShare;

    logger.info(
      'OWNER',
      `Profit distribution: ${profitSol.toFixed(4)} SOL → Owner: ${ownerShare.toFixed(4)} SOL | Capital: ${activeShare.toFixed(4)} SOL`
    );

    // Track running owner reserve in DB
    const reserveRow = this.db
      .prepare("SELECT SUM(amount_sol) as total FROM payouts WHERE tx_signature LIKE 'RESERVE_%'")
      .get() as any;
    const currentReserve = (reserveRow?.total ?? 0) + ownerShare;

    // Stage the reserve entry
    this.db
      .prepare("INSERT INTO payouts (tx_signature, amount_sol) VALUES (?, ?)")
      .run(`RESERVE_${Date.now()}`, ownerShare);

    logger.info('OWNER', `Owner reserve now: ${currentReserve.toFixed(4)} SOL (threshold: ${config.ownerPayoutThresholdSol} SOL)`);

    // Auto-transfer when reserve crosses threshold
    if (currentReserve >= config.ownerPayoutThresholdSol) {
      await this.executePayout(currentReserve);
    }
  }

  /**
   * Executes a real SOL SystemProgram transfer from agent wallet → owner wallet.
   * Records the real tx signature in the DB.
   */
  public async executePayout(amountSol: number): Promise<void> {
    if (amountSol <= 0) return;

    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    logger.info(
      'OWNER',
      `💸 Executing payout of ${amountSol.toFixed(4)} SOL → ${OWNER_WALLET.toBase58()}`
    );

    if (this.isDryRun) {
      logger.info('OWNER', `[DRY RUN] Would transfer ${amountSol.toFixed(4)} SOL to owner`);
      this.db
        .prepare("INSERT INTO payouts (tx_signature, amount_sol) VALUES (?, ?)")
        .run(`DRY_RUN_PAYOUT_${Date.now()}`, amountSol);
      return;
    }

    try {
      const wallet = loadWallet();

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: OWNER_WALLET,
          lamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [wallet],
        { skipPreflight: false }
      );

      // Update wallet balance in state
      state.walletBalanceSol = Math.max(0, state.walletBalanceSol - amountSol);

      // Record successful payout
      this.db
        .prepare("INSERT INTO payouts (tx_signature, amount_sol) VALUES (?, ?)")
        .run(signature, amountSol);

      // Clear staged reserves from DB (mark as paid)
      this.db
        .prepare("DELETE FROM payouts WHERE tx_signature LIKE 'RESERVE_%'")
        .run();

      logger.info('OWNER', `✅ Payout confirmed: ${signature} (${amountSol.toFixed(4)} SOL)`);
    } catch (err: any) {
      logger.error('OWNER', `❌ Payout transfer failed: ${err.message}`);
      throw err;
    }
  }
}
