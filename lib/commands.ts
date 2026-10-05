import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyDiscord } from '@/lib/discord';

// Chat commands handled by the server, never by the LLM: the model (or text inside a document)
// can't trigger them, and they cost no Gemini quota.
export type Command = 'save_todo' | 'reset_workspace';

const SAVE_TODO = /^\s*(please\s+)?(save|create|add)\b.{0,40}\btodo\s*[.!]?\s*$/i; // "save todo", "save the details as a todo"
const RESET = /^\s*reset(\s+(the\s+)?workspace)?\s*[.!]?\s*$/i;                  // whole message must be "reset" / "reset workspace"
const MAX_CONVERSATION_CHARS = 20_000;

export function detectCommand(text: string): Command | null {
  if (RESET.test(text)) return 'reset_workspace';
  if (SAVE_TODO.test(text)) return 'save_todo';
  return null;
}

type Ctx = { supabase: SupabaseClient; workspaceId: string; userId: string };

async function saveConversation({ supabase, workspaceId, userId }: Ctx) {
  const { data: rows, error } = await supabase.from('messages')
    .select('role, content').eq('workspace_id', workspaceId).eq('status', 'done')
    .order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  if (rows.length === 0) return { answer: 'There is no conversation to save yet.', result: { saved: 0 } };

  let text = rows.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
  if (text.length > MAX_CONVERSATION_CHARS) text = `(truncated, oldest messages removed)\n\n${text.slice(-MAX_CONVERSATION_CHARS)}`;
  const first = rows.find((m) => m.role === 'user')?.content.replace(/\s+/g, ' ').trim() ?? 'Conversation';
  const title = first.length > 80 ? `${first.slice(0, 79)}…` : first;

  const { data, error: tErr } = await supabase.from('tasks')
    .insert({ workspace_id: workspaceId, title, description: text, created_by: userId })
    .select('id').single();
  if (tErr) throw tErr;

  const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single();
  await notifyDiscord(`**[${ws?.name ?? 'workspace'}]** Chat saved as a todo: “${title}” (${rows.length} messages)`);
  return { answer: `Saved the whole chat (${rows.length} messages) as a todo: “${title}”.`, result: { task_id: data.id, saved: rows.length } };
}

// Wipes everything inside the workspace; the workspace itself is kept. RLS limits each delete to members.
async function resetWorkspace({ supabase, workspaceId }: Ctx) {
  for (const table of ['tool_calls', 'tasks', 'messages', 'document_chunks', 'documents']) {
    const { error } = await supabase.from(table).delete().eq('workspace_id', workspaceId);
    if (error) throw error;
  }
  return { answer: 'Workspace reset: all documents, chat, todos and tool logs were deleted.', result: { reset: true } };
}

export async function runCommand(command: Command, question: string, ctx: Ctx) {
  const t0 = Date.now();
  const { answer, result } = command === 'save_todo' ? await saveConversation(ctx) : await resetWorkspace(ctx);
  // Written after the command so the reset doesn't erase its own record.
  // Two inserts, not one: rows from one statement share created_at and could display out of order.
  for (const [role, content] of [['user', question], ['assistant', answer]]) {
    const { error } = await ctx.supabase.from('messages')
      .insert({ workspace_id: ctx.workspaceId, user_id: ctx.userId, role, content });
    if (error) throw error;
  }
  await ctx.supabase.from('tool_calls').insert({
    workspace_id: ctx.workspaceId, tool_name: command, arguments: null, status: 'success', result, duration_ms: Date.now() - t0,
  });
  return { answer, sources: [], reset: command === 'reset_workspace' };
}
