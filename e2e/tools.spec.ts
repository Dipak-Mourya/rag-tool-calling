import { test, expect } from '@playwright/test';
import { executeTool, type ToolContext } from '../lib/tools';

// Rejections happen before any DB/network access, so a bare context is enough.
const ctx = {} as ToolContext;

test('unknown tools are rejected, never executed', async () => {
  for (const name of ['delete_everything', 'constructor', '__proto__', 'toString', '']) {
    const r = await executeTool(name, {}, ctx);
    expect(r.status).toBe('rejected');
  }
});

test('malformed or extra arguments are rejected', async () => {
  expect((await executeTool('save_task', {}, ctx)).status).toBe('rejected');                        // missing title
  expect((await executeTool('save_task', { title: '' }, ctx)).status).toBe('rejected');             // empty
  expect((await executeTool('save_task', { title: 5 }, ctx)).status).toBe('rejected');              // wrong type
  expect((await executeTool('save_task', { title: 'x'.repeat(201) }, ctx)).status).toBe('rejected'); // too long
  expect((await executeTool('save_task', { title: 'ok', workspace_id: 'other' }, ctx)).status).toBe('rejected'); // strict: no workspace_id
  expect((await executeTool('send_summary', { summary: 123 }, ctx)).status).toBe('rejected');
  expect((await executeTool('save_task', null, ctx)).status).toBe('rejected');
});
