// Guide 3 on the website: "Colours, fonts and backgrounds".
import { dockButton, inspector, NO_TOUR, panel, quickClear, quickScreen, quickTheme } from '../helpers.mjs';

export default {
  slug: 'change-the-look',
  title: 'Colours, fonts and backgrounds',
  order: 3,
  localStorage: NO_TOUR,
  cursorStart: [900, 560],
  async setup(ctx) {
    await quickTheme(ctx.page, 'Arcade Nights');
    await quickClear(ctx.page);
  },
  steps: [
    {
      id: 'palette',
      title: 'Try a colour palette',
      shows: 'Presets is opened from the tools column and scrolled down to "Colour palettes". Clicking the "Neon" palette, then "Starry night", recolours the whole theme at once in the live preview: the list highlight, the text and the panels.',
      uiLabels: ['Presets', 'Colour palettes', 'Neon', 'Starry night'],
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(dockButton(page, 'presets'), { after: 700 });
        const head = panel(page).getByText('Colour palettes', { exact: true });
        await ctx.moveTo({ x: 240, y: 520 }, { ms: 600 });
        for (let i = 0; i < 12 && !(await head.isVisible().then(async (v) => v && (await head.boundingBox()).y < 420)); i++) await ctx.scroll(null, 900, { ms: 260 });
        await ctx.pause(400);
        await ctx.click(panel(page).getByTitle('Apply the Neon palette'), { after: 1400 });
        await ctx.click(panel(page).getByTitle('Apply the Starry night palette'), { after: 1400 });
      },
    },
    {
      id: 'colours',
      title: 'Change one colour everywhere',
      shows: 'Colours is opened. Each colour there is used in many places at once. The "Design accent" colour code is replaced with a new one (FF2E88FF) and Enter is pressed: the list highlight and every other part that uses the accent change together.',
      uiLabels: ['Colours', 'Design accent'],
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(dockButton(page, 'variables'), { after: 800 });
        const field = panel(page).locator('div.var').filter({ has: page.locator('span.name', { hasText: /^Design accent$/ }) }).locator('input.hex');
        await ctx.click(field, { after: 200 });
        await ctx.type('FF2E88FF', { clear: true });
        await ctx.press('Enter', 1300);
        await ctx.moveTo({ x: 1150, y: 360 }, { ms: 900 });
      },
    },
    {
      id: 'select-element',
      title: 'Click a part to change it',
      shows: 'The game\'s name in the preview is clicked: it gets a frame with handles, and the panel on the right shows what can be changed for it. One click on the "Neon" quick look gives it a new free font, capitals and a glow.',
      uiLabels: ['Game name', 'Quick looks', 'Neon'],
      async run(ctx) {
        const { page } = ctx;
        await quickClear(page);
        await ctx.click(page.locator('.el[data-name="ccs_title"]').first(), { position: [110, 18], after: 1100 });
        await inspector(page).getByText('Quick looks').waitFor();
        await ctx.hover(inspector(page).getByText('Quick looks'), { hold: 500 });
        await ctx.click(inspector(page).getByTitle('Neon: font, capitals and glow in one click'), { after: 1500 });
        await ctx.moveTo({ x: 640, y: 450 }, { ms: 800 });
      },
    },
    {
      id: 'font',
      title: 'Pick a free font',
      shows: 'With the game name still selected, "More fonts: free ones, or from your PC…" and then the "…" button open the font list. On the "Free fonts" tab, typing "Press Start" finds "Press Start 2P"; clicking it downloads the font into the theme and the name changes to it in the preview.',
      uiLabels: ['More fonts: free ones, or from your PC…', 'Free fonts', 'Press Start 2P'],
      async run(ctx) {
        const { page } = ctx;
        const ins = inspector(page);
        await ctx.click(ins.getByRole('button', { name: 'More fonts: free ones, or from your PC…' }), { after: 600 });
        await ctx.click(ins.locator('button', { hasText: /^…$/ }).first(), { after: 600 });
        await ctx.click(ins.getByRole('tab', { name: 'Free fonts' }), { after: 600 });
        await ctx.type('Press Start', { into: ins.getByPlaceholder('Filter fonts…') });
        await ctx.pause(700);
        await ctx.click(ins.getByRole('button', { name: /Press Start 2P/ }).first(), { after: 600 });
        await page.waitForFunction(() => !document.querySelector('[data-panel=inspector] button.item[disabled]'), null, { timeout: 30000 }).catch(() => {});
        await ctx.pause(1200);
        await ctx.moveTo({ x: 640, y: 470 }, { ms: 800 });
      },
    },
    {
      id: 'background',
      title: 'Give the background some movement',
      shows: 'On the System menu screen, Presets is opened at "Moving background". The "Space" kind is picked and then a scene; the app makes a short looping video in the theme\'s colours and it plays behind the console picture in the preview.',
      uiLabels: ['System menu', 'Presets', 'Moving background', 'Space', 'Playing now'],
      leadIn: 500,
      async before(ctx) {
        await quickClear(ctx.page);
        await quickScreen(ctx.page, 'System menu');
        await ctx.page.locator('[data-tour=panel-presets]').click();
        await ctx.page.waitForTimeout(500);
        await panel(ctx.page).getByText('Moving background', { exact: true }).scrollIntoViewIfNeeded();
        await ctx.page.mouse.wheel(0, 0);
        await ctx.page.waitForTimeout(600);
      },
      async run(ctx) {
        const { page } = ctx;
        const p = panel(page);
        await ctx.hover(p.getByText('Moving background', { exact: true }), { hold: 500 });
        await ctx.click(p.getByRole('radio', { name: /^Space/ }), { after: 700 });
        const tile = p.locator('button.tile').nth(1);
        await ctx.hover(tile, { hold: 700 });
        await ctx.click(tile, { after: 300 });
        await p.getByText('Playing now:').waitFor({ timeout: 30000 });
        await ctx.pause(600);
        await ctx.moveTo({ x: 900, y: 300 }, { ms: 900 });
        await ctx.pause(1500);
      },
    },
    {
      id: 'undo',
      title: 'Undo, or go back in History',
      shows: 'The Undo arrow at the top takes back the last change (the moving background goes). History, in the tools column, lists every change made; clicking an earlier one ("Opened theme" at the top) goes straight back to it, and the preview shows the theme as it was.',
      uiLabels: ['Undo', 'History', 'Opened theme'],
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(page.getByRole('button', { name: /^Undo/ }).first(), { after: 1300 });
        await ctx.click(dockButton(page, 'history'), { after: 1000 });
        await ctx.hover(panel(page).getByRole('button').nth(3), { hold: 500 });
        await ctx.click(panel(page).getByText('Opened theme'), { after: 1600 });
        await ctx.moveTo({ x: 900, y: 420 }, { ms: 800 });
      },
    },
  ],
};
