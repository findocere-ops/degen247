# DEGEN247 — Claude Code Instruction

> Autonomous Meteora DLMM liquidity agent on Solana.
> Architecture: Meridian v2 dual-agent ReAct pattern.
> SDK: `@meteora-ag/dlmm` direct execution, LP Agent read-only data.
> Target: Lenovo Yoga 7i 2022 headless, <200MB RAM, 24/7 via PM2.

---

## ROUTING MAP

Read this section first. It tells you WHERE everything lives and WHEN to go there.

```
degen247/
├── CLAUDE.md                          ← YOU ARE HERE. Master instruction.
│
├── workflows/                         ← All agent behavior organized by workflow
│   ├── 01-screening/                  ← Hunter Agent: find pools, deploy capital
│   │   ├── WORKFLOW.md                ← Workflow spec, entry/exit conditions
│   │   ├── tasks/
│   │   │   ├── scan-pools/
│   │   │   │   ├── TASK.md            ← What this task does
│   │   │   │   ├── prompt.md          ← Hunter system prompt template
│   │   │   │   ├── tools.md           ← Tools available: screen_pools, get_token_narrative, check_global_fees
│   │   │   │   └── data.md            ← Data shapes: PoolCandidate, ScreeningThresholds
│   │   │   ├── evaluate-candidate/
│   │   │   │   ├── TASK.md
│   │   │   │   ├── prompt.md          ← Evaluation reasoning prompt
│   │   │   │   ├── tools.md           ← Tools: get_pool_history, get_token_narrative, get_composite_strategy
│   │   │   │   └── data.md            ← Data: PoolHistory, TokenNarrative, BlacklistCheck
│   │   │   └── deploy-position/
│   │   │       ├── TASK.md
│   │   │       ├── prompt.md          ← Deployment decision prompt
│   │   │       ├── tools.md           ← Tools: deploy_position, calculate_deploy_amount
│   │   │       └── data.md            ← Data: OpenPositionParams, Meteora SDK calls
│   │   └── memory/
│   │       └── MEMORY.md              ← Hunter memory spec (15 slots + 5 shared pins)
│   │
│   ├── 02-management/                 ← Healer Agent: manage positions, exit/redeploy
│   │   ├── WORKFLOW.md
│   │   ├── tasks/
│   │   │   ├── evaluate-position/
│   │   │   │   ├── TASK.md
│   │   │   │   ├── prompt.md          ← Healer system prompt template
│   │   │   │   ├── tools.md           ← Tools: get_position_health, get_active_bin
│   │   │   │   └── data.md            ← Data: PositionHealth, ExitSignals
│   │   │   ├── close-position/
│   │   │   │   ├── TASK.md
│   │   │   │   ├── tools.md           ← Tools: close_position (removeLiquidity SDK call)
│   │   │   │   └── data.md            ← Data: CloseParams, ProfitDistribution
│   │   │   └── redeploy-position/
│   │   │       ├── TASK.md
│   │   │       ├── tools.md           ← Tools: close_position → deploy_position chain
│   │   │       └── data.md
│   │   └── memory/
│   │       └── MEMORY.md              ← Healer memory spec (15 slots + 5 shared pins)
│   │
│   ├── 03-learning/                   ← Study top LPers, evolve thresholds, manage memory
│   │   ├── WORKFLOW.md
│   │   ├── tasks/
│   │   │   ├── study-top-lpers/
│   │   │   │   ├── TASK.md
│   │   │   │   ├── prompt.md
│   │   │   │   ├── tools.md           ← Tools: study_top_lpers, get_top_lpers
│   │   │   │   └── data.md            ← Data: LPerStudy, Lesson, StrategyFingerprint
│   │   │   ├── evolve-thresholds/
│   │   │   │   ├── TASK.md
│   │   │   │   ├── tools.md           ← Tools: get_performance_history, write_config
│   │   │   │   └── data.md            ← Data: EvolutionResult, ThresholdChange
│   │   │   └── manage-memory/
│   │   │       ├── TASK.md
│   │   │       ├── tools.md           ← Tools: pin_memory, unpin_memory, prune_memory
│   │   │       └── data.md            ← Data: MemorySlot, MemoryStore
│   │   └── memory/
│   │       └── SHARED_LESSONS.md      ← Shared pinned lessons spec (5 slots)
│   │
│   ├── 04-risk/                       ← Portfolio protection, emergency close, safe mode
│   │   ├── WORKFLOW.md
│   │   ├── tasks/
│   │   │   ├── health-check/
│   │   │   │   ├── TASK.md
│   │   │   │   ├── tools.md           ← Tools: get_wallet_balance, get_portfolio_snapshot
│   │   │   │   └── data.md            ← Data: PortfolioHealth, CapitalBuckets
│   │   │   ├── emergency-close/
│   │   │   │   ├── TASK.md
│   │   │   │   └── tools.md           ← Tools: close_all_positions
│   │   │   └── safe-mode/
│   │   │       ├── TASK.md
│   │   │       └── data.md            ← Data: SafeModeState, ResumeConditions
│   │   └── blacklist/
│   │       ├── TASK.md
│   │       ├── tools.md               ← Tools: blacklist_token, unblacklist_token
│   │       └── data.md                ← Data: TokenBlacklist, AutoBlacklistRules
│   │
│   ├── 05-owner/                      ← Owner-facing: payouts, top-ups, key export
│   │   ├── WORKFLOW.md
│   │   ├── tasks/
│   │   │   ├── payout/
│   │   │   │   ├── TASK.md
│   │   │   │   └── tools.md
│   │   │   ├── topup-detection/
│   │   │   │   ├── TASK.md
│   │   │   │   └── data.md
│   │   │   └── key-export/
│   │   │       ├── TASK.md
│   │   │       └── tools.md
│   │   └── briefing/
│   │       ├── TASK.md                ← Morning briefing + 6hr watchdog
│   │       └── prompt.md
│   │
│   └── 06-interface/                  ← Telegram bot, reporting, free-form chat
│       ├── WORKFLOW.md
│       ├── tasks/
│       │   ├── telegram-commands/
│       │   │   ├── TASK.md
│       │   │   └── data.md            ← All command definitions + responses
│       │   ├── cycle-reports/
│       │   │   ├── TASK.md
│       │   │   └── prompt.md          ← Report formatting templates
│       │   └── free-form-chat/
│       │       ├── TASK.md
│       │       └── prompt.md          ← General chat system prompt
│       └── formatters/
│           └── FORMATTERS.md          ← Emoji tags, message templates
│
│   └── 07-upstream-sync/              ← Track Meridian repo, generate update plans
│       ├── WORKFLOW.md
│       ├── tasks/
│       │   ├── fetch-upstream/
│       │   │   ├── TASK.md
│       │   │   ├── tools.md           ← Tools: fetch_github_repo, diff_against_snapshot
│       │   │   └── data.md            ← Data: UpstreamSnapshot, FileDiff
│       │   ├── analyze-changes/
│       │   │   ├── TASK.md
│       │   │   ├── prompt.md          ← LLM analysis prompt
│       │   │   └── data.md            ← Data: ChangeAnalysis, AdoptionRecommendation
│       │   └── generate-update-plan/
│       │       ├── TASK.md
│       │       ├── prompt.md          ← Plan generation prompt
│       │       └── data.md            ← Data: UpdatePlan with vibecode prompts
│       └── snapshots/
│           └── SNAPSHOT.md            ← Last known Meridian state
│
├── sdk/                               ← Execution layer (Meteora + Solana)
│   ├── METEORA.md                     ← All @meteora-ag/dlmm SDK call specs
│   ├── SOLANA.md                      ← RPC, transaction, wallet specs
│   └── SIZING.md                      ← Auto-scaling deploy formula
│
├── data/                              ← Persistence layer
│   ├── SCHEMA.md                      ← All SQLite table definitions
│   └── CONFIG.md                      ← user-config.json spec + defaults
│
└── infra/                             ← Deployment + operations
    ├── DEPLOY.md                      ← Yoga 7i setup, PM2, systemd
    └── ENV.md                         ← Environment variables spec
```

**ROUTING RULES — how the agent decides which workflow to enter:**

| Trigger | Workflow | Entry Point |
|---------|----------|-------------|
| Cron: every `screeningIntervalMin` min | `01-screening` | `WORKFLOW.md → scan-pools → evaluate → deploy` |
| Cron: every `managementIntervalMin` min | `02-management` | `WORKFLOW.md → evaluate-position → STAY/CLOSE/REDEPLOY` |
| Cron: daily at midnight | `03-learning` | `WORKFLOW.md → study-top-lpers → evolve-thresholds` |
| Cron: every 1 hour | `04-risk` | `WORKFLOW.md → health-check` |
| Cron: daily 8:00 AM / startup watchdog | `05-owner` | `briefing/TASK.md` |
| Telegram message received | `06-interface` | `WORKFLOW.md → route to command or free-form` |
| Drawdown > 10% | `04-risk` | `emergency-close/TASK.md` |
| Position loss > 90% | `04-risk` | `blacklist/TASK.md → auto-blacklist` |
| Cron: Monday 06:00 / `/sync` command | `07-upstream-sync` | `WORKFLOW.md → fetch → analyze → plan` |

---

## ABSTRACTION LAYERS

The system has 4 layers. Each layer only talks to its adjacent layers.

```
┌─────────────────────────────────────────────┐
│  LAYER 4: INTERFACE                         │
│  Telegram, REPL, reports, free-form chat    │
│  Files: workflows/06-interface/             │
├─────────────────────────────────────────────┤
│  LAYER 3: DECISION (LLM ReAct)             │
│  Hunter Agent, Healer Agent, Learning       │
│  Files: workflows/01-screening/             │
│         workflows/02-management/            │
│         workflows/03-learning/              │
│  Each agent has: prompt, tools, memory      │
│  Agent reasons → calls tools → acts         │
├─────────────────────────────────────────────┤
│  LAYER 2: EXECUTION + RISK                  │
│  Meteora SDK, Solana RPC, risk engine       │
│  Files: sdk/METEORA.md, sdk/SOLANA.md       │
│         workflows/04-risk/                  │
│         workflows/05-owner/                 │
│  Pure functions: no LLM, deterministic      │
├─────────────────────────────────────────────┤
│  LAYER 1: DATA + PERSISTENCE               │
│  SQLite, config, memory stores, blacklist   │
│  Files: data/SCHEMA.md, data/CONFIG.md      │
│  Source of truth for all state              │
└─────────────────────────────────────────────┘
```

**Rules:**
- Layer 4 never calls Layer 1 directly — always through Layer 2 or 3
- Layer 3 (LLM) never writes to Layer 1 directly — always through tools in Layer 2
- Layer 2 is stateless functions — no LLM calls, no memory, pure execution
- Layer 1 is the only place where state is persisted

---

## WORKFLOW 01: SCREENING (Hunter Agent)

**File: `workflows/01-screening/WORKFLOW.md`**

**Trigger:** Cron every `screeningIntervalMin` (default 30 min)
**Agent:** Hunter | **Model:** `screeningModel` config key
**Memory:** 15 dedicated Hunter slots + 5 shared pinned lessons

### Task 1: Scan Pools

**Pre-filter pipeline** (deterministic, no LLM):
1. Fetch all pools from `https://dlmm.datapi.meteora.ag/pair/all`
2. REMOVE pools containing tokens in `token_blacklist` table
3. REMOVE pools where `global_fees_sol < minGlobalFeesSol` (default 30 SOL) — below this means bundled/fake txs, likely scam
4. REMOVE pools with `pool_history.win_rate < 30%` over 3+ deploys — bad track record
5. APPLY threshold filters: minFeeActiveTvlRatio, minTvl, maxTvl, minOrganic, minHolders, binStep bounds
6. SCORE remaining pools: feeAprScore×0.4 + volumeConsistencyScore×0.3 + topWalletPresenceScore×0.3
7. BOOST +10 points for pools with positive pool_history
8. FILTER compositeScore < 65
9. RETURN top 10 candidates

**Tools available:**
- `screen_pools` → runs the pipeline above, returns `PoolCandidate[]`
- `get_wallet_balance` → current SOL balance
- `get_open_positions` → count and details of open positions
- `check_global_fees(token_mint)` → total priority+Jito fees in SOL for the token
- `get_pool_history(pool_address)` → past deployments, wins, losses, PnL

### Task 2: Evaluate Candidate

**LLM ReAct step** — Hunter reasons about top candidates:

**Tools available:**
- `get_token_narrative(token_mint)` → fetches token metadata, social signals, on-chain story. LLM evaluates: real catalyst or generic hype? No narrative = skip.
- `get_composite_strategy` → weighted strategy from top wallets (bin width, strategy type, hold time)
- `get_pool_history(pool_address)` → past experience with this specific pool

### Task 3: Deploy Position

**Decision:** DEPLOY or SKIP

**If DEPLOY:**
1. Calculate deploy amount via auto-scaling formula (see `sdk/SIZING.md`)
2. Get active bin via `dlmmPool.getActiveBin()`
3. Set bin range from composite strategy centered on active bin
4. Select StrategyType (Spot/Curve/BidAsk) from composite strategy
5. Execute via `initializePositionAndAddLiquidityByStrategy` (see `sdk/METEORA.md`)
6. Record in `pool_history` table
7. Store Hunter memory: "Deployed into {pair} at bins {range}, reasoning: {why}"

**Tools available:**
- `calculate_deploy_amount` → `(walletBalance - 0.2) × 0.35`, capped at maxPositionAllocation
- `deploy_position(poolAddress, amountSol, minBin, maxBin, strategyType)` → Meteora SDK call

### Hunter System Prompt Template

```
You are Hunter, the pool screening agent for Degen247.

YOUR JOB: Find the single best DLMM pool to deploy capital into RIGHT NOW.

CURRENT STATE:
- Wallet: {balance} SOL | Deploy amount: {deployAmount} SOL (auto-scaled)
- Open positions: {count}/{maxPositions}
- Mode: {DRY_RUN ? "DRY RUN" : "LIVE"}

YOUR MEMORY (Hunter-specific):
{hunterMemorySlots}

SHARED LESSONS (pinned):
{sharedPinnedLessons}

SCREENING THRESHOLDS:
{thresholds}

PROCESS:
1. Call screen_pools → get pre-filtered candidates
2. Call get_wallet_balance → verify you have enough SOL
3. For top 3 candidates: call get_token_narrative → evaluate the story
4. For top 3 candidates: call get_pool_history → check past experience
5. Decide: DEPLOY into the best pool, or SKIP this cycle
6. If deploying: call calculate_deploy_amount → call deploy_position

HARD RULES:
- NEVER deploy if balance < {minSolToOpen} SOL
- NEVER deploy if positions >= {maxPositions}
- NEVER deploy into a pool with no token narrative (generic hype = skip)
- NEVER deploy into a pool with global_fees_sol < {minGlobalFeesSol} SOL
- Skip pools with bad pool_history (win rate < 30% over 3+ deploys)
- If no pool meets your standards, SKIP. Never force a deployment.
```

---

## WORKFLOW 02: MANAGEMENT (Healer Agent)

**File: `workflows/02-management/WORKFLOW.md`**

**Trigger:** Cron every `managementIntervalMin` (default 10 min)
**Agent:** Healer | **Model:** `managementModel` config key
**Memory:** 15 dedicated Healer slots + 5 shared pinned lessons

### Task 1: Evaluate Position

For EACH open position, gather:
- Current active bin vs position bin range → in-range?
- Unclaimed fees vs deployed capital → fee take-profit %
- Current value vs entry value → PnL %
- Time since open, IL estimate

**Exit signals** (deterministic checks, feed results to LLM):

| Signal | Trigger Condition | Urgency |
|--------|------------------|---------|
| Fee take-profit | fees/deployed >= `takeProfitFeePct`% | normal |
| Stop-loss | (entry-current)/entry >= `stopLossPct`% | critical |
| IL exceeds fees | IL > fees × 2 (1hr rolling) | high |
| Out of range | !inRange for > `outOfRangeWaitMinutes` | high |
| Copied wallet closed | tracked wallet exited | normal |
| Volume decay | volume24h < volume7dAvg × 0.5 | normal |

**Tools available:**
- `get_position_health(positionId)` → all metrics above + triggered signals
- `get_active_bin(poolAddress)` → current bin for range check

### Task 2: Decision — STAY / CLOSE / REDEPLOY

LLM reasons about each position using metrics + exit signals + memory.

**STAY:** Position healthy. Log reasoning to Healer memory.
**CLOSE:** Execute `close_position`. Distribute profit. Update `pool_history`. Auto-blacklist if loss > 90%.
**REDEPLOY:** Close current → open new at updated bin range. Same pool, fresh range.

**Tools available:**
- `close_position(positionId, reason)` → `removeLiquidity({ shouldClaimAndClose: true })` 
- `redeploy_position(positionId, newMinBin, newMaxBin)` → close then deploy
- `claim_fees(positionId)` → claim without closing

### Healer System Prompt Template

```
You are Healer, the position management agent for Degen247.

YOUR JOB: Evaluate each open position. Decide: STAY, CLOSE, or REDEPLOY.

CURRENT POSITIONS:
{for each position:
  #{id}: {pair} | Bins {min}-{max} | {strategyType}
  Entry: {entryValue} SOL at {entryTime} ({holdMinutes} min ago)
  Value: {currentValue} SOL | PnL: {pnl}%
  Fees: {fees} SOL ({feesPct}% of deployed) ← take-profit at {takeProfitFeePct}%
  Range: {inRange ? "IN RANGE" : "OUT OF RANGE for {outMinutes} min"}
  EXIT SIGNALS: {triggeredSignals or "none"}
}

YOUR MEMORY (Healer-specific):
{healerMemorySlots}

SHARED LESSONS (pinned):
{sharedPinnedLessons}

RULES:
- Fee take-profit reached → usually CLOSE to lock profits
- Stop-loss breached → ALWAYS CLOSE immediately
- Out-of-range is NOT auto-close — consider if fees are still accruing
- REDEPLOY only if pool fundamentals are still strong
- Explain your reasoning for EVERY position
```

---

## WORKFLOW 03: LEARNING

**File: `workflows/03-learning/WORKFLOW.md`**

**Trigger:** Daily at midnight (LP Agent refresh) + manual via `/learn` and `/evolve`

### Task 1: Study Top LPers

1. Call LP Agent `study_top_lpers` on top 5 candidate pools
2. Analyze: hold duration, entry/exit timing, bin width, strategy type, win rates
3. Generate 4-8 actionable lessons
4. Cross-pool patterns → auto-pin (confidence 0.8+)
5. Single-pool patterns → store unpinned (confidence 0.5)
6. Save to `agent_memory` table as `role='shared'`

### Task 2: Evolve Thresholds

**Requires:** 5+ closed positions in `positions` table.

1. Query closed positions, group by pool characteristics
2. For each threshold: compare win rates above vs below current value
3. If better win rate at higher threshold → increase 10%
4. If better win rate at lower threshold → decrease 10%
5. Write to `user-config.json` (hot-reload, no restart)
6. Unpin stale lessons that contradict new thresholds
7. Max 1 evolution per day

### Task 3: Manage Memory

**Memory architecture** (Meridian v2):

| Store | Slots | Owner | Eviction |
|-------|-------|-------|----------|
| Hunter Memory | 15 | Hunter Agent | FIFO on unpinned |
| Healer Memory | 15 | Healer Agent | FIFO on unpinned |
| Shared Pinned | 5 | Both agents | Never (until manually unpinned or stale) |
| **Total** | **35** | | |

**Pinning:** Critical lessons get pinned → never evicted. Owner can `/pin` and `/unpin`. Threshold evolution auto-unpins stale lessons.

**Injection:** Hunter only sees Hunter memory + shared pins. Healer only sees Healer memory + shared pins. Neither sees the other's memory.

**SQLite table `agent_memory`:**
```sql
CREATE TABLE agent_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_role TEXT NOT NULL,  -- 'hunter' | 'healer' | 'shared'
  content TEXT NOT NULL,
  source TEXT,               -- 'study_lpers' | 'position_close' | 'manual' | 'evolution'
  confidence REAL DEFAULT 0.5,
  pinned INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER          -- NULL = never expires
);
CREATE INDEX idx_memory_role ON agent_memory(agent_role, pinned DESC, created_at DESC);
```

---

## WORKFLOW 04: RISK

**File: `workflows/04-risk/WORKFLOW.md`**

### Task 1: Health Check (hourly)

1. Get wallet SOL balance
2. Sum all open position values
3. Compare total vs high-water mark
4. If total < 90% HWM → trigger emergency close
5. If total < 95% HWM → log drawdown warning
6. Check for owner top-ups (balance > expected)
7. Check owner payout threshold
8. Log portfolio snapshot to `portfolio` table

### Task 2: Emergency Close

Trigger: drawdown > 10% OR `/emergency` command.
1. For each open position: `removeLiquidity({ shouldClaimAndClose: true })`
2. Enter safe mode
3. Send Telegram alert

### Task 3: Safe Mode

1. Pause Hunter for 1 hour
2. After resume: half deploy percentage for 24 hours
3. Auto-resume via setTimeout

### Task 4: Token Blacklist

**SQLite table `token_blacklist`:**
```sql
CREATE TABLE token_blacklist (
  mint_address TEXT PRIMARY KEY,
  reason TEXT,
  blacklisted_at INTEGER,
  blacklisted_by TEXT DEFAULT 'owner'  -- 'owner' | 'auto'
);
```

**Auto-blacklist:** If position close results in >90% loss, auto-blacklist the token with reason `"auto: catastrophic loss"`.

**Manual:** `/blacklist <mint> <reason>` via Telegram.

**Effect:** Blacklisted tokens are filtered out in `01-screening` pre-filter step. The LLM never sees these pools.

### Task 5: Pool Memory

**SQLite table `pool_history`:**
```sql
CREATE TABLE pool_history (
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
);
```

**Updated on every position close.** Hunter checks before deploying: skip if win rate < 30% over 3+ deploys.

---

## WORKFLOW 05: OWNER

**File: `workflows/05-owner/WORKFLOW.md`**

### Task 1: Payout

Capital buckets: ops 5%, active 75%, safety 10%, owner payout 10%.

Profit distribution on every profitable close:
1. Replenish ops reserve (if below 5% target)
2. Owner payout: `ownerPayoutPct` (default 20%) of remaining → owner payout reserve
3. Rest → active capital for compounding

Auto-payout when reserve >= `ownerPayoutThresholdSol`. Manual via `/withdraw`.

### Task 2: Top-Up Detection

Hourly during health check:
- If wallet balance > expected by > 0.001 SOL → classify as owner top-up
- Credit to active capital, recalculate high-water mark
- Log in `topups` table, notify via Telegram

### Task 3: Key Export

`/exportkey <AUTH_TOKEN>` → returns base58 private key as ephemeral Telegram message, auto-deleted after 60 seconds. Uses `crypto.timingSafeEqual` for token comparison. Key is NEVER logged.

### Task 4: Morning Briefing

**Schedule:** Daily at 08:00 Jakarta (Asia/Jakarta).
**Watchdog:** If agent restarts and missed the 08:00 window, fire on startup if current time is before 14:00 (within 6 hours). Beyond 14:00, skip until next morning.

**Content:**
- Portfolio value + overnight change
- Open positions status (in-range, fees accumulated)
- Capital bucket breakdown
- Top 3 pool candidates preview
- Lessons summary (pinned + recent)

**Trigger:** Also via `/briefing` Telegram command.

---

## WORKFLOW 06: INTERFACE (Telegram)

**File: `workflows/06-interface/WORKFLOW.md`**

### Command Reference

| Command | Workflow Routed To | Description |
|---------|-------------------|-------------|
| `/status` | 02-management | Wallet balance + open positions |
| `/report` | 03-learning | Last 24h summary |
| `/history [24h\|7d\|N]` | 03-learning | Closed positions with PnL |
| `/briefing` | 05-owner | Morning briefing on demand |
| `/candidates` | 01-screening | Re-screen pools, show top 5 |
| `/learn [pool]` | 03-learning | Study top LPers, save lessons |
| `/memory` | 03-learning | Show memory slot usage |
| `/pin <id>` | 03-learning | Pin a lesson |
| `/unpin <id>` | 03-learning | Unpin a lesson |
| `/thresholds` | 03-learning | Current thresholds + performance |
| `/evolve` | 03-learning | Force threshold evolution |
| `/blacklist <mint> [reason]` | 04-risk | Blacklist token permanently |
| `/unblacklist <mint>` | 04-risk | Remove from blacklist |
| `/blacklisted` | 04-risk | Show all blacklisted tokens |
| `/poolhistory [pool]` | 04-risk | Pool deployment history |
| `/balance` | 05-owner | Capital bucket breakdown |
| `/withdraw` | 05-owner | Trigger manual payout |
| `/topups` | 05-owner | Show owner top-up history |
| `/exportkey <token>` | 05-owner | Export private key (ephemeral) |
| `/pause` | 04-risk | Halt Hunter, Healer still runs |
| `/resume` | 04-risk | Resume Hunter |
| `/emergency` | 04-risk | Close all positions NOW |
| `/stop` | infra | Graceful shutdown |
| `/sync` | 07-upstream-sync | Trigger Meridian repo sync now |
| `/syncstatus` | 07-upstream-sync | Last sync date, commits behind |
| `/syncplan` | 07-upstream-sync | Latest update plan summary |
| `<anything else>` | 06-interface | Free-form chat with agent |

### Cycle Reports (automatic)

After every Hunter cycle → formatted report to Telegram.
After every Healer cycle → formatted report with per-position reasoning.

### Emoji Convention

```
🟢 position opened    🔴 position closed     🔄 redeployed
💰 payout sent        📥 top-up detected     🚨 emergency
⏸ paused             ▶️ resumed              📊 report
🔍 screening         🩺 management           🧠 learning
⛔ blacklisted        ✅ passed               ❌ failed/skipped
```

---

## SDK: METEORA EXECUTION

**File: `sdk/METEORA.md`**

All position lifecycle uses `@meteora-ag/dlmm` SDK. Reference: https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/sdk-functions

### Critical Rules

1. **ALWAYS** call `dlmmPool.refetchStates()` before every read or write
2. `initializePositionAndAddLiquidityByStrategy` requires BOTH `[wallet, positionKeypair]` as signers
3. `removeLiquidity` returns `Transaction[]` (array) — send EACH sequentially
4. `bps: new BN(10000)` = 100% removal
5. Use `shouldClaimAndClose: true` for clean exits (claims fees + closes account)
6. `StrategyType` enum: `Spot=0, Curve=1, BidAsk=2`
7. Pool API endpoint: `https://dlmm.datapi.meteora.ag/pair/all`

### Open Position

```typescript
const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
await dlmmPool.refetchStates();
const activeBin = await dlmmPool.getActiveBin();
const positionKeypair = new Keypair();

const tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
  positionPubKey: positionKeypair.publicKey,
  user: wallet.publicKey,
  totalXAmount, totalYAmount,
  strategy: { maxBinId, minBinId, strategyType: StrategyType.Spot },
  slippage: 1,
});

const txHash = await sendAndConfirmTransaction(connection, tx, [wallet, positionKeypair]);
```

### Close Position

```typescript
await dlmmPool.refetchStates();
const removeTxs = await dlmmPool.removeLiquidity({
  user: wallet.publicKey,
  position: positionPubKey,
  fromBinId: lowerBinId, toBinId: upperBinId,
  bps: new BN(10000),
  shouldClaimAndClose: true,
});
for (const tx of removeTxs) {
  await sendAndConfirmTransaction(connection, tx, [wallet]);
}
```

### Claim Fees Only

```typescript
const claimTxs = await dlmmPool.claimAllSwapFee({
  owner: wallet.publicKey,
  positions: [position],
});
```

---

## SDK: AUTO-SCALING SIZING

**File: `sdk/SIZING.md`**

Position sizing scales automatically with wallet balance (Meridian v2):

```
deployAmount = (walletBalance - SOL_RESERVE) × DEPLOY_PERCENTAGE
```

| Constant | Default | Description |
|----------|---------|-------------|
| `SOL_RESERVE` | 0.2 SOL | Never touched — gas buffer for emergency closes |
| `DEPLOY_PERCENTAGE` | 0.35 (35%) | Configurable via `deployPercentage` in user-config |

**Examples:**

| Wallet | Reserve | Deployable | Amount (35%) |
|--------|---------|------------|-------------|
| 1.0 SOL | 0.2 | 0.8 | 0.28 SOL |
| 2.5 SOL | 0.2 | 2.3 | 0.80 SOL |
| 5.0 SOL | 0.2 | 4.8 | 1.68 SOL |

**Guardrails:**
- Cap at `maxPositionAllocation` (30%) of total portfolio
- Minimum 0.05 SOL (below = skip, too small after gas)
- Override: if `autoScaleDeploy: false`, use static `deployAmountSol`

---

## DATA: SQLITE SCHEMA

**File: `data/SCHEMA.md`**

9 tables total:

```sql
-- Core
wallets            -- top LPer leaderboard (50 wallets, daily refresh)
positions          -- all position records (open + closed)
portfolio          -- hourly snapshots of capital buckets

-- Owner
payouts            -- SOL transfers to owner wallet
topups             -- detected owner balance additions

-- Intelligence
pool_history       -- per-pool deployment track record
token_blacklist    -- permanently banned token mints
agent_memory       -- role-split memory (hunter/healer/shared, 35 slots)

-- System
system_log         -- structured log with agent tags
```

---

## DATA: USER CONFIG

**File: `data/CONFIG.md`**

Runtime-editable `user-config.json`. Changes hot-reload (PM2 watches the file).

| Field | Default | Category |
|-------|---------|----------|
| `dryRun` | `true` | Core |
| `autoScaleDeploy` | `true` | Sizing |
| `deployPercentage` | `0.35` | Sizing |
| `solReserve` | `0.2` | Sizing |
| `deployAmountSol` | `0.5` | Sizing (override if autoScale=false) |
| `maxPositions` | `3` | Risk |
| `maxPositionAllocation` | `0.30` | Risk |
| `minSolToOpen` | `0.07` | Risk |
| `managementIntervalMin` | `10` | Schedule |
| `screeningIntervalMin` | `30` | Schedule |
| `managementModel` | `google/gemini-2.5-flash-preview` | LLM |
| `screeningModel` | `google/gemini-2.5-flash-preview` | LLM |
| `generalModel` | `google/gemini-2.5-flash-preview` | LLM |
| `minFeeActiveTvlRatio` | `0.05` | Screening (evolvable) |
| `minTvl` | `10000` | Screening (evolvable) |
| `maxTvl` | `150000` | Screening (evolvable) |
| `minOrganic` | `65` | Screening (evolvable) |
| `minHolders` | `500` | Screening (evolvable) |
| `minGlobalFeesSol` | `30` | Screening |
| `takeProfitFeePct` | `5` | Exit |
| `stopLossPct` | `3` | Exit |
| `outOfRangeWaitMinutes` | `30` | Exit |
| `ownerPayoutPct` | `0.20` | Owner |
| `ownerPayoutThresholdSol` | `5.0` | Owner |
| `briefingHour` | `8` | Schedule (Jakarta time) |
| `briefingWatchdogHours` | `6` | Schedule |

---

## INFRA: ENVIRONMENT

**File: `infra/ENV.md`**

```env
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=KEY
SOLANA_RPC_FALLBACK=https://api.mainnet-beta.solana.com
HELIUS_API_KEY=key
WALLET_PRIVATE_KEY=base58_key
WALLET_ENCRYPTION_PASSWORD=password
OWNER_WALLET_ADDRESS=pubkey
OWNER_AUTH_TOKEN=random_string
LPAGENT_API_KEY=key
LPAGENT_API_BASE=https://api.lpagent.io
OPENROUTER_API_KEY=sk-or-v1-key
TELEGRAM_BOT_TOKEN=token
DRY_RUN=true
DB_PATH=./data/degen247.sqlite
```

---

## CRON SCHEDULE SUMMARY

```typescript
// Healer: every managementIntervalMin
cron.schedule(`*/${config.managementIntervalMin} * * * *`, healerCycle);

// Hunter: every screeningIntervalMin  
cron.schedule(`*/${config.screeningIntervalMin} * * * *`, hunterCycle);

// Health Check: every hour
cron.schedule('0 * * * *', healthCheck);

// Morning Briefing: daily at briefingHour Jakarta time
cron.schedule(`0 ${config.briefingHour} * * *`, morningBriefing);

// LP Agent Refresh + Learning: daily at midnight
cron.schedule('0 0 * * *', dailyRefresh);
```

**Watchdog on startup:**
```typescript
const lastBriefing = db.getLastBriefingTime();
const now = Date.now();
const windowEnd = todayAt(config.briefingHour + config.briefingWatchdogHours);
if (!lastBriefing || lastBriefing < todayAt(config.briefingHour)) {
  if (now < windowEnd) morningBriefing(); // Missed window, fire now
}
```

---

## SOURCE FILE MAP

Maps every workflow task to its TypeScript source file:

| Workflow | Task | Source File |
|----------|------|-------------|
| 01-screening | scan-pools | `src/pools/poolScanner.ts` |
| 01-screening | evaluate-candidate | `src/agents/hunterAgent.ts` |
| 01-screening | deploy-position | `src/positions/meteoraClient.ts` |
| 01-screening | pre-filter | `src/pools/tokenBlacklist.ts`, `src/pools/poolMemory.ts` |
| 01-screening | narrative | `src/pools/narrativeChecker.ts` |
| 02-management | evaluate-position | `src/agents/healerAgent.ts` |
| 02-management | exit-signals | `src/positions/exitSignals.ts` |
| 02-management | close/redeploy | `src/positions/meteoraClient.ts` |
| 03-learning | study-lpers | `src/learning/lessonsModule.ts` |
| 03-learning | evolve | `src/learning/thresholdEvolution.ts` |
| 03-learning | memory | `src/learning/memoryManager.ts` |
| 03-learning | metrics | `src/learning/metrics.ts` |
| 04-risk | health-check | `src/agents/healthCheck.ts` |
| 04-risk | emergency | `src/risk/riskEngine.ts` |
| 04-risk | blacklist | `src/pools/tokenBlacklist.ts` |
| 04-risk | pool-memory | `src/pools/poolMemory.ts` |
| 04-risk | capital | `src/risk/capitalBuckets.ts` |
| 05-owner | payout | `src/owner/payoutManager.ts` |
| 05-owner | topup | `src/owner/topupDetector.ts` |
| 05-owner | key-export | `src/owner/keyExport.ts` |
| 05-owner | briefing | `src/agents/briefing.ts` |
| 06-interface | telegram | `src/telegram/bot.ts` |
| 06-interface | formatters | `src/telegram/formatter.ts` |
| 06-interface | chat | `src/api/openrouter.ts` |
| sdk | meteora | `src/positions/meteoraClient.ts` |
| sdk | solana | `src/api/solana.ts` |
| sdk | sizing | `src/positions/sizing.ts` |
| data | schema | `src/db/database.ts`, `src/db/migrations.ts` |
| data | config | `src/config.ts` |
| infra | state | `src/state.ts` |
| infra | logger | `src/logger.ts` |
| infra | entrypoint | `src/index.ts` |

---

## VERSIONING

| Version | Date | Source | Changes |
|---------|------|--------|---------|
| v1.0 | 2026-03-18 | Agent247 original | Monolithic Hermes loop, LP Agent execution |
| v2.0 | 2026-03-19 | Meridian v1 | Dual-agent ReAct, direct SDK execution, lessons |
| v2.1 | 2026-03-20 | Meridian v2 (Mar 18 update) | Role-split memory, pool memory, token blacklist, global_fees_sol, token narrative, auto-scaling sizing, morning briefing + watchdog, performance history |
| **v3.0** | **2026-03-20** | **This document** | **Workflow-routed architecture, task decomposition, abstraction layers, all v2.1 features** |

---

## UPSTREAM SYNC PROTOCOL — Tracking Meridian Updates

Degen247 is NOT a fork of Meridian. It is an independent TypeScript implementation that treats Meridian (`https://github.com/yunus-0x/meridian`) as an **upstream design oracle**. We watch what Meridian does architecturally, extract the good ideas, and adapt them into our codebase on our own terms.

### Why Not Fork

| Aspect | Fork | Build Own + Sync (our approach) |
|--------|------|-------------------------------|
| Language | Stuck with JS, must rewrite | Native TypeScript from day one |
| Merge conflicts | Every upstream push = pain | Cherry-pick ideas, not code |
| Custom features | Must maintain as patches on top of their code | First-class citizens in our architecture |
| Dependency | Coupled to their release schedule | Independent release cadence |
| Understanding | Treat their code as black box | Deeply understand every line we write |

### How the Sync Works

**File: `workflows/07-upstream-sync/WORKFLOW.md`**

The agent has a dedicated workflow for tracking Meridian changes. This runs on two triggers:

1. **Automated weekly check** — every Monday at 06:00 Jakarta time
2. **Manual trigger** — owner sends `/sync` via Telegram

### Sync Workflow Tasks

```
workflows/07-upstream-sync/
├── WORKFLOW.md              ← This spec
├── tasks/
│   ├── fetch-upstream/
│   │   ├── TASK.md          ← Fetch latest from Meridian repo
│   │   ├── tools.md         ← Tools: fetch_github_repo, diff_against_snapshot
│   │   └── data.md          ← Data: UpstreamSnapshot, FileDiff
│   ├── analyze-changes/
│   │   ├── TASK.md          ← LLM analyzes what changed and why
│   │   ├── prompt.md        ← Analysis prompt template
│   │   └── data.md          ← Data: ChangeAnalysis, AdoptionRecommendation
│   └── generate-update-plan/
│       ├── TASK.md          ← Produce actionable update plan for Degen247
│       ├── prompt.md        ← Plan generation prompt
│       └── data.md          ← Data: UpdatePlan, AffectedWorkflows
└── snapshots/
    └── SNAPSHOT.md          ← Last known state of Meridian repo
```

### Task 1: Fetch Upstream

**What it does:** Reads the current state of `https://github.com/yunus-0x/meridian` and compares against the last saved snapshot.

**Files to track** (these are Meridian's core files that contain architectural decisions):

| Meridian File | What to Watch For | Maps to Degen247 |
|--------------|-------------------|-------------------|
| `README.md` | New features, config changes, architecture shifts | CLAUDE.md routing map |
| `agent.js` | ReAct loop changes, new agent patterns | `src/agents/hunterAgent.ts`, `healerAgent.ts` |
| `prompt.js` | System prompt updates, new reasoning patterns | `workflows/*/tasks/*/prompt.md` |
| `tools/` (directory) | New tools, modified tool signatures | `src/agents/tools.ts` |
| `config.js` | New config fields, default changes | `data/CONFIG.md`, `user-config.json` |
| `lessons.js` | Memory/lessons architecture changes | `src/learning/memoryManager.ts` |
| `state.js` | State management changes | `src/state.ts` |
| `get_status.js` | New status/reporting features | `src/telegram/bot.ts` |
| `telegram.js` | New commands, notification patterns | `src/telegram/bot.ts` |
| `setup.js` | Boot sequence changes | `src/index.ts` |
| `scripts/` (directory) | New utility scripts, deployment changes | `infra/` |
| `test/` (directory) | New test patterns, edge cases discovered | `test/` |
| `user-config.example.json` | New config fields, threshold changes | `data/CONFIG.md` |
| `package.json` | New dependencies, version bumps | `package.json` |

**Implementation:**

```typescript
// src/sync/upstreamSync.ts

interface UpstreamSnapshot {
  fetchedAt: number;                    // Unix timestamp
  commitHash: string;                   // Latest commit SHA
  commitCount: number;                  // Total commits (detect new activity)
  readmeHash: string;                   // Hash of README.md content
  fileHashes: Record<string, string>;   // Hash of each tracked file
  configFields: string[];               // Fields in user-config.example.json
  toolNames: string[];                  // Tool function names found in tools/
  telegramCommands: string[];           // Commands found in telegram.js
}

interface ChangeDiff {
  file: string;
  changeType: 'added' | 'modified' | 'deleted';
  summary: string;                      // Human-readable description
  relevantWorkflows: string[];          // Which Degen247 workflows are affected
}
```

**How to fetch** (no git clone needed — use GitHub raw content API):

```typescript
// Fetch individual files via raw.githubusercontent.com
const BASE = 'https://raw.githubusercontent.com/yunus-0x/meridian/main';
const files = ['README.md', 'agent.js', 'prompt.js', 'config.js', 'lessons.js', 
               'state.js', 'get_status.js', 'telegram.js', 'setup.js',
               'user-config.example.json', 'package.json'];

for (const file of files) {
  const content = await fetch(`${BASE}/${file}`).then(r => r.text());
  // Hash and compare against last snapshot
}

// Fetch directory listing via GitHub API
const toolsDir = await fetch('https://api.github.com/repos/yunus-0x/meridian/contents/tools')
  .then(r => r.json());
```

**Snapshot storage:** Save to `data/upstream-snapshot.json` (flat file, not SQLite — easy to diff manually).

### Task 2: Analyze Changes

**What it does:** Feeds the diff to the LLM for architectural analysis.

**Prompt template:**

```
You are a senior software architect analyzing upstream changes to Meridian, 
an open-source DLMM liquidity agent that Degen247 draws architectural 
inspiration from.

UPSTREAM REPO: https://github.com/yunus-0x/meridian
LAST SYNC: {lastSyncDate} (commit {lastCommitHash})
CURRENT: {currentCommitHash} ({commitDelta} new commits)

FILES CHANGED:
{for each change:
  {file} — {changeType}
  Summary: {contentDiff}
}

NEW CONFIG FIELDS (not in our user-config.json):
{newFields}

NEW TOOLS (not in our tools registry):
{newTools}

NEW TELEGRAM COMMANDS (not in our bot):
{newCommands}

DEGEN247 CURRENT ARCHITECTURE:
- 6 workflows: screening, management, learning, risk, owner, interface
- Role-split memory (35 slots: Hunter 15, Healer 15, Shared 5)
- Auto-scaling sizing, pool memory, token blacklist
- TypeScript, SQLite, PM2, Yoga 7i target

For each change, analyze:
1. WHAT changed and WHY (infer the motivation from the code change)
2. RELEVANCE: Does this affect Degen247? Which workflow(s)?
3. ADOPT / ADAPT / SKIP:
   - ADOPT: Take the idea as-is, implement in TypeScript
   - ADAPT: Good idea but needs modification for our architecture
   - SKIP: Not relevant or we already have a better solution
4. If ADOPT or ADAPT: specific implementation notes for our codebase

Be concrete. Reference specific Degen247 files that would need changes.
```

**Output:** `ChangeAnalysis[]` — one per changed file, with adoption recommendations.

### Task 3: Generate Update Plan

**What it does:** Produces a structured update plan that can be executed as vibecoding prompts.

**Output format:**

```typescript
interface UpdatePlan {
  syncDate: string;
  upstreamCommitHash: string;
  totalChanges: number;
  adoptions: UpdateItem[];     // Take as-is
  adaptations: UpdateItem[];   // Modify for our needs
  skipped: SkippedItem[];      // Not relevant + reason
}

interface UpdateItem {
  title: string;                         // e.g., "Add position timeout watchdog"
  sourceFile: string;                    // Meridian file that inspired this
  affectedWorkflows: string[];           // e.g., ["02-management"]
  affectedFiles: string[];               // e.g., ["src/agents/healerAgent.ts"]
  priority: 'critical' | 'high' | 'medium' | 'low';
  vibecodePrompt: string;               // Ready-to-paste Claude Code prompt
  testRequirements: string;             // What tests to write
}
```

**The plan is saved to `data/upstream-updates/YYYY-MM-DD.md`** as a human-readable markdown file that the owner can review before executing. Example:

```markdown
# Upstream Sync Report — 2026-03-25

Source: https://github.com/yunus-0x/meridian
Commits since last sync: 3 (abc1234 → def5678)

## ADOPT (2 changes)

### 1. Position timeout watchdog [HIGH]
Meridian added a configurable timeout per position — if a position has been 
open longer than maxHoldMinutes without reaching TP, force-evaluate it.
- Affects: workflows/02-management, src/positions/exitSignals.ts
- Vibecode prompt: [ready to paste]
- Tests: Add timeout exit signal, test at boundary

### 2. New tool: get_token_socials [MEDIUM]  
Meridian added social signal checking (Twitter mentions, Telegram group size).
- Affects: workflows/01-screening, src/agents/tools.ts
- Vibecode prompt: [ready to paste]

## ADAPT (1 change)

### 3. Memory compression [MEDIUM]
Meridian started compressing old lessons into summaries to save context tokens.
Their implementation is simple string concat — we should use LLM summarization.
- Affects: workflows/03-learning, src/learning/memoryManager.ts
- Vibecode prompt: [ready to paste with our SQLite adaptation]

## SKIPPED (1 change)

### 4. REPL interactive commands
Meridian updated their REPL interface. We don't use REPL (headless Yoga 7i),
Telegram is our only interface. Skip.
```

### Sync Schedule

| Trigger | When | What Happens |
|---------|------|-------------|
| **Weekly auto-sync** | Monday 06:00 Jakarta | Fetch → Analyze → Generate plan → Notify owner via Telegram |
| **Manual `/sync`** | On demand | Same as above, immediate |
| **Post-update verification** | After applying changes | Run tests, verify no regressions |

### Cron Entry

```typescript
// Weekly upstream sync — Monday at 06:00 Jakarta
cron.schedule('0 6 * * 1', async () => {
  try {
    logger.info('SYNC', 'Starting weekly upstream sync...');
    const diff = await upstreamSync.fetchAndDiff();
    if (diff.hasChanges) {
      const analysis = await upstreamSync.analyzeChanges(diff);
      const plan = await upstreamSync.generateUpdatePlan(analysis);
      await upstreamSync.savePlan(plan);
      if (telegramBot) {
        await telegramBot.sendAlert(
          `🔄 UPSTREAM SYNC\n` +
          `${diff.newCommits} new commits in Meridian\n` +
          `${plan.adoptions.length} to adopt, ${plan.adaptations.length} to adapt, ${plan.skipped.length} skipped\n` +
          `Review: data/upstream-updates/${plan.syncDate}.md`
        );
      }
    } else {
      logger.info('SYNC', 'No upstream changes detected.');
    }
  } catch (error) {
    logger.error('SYNC', `Sync failed: ${error.message}`);
  }
});
```

### Telegram Commands

| Command | Description |
|---------|-------------|
| `/sync` | Trigger upstream sync now |
| `/syncstatus` | Show last sync date, commits behind, pending updates |
| `/syncplan` | Show latest update plan summary |

### Source Files

| File | Purpose |
|------|---------|
| `src/sync/upstreamSync.ts` | Main sync orchestrator: fetch, diff, analyze |
| `src/sync/githubFetcher.ts` | Fetch raw files from GitHub, no git dependency |
| `src/sync/snapshotManager.ts` | Save/load/compare snapshots |
| `src/sync/changeAnalyzer.ts` | LLM-powered change analysis |
| `src/sync/planGenerator.ts` | Generate structured update plans with vibecode prompts |
| `data/upstream-snapshot.json` | Last known Meridian state |
| `data/upstream-updates/*.md` | Generated update plans (one per sync) |

### Updated Routing Map Entry

Add to the main routing table:

| Trigger | Workflow | Entry Point |
|---------|----------|-------------|
| Cron: Monday 06:00 / `/sync` command | `07-upstream-sync` | `WORKFLOW.md → fetch → analyze → plan` |

### Updated Source File Map Entries

| Workflow | Task | Source File |
|----------|------|-------------|
| 07-upstream-sync | fetch-upstream | `src/sync/githubFetcher.ts`, `src/sync/snapshotManager.ts` |
| 07-upstream-sync | analyze-changes | `src/sync/changeAnalyzer.ts` |
| 07-upstream-sync | generate-plan | `src/sync/planGenerator.ts` |

### Updated Cron Schedule

```typescript
// Add to the cron summary:
// Upstream Sync: weekly Monday at 06:00 Jakarta
cron.schedule('0 6 * * 1', upstreamSync);
```

---

## HOW TO APPLY AN UPDATE PLAN

After the sync generates a plan, the owner reviews it and decides which updates to apply. The process:

1. **Review** — Read `data/upstream-updates/YYYY-MM-DD.md` (or `/syncplan` in Telegram)
2. **Decide** — For each item: apply now, defer, or reject
3. **Execute** — Copy the `vibecodePrompt` from the plan into Claude Code
4. **Test** — Run the test requirements specified in the plan
5. **Update CLAUDE.md** — If the change affects the routing map, abstraction layers, or workflow specs, update this instruction file
6. **Commit** — `git commit -am "Upstream sync: adopted X from Meridian {commitHash}"`
7. **Version** — Add entry to the VERSIONING table below

This keeps every change traceable: you always know which Meridian commit inspired which Degen247 change.

---

## VERSIONING

| Version | Date | Source | Changes |
|---------|------|--------|---------|
| v1.0 | 2026-03-18 | Agent247 original | Monolithic Hermes loop, LP Agent execution |
| v2.0 | 2026-03-19 | Meridian v1 | Dual-agent ReAct, direct SDK execution, lessons |
| v2.1 | 2026-03-20 | Meridian v2 (Mar 18 update) | Role-split memory, pool memory, token blacklist, global_fees_sol, token narrative, auto-scaling sizing, morning briefing + watchdog, performance history |
| **v3.0** | **2026-03-23** | **This document** | **Workflow-routed architecture, task decomposition, abstraction layers, upstream sync protocol, all v2.1 features** |
