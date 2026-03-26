import { scanMeteoraPools } from '../src/pools/poolScanner';
import { scorePoolCandidate } from '../src/pools/poolScorer';
import { checkNarrative } from '../src/pools/narrativeChecker';
import { capitalBuckets } from '../src/risk/capitalBuckets';
import { TokenBlacklist } from '../src/pools/tokenBlacklist';
import { initDb, closeDb } from '../src/db/database';

jest.mock('../src/api/meteoraApi', () => {
  return {
    MeteoraApiClient: jest.fn().mockImplementation(() => ({
      getPoolsByFeeTvlRatio: jest.fn().mockResolvedValue([
        { address: 'pool1', mint_x: 'So11111111111111111111111111111111111111112', mint_y: 'TOKEN_A', liquidity: '500000', fees_24h: 5000 },
        { address: 'pool2', mint_x: 'TOKEN_B', mint_y: 'USDC', liquidity: '200000', fees_24h: 1000 }
      ])
    }))
  };
});

jest.mock('../src/api/lpagent', () => {
  return {
    LPAgentClient: jest.fn().mockImplementation(() => ({
      getPoolScore: jest.fn().mockResolvedValue({
        score: 80,
        metrics: { tvl: 500000, volume24h: 200000, fees24h: 5000 }
      })
    }))
  };
});

describe('Phase 3 - Pool Scanner + Pre-Filter', () => {
  let db: any;

  beforeAll(() => {
    process.env.DRY_RUN = 'true';
    db = initDb();
  });

  afterAll(() => {
    closeDb();
  });

  describe('poolScanner', () => {
    it('scans and returns pool candidates with tokenMints extracted', async () => {
      const pools = await scanMeteoraPools(10);
      expect(pools.length).toBe(2);
      expect(pools[0].address).toBe('pool1');
      // Should pick TOKEN_A since SOL is known
      expect(pools[0].tokenMint).toBe('TOKEN_A');
    });
  });

  describe('poolScorer', () => {
    it('returns zero score if blacklisted', async () => {
      const tb = new TokenBlacklist(db);
      tb.add('BAD_TOKEN', 'rug');

      const score = await scorePoolCandidate({ address: 'x', tokenMint: 'BAD_TOKEN', score: 0 }, tb);
      expect(score.composite).toBe(0);
    });

    it('returns a calculated composite score with narrative adjustments', async () => {
      const tb = new TokenBlacklist(db);
      
      // Since dryRun = true, narrativeChecker.ts returns true (15% boost)
      // Base score is 80 (from mock) -> 80 * 1.15 = 92
      const score = await scorePoolCandidate({ address: 'pool1', tokenMint: 'TOKEN_A', score: 0 }, tb);
      expect(score.composite).toBeCloseTo(92, 0);
      expect(score.feeScore).toBeGreaterThan(0);
    });
  });

  describe('narrativeChecker', () => {
    it('returns fallback data during dry run without LLM calls', async () => {
      const n = await checkNarrative('SOME_MINT_123');
      expect(n.hasRealCatalyst).toBe(true);
      expect(n.name).toBe('SOME_MIN');
    });
  });

  describe('capitalBuckets', () => {
    it('manages allocations per risk tier correctly', () => {
      // 50% safe, 30% vol, 20% degen
      const totalOps = 10; // 10 SOL
      const safeAvail = capitalBuckets.getAvailableForTier('safe', totalOps); // 5
      expect(safeAvail).toBe(5);

      capitalBuckets.recordDeployment('safe', 2);
      expect(capitalBuckets.getAvailableForTier('safe', totalOps)).toBe(3);

      capitalBuckets.recordClosure('safe', 1.5);
      expect(capitalBuckets.getAvailableForTier('safe', totalOps)).toBe(4.5);
    });
  });
});
