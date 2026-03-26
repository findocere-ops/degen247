export interface PoolCandidate {
  address: string;
  tokenMint: string;
  score: number;
}

export interface PoolScore {
  composite: number;
  feeScore: number;
  volumeScore: number;
  walletScore: number;
}

export interface PoolHistoryRecord {
  poolAddress: string;
  tokenPair: string;
  totalDeploys: number;
  wins: number;
  losses: number;
  totalPnlSol: number;
  avgHoldMinutes: number;
  lastDeployed: number;
  lastExitReason: string;
  blacklisted: boolean;
}

export interface BlacklistedToken {
  mintAddress: string;
  reason: string;
  blacklistedAt: number;
  blacklistedBy: string;
}

export interface ScreeningThresholds {
  minFeeActiveTvlRatio: number;
  minTvl: number;
  maxTvl: number;
  minOrganic: number;
  minHolders: number;
  minGlobalFeesSol: number;
}

export interface TokenNarrative {
  mint: string;
  name: string;
  description: string;
  hasRealCatalyst: boolean;
  summary: string;
}
