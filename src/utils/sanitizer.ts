/**
 * Sanitizes untrusted strings (e.g., from on-chain data) before embedding them
 * into LLM prompts to prevent prompt injection or JSON format breaking.
 */
export function sanitizeForPrompt(input: string): string {
  if (!input) return '';
  // Strip out JSON control characters that could be used to break out of
  // stringified blocks and arbitrarily inject tool_calls.
  return input.replace(/[{}[\]"]/g, '').trim();
}

export function sanitizeMemories(memories: any[]): any[] {
  return memories.map(mem => ({
    ...mem,
    content: sanitizeForPrompt(mem.content),
    source: sanitizeForPrompt(mem.source),
  }));
}
