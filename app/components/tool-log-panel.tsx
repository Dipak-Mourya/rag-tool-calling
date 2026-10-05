'use client';

import { useEffect, useState } from 'react';

type Call = { id: string; tool_name: string; arguments: unknown; status: string; error: string | null; duration_ms: number | null };
type Task = { id: string; title: string };

const BADGE: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  rejected: 'bg-orange-100 text-orange-800',
};

export function ToolLogPanel({ workspaceId, refreshKey }: { workspaceId: string; refreshKey: number }) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/workspaces/${workspaceId}/tool-calls`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (alive && b) { setCalls(b.toolCalls); setTasks(b.tasks); } });
    return () => { alive = false; };
  }, [workspaceId, refreshKey]);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold">Tool calls</h2>
      {calls.length === 0 ? <p className="text-sm text-gray-500">No tool calls yet.</p> : (
        <ul className="space-y-2" data-testid="tool-log">
          {calls.map((c) => (
            <li key={c.id} className="rounded-md border border-gray-100 p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.tool_name}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs ${BADGE[c.status] ?? ''}`}>{c.status}</span>
              </div>
              <p className="truncate text-xs text-gray-500">{JSON.stringify(c.arguments)}</p>
              {c.error && <p className="text-xs text-red-600">{c.error}</p>}
            </li>
          ))}
        </ul>
      )}
      <h2 className="mb-2 mt-5 text-sm font-semibold">Tasks</h2>
      {tasks.length === 0 ? <p className="text-sm text-gray-500">No tasks yet.</p> : (
        <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="tasks">
          {tasks.map((t) => <li key={t.id}>{t.title}</li>)}
        </ul>
      )}
    </section>
  );
}
