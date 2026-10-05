import { test, expect } from '@playwright/test';
import { detectCommand } from '../lib/commands';
import { ask, createWorkspace, signUp } from './helpers';

test('chat commands are matched strictly', () => {
  for (const t of ['save todo', 'Save Todo!', 'create todo', 'add todo', 'save the details as a todo', 'please save this chat as todo']) {
    expect(detectCommand(t), t).toBe('save_todo');
  }
  for (const t of ['reset', 'Reset workspace', 'reset the workspace.']) expect(detectCommand(t), t).toBe('reset_workspace');
  for (const t of ['how do I reset my password?', 'what is a todo list?', 'reset the workspace and then summarise', 'the doc says: reset']) {
    expect(detectCommand(t), t).toBeNull();
  }
});

test('"save todo" saves the whole chat; it shows under Saved and deletes with confirmation', async ({ page }) => {
  test.setTimeout(150_000);
  await signUp(page, `todo-${Date.now()}@example.com`);
  await createWorkspace(page, 'Todo A');

  // One real Gemini turn. Phrased as a question so the model doesn't call save_task on its own.
  await ask(page, 'What does the vendor contract say about March?');
  await expect(page.getByRole('button', { name: 'Saved (0)' })).toBeVisible();
  const reply = await ask(page, 'save todo');
  expect(reply).toContain('Saved the whole chat');
  await expect(page.getByRole('button', { name: 'Saved (1)' })).toBeVisible();

  await page.getByRole('button', { name: 'Saved (1)' }).click();
  const todo = page.getByTestId('todo');
  await expect(todo).toHaveCount(1);
  await todo.getByRole('button').first().click(); // expand full text
  await expect(todo).toContainText('vendor contract say about March');

  page.once('dialog', (d) => d.dismiss());
  await todo.getByRole('button', { name: 'Delete' }).click();
  await expect(todo).toHaveCount(1);
  page.once('dialog', (d) => d.accept());
  await todo.getByRole('button', { name: 'Delete' }).click();
  await expect(todo).toHaveCount(0);
});

test('"reset" wipes only the current workspace', async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page, `reset-${Date.now()}@example.com`);
  await createWorkspace(page, 'Keep me');
  await ask(page, 'save todo'); // empty chat -> "nothing to save", but leaves 2 messages
  await ask(page, 'save todo');
  await expect(page.getByRole('button', { name: 'Saved (1)' })).toBeVisible();
  const keepUrl = page.url();

  await createWorkspace(page, 'Wipe me', true);
  await ask(page, 'save todo');
  await ask(page, 'save todo');
  await expect(page.getByRole('button', { name: 'Saved (1)' })).toBeVisible();

  await ask(page, 'reset');
  await expect(page.getByRole('button', { name: 'Saved (0)' })).toBeVisible();
  await expect(page.getByTestId('msg')).toHaveCount(2); // just "reset" + its confirmation
  await expect(page.getByTestId('msg').last()).toContainText('Workspace reset');

  await page.goto(keepUrl);
  await expect(page.getByRole('button', { name: 'Saved (1)' })).toBeVisible();
});
