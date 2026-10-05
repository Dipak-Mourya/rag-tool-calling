import type { SupabaseClient } from '@supabase/supabase-js';
import { embedTexts, toPgVector } from './gemini';

export const TOP_K = 6;
export const MIN_SIMILARITY = 0.5;

export type RetrievedChunk = {
  id: string;
  document_id: string;
  filename: string;
  page_number: number | null;
  chunk_index: number;
  content: string;
  similarity: number;
};

// The workspace filter lives INSIDE the match_chunks SQL (WHERE workspace_id = $1 in the vector query).
export async function retrieve(supabase: SupabaseClient, workspaceId: string, question: string) {
  const [vector] = await embedTexts([question], 'RETRIEVAL_QUERY');
  const { data, error } = await supabase.rpc('match_chunks', {
    p_workspace_id: workspaceId,
    p_query_embedding: toPgVector(vector),
    p_match_count: TOP_K,
  });
  if (error) throw error;
  const all = (data ?? []) as RetrievedChunk[];
  return { all, relevant: all.filter((c) => c.similarity >= MIN_SIMILARITY) };
}
