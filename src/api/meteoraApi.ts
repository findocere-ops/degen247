import axios, { AxiosInstance } from 'axios';
import { logger } from '../logger';

export interface MeteoraApiPool {
  address: string;
  name: string;
  mint_x: string;
  mint_y: string;
  liquidity: string;
  trade_volume_24h: number;
  fees_24h: number;
  bin_step: number;
}

export class MeteoraApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://app.meteora.ag/amm',
      timeout: 10000
    });
  }

  async getPoolsByFeeTvlRatio(minTvl: number, minRatio: number): Promise<MeteoraApiPool[]> {
    try {
      const resp = await this.client.get('/pools/dlmm');
      const pools = resp.data as MeteoraApiPool[];

      return pools
        .filter(p => {
          const tvl = parseFloat(p.liquidity || '0');
          if (tvl < minTvl) return false;
          const ratio = p.fees_24h / tvl;
          return ratio >= minRatio;
        })
        .sort((a, b) => {
          const rA = a.fees_24h / parseFloat(a.liquidity || '1');
          const rB = b.fees_24h / parseFloat(b.liquidity || '1');
          return rB - rA;
        });
    } catch (err: any) {
      logger.error('METEORA_API', `Failed to fetch DLMM pools: ${err.message}`);
      return [];
    }
  }
}
