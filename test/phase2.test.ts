import { LPAgentClient } from '../src/api/lpagent';
import { MeteoraApiClient } from '../src/api/meteoraApi';
import { MemoryManager } from '../src/learning/memoryManager';
import { TokenBlacklist } from '../src/pools/tokenBlacklist';
import { PoolMemory } from '../src/pools/poolMemory';
import { initDb, closeDb } from '../src/db/database';
import fs from 'fs';
import path from 'path';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/pool/score')) {
        return { data: { score: 85, metrics: { tvl: 10000 } } };
      }
      if (url.includes('/wallet/score')) {
        return { data: { score: 9.5, winRate: 75, pnl30d: 50.5 } };
      }
      if (url.includes('/pools/dlmm')) {
        return { data: [
          { address: 'poolA', liquidity: '150000', fees_24h: 3000 }, // 0.02 ratio
          { address: 'poolB', liquidity: '5000', fees_24h: 100 },    // Below tvl req
          { address: 'poolC', liquidity: '200000', fees_24h: 10000 } // 0.05 ratio
        ]};
      }
      throw new Error('Not found');
    })
  }))
}));

describe('Phase 2 - Data Feeds + Discovery + Memory', () => {
  let db: any;

  beforeAll(() => {
    db = initDb();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM agent_memory').run();
    db.prepare('DELETE FROM pool_history').run();
    db.prepare('DELETE FROM token_blacklist').run();
  });

  afterAll(() => {
    closeDb();
  });

  describe('LPAgentClient', () => {
    it('fetches pool score correctly', async () => {
      const client = new LPAgentClient();
      const res = await client.getPoolScore('testPool');
      expect(res?.score).toBe(85);
    });

    it('fetches wallet score correctly', async () => {
      const client = new LPAgentClient();
      const res = await client.getWalletScore('testWallet');
      expect(res?.score).toBe(9.5);
    });
  });

  describe('MeteoraApiClient', () => {
    it('filters and sorts pools by fee/tvl ratio', async () => {
      const client = new MeteoraApiClient();
      // minTvl = 100000, minRatio = 0.01
      const pools = await client.getPoolsByFeeTvlRatio(100000, 0.01);
      
      expect(pools.length).toBe(2);
      expect(pools[0].address).toBe('poolC'); // 0.05 ratio is first
      expect(pools[1].address).toBe('poolA'); // 0.02 ratio is second
    });
  });

  describe('MemoryManager', () => {
    it('adds and enforces limits perfectly', () => {
      const manager = new MemoryManager(db);
      
      // Add 20 hunter memories (limit 15)
      for (let i = 0; i < 20; i++) {
        manager.addMemory('hunter', 'content' + i, 'src', 0.5, 24);
      }

      const rows = db.prepare("SELECT count(*) as c FROM agent_memory WHERE agent_role = 'hunter' AND pinned = 0").get();
      expect(rows.c).toBe(15);
    });

    it('gets relevant memories via text matching', () => {
      const manager = new MemoryManager(db);
      manager.addMemory('healer', 'Look for rug pulls', 'sys', 0.9, 24);
      manager.addMemory('healer', 'Check the liquidity spread often', 'sys', 0.6, 24);
      
      const res = manager.getRelevantMemories('healer', ['rug']);
      expect(res.length).toBeGreaterThan(0);
      // The one with rug should be scored highest (if limits allow us to see ordering easily)
      expect(res[0].content).toContain('rug');
    });

    it('pins memories making them queryable globally if shared', () => {
      const manager = new MemoryManager(db);
      const id = manager.addMemory('shared', 'Shared wisdom', 'sys', 0.5, 24);
      manager.pinMemory(id);
      
      // Hunter can see pinned shared memories
      const res = manager.getRelevantMemories('hunter', []);
      expect(res.some(r => r.content === 'Shared wisdom' && r.pinned)).toBe(true);
    });
  });

  describe('TokenBlacklist', () => {
    it('adds, checks, and removes tokens', () => {
      const list = new TokenBlacklist(db);
      list.add('badMint123', 'rug');
      expect(list.isBlacklisted('badMint123')).toBe(true);
      expect(list.isBlacklisted('goodMint456')).toBe(false);

      list.remove('badMint123');
      expect(list.isBlacklisted('badMint123')).toBe(false);
    });
  });

  describe('PoolMemory', () => {
    it('records deploy and extracts stats successfully', () => {
      const pm = new PoolMemory(db);
      pm.recordDeploy('testPoolX', 'TOKEN/USDC');
      
      let state = pm.getPoolHistory('testPoolX');
      expect(state?.totalDeploys).toBe(1);

      pm.recordExit('testPoolX', 0.5, 120, 'TakeProfit');
      state = pm.getPoolHistory('testPoolX');
      
      expect(state?.totalPnlSol).toBe(0.5);
      expect(state?.wins).toBe(1);
      expect(state?.avgHoldMinutes).toBe(60); // Math: (0*1 + 120)/2 = 60
    });
  });
});
