import { MeteoraApiClient } from '../api/meteoraApi';
import { PoolCandidate } from './types';
import { config } from '../config';
import { logger } from '../logger';

export async function scanMeteoraPools(limit: number = 50): Promise<PoolCandidate[]> {
  const client = new MeteoraApiClient();
  
  logger.info('SCANNER', `Scanning Meteora pools with min TVL $${config.minTvl} ratio: ${config.minFeeActiveTvlRatio}`);
  
  const rawPools = await client.getPoolsByFeeTvlRatio(
    config.minTvl,
    config.minFeeActiveTvlRatio
  );

  const candidates: PoolCandidate[] = rawPools.slice(0, limit).map(p => ({
    address: p.address,
    // Note: DLMM pairs have two mints, usually one is quote (USDC/SOL). 
    // We treat the other as the 'tokenMint' for narrative checking.
    tokenMint: [
      'So11111111111111111111111111111111111111112', // wSOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
    ].includes(p.mint_x) ? p.mint_y : p.mint_x,
    score: 0 // Will be populated by scorer
  }));

  logger.info('SCANNER', `Found ${candidates.length} initial candidates`);
  return candidates;
}
