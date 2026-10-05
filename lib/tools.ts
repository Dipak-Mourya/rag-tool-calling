import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

// workspaceId is NEVER a tool argument: the server injects the active workspace.
export type ToolContext = {
  supabase: SupabaseClient;
  workspaceId: string;
  workspaceName: string;
  userId: string;
};

const SaveTaskArgs = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
}).strict();

const SendSummaryArgs = z.object({
  summary: z.string().trim().min(1).max(1500),
}).strict();

const ListTasksArgs = z.object({}).strict();

export const TOOLS = {
  save_task: {
    schema: SaveTaskArgs,
    run: async (args: z.infer<typeof SaveTaskArgs>, ctx: ToolContext) => {
      const { data, error } = await ctx.supabase.from('tasks')
        .insert({ workspace_id: ctx.workspaceId, title: args.title, description: args.description ?? null, created_by: ctx.userId })
        .select('id, title').single();
      if (error) throw error;
      return { ok: true, task_id: data.id, title: data.title };
    },
  },
  list_tasks: {
    schema: ListTasksArgs,
    run: async (_args: z.infer<typeof ListTasksArgs>, ctx: ToolContext) => {
      const { data, error } = await ctx.supabase.from('tasks')
        .select('title, description, created_at').eq('workspace_id', ctx.workspaceId)
        .order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return { tasks: data };
    },
  },
  send_summary: {
    schema: SendSummaryArgs,
    run: async (args: z.infer<typeof SendSummaryArgs>, ctx: ToolContext) => {
      const url = process.env.DISCORD_WEBHOOK_URL;
      if (!url) throw new Error('send_summary is not configured on this server');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // allowed_mentions: [] stops injected text from pinging @everyone.
        body: JSON.stringify({ content: `**[${ctx.workspaceName}]** ${args.summary}`.slice(0, 1900), allowed_mentions: { parse: [] } }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Notification service returned ${res.status}`);
      return { ok: true, sent: true };
    },
  },
} as const;

export type ToolName = keyof typeof TOOLS;

// What the model sees. Same names/shapes as the zod schemas above.
export const FUNCTION_DECLARATIONS = [
  {
    name: 'save_task',
    description: 'Save a task in the current workspace. Only call when the user explicitly asks to create/save a task.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short task title' },
        description: { type: 'string', description: 'Optional details' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List the tasks saved in the current workspace.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  {
    name: 'send_summary',
    description: 'Send a short summary message to the team notification channel. Only call when the user explicitly asks to send/share a summary.',
    parametersJsonSchema: {
      type: 'object',
      properties: { summary: { type: 'string', description: 'The summary text to send' } },
      required: ['summary'],
    },
  },
];

export type ToolOutcome = {
  status: 'success' | 'error' | 'rejected';
  result: Record<string, unknown>;
  error?: string;
};

// Never throws. Unknown tool / bad args / runtime failure all become a result the model can see.
export async function executeTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  if (!Object.hasOwn(TOOLS, name)) {
    return { status: 'rejected', result: { error: `Unknown tool: ${name.slice(0, 60)}` }, error: 'Unknown tool' };
  }
  const tool = TOOLS[name as ToolName];
  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'arguments'}: ${i.message}`).join('; ');
    return { status: 'rejected', result: { error: `Invalid arguments: ${msg}` }, error: msg };
  }
  try {
    // Each tool's args type matches its own schema; the lookup above loses that, hence the cast.
    const result = await (tool.run as (a: unknown, c: ToolContext) => Promise<Record<string, unknown>>)(parsed.data, ctx);
    return { status: 'success', result };
  } catch (e) {
    console.error(`tool ${name} failed:`, e instanceof Error ? e.message : 'unknown');
    const msg = e instanceof Error && e.message.includes('not configured') ? e.message : 'Tool failed';
    return { status: 'error', result: { error: msg }, error: msg };
  }
}
