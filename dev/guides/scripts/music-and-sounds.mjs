// Guide 5 on the website: "Music and sounds" (the Sound panel, and your own files in Assets).
import { dockButton, NO_TOUR, panel, quickClear, quickTheme } from '../helpers.mjs';

const row = (page, name) => panel(page).locator('.row').filter({ has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) });

export default {
  slug: 'music-and-sounds',
  title: 'Music and sounds',
  order: 5,
  localStorage: NO_TOUR,
  cursorStart: [900, 560],
  async setup(ctx) {
    await quickTheme(ctx.page, 'Arcade Nights');
    await quickClear(ctx.page);
  },
  steps: [
    {
      id: 'menu-music',
      title: 'Pick menu music',
      shows: 'Sound is opened from the tools column. Under "Menu music" are songs made by the app, free to use and share. The play button next to "Night Drive" plays it to listen first, and "Use" makes it the theme\'s menu music ("In use").',
      uiLabels: ['Sound', 'Menu music', 'Night Drive', 'Use', 'In use'],
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(dockButton(page, 'sound'), { after: 900 });
        await ctx.hover(panel(page).getByText('Menu music', { exact: true }), { hold: 500 });
        await ctx.click(page.getByRole('button', { name: 'Listen to Night Drive' }), { after: 1500 });
        await ctx.click(page.getByRole('button', { name: 'Stop Night Drive' }), { after: 400 });
        await ctx.click(row(page, 'Night Drive').getByRole('button', { name: 'Use' }), { after: 400 });
        await row(page, 'Night Drive').getByText('In use').waitFor({ timeout: 20000 });
        await ctx.pause(900);
      },
    },
    {
      id: 'own-song',
      title: 'Use your own song',
      shows: '"Use my own song…" opens a list of the sounds in your Assets, with "From my computer…" for a file on the PC. "Neon Skyline.ogg" from the Music folder is picked: it is copied into the theme, shown as "Your own song" and "In use", and added to Assets for next time. In the real app a Windows file window opens for the pick; the clip skips it.',
      uiLabels: ['Use my own song…', 'Your sounds in Assets', 'From my computer…', 'Your own song', 'In use'],
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(panel(page).getByRole('button', { name: 'Use my own song…' }), { after: 900 });
        await ctx.hover(panel(page).getByText('Your sounds in Assets'), { hold: 600 });
        await ctx.answerDialog('C:\\Users\\Player\\Music\\Neon Skyline.ogg');
        await ctx.click(panel(page).getByRole('button', { name: 'From my computer…' }), { after: 400 });
        await panel(page).getByText('Your own song').first().waitFor({ timeout: 20000 });
        await ctx.pause(500);
        await ctx.hover(panel(page).getByText('Your own song').first(), { hold: 900 });
      },
    },
    {
      id: 'scroll-sound',
      title: 'Choose the scroll sound',
      shows: 'Further down the Sound panel, "Scroll sound" is the sound RetroBat plays each time you move through the consoles or the game list. "8-bit blip" is listened to and then used.',
      uiLabels: ['Scroll sound', '8-bit blip', 'Use', 'In use'],
      async run(ctx) {
        const { page } = ctx;
        const head = panel(page).getByText('Scroll sound', { exact: true });
        await ctx.moveTo({ x: 240, y: 520 }, { ms: 600 });
        await ctx.scroll(null, 380, { ms: 700 });
        await ctx.hover(head, { hold: 500 });
        await ctx.click(page.getByRole('button', { name: 'Listen to 8-bit blip' }), { after: 900 });
        await ctx.click(row(page, '8-bit blip').getByRole('button', { name: 'Use' }), { after: 400 });
        await row(page, '8-bit blip').getByText('In use').waitFor({ timeout: 20000 });
        await ctx.pause(900);
      },
    },
    {
      id: 'assets',
      title: 'Keep your own files in Assets',
      shows: 'Assets holds your own pictures, videos, sounds and fonts, ready for any theme. "Add" picks files from the PC (here two songs from the Music folder); they show up in the list next to the song picked earlier. The "Sounds" filter shows only sounds: your files first, then the songs and scroll sounds made by the app, free to use and share.',
      uiLabels: ['Assets', 'Add', 'Sounds', 'Your files', 'Made by the app'],
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(dockButton(page, 'assets'), { after: 900 });
        await ctx.answerDialog(['C:\\Users\\Player\\Music\\Midnight Arcade.ogg', 'C:\\Users\\Player\\Music\\Pixel Harbor.ogg']);
        await ctx.click(panel(page).getByRole('button', { name: 'Add', exact: true }), { after: 400 });
        await panel(page).getByText(/Pixel Harbor/).first().waitFor({ timeout: 20000 });
        await ctx.pause(900);
        await ctx.click(panel(page).getByRole('tab', { name: /^Sounds/ }), { after: 1200 });
        await ctx.hover(panel(page).getByText(/Midnight Arcade/).first(), { hold: 900 });
      },
    },
    {
      id: 'drag-from-windows',
      title: 'Drop a sound straight onto Menu music',
      skipped: 'This uses Windows File Explorer: with the Sound panel open, drag a sound file from Explorer onto "Menu music" or "Scroll sound" ("Drop the sound here to use it as the menu music"). Files dragged in from Windows can\'t be filmed in the browser version of the app. The still shows the Sound panel those two drop areas are in.',
      async still(ctx) {
        const { page } = ctx;
        await ctx.place(1300, 820);
        await dockButton(page, 'sound').click();
        await page.waitForTimeout(900);
      },
    },
  ],
};
