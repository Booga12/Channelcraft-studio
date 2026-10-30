// Guide 4 on the website: "Console logos and artwork".
import { appMenu, dialog, NO_TOUR, quickClear, quickTheme, showScreen } from '../helpers.mjs';

export default {
  slug: 'logos-and-art',
  title: 'Console logos and artwork',
  order: 4,
  localStorage: NO_TOUR,
  cursorStart: [900, 560],
  async setup(ctx) {
    await quickTheme(ctx.page, 'Arcade Nights');
    await quickClear(ctx.page);
  },
  steps: [
    {
      id: 'console-logos',
      title: 'Console logos on the System menu',
      shows: 'The screen menu is switched to "System menu", the first screen RetroBat shows. The console logos sit in the carousel along the bottom with a big picture of the selected console. "Previous console" under the preview steps to the PlayStation and then the Nintendo 64, and the carousel slides to each one.',
      uiLabels: ['System menu', 'Previous console', 'Next console'],
      async run(ctx) {
        const { page } = ctx;
        await showScreen(ctx, 'System menu');
        await ctx.pause(700);
        const prev = page.getByRole('button', { name: 'Previous console' });
        await ctx.click(prev, { after: 1300 });
        await ctx.click(prev, { after: 1500 });
        await ctx.moveTo({ x: 920, y: 420 }, { ms: 800 });
      },
    },
    {
      id: 'game-art',
      title: 'Box art, screenshots and videos on the game list',
      shows: 'On "Game list (video)", the preview shows the selected game\'s video, logo, description and details from RetroBat\'s scraped media. "Next game" moves to the next game and the artwork and video change with it.',
      uiLabels: ['Game list (video)', 'Next game'],
      async run(ctx) {
        const { page } = ctx;
        await showScreen(ctx, 'Game list (video)');
        await ctx.pause(2200);
        const next = page.getByRole('button', { name: 'Next game' });
        await ctx.click(next, { after: 2600 });
        await ctx.moveTo({ x: 700, y: 430 }, { ms: 800 });
      },
    },
    {
      id: 'where-art-comes-from',
      title: 'Where the artwork comes from',
      shows: 'Settings > Preview has the two switches for artwork in the preview. "Show my own games" uses the box art, screenshots, videos and descriptions RetroBat scraped for your games (off shows sample games). "Fill missing pictures from libretro-thumbnails" fetches box art from the internet for games that have none.',
      uiLabels: ['Settings…', 'Preview', 'Show my own games', 'Fill missing pictures from libretro-thumbnails'],
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(page.getByRole('button', { name: 'Theme menu' }), { after: 500 });
        await ctx.click(page.getByRole('menuitem', { name: /^Settings…/ }), { after: 900 });
        const d = dialog(page);
        await ctx.click(d.getByRole('tab', { name: 'Preview' }), { after: 900 });
        await ctx.hover(d.getByText('Show my own games', { exact: true }), { hold: 1400 });
        await ctx.hover(d.getByText(/Fill missing pictures from libretro/).first(), { hold: 1600 });
      },
      async after(ctx) {
        await quickClear(ctx.page);
      },
    },
    {
      id: 'check-media',
      title: 'Check your game media',
      shows: 'File > "Check game media…" and "Start check" go through every console\'s scraped games and list missing or broken pictures and videos, which can be filtered by kind and console and saved as a report.',
      uiLabels: ['File', 'Check game media…', 'Start check', 'Save report (CSV)…'],
      async before(ctx) {
        await quickClear(ctx.page);
      },
      async run(ctx) {
        const { page } = ctx;
        await appMenu(ctx, 'File', 'Check game media…');
        const d = dialog(page);
        await d.waitFor();
        await ctx.pause(900);
        await ctx.click(d.getByRole('button', { name: 'Start check' }), { after: 2600 });
        await ctx.hover(d.getByRole('button', { name: 'Save report (CSV)…' }), { hold: 900 });
      },
    },
  ],
};
