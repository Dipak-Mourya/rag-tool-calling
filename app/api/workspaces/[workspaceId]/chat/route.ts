import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { HttpError, errorResponse, requireMember } from '@/lib/auth';
import { RateLimitError, runChat } from '@/lib/chat';
import { detectCommand, runCommand } from '@/lib/commands';

export const maxDuration = 60;

type Ctx = { params: Promise<{ workspaceId: string }> };
const Body = z.object({ question: z.string().trim().min(1).max(2000) });

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { workspaceId } = await params;
    const supabase = await createClient();
    await requireMember(supabase, workspaceId);
    const { data, error } = await supabase.from('messages')
      .select('id, role, content, status, sources, debug, created_at')
      .eq('workspace_id', workspaceId).order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    return NextResponse.json({ messages: data });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { workspaceId } = await params;
    const supabase = await createClient();
    const user = await requireMember(supabase, workspaceId);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Question must be 1-2000 characters');
    const { question } = parsed.data;

    const command = detectCommand(question);
    if (command) return NextResponse.json(await runCommand(command, question, { supabase, workspaceId, userId: user.id }));

    const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single();
    const { data: prior } = await supabase.from('messages')
      .select('role, content').eq('workspace_id', workspaceId).eq('status', 'done')
      .order('created_at', { ascending: false }).limit(6);
    const history = (prior ?? []).reverse() as { role: 'user' | 'assistant'; content: string }[];

    // Save the question BEFORE any LLM work, so a slow/failed model never loses it.
    const { error: uErr } = await supabase.from('messages')
      .insert({ workspace_id: workspaceId, user_id: user.id, role: 'user', content: question });
    if (uErr) throw uErr;
    const { data: pending, error: aErr } = await supabase.from('messages')
      .insert({ workspace_id: workspaceId, user_id: user.id, role: 'assistant', content: '', status: 'pending' })
      .select('id').single();
    if (aErr) throw aErr;

    try {
      const result = await runChat({
        supabase, question, history,
        onToolCall: async (t) => {
          await supabase.from('tool_calls').insert({
            workspace_id: workspaceId, message_id: pending.id, tool_name: t.name, arguments: t.args,
            status: t.status, result: t.result, error: t.error ?? null, duration_ms: t.duration_ms,
          });
        },
        ctx: { supabase, workspaceId, workspaceName: ws?.name ?? 'workspace', userId: user.id },
      });
      await supabase.from('messages')
        .update({ content: result.answer, status: 'done', sources: result.sources, debug: result.debug })
        .eq('id', pending.id);
      return NextResponse.json({ answer: result.answer, sources: result.sources });
    } catch (e) {
      console.error('chat failed:', e instanceof Error ? e.message : 'unknown');
      const message = e instanceof RateLimitError
        ? `The AI service is rate-limited (free tier). Please retry in about ${e.retryAfterSec}s.`
        : 'The assistant failed to answer. Please retry.';
      await supabase.from('messages').update({ content: message, status: 'error' }).eq('id', pending.id);
      throw new HttpError(e instanceof RateLimitError ? 429 : 502, message);
    }
  } catch (e) {
    return errorResponse(e);
  }
}
