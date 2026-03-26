import { bootstrap } from '../src/index';
import cron from 'node-cron';
import { initDb, closeDb } from '../src/db/database';

jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));
jest.mock('../src/db/database');
jest.mock('../src/wallet', () => ({
  loadWallet: jest.fn().mockReturnValue({})
}));
jest.mock('../src/agents/healthCheck');

describe('Phase 10 - Integration Wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (initDb as jest.Mock).mockReturnValue({});
  });

  it('boots up the system and registers 5 cron jobs', async () => {
    await bootstrap();
    expect(cron.schedule).toHaveBeenCalledTimes(5);
  });
});
