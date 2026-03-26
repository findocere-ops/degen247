import { state } from '../state';
import Database from 'better-sqlite3';

export function generateMorningBriefing(db: Database.Database): string {
  const openPosCount = state.positions.size;
  const portfolioVal = state.walletBalanceSol;
  
  // Pull top candidates
  const candidatesRow = db.prepare('SELECT pool_address FROM pool_history ORDER BY total_pnl_sol DESC LIMIT 3').all() as any[];
  const topCandidatesPath = candidatesRow.map(c => `- ${c.pool_address}`).join('\\n') || "- No proven candidates yet";

  return `
🌅 DEGEN247 Morning Briefing

📊 Portfolio: ${portfolioVal.toFixed(2)} SOL
🟢 Open Positions: ${openPosCount}

🚀 Top Proven Candidates:
${topCandidatesPath}

🧠 AI Strategy Mode Active.
`;
}
