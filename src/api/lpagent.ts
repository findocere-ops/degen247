import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../logger';

export interface PoolMetrics {
  tvl: number;
  volume24h: number;
  fees24h: number;
  [key: string]: any;
}

export interface PoolScoreResponse {
  score: number;
  metrics: PoolMetrics;
}

export interface WalletScoreResponse {
  score: number;
  winRate: number;
  pnl30d: number;
}

export class LPAgentClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.LPAGENT_API_BASE || 'https://api.lpagent.com/v1',
      headers: {
        'Authorization': `Bearer ${config.LPAGENT_API_KEY || ''}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
  }

  async getPoolScore(poolAddress: string): Promise<PoolScoreResponse | null> {
    if (config.dryRun && !config.LPAGENT_API_KEY) {
      return { score: 75, metrics: { tvl: 50000, volume24h: 100000, fees24h: 300 } };
    }

    try {
      const resp = await this.client.get(`/pool/score/${poolAddress}`);
      return resp.data as PoolScoreResponse;
    } catch (err: any) {
      logger.warn('LPAGENT', `Failed to get pool score for ${poolAddress}: ${err.message}`);
      return null;
    }
  }

  async getWalletScore(walletAddress: string): Promise<WalletScoreResponse | null> {
    if (config.dryRun && !config.LPAGENT_API_KEY) {
      return { score: 8.5, winRate: 65, pnl30d: 15.4 };
    }

    try {
      const resp = await this.client.get(`/wallet/score/${walletAddress}`);
      return resp.data as WalletScoreResponse;
    } catch (err: any) {
      logger.warn('LPAGENT', `Failed to get wallet score for ${walletAddress}: ${err.message}`);
      return null;
    }
  }
}
