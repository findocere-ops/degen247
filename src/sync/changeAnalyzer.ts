import { chatCompletion } from '../api/openrouter';
import { FileDiff } from './githubFetcher';
import { config } from '../config';

export interface ChangeAnalysis {
  summary: string;
  isBreaking: boolean;
  affectedComponents: string[];
}

export async function analyzeChanges(diffs: FileDiff[]): Promise<ChangeAnalysis> {
  const content = diffs.map(d => `FILE: ${d.filename} (${d.status})\n${d.diffContent}`).join('\n\n');
  
  const sysPrompt = `
You are Meridian's Sync Analyzer. Review the following Git diffs from upstream.
Determine if the changes are breaking, and list affected architectural components.

Output MUST be strictly valid JSON matching this schema:
{
  "summary": "Short description of changes",
  "isBreaking": boolean,
  "affectedComponents": ["list", "of", "modules"]
}
`;

  try {
    const res = await chatCompletion(
      [
        { role: 'system', content: sysPrompt },
        { role: 'user', content }
      ],
      [], // No tools
      config.generalModel,
      1000
    );

    const raw = res?.content || '{}';
    // attempt parse
    const parsed = JSON.parse(raw.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, ''));
    return {
      summary: parsed.summary || 'Unknown update',
      isBreaking: !!parsed.isBreaking,
      affectedComponents: parsed.affectedComponents || []
    };
  } catch (e: any) {
    return { summary: 'Analysis failed: ' + e.message, isBreaking: true, affectedComponents: [] };
  }
}
