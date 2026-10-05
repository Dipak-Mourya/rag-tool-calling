'use client';

import { useState } from 'react';

export type Todo = { id: string; title: string; description: string | null; created_at: string };

export function SavedTodos({ todos, onDelete }: { todos: Todo[]; onDelete: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function remove(t: Todo) {
    if (!window.confirm(`Delete this todo?\n\n“${t.title}”`)) return;
    setDeleting(t.id);
    await onDelete(t.id);
    setDeleting('');
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium hover:bg-gray-50">
        Saved ({todos.length})
      </button>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-label="Saved todos">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold">Saved todos</h2>
              <button onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-900" aria-label="Close">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {todos.length === 0 ? <p className="text-sm text-gray-500">Nothing saved yet. Type “save todo” in the chat to save the conversation.</p> : (
                <ul className="space-y-2" data-testid="saved-todos">
                  {todos.map((t) => (
                    <li key={t.id} data-testid="todo" className="rounded-md border border-gray-100 p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <button className="text-left font-medium" onClick={() => setExpanded((x) => ({ ...x, [t.id]: !x[t.id] }))}>
                          {t.title}
                        </button>
                        <button
                          onClick={() => remove(t)} disabled={deleting === t.id}
                          className="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}</p>
                      {expanded[t.id] && t.description && <p className="mt-2 whitespace-pre-wrap text-gray-700">{t.description}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
