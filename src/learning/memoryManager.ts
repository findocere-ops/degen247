import Database from 'better-sqlite3';

export interface Memory {
  id: number;
  agentRole: 'hunter' | 'healer' | 'shared';
  content: string;
  source: string;
  confidence: number;
  pinned: boolean;
  createdAt: number;
  expiresAt: number | null;
}

export class MemoryManager {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  addMemory(
    role: 'hunter' | 'healer' | 'shared',
    content: string,
    source: string,
    confidence: number = 0.5,
    ttlHours: number = 24
  ): number {
    const createdAt = Date.now();
    const expiresAt = ttlHours > 0 ? createdAt + (ttlHours * 60 * 60 * 1000) : null;

    const stmt = this.db.prepare(
      `INSERT INTO agent_memory (agent_role, content, source, confidence, pinned, created_at, expires_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    );

    const info = stmt.run(role, content, source, confidence, createdAt, expiresAt);
    this.enforceLimits(role);
    return info.lastInsertRowid as number;
  }

  private enforceLimits(role: 'hunter' | 'healer' | 'shared') {
    // Role limits defined in CLAUDE.md: 15 Hunter, 15 Healer, 5 Pinned Shared
    const limit = role === 'shared' ? 5 : 15;
    const stmt = this.db.prepare(
      `DELETE FROM agent_memory 
       WHERE id IN (
         SELECT id FROM agent_memory 
         WHERE agent_role = ? AND pinned = 0
         ORDER BY created_at DESC 
         LIMIT -1 OFFSET ?
       )`
    );
    stmt.run(role, limit);
  }

  getRelevantMemories(role: 'hunter' | 'healer' | 'shared', contextKeywords: string[], limit: number = 5): Memory[] {
    // Get all pinned shared + relevant non-expired roll memories
    const now = Date.now();
    
    let baseQuery = `
      SELECT * FROM agent_memory 
      WHERE (agent_role = ? OR (agent_role = 'shared' AND pinned = 1))
      AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY pinned DESC, confidence DESC
    `;

    const rows = this.db.prepare(baseQuery).all(role, now) as any[];

    // Simple text match heuristic for contextKeywords scoring
    const scored = rows.map(r => {
      let score = r.confidence;
      if (r.pinned) score += 10;
      for (const kw of contextKeywords) {
        if (r.content.toLowerCase().includes(kw.toLowerCase())) {
          score += 1.0;
        }
      }
      return { ...r, _score: score };
    });

    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, limit).map(r => ({
      id: r.id,
      agentRole: r.agent_role,
      content: r.content,
      source: r.source,
      confidence: r.confidence,
      pinned: r.pinned === 1,
      createdAt: r.created_at,
      expiresAt: r.expires_at
    }));
  }

  pinMemory(id: number) {
    this.db.prepare('UPDATE agent_memory SET pinned = 1 WHERE id = ?').run(id);
  }

  evictExpired() {
    this.db.prepare('DELETE FROM agent_memory WHERE expires_at IS NOT NULL AND expires_at < ?').run(Date.now());
  }
}
