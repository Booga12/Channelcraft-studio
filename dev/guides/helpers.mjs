// Shared moves for the guide scripts in ./scripts (not a guide itself: record.mjs only loads
// ./scripts). The quick* helpers act without the drawn pointer, for setup that isn't recorded.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The base preferences every guide starts from (record.mjs adds the guide's own on top). */
export const NO_TOUR = { 'ccs.tourDone': '1', 'ccs.askCopy': '0' };

export const dialog = (page) => page.getByRole('dialog');
export const dockButton = (page, id) => page.locator(`[data-tour="panel-${id}"]`);
export const inspector = (page) => page.locator('[data-panel=inspector]');
export const panel = (page) => page.locator('[data-panel=dock]');

/** Waits until the editor shows the theme and nothing is loading or building. */
export async function editorReady(page, name) {
  await page.locator('header').getByText(name, { exact: true }).first().waitFor({ timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'), null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(600);
}

/**
 * Makes a theme with the New theme wizard (not recorded): the name, and optionally a style chip
 * and a design by its card name.
 */
export async function quickTheme(page, name = 'Arcade Nights', { design } = {}) {
  await page.getByRole('button', { name: /Start a new theme/ }).click();
  const d = dialog(page);
  await d.locator('input').first().waitFor();
  await sleep(300);
  await d.locator('input').first().fill(name);
  if (design) {
    await d.getByRole('button', { name: 'Next', exact: true }).click();
    await d.locator('label').filter({ hasText: design }).first().click();
  }
  await d.getByRole('button', { name: 'Create and open', exact: true }).click();
  await editorReady(page, name);
}

/** Switches the preview to a screen by its name in the screen menu (not recorded). */
export async function quickScreen(page, label) {
  await page.getByTitle('Which screen of the theme to show').click();
  await page.getByRole('menuitem', { name: new RegExp(`^${label.replace(/[()]/g, '\\$&')}`) }).click();
  await sleep(1200);
}

/** Switches the preview to a screen with the pointer (recorded). */
export async function showScreen(ctx, label) {
  const { page } = ctx;
  await ctx.click(page.getByTitle('Which screen of the theme to show'), { after: 500 });
  await ctx.click(page.getByRole('menuitem', { name: new RegExp(`^${label.replace(/[()]/g, '\\$&')}`) }), { after: 900 });
}

/** Opens a top-bar menu (the logo button) and picks an item by its label (recorded). */
export async function appMenu(ctx, menu, item) {
  const { page } = ctx;
  await ctx.click(page.getByRole('button', { name: 'Theme menu' }), { after: 400 });
  const sub = page.getByRole('menuitem', { name: menu, exact: true });
  await ctx.hover(sub, { hold: 300 });
  // Along the row first, so the pointer doesn't cross the other menus on its way to the submenu.
  const box = await sub.boundingBox();
  await ctx.moveTo({ x: box.x + box.width + 30, y: box.y + box.height / 2 }, { ms: 380 });
  await ctx.click(page.getByRole('menuitem', { name: item }).first(), { after: 600 });
}

/** Closes whatever is open (panels, the inspector, menus) without the pointer. */
export async function quickClear(page) {
  // Escape is ignored while typing in a field, so leave the field first.
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await sleep(120);
  }
  await sleep(400);
}

/** Waits for a toast with this text (svelte-sonner). */
export async function toast(page, text, timeout = 30000) {
  await page.locator('[data-sonner-toast]').filter({ hasText: text }).first().waitFor({ timeout });
}

/**
 * Picks an option in a native <select> (recorded). A headless browser draws no drop-down list,
 * so the pointer clicks the box and the choice is made directly.
 */
export async function pickOption(ctx, select, value) {
  const { page } = ctx;
  await ctx.moveTo(select);
  await ctx.pause(150);
  await page.evaluate(() => {
    window.__cursor.down();
    window.__cursor.ripple();
  });
  await ctx.pause(120);
  await page.evaluate(() => window.__cursor.up());
  await ctx.pause(350);
  await select.selectOption(value);
  await ctx.pause(700);
}
