import { initDb, closeDb } from '../src/db/database';
import { PayoutManager } from '../src/owner/payoutManager';
import { TopupDetector } from '../src/owner/topupDetector';
import { exportKeyAuthorized } from '../src/owner/keyExport';
import { generateMorningBriefing } from '../src/agents/briefing';
import { state } from '../src/state';
import { config } from '../src/config';

describe('Phase 6 - Owner & Briefing', () => {
  let db: any;

  beforeAll(() => {
    db = initDb();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    state.positions.clear();
    state.walletBalanceSol = 5.0;
    state.highWaterMark = 5.0;
    
    // Clear DB
    db.prepare('DELETE FROM payouts').run();
    db.prepare('DELETE FROM topups').run();
    db.prepare('DELETE FROM pool_history').run();
  });

  afterAll(() => {
    closeDb();
  });

  describe('PayoutManager', () => {
    it('distributes profit properly ignoring negative limits', () => {
      const pm = new PayoutManager(db);
      pm.distributeProfit(-1);
      
      const payoutDocs = db.prepare('SELECT * FROM payouts').all();
      expect(payoutDocs.length).toBe(0);
    });

    it('triggers execution when threshold is met', () => {
      const pm = new PayoutManager(db);
      const testProfit = config.ownerPayoutThresholdSol / config.ownerPayoutPct; // Math ensures threshold hits
      
      pm.distributeProfit(testProfit); // Should trigger auto payout

      const payoutDocs = db.prepare('SELECT * FROM payouts').all();
      expect(payoutDocs.length).toBe(1);
      expect(payoutDocs[0].amount_sol).toBeCloseTo(config.ownerPayoutThresholdSol, 2);
    });
  });

  describe('TopupDetector', () => {
    it('detects a jump over 0.001 SOL and logs a topup', () => {
      const detector = new TopupDetector(db);
      
      detector.checkBalance(10.0); // +5 jumps

      expect(state.highWaterMark).toBe(10.0);
      expect(state.walletBalanceSol).toBe(10.0);
      
      const topups = db.prepare('SELECT * FROM topups').all();
      expect(topups.length).toBe(1);
      expect(topups[0].amount_sol).toBe(5.0);
    });

    it('syncs balance implicitly if variance is minor', () => {
      const detector = new TopupDetector(db);
      
      detector.checkBalance(4.99); // -0.01 gas burn

      expect(state.highWaterMark).toBe(5.0); // Shouldn't change
      expect(state.walletBalanceSol).toBe(4.99);
      
      const topups = db.prepare('SELECT * FROM topups').all();
      expect(topups.length).toBe(0);
    });
  });

  describe('KeyExport', () => {
    it('returns valid key on matching token', () => {
      const stored = 'TEST_TOKEN_123';
      const input = 'TEST_TOKEN_123';
      const key = 'PRIVATE_BASE58_KEY';
      
      const result = exportKeyAuthorized(input, stored, key);
      expect(result).toBe(key);
    });

    it('returns null on invalid length token mismatch', () => {
      const stored = 'TEST_TOKEN_123';
      const input = 'WRONG';
      const key = 'PRIVATE_BASE58_KEY';
      
      const result = exportKeyAuthorized(input, stored, key);
      expect(result).toBeNull();
    });

    it('returns null on exact length mismatch', () => {
      const stored = 'TEST_TOKEN_123';
      const input = 'TEST_T0KEN_123';
      const key = 'PRIVATE_BASE58_KEY';
      
      const result = exportKeyAuthorized(input, stored, key);
      expect(result).toBeNull();
    });
  });

  describe('Morning Briefing', () => {
    it('generates a formatted briefing payload', () => {
      db.prepare('INSERT INTO pool_history (pool_address, total_pnl_sol) VALUES (?, ?)').run('addressX', 0.5);
      
      const result = generateMorningBriefing(db);
      expect(result).toContain('Portfolio: 5.00 SOL');
      expect(result).toContain('Open Positions: 0');
      expect(result).toContain('addressX');
    });
  });
});
