export interface ActivePosition {
  id: string;
  poolAddress: string;
  // TODO: Add full types later
}

export interface SystemState {
  paused: boolean;
  positions: Map<string, ActivePosition>;
  walletBalanceSol: number;
  portfolioValue: number;
  highWaterMark: number;
  lastHunterCycle: Date | null;
  lastHealerCycle: Date | null;
  lastHealthCheck: Date | null;
  lastBriefing: Date | null;
  telegramChatId: string | null;
  safeModeUntil: Date | null;
  halfSizingUntil: Date | null;
}

export const state: SystemState = {
  paused: false,
  positions: new Map(),
  walletBalanceSol: 0,
  portfolioValue: 0,
  highWaterMark: 0,
  lastHunterCycle: null,
  lastHealerCycle: null,
  lastHealthCheck: null,
  lastBriefing: null,
  telegramChatId: null,
  safeModeUntil: null,
  halfSizingUntil: null,
};
