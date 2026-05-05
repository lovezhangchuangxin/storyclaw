export interface ModelSpecs {
  contextWindowTokens: number
  maxOutputTokens: number
}

/**
 * Known model specs keyed by model ID prefix (lowercase).
 * Sorted by specificity (longer prefixes first) for best-match lookup.
 */
const MODEL_SPECS: [string, ModelSpecs][] = [
  // --- DeepSeek ---
  ['deepseek-v4-flash', { contextWindowTokens: 1_048_576, maxOutputTokens: 384_000 }],
  ['deepseek-v4-pro', { contextWindowTokens: 1_048_576, maxOutputTokens: 384_000 }],
  ['deepseek-chat', { contextWindowTokens: 1_048_576, maxOutputTokens: 384_000 }],
  ['deepseek-reasoner', { contextWindowTokens: 1_048_576, maxOutputTokens: 384_000 }],

  // --- 智谱 GLM 5.x ---
  ['glm-5-turbo', { contextWindowTokens: 200_000, maxOutputTokens: 131_072 }],
  ['glm-5.1', { contextWindowTokens: 200_000, maxOutputTokens: 131_072 }],
  ['glm-5', { contextWindowTokens: 200_000, maxOutputTokens: 131_072 }],

  // --- 智谱 GLM 4.7 ---
  ['glm-4.7-flashx', { contextWindowTokens: 200_000, maxOutputTokens: 131_072 }],
  ['glm-4.7-flash', { contextWindowTokens: 200_000, maxOutputTokens: 131_072 }],
  ['glm-4.7', { contextWindowTokens: 200_000, maxOutputTokens: 131_072 }],

  // --- 智谱 GLM 4.6 ---
  ['glm-4.6', { contextWindowTokens: 200_000, maxOutputTokens: 131_072 }],

  // --- 智谱 GLM 4.5 ---
  ['glm-4.5-airx', { contextWindowTokens: 131_072, maxOutputTokens: 98_304 }],
  ['glm-4.5-air', { contextWindowTokens: 131_072, maxOutputTokens: 98_304 }],
  ['glm-4.5-flash', { contextWindowTokens: 131_072, maxOutputTokens: 98_304 }],
  ['glm-4.5', { contextWindowTokens: 131_072, maxOutputTokens: 98_304 }],

  // --- 智谱 GLM 4.x ---
  ['glm-4-long', { contextWindowTokens: 1_048_576, maxOutputTokens: 4_096 }],
  ['glm-4-plus', { contextWindowTokens: 131_072, maxOutputTokens: 4_096 }],
  ['glm-4-flashx', { contextWindowTokens: 131_072, maxOutputTokens: 16_384 }],
  ['glm-4-flash', { contextWindowTokens: 131_072, maxOutputTokens: 16_384 }],
  ['glm-4-airx', { contextWindowTokens: 8_192, maxOutputTokens: 4_096 }],
  ['glm-4-air', { contextWindowTokens: 131_072, maxOutputTokens: 16_384 }],

  // --- MiniMax ---
  ['minimax-m2.7-highspeed', { contextWindowTokens: 204_800, maxOutputTokens: 131_072 }],
  ['minimax-m2.7', { contextWindowTokens: 204_800, maxOutputTokens: 131_072 }],
  ['minimax-m2.5-highspeed', { contextWindowTokens: 204_800, maxOutputTokens: 131_072 }],
  ['minimax-m2.5', { contextWindowTokens: 204_800, maxOutputTokens: 131_072 }],
  ['minimax-m2.1-highspeed', { contextWindowTokens: 204_800, maxOutputTokens: 131_072 }],
  ['minimax-m2.1', { contextWindowTokens: 204_800, maxOutputTokens: 131_072 }],
  ['minimax-m2', { contextWindowTokens: 204_800, maxOutputTokens: 131_072 }],
  ['minimax-m1', { contextWindowTokens: 1_048_576, maxOutputTokens: 81_920 }],

  // --- OpenAI GPT-5.x ---
  ['gpt-5.4-mini', { contextWindowTokens: 400_000, maxOutputTokens: 131_072 }],
  ['gpt-5.4', { contextWindowTokens: 1_048_576, maxOutputTokens: 131_072 }],
  ['gpt-5.5', { contextWindowTokens: 1_048_576, maxOutputTokens: 131_072 }],

  // --- OpenAI GPT-4.1 ---
  ['gpt-4.1-mini', { contextWindowTokens: 1_047_576, maxOutputTokens: 32_768 }],
  ['gpt-4.1-nano', { contextWindowTokens: 1_047_576, maxOutputTokens: 32_768 }],
  ['gpt-4.1', { contextWindowTokens: 1_047_576, maxOutputTokens: 32_768 }],

  // --- OpenAI GPT-4o ---
  ['gpt-4o-mini', { contextWindowTokens: 131_072, maxOutputTokens: 16_384 }],
  ['gpt-4o', { contextWindowTokens: 131_072, maxOutputTokens: 16_384 }],

  // --- OpenAI o-series ---
  ['o3-mini', { contextWindowTokens: 200_000, maxOutputTokens: 100_000 }],
  ['o4-mini', { contextWindowTokens: 200_000, maxOutputTokens: 100_000 }],
  ['o3', { contextWindowTokens: 200_000, maxOutputTokens: 100_000 }],

  // --- Anthropic Claude ---
  ['claude-opus-4-7', { contextWindowTokens: 200_000, maxOutputTokens: 131_072 }],
  ['claude-sonnet-4-6', { contextWindowTokens: 200_000, maxOutputTokens: 65_536 }],
  ['claude-haiku-4-5', { contextWindowTokens: 200_000, maxOutputTokens: 65_536 }],

  // --- 阿里 Qwen3 ---
  ['qwen3-235b-a22b', { contextWindowTokens: 131_072, maxOutputTokens: 16_384 }],
  ['qwen3-32b', { contextWindowTokens: 131_072, maxOutputTokens: 16_384 }],
  ['qwen3-30b-a3b', { contextWindowTokens: 131_072, maxOutputTokens: 16_384 }],

  // --- 阿里 Qwen (DashScope) ---
  ['qwen-plus', { contextWindowTokens: 1_048_576, maxOutputTokens: 32_768 }],
  ['qwen-turbo', { contextWindowTokens: 1_048_576, maxOutputTokens: 16_384 }],
  ['qwen-max', { contextWindowTokens: 262_144, maxOutputTokens: 65_536 }],

  // --- Moonshot ---
  ['moonshot-v1-128k', { contextWindowTokens: 131_072, maxOutputTokens: 12_288 }],
  ['moonshot-v1-32k', { contextWindowTokens: 32_768, maxOutputTokens: 12_288 }],
  ['moonshot-v1-8k', { contextWindowTokens: 8_192, maxOutputTokens: 4_096 }],
  ['moonshot-v1', { contextWindowTokens: 131_072, maxOutputTokens: 12_288 }],

  // --- Kimi ---
  ['kimi-k2', { contextWindowTokens: 262_144, maxOutputTokens: 262_144 }],
  ['kimi-latest', { contextWindowTokens: 262_144, maxOutputTokens: 262_144 }],

  // --- 豆包 Doubao ---
  ['doubao-1.8-pro', { contextWindowTokens: 262_144, maxOutputTokens: 65_536 }],
  ['doubao-1.8-lite', { contextWindowTokens: 262_144, maxOutputTokens: 65_536 }],
  ['doubao-1.5-pro', { contextWindowTokens: 32_768, maxOutputTokens: 4_096 }],
  ['doubao-1.5-lite', { contextWindowTokens: 32_768, maxOutputTokens: 4_096 }],
]

/**
 * Look up model specs by model ID.
 * Uses case-insensitive prefix matching — longer (more specific) prefixes win.
 * Handles dated snapshot IDs like `gpt-4o-2024-08-06` → `gpt-4o`.
 */
export function lookupModelSpecs(modelId: string): ModelSpecs | null {
  const lower = modelId.toLowerCase()
  let best: ModelSpecs | null = null
  let bestLen = 0
  for (const [prefix, specs] of MODEL_SPECS) {
    if (lower === prefix || lower.startsWith(prefix + '-') || lower.startsWith(prefix + '.')) {
      if (prefix.length > bestLen) {
        best = specs
        bestLen = prefix.length
      }
    }
  }
  return best
}
