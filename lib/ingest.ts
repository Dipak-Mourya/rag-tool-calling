import { createHash } from 'node:crypto';
import { extractText } from 'unpdf';
import type { SupabaseClient } from '@supabase/supabase-js';
import { chunkPages } from './chunk';
import { embedTexts, toPgVector } from './gemini';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel request body limit is ~4.5 MB
const ALLOWED = ['pdf', 'txt', 'md'];

export const fileExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
export const isAllowedFile = (name: string) => ALLOWED.includes(fileExt(name));
export const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

async function parsePages(bytes: Buffer, filename: string): Promise<string[]> {
  if (fileExt(filename) === 'pdf') {
    const { text } = await extractText(new Uint8Array(bytes), { mergePages: false });
    return text;
  }
  return [bytes.toString('utf8')];
}

// Idempotent: same bytes in the same workspace -> same documents row, chunks replaced not duplicated.
export async function ingestDocument(
  supabase: SupabaseClient,
  args: { workspaceId: string; userId: string; filename: string; bytes: Buffer },
) {
  const { workspaceId, userId, filename, bytes } = args;
  const contentHash = sha256(bytes);

  const { data: existing } = await supabase
    .from('documents').select('*')
    .eq('workspace_id', workspaceId).eq('content_hash', contentHash).maybeSingle();
  if (existing?.status === 'ready') return { document: existing, duplicate: true };

  let docId: string;
  if (existing) {
    docId = existing.id;
    await supabase.from('document_chunks').delete().eq('document_id', docId);
    await supabase.from('documents').update({ status: 'processing', error: null, filename }).eq('id', docId);
  } else {
    const { data, error } = await supabase.from('documents')
      .insert({ workspace_id: workspaceId, filename, content_hash: contentHash, uploaded_by: userId })
      .select('id').single();
    if (error) throw error;
    docId = data.id;
  }

  try {
    const chunks = chunkPages(await parsePages(bytes, filename));
    if (chunks.length === 0) throw new Error('No readable text found in this file');
    const vectors = await embedTexts(chunks.map((c) => c.content), 'RETRIEVAL_DOCUMENT');

    const rows = chunks.map((c, i) => ({
      workspace_id: workspaceId,
      document_id: docId,
      chunk_index: i,
      page_number: c.page,
      content: c.content,
      embedding: toPgVector(vectors[i]),
    }));
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabase.from('document_chunks')
        .upsert(rows.slice(i, i + 50), { onConflict: 'document_id,chunk_index' });
      if (error) throw error;
    }
    const { data: doc, error } = await supabase.from('documents')
      .update({ status: 'ready', chunk_count: rows.length, error: null }).eq('id', docId).select('*').single();
    if (error) throw error;
    return { document: doc, duplicate: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Processing failed';
    console.error('ingest failed:', message);
    const safe = message.startsWith('No readable text') ? message : 'Processing failed, please retry';
    await supabase.from('documents').update({ status: 'failed', error: safe }).eq('id', docId);
    throw new Error(safe);
  }
}
