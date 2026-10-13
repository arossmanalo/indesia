import { expect, test } from '@playwright/test';

test('a new player can start a battle, build a tower and send the first wave', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Indesia' })).toBeVisible();

  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /Kingsroad Meadow/ }).click();

  const gold = page.locator('.stat[title="Gold"]');
  await expect(gold).toHaveText('250');

  // Pick the archer (hotkey 1) and place it on the grass at tile (5, 2), next to the road.
  await page.keyboard.press('1');
  const canvas = page.locator('#game canvas');
  const box = (await canvas.boundingBox())!;
  const scale = box.width / 640;
  await page.mouse.click(box.x + 5.5 * 32 * scale, box.y + 2.5 * 32 * scale);
  await expect(gold).toHaveText('180');

  await page.getByRole('button', { name: 'Start wave 1' }).click();
  await expect(page.locator('.stat[title="Wave"]')).toHaveText('1/15');

  expect(errors).toEqual([]);
});
