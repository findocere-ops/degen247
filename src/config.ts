import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { z } from 'zod';

// -- ZOD SCHEMAS --

const EnvSchema = z.object({
  SOLANA_RPC_URL: z.string().url(),
  SOLANA_RPC_FALLBACK: z.string().url().optional(),
  HELIUS_API_KEY: z.string().optional(),
  WALLET_PRIVATE_KEY: z.string().min(32),
  WALLET_ENCRYPTION_PASSWORD: z.string().optional(),
  OWNER_WALLET_ADDRESS: z.string().min(32).optional(),
  OWNER_AUTH_TOKEN: z.string().min(8).optional(),
  LPAGENT_API_KEY: z.string().optional(),
  LPAGENT_API_BASE: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().startsWith('sk-'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  DRY_RUN: z.string().transform((v) => v === 'true').default('true'),
  DB_PATH: z.string().default('./data/degen247.sqlite')
});

const UserConfigSchema = z.object({
  dryRun: z.boolean().default(true),
  autoScaleDeploy: z.boolean().default(true),
  deployPercentage: z.number().default(0.35),
  solReserve: z.number().default(0.2),
  deployAmountSol: z.number().default(0.5),
  maxPositions: z.number().default(3),
  maxPositionAllocation: z.number().default(0.30),
  minSolToOpen: z.number().default(0.07),
  managementIntervalMin: z.number().default(10),
  screeningIntervalMin: z.number().default(30),
  managementModel: z.string().default('google/gemini-2.5-flash-preview'),
  screeningModel: z.string().default('google/gemini-2.5-flash-preview'),
  generalModel: z.string().default('google/gemini-2.5-flash-preview'),
  minFeeActiveTvlRatio: z.number().default(0.05),
  minTvl: z.number().default(10000),
  maxTvl: z.number().default(150000),
  minOrganic: z.number().default(65),
  minHolders: z.number().default(500),
  minGlobalFeesSol: z.number().default(30),
  takeProfitFeePct: z.number().default(5),
  stopLossPct: z.number().default(3),
  outOfRangeWaitMinutes: z.number().default(30),
  ownerPayoutPct: z.number().default(0.20),
  ownerPayoutThresholdSol: z.number().default(5.0),
  briefingHour: z.number().default(8),
  briefingWatchdogHours: z.number().default(6),
});

export type EnvConfig = z.infer<typeof EnvSchema>;
export type UserConfig = z.infer<typeof UserConfigSchema>;
export type Config = EnvConfig & UserConfig;

// -- CONFIG LOADER --

const USER_CONFIG_PATH = path.join(process.cwd(), 'user-config.json');

let parsedEnv: EnvConfig;
try {
  parsedEnv = EnvSchema.parse(process.env);
} catch (error) {
  console.error("CRITICAL: Invalid environment variables:", error);
  process.exit(1);
}

function loadUserConfig(): UserConfig {
  if (!fs.existsSync(USER_CONFIG_PATH)) {
    // Create defaults
    const defaults = UserConfigSchema.parse({});
    fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'));
    return UserConfigSchema.parse(raw);
  } catch (error) {
    console.warn("WARNING: Failed to parse user-config.json. Using defaults.", error);
    return UserConfigSchema.parse({});
  }
}

export const config: Config = { ...parsedEnv, ...loadUserConfig() };

// Hot reload support
export function reloadConfig(): Config {
  const newConfig = loadUserConfig();
  Object.assign(config, newConfig);
  return config;
}
