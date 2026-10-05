import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HttpError, errorResponse, requireMember } from '@/lib/auth';
import { MAX_UPLOAD_BYTES, ingestDocument, isAllowedFile } from '@/lib/ingest';

export const maxDuration = 60;

type Ctx = { params: Promise<{ workspaceId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { workspaceId } = await params;
    const supabase = await createClient();
    await requireMember(supabase, workspaceId);
    const { data, error } = await supabase.from('documents')
      .select('id, filename, status, chunk_count, error, created_at')
      .eq('workspace_id', workspaceId).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ documents: data });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { workspaceId } = await params;
    const supabase = await createClient();
    const user = await requireMember(supabase, workspaceId);

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) throw new HttpError(400, 'Attach a file');
    if (!isAllowedFile(file.name)) throw new HttpError(400, 'Only .pdf, .txt and .md files are supported');
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) throw new HttpError(400, 'File must be between 1 byte and 4 MB');

    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      const { document, duplicate } = await ingestDocument(supabase, {
        workspaceId, userId: user.id, filename: file.name, bytes,
      });
      return NextResponse.json({ document, duplicate }, { status: duplicate ? 200 : 201 });
    } catch (e) {
      throw new HttpError(422, e instanceof Error ? e.message : 'Processing failed');
    }
  } catch (e) {
    return errorResponse(e);
  }
}
