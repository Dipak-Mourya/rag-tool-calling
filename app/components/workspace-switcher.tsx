'use client';

import { useRouter } from 'next/navigation';

export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: { id: string; name: string }[];
  activeId: string;
}) {
  const router = useRouter();
  return (
    <select
      value={activeId}
      onChange={(e) => router.push(`/w/${e.target.value}`)}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium"
      aria-label="Switch workspace"
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>{w.name}</option>
      ))}
    </select>
  );
}
