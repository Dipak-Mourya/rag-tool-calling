import { GoogleGenAI } from '@google/genai';

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const EMBED_DIM = 768;

async function embedOnce(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY') {
  const res = await ai.models.embedContent({
    model: process.env.GEMINI_EMBED_MODEL!,
    contents: texts,
    config: { taskType, outputDimensionality: EMBED_DIM },
  });
  const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);
  if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBED_DIM)) {
    throw new Error('Unexpected embedding response');
  }
  return vectors;
}

// One retry with backoff covers the free tier's occasional 429/5xx.
export async function embedTexts(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY') {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    try {
      out.push(...(await embedOnce(batch, taskType)));
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
      out.push(...(await embedOnce(batch, taskType)));
    }
  }
  return out;
}

// pgvector accepts the text form '[0.1,0.2,...]' through PostgREST.
export const toPgVector = (v: number[]) => `[${v.join(',')}]`;
