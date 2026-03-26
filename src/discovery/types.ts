export interface TopLPer {
  address: string;
  score: number;
}

export interface HistoricalPosition {
  id: string;
  poolAddress: string;
}

export interface PositionOverview {
  total: number;
  active: number;
}

export interface StrategyFingerprint {
  poolType: string;
  binWidth: number;
  holdDuration: number;
  preferredStrategy: number;
}

export interface CompositeStrategy {
  avgBinWidth: number;
  avgHoldDuration: number;
  recommendedStrategy: number;
}

export interface WalletScore {
  address: string;
  score: number;
}
