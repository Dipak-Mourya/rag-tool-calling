import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { HttpError, errorResponse } from '@/lib/auth';

const Body = z.object({ name: z.string().trim().min(1).max(80) });

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new HttpError(401, 'Not signed in');

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Workspace name must be 1-80 characters');

    const { data, error } = await supabase.rpc('create_workspace', { p_name: parsed.data.name });
    if (error) throw error;
    return NextResponse.json({ id: data }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
