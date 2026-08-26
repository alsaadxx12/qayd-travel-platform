/** Newest flagship OpenAI model available on this project's key. */
export const DEFAULT_AI_MODEL = 'gpt-5.6-sol';
export const DEFAULT_FAST_MODEL = 'gpt-5.6-sol';
export const DEFAULT_PARSE_MODEL = 'gpt-5.6-sol';

export function isGpt5Family(model: string): boolean {
  return /^(gpt-5|o3|o4)/i.test(String(model || ''));
}

export function chatModelParams(
  model: string,
  opts: { maxTokens: number; temperature?: number; reasoning?: 'none' | 'low' | 'medium' | 'high' },
): Record<string, any> {
  if (isGpt5Family(model)) {
    return {
      max_completion_tokens: opts.maxTokens,
      reasoning_effort: opts.reasoning || 'medium',
    };
  }
  return {
    max_tokens: opts.maxTokens,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
  };
}
