export interface ActivePosition {
  id: string;
  poolAddress: string;
}

export interface PositionRecord {
  id: string;
  poolAddress: string;
  amountSol: number;
  entryValue: number;
  status: 'open' | 'closed';
  openedAt: Date;
  closedAt?: Date;
  pnlSol?: number;
  feesSol?: number;
  exitReason?: string;
}

export interface ExitSignal {
  triggered: boolean;
  reason?: string;
  urgency?: 'normal' | 'high' | 'critical';
  signalType: string;
}

export enum StrategyType {
  Spot = 0,
  Curve = 1,
  BidAsk = 2
}
