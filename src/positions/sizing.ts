import { SystemState } from '../state';
import { Config } from '../config';

export function calculateDeployAmount(walletBalanceSol: number, config: Config): number {
  if (!config.autoScaleDeploy) {
    return config.deployAmountSol;
  }

  const deployable = Math.max(0, walletBalanceSol - config.solReserve);
  const targetDeploy = deployable * config.deployPercentage;

  const maxDeploy = walletBalanceSol * config.maxPositionAllocation;
  
  // Floor at 0.05 SOL, ceil at dynamic max allocation
  return Math.max(0.05, Math.min(targetDeploy, maxDeploy));
}

export function canOpenPosition(state: SystemState, config: Config, minSolToOpenFromPool?: number): { allowed: boolean; reason?: string } {
  if (state.paused) {
    return { allowed: false, reason: 'System is paused' };
  }

  if (state.positions.size >= config.maxPositions) {
    return { allowed: false, reason: `Max positions reached (${config.maxPositions})` };
  }

  const minRequired = minSolToOpenFromPool ?? config.minSolToOpen;
  if (state.walletBalanceSol < minRequired) {
    return { allowed: false, reason: `Wallet balance (${state.walletBalanceSol} SOL) below minimum (${minRequired} SOL)` };
  }

  if (state.safeModeUntil && state.safeModeUntil > new Date()) {
    return { allowed: false, reason: 'System is in safe mode cooldown' };
  }

  if (state.lastHunterCycle) {
    const minutesSinceOpen = (Date.now() - state.lastHunterCycle.getTime()) / (1000 * 60);
    // 10 minutes debounce check as specified (though handled implicitly by intervals usually)
    if (minutesSinceOpen < 10 && state.positions.size > 0) {
      return { allowed: false, reason: 'Less than 10 minutes since last deployment cycle' };
    }
  }

  return { allowed: true };
}
