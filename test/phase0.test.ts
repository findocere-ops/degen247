import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';

// Mock env vars before loading config
const mockKeypair = Keypair.generate();
process.env.WALLET_PRIVATE_KEY = bs58.encode(mockKeypair.secretKey);
process.env.SOLANA_RPC_URL = 'http://localhost:8899';
process.env.OPENROUTER_API_KEY = 'sk-test-key';

import { config } from '../src/config';
import { initDb, closeDb } from '../src/db/database';
import { loadWallet } from '../src/wallet';

describe('Phase 0 Core Infrastructure', () => {
    beforeAll(() => {
        // already set above
    });

    afterAll(() => {
        closeDb();
        // optionally remove test DB file
        const dbPath = path.resolve(process.cwd(), config.DB_PATH);
        if (fs.existsSync(dbPath)) {
            try { fs.unlinkSync(dbPath); } catch {}
        }
    });

    it('Config loads with valid environment values', () => {
        expect(config.DRY_RUN).toBeDefined();
        expect(config.WALLET_PRIVATE_KEY).toBeDefined();
        // Check Zod defaults applying to user config
        expect(config.autoScaleDeploy).toBe(true);
        expect(config.deployPercentage).toBe(0.35);
    });

    it('Database creates all 9 tables', () => {
        const db = initDb();
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[];
        const tableNames = tables.map(t => t.name);

        expect(tableNames).toContain('system_log');
        expect(tableNames).toContain('wallets');
        expect(tableNames).toContain('positions');
        expect(tableNames).toContain('portfolio');
        expect(tableNames).toContain('payouts');
        expect(tableNames).toContain('topups');
        expect(tableNames).toContain('pool_history');
        expect(tableNames).toContain('token_blacklist');
        expect(tableNames).toContain('agent_memory');
    });

    it('Wallet loads from base58 key', () => {
        const wallet = loadWallet();
        expect(wallet.publicKey).toBeDefined();
        expect(wallet.secretKey).toBeDefined();
    });

    it('Logger can write to SQLite', () => {
        const db = initDb();
        const { insertLog } = require('../src/db/database');
        insertLog('INFO', 'TEST', 'This is a test log');
        
        const row = db.prepare("SELECT * FROM system_log WHERE component = 'TEST'").get();
        expect(row).toBeDefined();
    });
});
