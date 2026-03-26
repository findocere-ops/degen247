import { PoolCandidate, PoolScore } from './types';
import { LPAgentClient } from '../api/lpagent';
import { TokenBlacklist } from './tokenBlacklist';
import { checkNarrative } from './narrativeChecker';
import { logger } from '../logger';

export async function scorePoolCandidate(
  candidate: PoolCandidate,
  tokenBlacklist: TokenBlacklist
): Promise<PoolScore> {
  const zeroScore: PoolScore = { composite: 0, feeScore: 0, volumeScore: 0, walletScore: 0 };

  if (tokenBlacklist.isBlacklisted(candidate.tokenMint)) {
    logger.debug('SCORER', `Rejected ${candidate.address}: Token blacklisted`);
    return zeroScore;
  }

  const lpAgent = new LPAgentClient();
  const poolMetrics = await lpAgent.getPoolScore(candidate.address);

  if (!poolMetrics) {
    logger.debug('SCORER', `Rejected ${candidate.address}: Missing LP metrics`);
    return zeroScore;
  }

  // Base score from LPAgent directly
  let composite = poolMetrics.score;
  const feeScore = Math.min(100, (poolMetrics.metrics.fees24h / poolMetrics.metrics.tvl) * 1000); // Exaggerated for scaling
  const volumeScore = Math.min(100, (poolMetrics.metrics.volume24h / poolMetrics.metrics.tvl) * 100);
  
  // Real-time Narrative LLM Adjustment
  const narrative = await checkNarrative(candidate.tokenMint);
  if (!narrative.hasRealCatalyst) {
    logger.debug('SCORER', `Narrative penalty for ${candidate.address}`);
    composite *= 0.7; // 30% penalty if no strong narrative/hyped
  } else {
    composite = Math.min(100, composite * 1.15); // 15% boost for good narrative
  }

  return {
    composite,
    feeScore,
    volumeScore,
    walletScore: 0 // Fetched separately downstream in Hunter
  };
}
