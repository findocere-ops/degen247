export function formatStatus(walletSol: number, openPosCount: number, isPaused: boolean): string {
  const statusIcon = isPaused ? '⏸' : '▶️';
  return `
${statusIcon} SYSTEM STATUS
💰 Wallet Balance: ${walletSol.toFixed(4)} SOL
🟢 Open Positions: ${openPosCount}
  `.trim();
}

export function formatEmergencyStatus(): string {
  return `🚨 EMERGENCY TRIGGERED. All positions closing. Hunter paused.`;
}

export function formatKeysExportAuthFail(): string {
  return `❌ Unauthorized key export attempt.`;
}

export function formatSuccess(msg: string): string {
  return `✅ SUCCESS: ${msg}`;
}
