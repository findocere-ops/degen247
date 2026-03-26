import { Connection, PublicKey, Keypair, sendAndConfirmTransaction, Transaction, TransactionSignature } from '@solana/web3.js';
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import BN from 'bn.js';
import { logger } from '../logger';

export interface OpenPositionParams {
  poolAddress: string;
  totalXAmount: BN;
  totalYAmount: BN;
  minBinId: number;
  maxBinId: number;
  strategyType: StrategyType;
  slippage?: number;
}

export interface ClosePositionParams {
  poolAddress: string;
  positionPubkey: string;
  lowerBinId: number;
  upperBinId: number;
}

export class MeteoraClient {
  private connection: Connection;
  private wallet: Keypair;
  public dryRun: boolean;
  private poolCache: Map<string, { pool: DLMM; lastUsed: number }> = new Map();
  private readonly MAX_CACHE_SIZE = 20;

  constructor(connection: Connection, wallet: Keypair, dryRun: boolean) {
    this.connection = connection;
    this.wallet = wallet;
    this.dryRun = dryRun;
  }

  private async getPool(poolAddress: string): Promise<DLMM> {
    const cached = this.poolCache.get(poolAddress);
    if (cached) {
      cached.lastUsed = Date.now();
      return cached.pool;
    }

    if (this.poolCache.size >= this.MAX_CACHE_SIZE) {
      let oldest = '';
      let oldestTime = Infinity;
      for (const [key, val] of this.poolCache.entries()) {
        if (val.lastUsed < oldestTime) {
          oldestTime = val.lastUsed;
          oldest = key;
        }
      }
      if (oldest) this.poolCache.delete(oldest);
    }

    const pool = await DLMM.create(this.connection, new PublicKey(poolAddress));
    this.poolCache.set(poolAddress, { pool, lastUsed: Date.now() });
    return pool;
  }

  private async executeTxWithRetries(tx: Transaction, signers: Keypair[], context: string): Promise<TransactionSignature> {
    if (this.dryRun) {
      logger.info('METEORA', `[DRY RUN] Would execute tx: ${context}`);
      return 'dry-run-signature-' + Date.now();
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const signature = await sendAndConfirmTransaction(this.connection, tx, signers, {
            skipPreflight: true,
            maxRetries: 3
        });
        logger.info('METEORA', `Success [${context}]: ${signature}`);
        return signature;
      } catch (err) {
        logger.warn('METEORA', `Attempt ${attempt}/3 failed [${context}]: ${(err as Error).message}`);
        if (attempt === 3) throw err;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    throw new Error('Unreachable code');
  }

  async initPool(poolAddress: string): Promise<DLMM> {
    return this.getPool(poolAddress);
  }

  async getActiveBin(poolAddress: string) {
    const pool = await this.getPool(poolAddress);
    await pool.refetchStates();
    return pool.getActiveBin();
  }

  async openPosition(params: OpenPositionParams) {
    const pool = await this.getPool(params.poolAddress);
    await pool.refetchStates();

    const positionKeypair = new Keypair();
    const strategyParams = {
        maxBinId: params.maxBinId,
        minBinId: params.minBinId,
        strategyType: params.strategyType
    };

    const tx = await pool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: positionKeypair.publicKey,
      user: this.wallet.publicKey,
      totalXAmount: params.totalXAmount,
      totalYAmount: params.totalYAmount,
      strategy: strategyParams,
      slippage: params.slippage || 1
    });

    const txSignature = await this.executeTxWithRetries(
      tx, 
      [this.wallet, positionKeypair], 
      `openTarget:${params.poolAddress}`
    );

    return {
      positionPubkey: positionKeypair.publicKey.toBase58(),
      txSignature,
      positionKeypair
    };
  }

  async closePosition(params: ClosePositionParams) {
    const pool = await this.getPool(params.poolAddress);
    await pool.refetchStates();

    const removeTxs = await pool.removeLiquidity({
      user: this.wallet.publicKey,
      position: new PublicKey(params.positionPubkey),
      fromBinId: params.lowerBinId,
      toBinId: params.upperBinId,
      bps: new BN(10000),
      shouldClaimAndClose: true
    });

    if (this.dryRun) {
      logger.info('METEORA', `[DRY RUN] Would close position ${params.positionPubkey} (${removeTxs.length} txs expected)`);
      return 'dry-run-close-signature';
    }

    let lastSignature = '';
    for (let i = 0; i < removeTxs.length; i++) {
        lastSignature = await this.executeTxWithRetries(removeTxs[i], [this.wallet], `closeTx:${i+1}/${removeTxs.length} pos:${params.positionPubkey}`);
    }
    return lastSignature;
  }

  async claimFees(poolAddress: string, positions: any[]) {
    const pool = await this.getPool(poolAddress);
    await pool.refetchStates();

    const claimTxs = await pool.claimAllSwapFee({
      owner: this.wallet.publicKey,
      positions
    });

    if (this.dryRun) {
      logger.info('METEORA', `[DRY RUN] Would claim fees on ${positions.length} positions`);
      return ['dry-run-claim-signature'];
    }

    const signatures = [];
    for (let i = 0; i < claimTxs.length; i++) {
        signatures.push(await this.executeTxWithRetries(claimTxs[i], [this.wallet], `claimTx:${i+1}/${claimTxs.length}`));
    }
    return signatures;
  }

  async getPositions(poolAddress: string) {
    const pool = await this.getPool(poolAddress);
    await pool.refetchStates();
    const activeBin = await pool.getActiveBin();
    const userPositions = await pool.getPositionsByUserAndLbPair(this.wallet.publicKey);
    return { activeBin, userPositions };
  }

  async calculateBalancedAmounts(poolAddress: string, totalXAmount: BN, minBinId: number, maxBinId: number, strategyType: StrategyType) {
    const pool = await this.getPool(poolAddress);
    await pool.refetchStates();
    // Using simple filler wrapper for SDK method
    // @ts-ignore - SDK typings missing this property although it is specified
    return pool.autoFillYByStrategy({
        totalXAmount, 
        minBinId, 
        maxBinId, 
        strategyType
    });
  }

  async getPoolInfo(poolAddress: string) {
    const pool = await this.getPool(poolAddress);
    await pool.refetchStates();
    const activeBin = await pool.getActiveBin();
    return {
      activeBin,
      // @ts-ignore
      binStep: pool.lbPair.binStep,
      tokenXMint: pool.lbPair.tokenXMint,
      tokenYMint: pool.lbPair.tokenYMint,
      feeInfo: pool.lbPair.vParameters
    };
  }
}
