export const MIGRATIONS = [
  // 1. system_log
  `CREATE TABLE IF NOT EXISTS system_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL,
    component TEXT NOT NULL,
    message TEXT NOT NULL
  );`,

  // 2. wallets
  `CREATE TABLE IF NOT EXISTS wallets (
    address TEXT PRIMARY KEY,
    score REAL DEFAULT 0,
    pnl_30d REAL DEFAULT 0,
    win_rate REAL DEFAULT 0,
    duration_hours REAL DEFAULT 0,
    fee_income REAL DEFAULT 0,
    active_days INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );`,

  // 3. positions
  `CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    pool_address TEXT NOT NULL,
    amount_sol REAL NOT NULL,
    entry_value REAL NOT NULL,
    status TEXT NOT NULL, -- 'open', 'closed'
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    pnl_sol REAL,
    fees_sol REAL,
    exit_reason TEXT
  );`,

  // 4. portfolio
  `CREATE TABLE IF NOT EXISTS portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_value_sol REAL NOT NULL,
    ops_reserve_sol REAL NOT NULL,
    active_capital_sol REAL NOT NULL,
    safety_buffer_sol REAL NOT NULL,
    owner_payout_reserve_sol REAL NOT NULL
  );`,

  // 5. payouts
  `CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_signature TEXT NOT NULL,
    amount_sol REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );`,

  // 6. topups
  `CREATE TABLE IF NOT EXISTS topups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount_sol REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );`,

  // 7. pool_history
  `CREATE TABLE IF NOT EXISTS pool_history (
    pool_address TEXT PRIMARY KEY,
    token_pair TEXT,
    total_deploys INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_pnl_sol REAL DEFAULT 0,
    avg_hold_minutes REAL,
    last_deployed INTEGER,
    last_exit_reason TEXT,
    blacklisted INTEGER DEFAULT 0
  );`,

  // 8. token_blacklist
  `CREATE TABLE IF NOT EXISTS token_blacklist (
    mint_address TEXT PRIMARY KEY,
    reason TEXT,
    blacklisted_at INTEGER,
    blacklisted_by TEXT DEFAULT 'owner'
  );`,

  // 9. agent_memory
  `CREATE TABLE IF NOT EXISTS agent_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_role TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    confidence REAL DEFAULT 0.5,
    pinned INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER
  );`,

  `CREATE INDEX IF NOT EXISTS idx_memory_role ON agent_memory(agent_role, pinned DESC, created_at DESC);`
];
