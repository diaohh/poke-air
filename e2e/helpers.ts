import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/** Shared E2E helpers: Host room, phone contexts and a generic "play one decision" step. */

const SHOTS = process.env.E2E_SCREENSHOTS;
export const PHONE = { width: 390, height: 844 };

/** Every context the helpers opened in the current test (closed by `closeContexts`). */
const contexts: BrowserContext[] = [];

/** `test.afterEach(closeContexts)`: the shared browser must not keep a test's pages around. */
export async function closeContexts(): Promise<void> {
  await Promise.all(contexts.splice(0).map((context) => context.close()));
}

/** Saves a screenshot when `E2E_SCREENSHOTS=<dir>` is set. */
export async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Opens `/host` (fast animations) and returns the page, its room code and its page errors. */
export async function openHost(browser: Browser, locale?: string) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    ...(locale ? { locale } : {}),
  });
  contexts.push(context);
  const host = await context.newPage();
  // Scene, audio or sprite failures must not throw on the Host.
  const errors: string[] = [];
  host.on('pageerror', (error) => errors.push(error.message));
  await host.goto('/host?speed=8');
  await expect(host.getByRole('radiogroup')).toBeVisible();
  const code = await host.evaluate(
    () => (JSON.parse(sessionStorage.getItem('poke-air:host') ?? '{}') as { code: string }).code,
  );
  expect(code).toMatch(/^[A-Z]{4}$/);
  return { host, code, errors };
}

/** A phone context that joins the room with this trainer name (English room labels). */
export async function phone(browser: Browser, code: string, name: string): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(`/j/${code}`);
  await page.getByPlaceholder('Trainer name').fill(name);
  await page.getByRole('button', { name: 'Join room' }).click();
  await expect(page.getByText('Choose your team')).toBeVisible();
  return page;
}

/** Fills the team with random Pokémon, then removes all but `keep` of them. */
export async function randomTeam(page: Page, keep: number): Promise<void> {
  await page.getByRole('button', { name: /^(Fill with random Pokémon|Completar con)/ }).click();
  const cards = page.locator('article.phone-card');
  await expect(cards.first()).toBeVisible();
  const total = await cards.count();
  for (let left = total; left > keep; left--) {
    await page
      .getByRole('button', { name: /^(Remove|Quitar a) / })
      .first()
      .click();
    await expect(cards).toHaveCount(left - 1);
  }
}

const LABELS = {
  fight: /^(FIGHT|LUCHAR)$/,
  forced: /^(Choose your next Pokémon|Elige tu siguiente Pokémon)$/,
  switchIn: /^(Switch in|Cambiar)$/,
  target: /: (choose a target|elige un objetivo)$/,
};

/**
 * One decision on a phone, if it has one: every position it controls uses its first usable move
 * (at the first target that can be picked), and forced switches send the first Pokémon available.
 * Each pass looks at the view the phone shows now (menu, moves, targets, forced switch), so a view
 * that renders late is simply handled on the next pass.
 */
export async function playTurn(page: Page): Promise<void> {
  for (let pass = 0; pass < 8; pass++) {
    if (await page.getByRole('heading', { name: LABELS.target }).isVisible()) {
      await page.locator('button.party-row:not([disabled])').first().click();
    } else if (await page.locator('.move-btn').first().isVisible()) {
      const move = page.locator('.move-btn:not([disabled])').first();
      if (!(await move.isVisible())) return;
      // First tap selects, second tap uses it.
      if ((await move.getAttribute('aria-pressed')) !== 'true') await move.click();
      await move.click();
    } else if (await page.getByRole('button', { name: LABELS.fight }).isVisible()) {
      await page.getByRole('button', { name: LABELS.fight }).click();
    } else if (await page.getByRole('heading', { name: LABELS.forced }).isVisible()) {
      if (!(await switchIn(page))) return;
    } else {
      return;
    }
    await page.waitForTimeout(150);
  }
}

/** Opens the first Pokémon that can come in and sends it; false when none can. */
async function switchIn(page: Page): Promise<boolean> {
  const rows = page.locator('button.party-row:not(.party-row--fainted)');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await rows.nth(i).click();
    const button = page.getByRole('button', { name: LABELS.switchIn });
    if (await button.isEnabled({ timeout: 2_000 }).catch(() => false)) {
      await button.click();
      return true;
    }
    await page.keyboard.press('Escape');
  }
  return false;
}
/** Plays every phone until the Host shows the results (its Rematch button). */
export async function playToTheEnd(host: Page, phones: Page[], timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await host.getByRole('button', { name: /^(Rematch|Revancha)$/ }).isVisible()) return;
    expect(Date.now(), 'battle took too long').toBeLessThan(deadline);
    await Promise.all(phones.map((page) => playTurn(page)));
    await host.waitForTimeout(400);
  }
}
