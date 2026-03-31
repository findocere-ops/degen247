import { initDb, closeDb } from '../src/db/database';
import { PayoutManager } from '../src/owner/payoutManager';
import { TopupDetector } from '../src/owner/topupDetector';

import { generateMorningBriefing } from '../src/agents/briefing';
import { state } from '../src/state';
import { config } from '../src/config';
import { Connection } from '@solana/web3.js';

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
      const connection = new Connection('http://localhost:8899');
      const pm = new PayoutManager(db, connection, true);
      pm.distributeProfit(-1);
      
      const payoutDocs = db.prepare('SELECT * FROM payouts').all();
      expect(payoutDocs.length).toBe(0);
    });

    it('triggers execution when threshold is met', () => {
      const connection = new Connection('http://localhost:8899');
      const pm = new PayoutManager(db, connection, true);
      const testProfit = config.ownerPayoutThresholdSol / config.ownerPayoutPct; // Math ensures threshold hits
      
      pm.distributeProfit(testProfit); // Should trigger auto payout

      const payoutDocs = db.prepare("SELECT amount_sol FROM payouts WHERE tx_signature LIKE 'DRY_RUN_PAYOUT_%'").all();
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
