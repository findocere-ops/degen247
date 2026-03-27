# DEGEN247 — Full Installation & Deployment Guide

> Step-by-step instructions for deploying the autonomous Meteora DLMM liquidity agent on a Lenovo Yoga 7i running Windows 11, designed for 24/7 headless operation.

---

## Phase A: Prepare the Yoga 7i Hardware

### A1. Prevent Sleep & Lid Shutdown
Since this is a laptop that needs to stay awake 24/7:

1. Press **Windows Key**, type **"Power & Battery"**, hit Enter.
2. Set **"When plugged in, put my device to sleep after"** → **Never**.
3. Set **"Turn off screen after"** → **5 minutes** (saves power, agent keeps running).
4. Press **Windows Key**, type **"Control Panel"** → **Hardware and Sound** → **Power Options**.
5. Click **"Choose what closing the lid does"** on the left.
6. Set **"When I close the lid (Plugged in)"** → **Do nothing**.
7. Click **Save changes**.

### A2. Pause Windows Updates
Prevents forced restarts mid-trade:

1. Press **Windows Key**, type **"Windows Update"**, hit Enter.
2. Click **"Pause updates"** → Pause for the maximum duration available.
3. Repeat this before every trip.

### A3. Physical Setup
- Plug the laptop into a **reliable power source** (surge protector recommended).
- Place on a **hard, flat surface** (desk/table) for proper ventilation — never on carpet/bed.
- Close the lid (it won't sleep thanks to Step A1).

---

## Phase B: Install Required Software

### B1. Install Node.js v20 LTS
1. Download from [https://nodejs.org/](https://nodejs.org/) — choose the **LTS** version.
2. Run the installer, accept all defaults.
3. Open **PowerShell** and verify:
   ```powershell
   node --version   # Should show v20.x.x
   npm --version    # Should show 10.x.x
   ```

### B2. Install Git
1. Download from [https://git-scm.com/downloads](https://git-scm.com/downloads).
2. Run the installer, accept all defaults.
3. Verify:
   ```powershell
   git --version
   ```

### B3. Install PM2 (Process Manager)
PM2 keeps the agent alive 24/7 and auto-restarts it if it crashes:
```powershell
npm install -g pm2
```

### B4. Install Tailscale (Optional — Remote Access)
If you want to SSH into the Yoga while traveling:
1. Download from [https://tailscale.com/download](https://tailscale.com/download).
2. Install and log in with your Google/GitHub account.
3. Note the Tailscale IP (e.g. `100.x.x.x`) — you'll use this to connect remotely.

---

## Phase C: Clone & Configure DEGEN247

### C1. Clone the Repository
```powershell
cd ~
git clone https://github.com/findocere-ops/degen247.git
cd degen247
```

### C2. Install Dependencies
```powershell
npm install
```

### C3. Configure Environment Variables
```powershell
copy .env.example .env
```

Open `.env` in Notepad and fill in **all required values**:

```env
# Solana
SOLANA_RPC_URL=https://your-helius-or-quicknode-rpc-url
SOLANA_PRIVATE_KEY=your_base58_private_key

# OpenRouter (LLM)
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_OWNER_CHAT_ID=your_chat_id

# Security
KEY_EXPORT_TOKEN=a_random_secret_string_you_choose

# Mode (remove this line or set to false for LIVE trading)
DRY_RUN=true
```

> ⚠️ **IMPORTANT:** Start with `DRY_RUN=true` first to verify everything works before going live.

### C4. Build the Project
```powershell
npm run build
```

### C5. Run Tests (Optional but Recommended)
```powershell
npm run test
```
You should see **53/53 tests passing**.

---

## Phase D: Launch the Agent

### D1. Start in Dry-Run Mode (First Time)
```powershell
npm run dev
```
Watch the logs. Verify the cron jobs register and the agent boots without errors. Press `Ctrl+C` to stop.

### D2. Start 24/7 Production Mode
```powershell
pm2 start ecosystem.config.cjs
```

### D3. Useful PM2 Commands
```powershell
pm2 logs degen247       # Watch real-time logs
pm2 status              # Check if agent is running
pm2 restart degen247    # Restart the agent
pm2 stop degen247       # Stop the agent
pm2 monit               # Live CPU/Memory dashboard
```

### D4. Auto-Start on Reboot
If there's a power outage and the laptop restarts:
```powershell
pm2 save
pm2 startup
```
Follow the instructions PM2 prints — this ensures the agent auto-starts on boot.

---

## Phase E: Remote Updates While Traveling

### E1. Remote Access via Tailscale
From your travel laptop or phone terminal:
```bash
ssh rejoelm@100.x.x.x    # Your Tailscale IP
cd ~/degen247
git pull origin main
npm install
npm run build
pm2 restart degen247
```

### E2. Fully Automatic Updates (Hands-Free)
Create `auto_update.sh` in the degen247 folder:
```bash
#!/bin/bash
cd ~/degen247
git fetch origin main

if [ $(git rev-parse HEAD) != $(git rev-parse @{u}) ]; then
    git pull origin main
    npm install
    npm run build
    pm2 restart degen247
    echo "[$(date)] Updated and restarted!" >> ~/degen247/update.log
fi
```

Set it to run every hour via Windows Task Scheduler:
1. Open **Task Scheduler** → Create Basic Task.
2. Name: `DEGEN247 Auto Update`.
3. Trigger: **Daily**, repeat every **1 hour**.
4. Action: **Start a program** → `bash` with argument `~/degen247/auto_update.sh`.

Now, whenever you push new code to GitHub from anywhere, the Yoga auto-pulls and redeploys within the hour!

### E3. Emergency Controls via Telegram
From your phone, text your Telegram bot:
- `/pause` — Pause all trading immediately.
- `/emergency` — Close all positions and halt.
- `/resume` — Resume trading.
- `/status` — Check portfolio and system health.

---

## Pre-Travel Checklist

- [ ] Laptop plugged into power (surge protector).
- [ ] Laptop on hard surface for ventilation.
- [ ] Lid close action set to "Do nothing".
- [ ] Sleep set to "Never" when plugged in.
- [ ] Windows Updates paused.
- [ ] `.env` file configured with real keys.
- [ ] `DRY_RUN=false` for live trading.
- [ ] `pm2 start ecosystem.config.cjs` running.
- [ ] `pm2 save && pm2 startup` configured.
- [ ] Tailscale installed and logged in.
- [ ] Telegram bot tested (`/status` returns data).
- [ ] Auto-update script scheduled (optional).

---

*Your Yoga 7i is now a dedicated, autonomous Solana trading server. Safe travels, CTO!*
