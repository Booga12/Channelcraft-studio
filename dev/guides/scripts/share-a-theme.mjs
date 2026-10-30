// Guide 7 on the website: "Share a theme" (Share theme… as one zip, and Import a theme).
import { appMenu, dialog, editorReady, NO_TOUR, quickClear, quickTheme, toast } from '../helpers.mjs';

export default {
  slug: 'share-a-theme',
  title: 'Share a theme',
  order: 7,
  localStorage: NO_TOUR,
  cursorStart: [900, 560],
  async setup(ctx) {
    await quickTheme(ctx.page, 'Arcade Nights');
    await quickClear(ctx.page);
  },
  steps: [
    {
      id: 'share',
      title: 'Share your theme as one zip',
      shows: 'File > "Share theme…" saves the theme first, adds a preview picture taken from the screen if it has none, and packs the whole theme into one .zip (here "Arcade Nights.zip" on the Desktop). The message says it is ready to share and that others add it with "Import a theme". In the real app a Windows save window asks where to put the zip; the clip skips it.',
      uiLabels: ['File', 'Share theme…', 'Show file'],
      hold: 2200,
      async run(ctx) {
        const { page } = ctx;
        await ctx.answerDialog('C:\\Users\\Player\\Desktop\\Arcade Nights.zip');
        await appMenu(ctx, 'File', 'Share theme…');
        await toast(page, 'is ready to share');
        await ctx.pause(600);
        await ctx.hover(page.locator('[data-sonner-toast]').filter({ hasText: 'is ready to share' }).first(), { hold: 600 });
      },
    },
    {
      id: 'whats-inside',
      title: 'What\'s in the zip',
      skipped: 'Looking inside the zip happens in Windows File Explorer ("Show file" in the message opens its folder), which can\'t be filmed in the browser version of the app. The zip holds the theme\'s folder: theme.xml and its other XML files, the pictures, fonts, sounds and videos it uses (with the fonts\' licence files), and preview.png. Nothing from your games or your RetroBat settings goes in.',
    },
    {
      id: 'import',
      title: 'Install a theme someone shared',
      shows: 'On the start screen, "Import a theme" opens the import window. "Choose a .zip…" picks "Sunset Drive.zip" from Downloads; the app looks inside first and says how many files will come in (only theme files: XML, pictures, fonts, sounds, videos, shaders and text; programs and scripts never). "Import" adds it as a new theme and opens it. In the real app a Windows file window opens for the pick; the clip skips it.',
      uiLabels: ['Import a theme', 'Choose a .zip…', 'Import'],
      poster: 'checked',
      async before(ctx) {
        const { page } = ctx;
        await page.getByRole('button', { name: 'Theme menu' }).click();
        await page.getByRole('menuitem', { name: 'Close theme' }).click();
        await page.getByText('Welcome to ChannelCraft Studio').waitFor({ timeout: 30000 });
        // The message from the share step is still up: close it, so it isn't in this clip.
        for (const b of await page.locator('[data-sonner-toast] [data-close-button]').all()) await b.click().catch(() => {});
        await page.waitForTimeout(900);
      },
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(page.getByRole('button', { name: /Import a theme/ }), { after: 900 });
        const d = dialog(page);
        await ctx.answerDialog('C:\\Users\\Player\\Downloads\\Sunset Drive.zip');
        await ctx.click(d.getByRole('button', { name: 'Choose a .zip…' }), { after: 400 });
        await d.getByText(/will be imported/).waitFor({ timeout: 30000 });
        await ctx.pause(900);
        await ctx.hover(d.getByText(/will be imported/), { hold: 600 });
        ctx.clip.mark('checked');
        await ctx.pause(600);
        await ctx.click(d.getByRole('button', { name: 'Import', exact: true }), { after: 300 });
        await editorReady(page, 'Sunset Drive');
        await ctx.pause(600);
      },
    },
  ],
};
