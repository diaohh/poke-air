import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Full Phase 1 flow: Host creates a room, two phones join and split into teams, build a random
 * one-Pokémon team each, ready up, play the battle to the end with their first usable move, then
 * the Host starts a rematch. `E2E_SCREENSHOTS=<dir>` saves screenshots of every screen.
 */

const SHOTS = process.env.E2E_SCREENSHOTS;
const PHONE = { width: 390, height: 844 };

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function phone(browser: Browser, code: string, name: string) {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`/j/${code}`);
  await page.getByPlaceholder('Trainer name').fill(name);
  await page.getByRole('button', { name: 'Join room' }).click();
  await expect(page.getByText('Choose your team')).toBeVisible();
  return page;
}

/** One decision on a phone, if it has one: its first usable move, or a switch-in. */
async function playTurn(page: Page): Promise<void> {
  const fight = page.getByRole('button', { name: 'FIGHT' });
  if (await fight.isVisible()) {
    await fight.click();
    const move = page.locator('.move-btn:not([disabled])').first();
    await move.click();
    await move.click();
    return;
  }
  if (await page.getByText('Choose your next Pokémon').isVisible()) {
    const rows = page.locator('.party-row:not(.party-row--fainted)');
    await rows.first().click();
    await page.getByRole('button', { name: 'Switch in' }).click();
  }
}

test('two phones play a singles battle to the end and start a rematch', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const host = await hostContext.newPage();
  // Scene, audio or sprite failures must not throw on the Host.
  const hostErrors: string[] = [];
  host.on('pageerror', (error) => hostErrors.push(error.message));
  await host.goto('/host?speed=8');
  await expect(host.getByText('Battle lobby')).toBeVisible();
  const code = await host.evaluate(
    () => (JSON.parse(sessionStorage.getItem('poke-air:host') ?? '{}') as { code: string }).code,
  );
  expect(code).toMatch(/^[A-Z]{4}$/);

  const ana = await phone(browser, code, 'Ana');
  const ben = await phone(browser, code, 'Ben');
  await shot(host, '01-host-lobby');
  await shot(ana, '02-phone-teams');

  await host.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ana, ben]) {
    await page.getByRole('button', { name: 'Fill with random Pokémon' }).click();
    await expect(page.locator('article.phone-card')).toHaveCount(6);
  }
  await shot(ana, '03-phone-team-builder');
  for (const page of [ana, ben]) {
    // Keep one Pokémon so the battle is short.
    for (let i = 0; i < 5; i++) {
      await page
        .getByRole('button', { name: /^Remove / })
        .first()
        .click();
      await expect(page.locator('article.phone-card')).toHaveCount(5 - i);
    }
  }
  await ana.getByRole('button', { name: "I'm ready" }).click();
  await expect(host.getByText('1 / 2 ready').first()).toBeVisible();
  await shot(host, '04-host-team-building');
  await ben.getByRole('button', { name: "I'm ready" }).click();
  await expect(host.getByText('Battle starts in')).toBeVisible();
  await shot(host, '05-host-countdown');

  // Battle: phones get their menu once the Host has shown the switch-ins.
  await expect(ana.getByRole('button', { name: 'FIGHT' })).toBeVisible({ timeout: 30_000 });
  const battleLog = host.getByRole('complementary', { name: 'Battle log' });
  await expect(battleLog).toContainText('sent out');
  await shot(host, '06-host-battle');
  await shot(ana, '07-phone-menu');
  await ana.getByRole('button', { name: 'FIGHT' }).click();
  await shot(ana, '08-phone-fight');
  await ana.getByRole('button', { name: 'Back' }).click();

  const deadline = Date.now() + 180_000;
  let turns = 0;
  for (;;) {
    const results = host.getByRole('button', { name: 'Rematch' });
    if (await results.isVisible()) break;
    expect(Date.now(), 'battle took too long').toBeLessThan(deadline);
    await Promise.all([playTurn(ana), playTurn(ben)]);
    if (turns++ === 1) await shot(host, '09-host-mid-battle');
    await host.waitForTimeout(400);
  }

  await shot(host, '10-host-results');
  await expect(ana.getByRole('heading', { name: /Victory!|Defeat|It's a draw!/ })).toBeVisible();
  await shot(ana, '11-phone-results');

  await host.getByRole('button', { name: 'Rematch' }).click();
  await expect(ana.getByRole('heading', { name: 'Your team' })).toBeVisible();
  await expect(ana.locator('article.phone-card')).toHaveCount(1);
  expect(hostErrors).toEqual([]);
});
