import { initDb, closeDb } from '../src/db/database';
import { TelegramInterface } from '../src/telegram/bot';
import { state } from '../src/state';

describe('Phase 8 - Telegram Bot Interface', () => {
  let db: any;
  let tgBot: TelegramInterface;
  const mockToken = 'SECRET_TG_AUTH_123';
  const mockPriv = 'BASE58_SECRET';

  beforeAll(() => {
    db = initDb();
    tgBot = new TelegramInterface(db);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    state.positions.clear();
    state.walletBalanceSol = 5.0;
    state.paused = false;
  });

  afterAll(() => {
    closeDb();
  });

  it('routes /status accurately computing state values', async () => {
    const res = await tgBot.handleCommand('/status');
    expect(res).toContain('SYSTEM STATUS');
    expect(res).toContain('5.0000 SOL');
    expect(res).toContain('Open Positions: 0');
  });

  it('routes /pause updating systemic state variable', async () => {
    expect(state.paused).toBe(false);
    const res = await tgBot.handleCommand('/pause');
    expect(res).toContain('SUCCESS');
    expect(state.paused).toBe(true);
  });

  it('reports free-form echo on /exportkey as it is now disabled', async () => {
    const res = await tgBot.handleCommand('/exportkey WRONG');
    expect(res).toContain('OpenRouter Agent routed: Free-form echo');
  });

  it('fallback routes everything else via freeform echo LLM pipe natively', async () => {
    const res = await tgBot.handleCommand('What is the current meme meta?');
    expect(res).toContain('OpenRouter Agent routed: Free-form echo');
  });
});
