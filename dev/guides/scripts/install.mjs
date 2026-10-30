// Guide 1 on the website: "Install and first start". The installer itself runs in Windows, so it
// has no clip; the first start is filmed as if RetroBat wasn't found on its own, so the folder
// question shows.
import { dialog } from '../helpers.mjs';

export default {
  slug: 'install',
  title: 'Install and first start',
  order: 1,
  localStorage: { 'ccs.tourDone': '1' },
  cursorStart: [1000, 640],
  async context(context) {
    // A PC where the app can't find RetroBat by itself: it asks where it is.
    await context.route(/\/__dev\/cmd\/detect_retrobat$/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, value: null }) }));
  },
  async ready(page) {
    await page.getByText('Where is RetroBat installed?').waitFor({ timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
  },
  steps: [
    {
      id: 'download',
      title: 'Download and run the installer',
      skipped: 'The installer is a Windows program (ChannelCraft Studio setup), so it runs outside the app and can\'t be filmed in the browser. Download it from the website, run it and follow its steps; Windows may ask to confirm because it is a new app.',
    },
    {
      id: 'choose-folder',
      title: 'Tell the app where RetroBat is',
      shows: 'On the very first start, if the app can\'t find RetroBat by itself, it asks "Where is RetroBat installed?". "Choose RetroBat folder…" is clicked and the RetroBat folder (the one with RetroBat.exe in it, here C:\\RetroBat) is picked. The start screen then fills in with the themes that are already installed. In the real app a Windows folder window opens for the pick; the clip skips that window.',
      uiLabels: ['Where is RetroBat installed?', 'Choose RetroBat folder…'],
      async run(ctx) {
        const { page } = ctx;
        await ctx.hover(page.getByText('Where is RetroBat installed?'), { hold: 700 });
        await ctx.answerDialog('C:\\RetroBat');
        await ctx.click(page.getByRole('button', { name: 'Choose RetroBat folder…' }), { after: 400 });
        await page.getByText('Welcome to ChannelCraft Studio').waitFor({ timeout: 30000 });
        await page.locator('button[aria-label^="Open "]').first().waitFor({ timeout: 30000 });
        await ctx.pause(900);
        await ctx.hover(page.getByText('RetroBat folder', { exact: true }), { hold: 900 });
      },
    },
    {
      id: 'start-screen',
      title: 'The start screen',
      shows: 'A look around the start screen: "Start a new theme", "Remix the theme you use", "Import a theme" and "How it works" at the top; "Your themes" below, with the theme RetroBat uses now marked "Active in RetroBat"; and the side bar with New theme, Settings and the RetroBat folder.',
      uiLabels: ['Welcome to ChannelCraft Studio', 'Start a new theme', 'Remix the theme you use', 'Import a theme', 'How it works', 'Your themes', 'Active in RetroBat', 'New theme', 'Settings'],
      async run(ctx) {
        const { page } = ctx;
        for (const name of [/Start a new theme/, /Remix the theme you use/, /Import a theme/, /How it works/]) await ctx.hover(page.getByRole('button', { name }), { hold: 650 });
        await ctx.hover(page.getByText('Active in RetroBat'), { hold: 900 });
        await ctx.hover(page.getByRole('button', { name: 'New theme', exact: true }), { hold: 700 });
        await ctx.hover(page.getByRole('button', { name: 'Settings', exact: true }), { hold: 700 });
      },
    },
    {
      id: 'how-it-works',
      title: 'Read "How it works"',
      shows: '"How it works" is clicked and the "Getting started" window opens with the four steps (pick a screen, click something to change it, move, restyle and add, save and try it) and the words you\'ll see (element, layer, options, colours). The pointer reads down the steps, then "Got it" closes it.',
      uiLabels: ['How it works', 'Getting started', 'Got it'],
      poster: 'open',
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(page.getByRole('button', { name: /How it works/ }), { after: 1200 });
        const d = dialog(page);
        await d.waitFor();
        ctx.clip.mark('open');
        await ctx.pause(900);
        for (const t of ['Pick a screen', 'Click something to change it', 'Move, restyle, add', 'Save and try it']) await ctx.hover(d.getByText(t, { exact: true }), { hold: 700 });
        await ctx.hover(d.getByText('Words you\'ll see'), { hold: 900 });
        await ctx.click(d.getByRole('button', { name: 'Got it' }), { after: 600 });
      },
    },
  ],
};
