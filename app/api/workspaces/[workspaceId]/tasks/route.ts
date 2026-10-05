import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HttpError, errorResponse, isUuid, requireMember } from '@/lib/auth';

type Ctx = { params: Promise<{ workspaceId: string }> };
const COLUMNS = 'id, title, description, created_at';

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { workspaceId } = await params;
    const supabase = await createClient();
    await requireMember(supabase, workspaceId);
    const { data, error } = await supabase.from('tasks').select(COLUMNS)
      .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return NextResponse.json({ tasks: data });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { workspaceId } = await params;
    const supabase = await createClient();
    await requireMember(supabase, workspaceId);
    const id = new URL(req.url).searchParams.get('id') ?? '';
    if (!isUuid(id)) throw new HttpError(400, 'Bad task id');
    const { data, error } = await supabase.from('tasks').delete()
      .eq('workspace_id', workspaceId).eq('id', id).select('id');
    if (error) throw error;
    if (!data.length) throw new HttpError(404, 'Task not found');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
