import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

// The only way a route learns "which workspace": URL id + membership check. Never trust the body or the model.
export async function requireMember(supabase: SupabaseClient, workspaceId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, 'Not signed in');
  if (!isUuid(workspaceId)) throw new HttpError(400, 'Bad workspace id');
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data) throw new HttpError(404, 'Workspace not found');
  return user;
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}
