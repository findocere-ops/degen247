import { hunterReActLoop } from '../src/agents/hunterAgent';
import { chatCompletion } from '../src/api/openrouter';
import { initDb, closeDb } from '../src/db/database';
import { state } from '../src/state';
import { Connection } from '@solana/web3.js';
import { MeteoraClient } from '../src/positions/meteoraClient';
import { config } from '../src/config';

jest.mock('../src/api/openrouter');
jest.mock('../src/positions/meteoraClient');
jest.mock('../src/pools/poolScanner', () => ({
  scanMeteoraPools: jest.fn().mockResolvedValue([
    { address: 'testPool123', tokenMint: 'TEST_TOKEN', score: 0 }
  ])
}));
jest.mock('../src/pools/poolScorer', () => ({
  scorePoolCandidate: jest.fn().mockResolvedValue({ composite: 85 })
}));

describe('Phase 4 - Hunter Agent ReAct Loop', () => {
  let db: any;
  let connection: Connection;
  let meteoraClient: MeteoraClient;

  beforeAll(() => {
    db = initDb();
    connection = new Connection('http://localhost:8899');
    meteoraClient = new MeteoraClient(connection, {} as any, true);
    (meteoraClient.openPosition as jest.Mock).mockResolvedValue({
      positionPubkey: 'pos123',
      txSignature: 'sig123'
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear state
    state.positions.clear();
    state.walletBalanceSol = 5.0; // enough to open
    state.paused = false;
    
    // Clear DB
    db.prepare('DELETE FROM positions').run();
    db.prepare('DELETE FROM agent_memory').run();
  });

  afterAll(() => {
    closeDb();
  });

  it('abort when canOpenPosition returns false', async () => {
    state.paused = true; // should block
    await hunterReActLoop(db, connection, meteoraClient);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it('executes execute_deployment tool call properly and saves to DB', async () => {
    (chatCompletion as jest.Mock).mockResolvedValue({
      tool_calls: [{
        function: {
          name: 'execute_deployment',
          arguments: '{"poolAddress": "testPool123", "strategyType": 0, "binWidth": 40, "lamports": 100000000}'
        }
      }]
    });

    await hunterReActLoop(db, connection, meteoraClient);

    expect(chatCompletion).toHaveBeenCalled();
    expect(meteoraClient.openPosition).toHaveBeenCalled();

    const row = db.prepare('SELECT * FROM positions WHERE id = ?').get('pos123');
    expect(row).toBeDefined();
    expect(row.pool_address).toBe('testPool123');
    expect(state.positions.has('pos123')).toBe(true);
  });

  it('handles reject_pool tool call by logging to memory', async () => {
    (chatCompletion as jest.Mock).mockResolvedValue({
      tool_calls: [{
        function: {
          name: 'reject_pool',
          arguments: '{"poolAddress": "testPool123", "reason": "Too volatile"}'
        }
      }]
    });

    await hunterReActLoop(db, connection, meteoraClient);

    const mem = db.prepare("SELECT * FROM agent_memory WHERE agent_role = 'hunter'").get();
    expect(mem.content).toContain('Too volatile');
    expect(meteoraClient.openPosition).not.toHaveBeenCalled(); // since it was rejected
  });
});
