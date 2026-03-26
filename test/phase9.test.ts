import * as fs from 'fs';
import * as path from 'path';
import { fetchGithubUpstreamDiff } from '../src/sync/githubFetcher';
import { SnapshotManager } from '../src/sync/snapshotManager';
import { analyzeChanges } from '../src/sync/changeAnalyzer';
import { generateUpdatePlan } from '../src/sync/planGenerator';
import { chatCompletion } from '../src/api/openrouter';

jest.mock('../src/api/openrouter');

describe('Phase 9 - Upstream Sync', () => {
  const testDir = path.join(__dirname, 'test_data');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
  });

  afterAll(() => {
    if (fs.existsSync(path.join(testDir, 'SNAPSHOT.json'))) {
      fs.unlinkSync(path.join(testDir, 'SNAPSHOT.json'));
    }
    if (fs.existsSync(testDir)) fs.rmdirSync(testDir);
  });

  describe('Github Fetcher', () => {
    it('returns array of file diffs based on simulated target constraints', async () => {
      const diffs = await fetchGithubUpstreamDiff('repo', 'shaA');
      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs[0].filename).toBe('src/workflows/hunter.ts');
    });
  });

  describe('SnapshotManager', () => {
    it('initializes default snapshot state on boot if missing', () => {
      const manager = new SnapshotManager(testDir);
      const snap = manager.getSnapshot();
      expect(snap.lastCommitSha).toBe('INITIAL_BOOTSTRAP_SHA');
    });

    it('saves and recalls snapshot state transparently', () => {
      const manager = new SnapshotManager(testDir);
      manager.saveSnapshot({ lastCommitSha: 'NEW_SHA', lastSyncDate: '2026-01-01' });
      const snap = manager.getSnapshot();
      expect(snap.lastCommitSha).toBe('NEW_SHA');
    });
  });

  describe('Change Analyzer', () => {
    it('parses structured JSON diff analysis successfully from LLM pipe', async () => {
      (chatCompletion as jest.Mock).mockResolvedValue({
        content: JSON.stringify({ summary: 'Hunter sizing update', isBreaking: false, affectedComponents: ['sizing'] })
      });

      const analysis = await analyzeChanges([{ filename: 'test', status: 'modified', diffContent: '+ size=1' }]);
      expect(analysis.isBreaking).toBe(false);
      expect(analysis.summary).toContain('Hunter sizing');
    });
  });

  describe('Plan Generator', () => {
    it('outputs adoption strategy and vibecode prompts off LLM input', async () => {
      (chatCompletion as jest.Mock).mockResolvedValue({
        content: JSON.stringify({ planId: 'plan_1', recommendedAction: 'adopt_all', vibecodePrompts: ['Prompt 1: update sizing'] })
      });

      const plan = await generateUpdatePlan({ summary: '', isBreaking: false, affectedComponents: [] });
      expect(plan.recommendedAction).toBe('adopt_all');
      expect(plan.vibecodePrompts.length).toBe(1);
    });
  });
});
