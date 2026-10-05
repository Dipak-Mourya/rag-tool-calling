'use client';

import { useEffect, useState } from 'react';
import { ChatPanel } from './chat-panel';
import { ToolLogPanel } from './tool-log-panel';
import { SavedTodos, type Todo } from './saved-todos';

export function ChatAndTools({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [todos, setTodos] = useState<Todo[]>([]);

  // Re-fetch after each chat turn: "save todo" (and the save_task tool) write to this table.
  useEffect(() => {
    let alive = true;
    fetch(`/api/workspaces/${workspaceId}/tasks`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (alive && b) setTodos(b.tasks); });
    return () => { alive = false; };
  }, [workspaceId, refreshKey]);

  async function remove(id: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks?id=${id}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? 'Could not delete'); return; }
    setTodos((ts) => ts.filter((t) => t.id !== id));
    setRefreshKey((k) => k + 1);
  }

  return (
    <>
      <ChatPanel
        workspaceId={workspaceId} workspaceName={workspaceName} onDone={() => setRefreshKey((k) => k + 1)}
        headerAction={<SavedTodos todos={todos} onDelete={remove} />}
      />
      <ToolLogPanel workspaceId={workspaceId} refreshKey={refreshKey} />
    </>
  );
}
