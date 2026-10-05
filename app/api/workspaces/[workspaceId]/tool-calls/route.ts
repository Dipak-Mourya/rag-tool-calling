import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { errorResponse, requireMember } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const supabase = await createClient();
    await requireMember(supabase, workspaceId);
    const [calls, tasks] = await Promise.all([
      supabase.from('tool_calls').select('id, tool_name, arguments, status, result, error, duration_ms, created_at')
        .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(30),
      supabase.from('tasks').select('id, title, description, created_at')
        .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(30),
    ]);
    if (calls.error) throw calls.error;
    if (tasks.error) throw tasks.error;
    return NextResponse.json({ toolCalls: calls.data, tasks: tasks.data });
  } catch (e) {
    return errorResponse(e);
  }
}
