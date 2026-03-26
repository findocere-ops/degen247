import * as fs from 'fs';
import * as path from 'path';

jest.mock('../src/learning/metrics', () => ({
  calculateMetrics: jest.fn((db, key, val, isAbove) => {
    if (isAbove) return { totalPositions: 10, winRate: 0.8, avgPnlPct: 5, avgHoldHours: 1 };
    return { totalPositions: 10, winRate: 0.2, avgPnlPct: -5, avgHoldHours: 1 };
  }),
}));

import { initDb, closeDb } from '../src/db/database';
import { evolveThresholds } from '../src/learning/thresholdEvolution';

describe('Phase 7 - Learning & Threshold Evolution', () => {
  let db: any;
  const testConfigPath = path.join(__dirname, 'test-config.json');

  beforeAll(() => {
    db = initDb();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM positions').run();
    db.prepare('DELETE FROM agent_memory').run();
    
    // Create base config
    fs.writeFileSync(testConfigPath, JSON.stringify({
      minFeeActiveTvlRatio: 0.05,
      minOrganic: 65,
      minHolders: 500
    }));
  });

  afterAll(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    closeDb();
  });

  it('bypasses evolution if less than 5 closed positions exist', () => {
    for(let i=0; i<3; i++) {
        db.prepare('INSERT INTO positions (id, pool_address, amount_sol, entry_value, status) VALUES (?, ?, ?, ?, ?)').run(
            `pos_${i}`, 'pool', 1.0, 1.0, 'closed'
        );
    }
    evolveThresholds(db, testConfigPath);

    const conf = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
    expect(conf.minFeeActiveTvlRatio).toBe(0.05); // No change
  });


  it('evolves configuration and unpins stale memories when statistical variance is found', () => {
    // Override db to simulate enough positions constraint
    for(let i=0; i<6; i++) {
        db.prepare("INSERT INTO positions (id, pool_address, amount_sol, entry_value, status) VALUES (?, ?, ?, ?, 'closed')").run(
            `pos_extra_${i}`, 'pool', 1.0, 1.0
        );
    }
    
    // Insert a stale pinned memory
    db.prepare("INSERT INTO agent_memory (agent_role, content, pinned, created_at) VALUES ('shared', 'mock_lesson', 1, 100)").run();
    
    evolveThresholds(db, testConfigPath);

    const conf = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
    // Since above (0.8) > below (0.2) + 0.1, it should INCREASE targets by 10%
    expect(conf.minFeeActiveTvlRatio).toBeCloseTo(0.055, 3);
    
    // Check if memory was unpinned
    const mems = db.prepare("SELECT * FROM agent_memory WHERE pinned = 1").all();
    expect(mems.length).toBe(0);
  });
});
