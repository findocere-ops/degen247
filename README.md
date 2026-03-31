# DEGEN247 v3.0 — Autonomous Liquidity Agent

## Mission Accomplished

The DEGEN247 autonomous Meteora DLMM liquidity agent has been successfully built to the `CLAUDE.md` v3.0 specification. The 10-Phase vibecoding execution plan is **100% Complete**. The system passed **53/53** integration tests suite-wide and is primed for headless 24/7 deployment on the Lenovo Yoga 7i.

## Architecture & Workflows Implemented

### 1. Data & Persistence (Layer 1)
- **SQLite Engine:** `src/db/database.ts` configured in WAL mode with robust typings covering 9 tables.
- **State Management:** Tracking portfolio snapshots, rolling performance per wallet, pool_history records, and dynamic config state mutations.

### 2. Execution & Risk (Layer 2 & Phase 5)
- **Meteora API Integration:** `@meteora-ag/dlmm` natively integrated for auto-scaled deployment algorithms mimicking JLP strategies. 
- **Health Engine:** Core risk protocols built via `src/agents/healthCheck.ts` enforcing a trailing 10% max-drawdown, portfolio snap-shotting, and the strict 5/75/10/10 capital tiering scheme.
- **Dynamic Exit Signals:** Deterministic evaluation mapped in `src/positions/exitSignals.ts` targeting stop-loss edges, out-of-range halts, and LP fee profit taking.

### 3. Dual-Agent ReAct Decision Engine (Layer 3 & Phase 4)
- **Hunter Agent:** Scans pools, scores metrics, processes structural token data, validates safety, and explicitly routes deployment calls via OpenRouter LLMs.
- **Healer Agent:** Manages open liquidity chunks on tight cron-loops, pinging LLMs for closure decisions aligned to exit signals.

### 4. Owner Interfaces (Layer 4 & Phase 6 & 8)
- **Telegram Bot Pipeline:** `src/telegram/bot.ts` handles status checks, pause/resume, and briefings.
- **Payout & Topups:** Safely evaluates unexpected wallet balance surges and routes auto-withdrawals for owners.
- **Security Lock:** Middleware ensures the bot ONLY responds to the authorized `TELEGRAM_CHAT_ID`.
- **Morning Briefing:** Automated watchdog cron dispatching operational updates daily.

### 5. AI Evolution & Syncing (Phase 7 & 9)
- **Threshold Evolution:** System self-adjusts deployment targets (`minOrganic`, `minHolders`, etc.) by actively calculating historical win-rates using `src/learning/thresholdEvolution.ts`.
- **Upstream Synchronization:** `src/sync/*.ts` interfaces natively with Upstream repositories via LLM prompts producing strictly valid Vibecoding Adoption tasks to track with Meridian changes globally.

## Deployment Status

**Integration Testing Results**
- **Test Suites:** 11 passed, 11 total.
- **Total Assertions:** 53 passed, 53 total.
- **Result:** System matches all deterministic boundaries without TypeScript or compiler leakage.

### How to Run Locally

```bash
# 1. Install Dependencies
npm install

# 2. Populate environment configurations
cp .env.example .env

# 3. Development / Dry-Run (Will simulate executes)
npm run dev

# 4. Global Production Bootloader
npm run build && npm run start
```

## 📱 Telegram Bot Setup

To control your agent remotely, you must set up a Telegram Bot:

1. **Create the Bot:**
   - Message [@BotFather](https://t.me/botfather) on Telegram.
   - Run `/newbot` and follow the instructions to get your **HTTP API Token**.
   - Add this to your `.env` as `TELEGRAM_BOT_TOKEN`.

2. **Get Your Chat ID:**
   - Message [@userinfobot](https://t.me/userinfobot) on Telegram.
   - It will reply with your **Id** (a string of numbers).
   - Add this to your `.env` as `TELEGRAM_CHAT_ID`.

3. **Security:**
   - The agent is hard-locked to your Chat ID. It will silently ignore commands from any other user to prevent unauthorized access.

### Telegram Commands
| Command | Description |
| --- | --- |
| `/status` | View current wallet balance, open positions, and state. |
| `/pause` | Stop the Hunter agent from opening new positions. |
| `/resume` | Allow the Hunter agent to resume pool scanning. |
| `/emergency` | Immediately pause the agent (useful for quick intervention). |
| `/briefing` | Get a summary of profit/loss and top performing pools. |

*Welcome to the autonomous era, CTO.*
