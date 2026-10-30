// Guide 6 on the website: "Try it in RetroBat, safely" (saving with backups, Try in RetroBat,
// History, restoring a backup, and unsaved changes kept when the app closes).
import { appMenu, dialog, dockButton, editorReady, NO_TOUR, panel, quickClear, quickTheme, toast } from '../helpers.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A quick colour change without the pointer (setup). */
async function quickPalette(page, name) {
  await dockButton(page, 'presets').click();
  await sleep(400);
  await panel(page).getByTitle(`Apply the ${name} palette`).click();
  await sleep(700);
  await quickClear(page);
}

export default {
  slug: 'try-it-safely',
  title: 'Try it in RetroBat, safely',
  order: 6,
  localStorage: NO_TOUR,
  // Autosave off (the default), so unsaved changes stay unsaved for the recovery step.
  prefs: { autosaveMinutes: 0, keepRecovery: true },
  cursorStart: [900, 560],
  async setup(ctx) {
    const { page } = ctx;
    await quickTheme(page, 'Arcade Nights');
    // A new session (the app opened again), so the first save makes its backup on camera.
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('button[aria-label^="Open Arcade Nights"]').click({ timeout: 30000 });
    await editorReady(page, 'Arcade Nights');
    await quickClear(page);
    await quickPalette(page, 'Neon');
  },
  steps: [
    {
      id: 'save',
      title: 'Save, with a backup first',
      shows: 'A dot next to the theme\'s name and the blue "Save" button show there are unsaved changes; nothing reaches RetroBat until you save. Save is clicked: the message says how many files were saved and the button turns to "Saved". Before anything is written in a session, the app makes a backup of the whole theme first.',
      uiLabels: ['Unsaved changes', 'Save', 'Saved'],
      poster: 'saved',
      async run(ctx) {
        const { page } = ctx;
        await ctx.hover(page.getByRole('img', { name: 'Unsaved changes' }), { hold: 700 });
        await ctx.click(page.locator('[data-tour=save]'), { after: 300 });
        await toast(page, 'Saved ');
        await ctx.pause(500);
        ctx.clip.mark('saved');
        await ctx.pause(700);
        await ctx.moveTo({ x: 900, y: 450 }, { ms: 900 });
      },
    },
    {
      id: 'try-in-retrobat',
      title: 'Try it in RetroBat',
      shows: '"Try in RetroBat" saves anything unsaved, makes this theme the one RetroBat uses ("In use by RetroBat" appears under its name) and starts RetroBat to see it on the TV. RetroBat\'s own settings are backed up first. If RetroBat is already open, the app asks to restart it.',
      uiLabels: ['Try in RetroBat', 'In use by RetroBat'],
      poster: 'started',
      async run(ctx) {
        const { page } = ctx;
        const btn = page.getByRole('button', { name: /Try in RetroBat/ });
        await ctx.hover(btn, { hold: 900 });
        await ctx.click(btn, { after: 300 });
        await toast(page, 'Starting RetroBat with');
        await ctx.pause(500);
        ctx.clip.mark('started');
        await ctx.pause(400);
        await ctx.hover(page.getByText('In use by RetroBat').first(), { hold: 1200 });
      },
    },
    {
      id: 'retrobat',
      title: 'Look at it in RetroBat',
      skipped: 'This part happens in RetroBat itself, on the TV or monitor, so it can\'t be filmed in the app. Look through the System menu and a few game lists with your controller; close RetroBat to come back to ChannelCraft and keep editing.',
    },
    {
      id: 'history',
      leadIn: 400,
      hold: 1000,
      title: 'Go back with History',
      shows: 'Two more palettes are tried. History lists every change in order; clicking an earlier entry ("Palette “Neon”") goes straight back to it in the preview, and the later ones stay listed in grey so you can go forward again.',
      uiLabels: ['Presets', 'History', 'Palette “Neon”'],
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(dockButton(page, 'presets'), { after: 700 });
        const head = panel(page).getByText('Colour palettes', { exact: true });
        await ctx.moveTo({ x: 240, y: 520 }, { ms: 500 });
        for (let i = 0; i < 12 && !(await head.isVisible().then(async (v) => v && (await head.boundingBox()).y < 420)); i++) await ctx.scroll(null, 900, { ms: 200 });
        await ctx.click(panel(page).getByTitle('Apply the Lava palette'), { after: 700 });
        await ctx.click(panel(page).getByTitle('Apply the Forest palette'), { after: 700 });
        await ctx.click(dockButton(page, 'history'), { after: 700 });
        await ctx.click(panel(page).getByText('Palette “Neon”'), { after: 1300 });
        await ctx.moveTo({ x: 900, y: 420 }, { ms: 800 });
      },
      async after(ctx) {
        await quickClear(ctx.page);
      },
    },
    {
      id: 'restore-backup',
      title: 'Restore a backup',
      shows: 'File > "Restore a backup…" lists the backups of this theme, made before the first save of each session and before every restore. "Restore" on one, then "Restore" in the question, puts the whole theme back exactly as it was in that backup.',
      uiLabels: ['File', 'Restore a backup…', 'Restore a backup', 'Restore'],
      poster: 'list',
      hold: 1000,
      async run(ctx) {
        const { page } = ctx;
        await appMenu(ctx, 'File', 'Restore a backup…');
        const d = dialog(page).filter({ hasText: 'Restore a backup' });
        await d.getByRole('button', { name: 'Restore', exact: true }).first().waitFor({ timeout: 20000 });
        await ctx.pause(300);
        ctx.clip.mark('list');
        await ctx.pause(500);
        await ctx.click(d.getByRole('button', { name: 'Restore', exact: true }).first(), { after: 900 });
        await ctx.answerMessage('ok', { after: 400 });
        await page.locator('[data-sonner-toast]').first().waitFor({ timeout: 30000 });
        await ctx.pause(900);
      },
      async after(ctx) {
        await quickClear(ctx.page);
      },
    },
    {
      id: 'recovery',
      title: 'Get unsaved changes back',
      shows: 'Unsaved changes are kept on the side while you work. After the app was closed without saving, opening the theme again asks "Restore unsaved changes"; "Restore" brings the changes back, and Save keeps them.',
      uiLabels: ['Restore unsaved changes', 'Restore', 'Discard them'],
      hold: 1800,
      async before(ctx) {
        const { page } = ctx;
        await quickClear(page);
        await quickPalette(page, 'Hologram');
        // The app keeps unsaved edits every 20 s; then it "closes" (the page reloads).
        await sleep(22000);
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByText('Welcome to ChannelCraft Studio').waitFor({ timeout: 30000 });
        await page.locator('button[aria-label^="Open Arcade Nights"]').waitFor({ timeout: 30000 });
        await page.evaluate(() => document.fonts.ready);
        await ctx.place(900, 560);
        await sleep(600);
      },
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(page.locator('button[aria-label^="Open Arcade Nights"]'), { after: 600 });
        await page.locator('[data-demo-dialog]').waitFor({ timeout: 30000 });
        await ctx.pause(1500);
        await ctx.answerMessage('ok', { after: 400 });
        await toast(page, 'Unsaved changes restored');
        await editorReady(page, 'Arcade Nights');
        await ctx.pause(600);
      },
    },
  ],
};
