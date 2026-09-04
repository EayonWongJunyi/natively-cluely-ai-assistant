/** DeepSeek's default text model used when no explicit model is selected. */
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash';

/**
 * The only DeepSeek API model currently documented to accept image input.
 * Keep the predicate exact: other DeepSeek V4 models return a 400 when sent an
 * image, even though they share the same OpenAI-compatible endpoint.
 */
export const DEEPSEEK_VISION_MODEL = 'deepseek-v4-flash-vision-exp';

export const DEEPSEEK_DEFAULT_MODEL_IDS = [
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_VISION_MODEL,
  'deepseek-v4-pro',
] as const;

export function isDeepseekModelId(modelId: string): boolean {
  return /^deepseek-v\d/i.test(modelId || '');
}

export function deepseekSupportsImages(modelId: string): boolean {
  return (modelId || '').toLowerCase() === DEEPSEEK_VISION_MODEL;
}
