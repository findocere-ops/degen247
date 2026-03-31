import {
  Connection,
  PublicKey,
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
  TransactionSignature
} from '@solana/web3.js';
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import BN from 'bn.js';
import { logger } from '../logger';

export interface OpenPositionParams {
  poolAddress: string;
  totalXAmount: BN;
  /** minBinId relative to active bin (e.g. -20) */
  minBinId: number;
  /** maxBinId relative to active bin (e.g. +20) */
  maxBinId: number;
  strategyType: StrategyType;
  slippage?: number;
}

export interface OpenPositionResult {
  positionPubkey: string;
  txSignature: string;
  /** Absolute lower bin ID stored for later close */
  lowerBinId: number;
  /** Absolute upper bin ID stored for later close */
  upperBinId: number;
}

export interface ClosePositionParams {
  poolAddress: string;
  positionPubkey: string;
  /** Absolute lower bin ID from DB */
  lowerBinId: number;
  /** Absolute upper bin ID from DB */
  upperBinId: number;
}

export interface PositionValue {
  /** Current token X amount in lamports */
  tokenXAmount: BN;
  /** Current token Y amount in lamports (SOL-side) */
  tokenYAmount: BN;
  /** Claimable fee X in lamports */
  feeX: BN;
  /** Claimable fee Y in lamports */
  feeY: BN;
  /** Combined current value in SOL (Y side + fee Y) */
  currentValueSol: number;
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

  // ─── Pool Cache ───────────────────────────────────────────────────────────

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

  // ─── Transaction Helper ───────────────────────────────────────────────────

  private async executeTxWithRetries(
    tx: Transaction,
    signers: Keypair[],
    context: string
  ): Promise<TransactionSignature> {
    if (this.dryRun) {
      logger.info('METEORA', `[DRY RUN] Would execute tx: ${context}`);
      return 'dry-run-signature-' + Date.now();
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const signature = await sendAndConfirmTransaction(
          this.connection,
          tx,
          signers,
          { skipPreflight: false, maxRetries: 3 }
        );
        logger.info('METEORA', `Success [${context}]: ${signature}`);
        return signature;
      } catch (err) {
        logger.warn(
          'METEORA',
          `Attempt ${attempt}/3 failed [${context}]: ${(err as Error).message}`
        );
        if (attempt === 3) throw err;
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
    throw new Error('Unreachable code');
  }

  // ─── Core Operations ──────────────────────────────────────────────────────

  async initPool(poolAddress: string): Promise<DLMM> {
    return this.getPool(poolAddress);
  }

  async getActiveBin(poolAddress: string) {
    const pool = await this.getPool(poolAddress);
    await pool.refetchStates();
    return pool.getActiveBin();
  }

  /**
   * Opens a DLMM position.
   * Uses autoFillYByStrategy so the SDK calculates the correct Y (SOL) amount
   * given the X amount and strategy — no manual 50/50 split.
   * Returns absolute lowerBinId and upperBinId for storage in DB.
   */
  async openPosition(params: OpenPositionParams): Promise<OpenPositionResult> {
    const pool = await this.getPool(params.poolAddress);
    await pool.refetchStates();

    const activeBin = await pool.getActiveBin();
    const activeBinId = activeBin.binId;

    // Convert relative offsets to absolute bin IDs
    const absoluteMinBinId = activeBinId + params.minBinId;
    const absoluteMaxBinId = activeBinId + params.maxBinId;

    // SDK calculates balanced Y amount for given X and strategy
    let totalYAmount: BN;
    try {
      // @ts-ignore — SDK method present but not fully typed
      const filled = pool.autoFillYByStrategy({
        totalXAmount: params.totalXAmount,
        minBinId: absoluteMinBinId,
        maxBinId: absoluteMaxBinId,
        strategyType: params.strategyType,
      });
      totalYAmount = filled as BN;
    } catch {
      // Fallback: mirror X amount (1:1 rough estimate)
      totalYAmount = params.totalXAmount;
    }

    const positionKeypair = new Keypair();

    const tx = await pool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: positionKeypair.publicKey,
      user: this.wallet.publicKey,
      totalXAmount: params.totalXAmount,
      totalYAmount,
      strategy: {
        maxBinId: absoluteMaxBinId,
        minBinId: absoluteMinBinId,
        strategyType: params.strategyType,
      },
      slippage: params.slippage ?? 1,
    });

    const txSignature = await this.executeTxWithRetries(
      tx,
      [this.wallet, positionKeypair],
      `openPosition:${params.poolAddress}`
    );

    logger.info(
      'METEORA',
      `Position opened: ${positionKeypair.publicKey.toBase58()} bins [${absoluteMinBinId}, ${absoluteMaxBinId}]`
    );

    return {
      positionPubkey: positionKeypair.publicKey.toBase58(),
      txSignature,
      lowerBinId: absoluteMinBinId,
      upperBinId: absoluteMaxBinId,
    };
  }

  /**
   * Closes a DLMM position completely.
   * Uses binIds[] reconstructed from stored lowerBinId/upperBinId.
   * shouldClaimAndClose: true — claims all fees and closes the position account in one call.
   */
  async closePosition(params: ClosePositionParams): Promise<string> {
    const pool = await this.getPool(params.poolAddress);
    await pool.refetchStates();

    // Reconstruct the full bin ID array from stored range
    const binIds: number[] = [];
    for (let b = params.lowerBinId; b <= params.upperBinId; b++) {
      binIds.push(b);
    }

    if (this.dryRun) {
      logger.info(
        'METEORA',
        `[DRY RUN] Would close position ${params.positionPubkey} (${binIds.length} bins)`
      );
      return 'dry-run-close-signature';
    }

    const removeTxs = await pool.removeLiquidity({
      user: this.wallet.publicKey,
      position: new PublicKey(params.positionPubkey),
      fromBinId: params.lowerBinId,
      toBinId: params.upperBinId,
      bps: new BN(10000), // 100%
      shouldClaimAndClose: true,
    });

    let lastSignature = '';
    const txArray = Array.isArray(removeTxs) ? removeTxs : [removeTxs];
    for (let i = 0; i < txArray.length; i++) {
      lastSignature = await this.executeTxWithRetries(
        txArray[i],
        [this.wallet],
        `closeTx:${i + 1}/${txArray.length} pos:${params.positionPubkey}`
      );
    }

    logger.info('METEORA', `Position closed: ${params.positionPubkey}`);
    return lastSignature;
  }

  /**
   * Claims swap fees across all provided positions.
   * Aligned with SDK: claimAllSwapFee({ owner, positions: PublicKey[] })
   */
  async claimFees(
    poolAddress: string,
    positionPubkeys: string[]
  ): Promise<string[]> {
    const pool = await this.getPool(poolAddress);
    await pool.refetchStates();

    if (this.dryRun) {
      logger.info(
        'METEORA',
        `[DRY RUN] Would claim fees for ${positionPubkeys.length} positions`
      );
      return ['dry-run-claim-signature'];
    }

    const { userPositions } = await pool.getPositionsByUserAndLbPair(this.wallet.publicKey);
    const posObjects = userPositions.filter(p => positionPubkeys.includes(p.publicKey.toBase58()));

    const claimTxs = await pool.claimAllSwapFee({
      owner: this.wallet.publicKey,
      positions: posObjects,
    });

    const txArray = Array.isArray(claimTxs) ? claimTxs : [claimTxs];
    const signatures: string[] = [];
    for (let i = 0; i < txArray.length; i++) {
      signatures.push(
        await this.executeTxWithRetries(
          txArray[i],
          [this.wallet],
          `claimFee:${i + 1}/${txArray.length}`
        )
      );
    }
    return signatures;
  }

  /**
   * Fetches real on-chain position value: current token amounts + claimable fees.
   * Used by exitSignals for real PnL calculation.
   */
  async getPositionValue(
    poolAddress: string,
    positionPubkey: string
  ): Promise<PositionValue | null> {
    try {
      const pool = await this.getPool(poolAddress);
      await pool.refetchStates();

      const { userPositions } = await pool.getPositionsByUserAndLbPair(
        this.wallet.publicKey
      );

      const positionData = userPositions.find(
        p => p.publicKey.toBase58() === positionPubkey
      );

      if (!positionData) {
        logger.warn('METEORA', `Position ${positionPubkey} not found on-chain`);
        return null;
      }

      // Sum token amounts across all bin data
      let tokenXAmount = new BN(0);
      let tokenYAmount = new BN(0);
      for (const binData of positionData.positionData.positionBinData) {
        tokenXAmount = tokenXAmount.add(new BN(binData.positionXAmount));
        tokenYAmount = tokenYAmount.add(new BN(binData.positionYAmount));
      }

      const feeY = positionData.positionData.feeY;
      // SOL is token Y in most SOL pairs (1 SOL = 1e9 lamports)
      const solValueLamports = tokenYAmount.add(feeY);
      const currentValueSol = solValueLamports.toNumber() / 1e9;

      return {
        tokenXAmount,
        tokenYAmount,
        feeX: positionData.positionData.feeX,
        feeY,
        currentValueSol,
      };
    } catch (err: any) {
      logger.error(
        'METEORA',
        `getPositionValue failed for ${positionPubkey}: ${err.message}`
      );
      return null;
    }
  }

  async getPositions(poolAddress: string) {
    const pool = await this.getPool(poolAddress);
    await pool.refetchStates();
    const activeBin = await pool.getActiveBin();
    const { userPositions } = await pool.getPositionsByUserAndLbPair(
      this.wallet.publicKey
    );
    return { activeBin, userPositions };
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
      feeInfo: pool.lbPair.vParameters,
    };
  }
}
