import axios from 'axios';
import { config } from '../config';
import { logger } from '../logger';

export async function chatCompletion(
  messages: any[],
  tools: any[] | undefined,
  model: string,
  maxTokens: number
): Promise<any> {
  if (config.dryRun && !config.OPENROUTER_API_KEY) {
    logger.info('OPENROUTER', '[DRY RUN] Returning mocked LLM response');
    // If tools are provided, mock a tool call response
    if (tools && tools.length > 0) {
      return {
        tool_calls: [{
          id: 'call_mock123',
          type: 'function',
          function: {
            name: 'execute_deployment',
            arguments: '{"poolAddress": "mock_pool", "strategyType": 0, "binWidth": 40, "lamports": 100000000}'
          }
        }]
      };
    }
    return JSON.stringify({ hasRealCatalyst: true, name: "MOCK", summary: "Mock" });
  }

  try {
    const payload: any = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://degen247.io',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const message = response.data.choices[0].message;
    if (message.tool_calls) {
      return message; // return full message to expose tool_calls
    }
    return message.content;
  } catch (err: any) {
    logger.error('OPENROUTER', `LLM Request failed: ${err.message}`);
    throw err;
  }
}
