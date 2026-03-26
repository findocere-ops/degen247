export interface BucketAllocation {
  safePct: number;
  volatilePct: number;
  degenPct: number;
}

export class CapitalBuckets {
  private static instance: CapitalBuckets;
  
  public allocation: BucketAllocation = {
    safePct: 0.50,
    volatilePct: 0.30,
    degenPct: 0.20
  };

  // State trackers
  public safeUsed: number = 0;
  public volatileUsed: number = 0;
  public degenUsed: number = 0;

  private constructor() {}

  public static getInstance(): CapitalBuckets {
    if (!CapitalBuckets.instance) {
      CapitalBuckets.instance = new CapitalBuckets();
    }
    return CapitalBuckets.instance;
  }

  getAvailableForTier(tier: 'safe' | 'volatile' | 'degen', totalOpsReserveSol: number): number {
    const allocated = totalOpsReserveSol * this.allocation[`${tier}Pct`];
    const used = this[`${tier}Used`];
    return Math.max(0, allocated - used);
  }

  recordDeployment(tier: 'safe' | 'volatile' | 'degen', amountSol: number) {
    this[`${tier}Used`] += amountSol;
  }

  recordClosure(tier: 'safe' | 'volatile' | 'degen', amountSol: number) {
    this[`${tier}Used`] = Math.max(0, this[`${tier}Used`] - amountSol);
  }
}

export const capitalBuckets = CapitalBuckets.getInstance();
