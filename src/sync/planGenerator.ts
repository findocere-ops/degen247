import { chatCompletion } from '../api/openrouter';
import { ChangeAnalysis } from './changeAnalyzer';
import { config } from '../config';

export interface UpdatePlan {
  planId: string;
  recommendedAction: 'adopt_all' | 'adopt_partial' | 'ignore';
  vibecodePrompts: string[];
}

export async function generateUpdatePlan(analysis: ChangeAnalysis): Promise<UpdatePlan> {
  const sysPrompt = `
You are the DEGEN247 CTO. Based on the upstream Change Analysis, write "Vibecoding Prompts" to adopt the changes cleanly into DEGEN247.
You MUST output strictly valid JSON matching:
{
  "planId": "timestamp-based-id",
  "recommendedAction": "adopt_all" | "adopt_partial" | "ignore",
  "vibecodePrompts": ["Prompt 1: Do X", "Prompt 2: Do Y"]
}
`;

  try {
    const res = await chatCompletion(
      [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: JSON.stringify(analysis) }
      ],
      [], 
      config.generalModel,
      1500
    );

    const raw = res?.content || '{}';
    const parsed = JSON.parse(raw.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, ''));
    
    return {
      planId: parsed.planId || `plan_${Date.now()}`,
      recommendedAction: parsed.recommendedAction || 'ignore',
      vibecodePrompts: parsed.vibecodePrompts || []
    };
  } catch (e: any) {
    return {
      planId: 'error_fallback',
      recommendedAction: 'ignore',
      vibecodePrompts: ['Failed to generate plan. Please review upstream manually.']
    };
  }
}
