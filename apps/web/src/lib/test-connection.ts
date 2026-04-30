import OpenAI from 'openai'

export async function testConnection(apiBase: string, apiKey: string, modelId: string) {
  const client = new OpenAI({
    baseURL: apiBase,
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  await client.chat.completions.create({
    model: modelId,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 1,
  })
}
