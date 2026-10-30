// Guide 8 on the website: "Make the app yours" (Settings > Appearance, and Simple or Advanced).
import { dialog, dockButton, NO_TOUR, pickOption, quickClear, quickTheme } from '../helpers.mjs';

const settings = (page) => dialog(page);

export default {
  slug: 'make-it-yours',
  title: 'Make the app yours',
  order: 8,
  localStorage: NO_TOUR,
  cursorStart: [700, 600],
  steps: [
    {
      id: 'open-appearance',
      title: 'Open Settings > Appearance',
      shows: 'Settings is clicked in the side bar of the start screen. The Settings window opens and "Appearance" is picked from its list: Light or dark, Accent colour, Logo colour and Interface size.',
      uiLabels: ['Settings', 'Appearance', 'Light or dark', 'Accent colour', 'Logo colour', 'Interface size'],
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(page.getByRole('button', { name: 'Settings', exact: true }), { after: 900 });
        await ctx.click(settings(page).getByRole('tab', { name: 'Appearance' }), { after: 900 });
        for (const t of ['Light or dark', 'Accent colour', 'Logo colour', 'Interface size']) await ctx.hover(settings(page).getByText(t, { exact: true }), { hold: 550 });
      },
    },
    {
      id: 'light-dark',
      title: 'Switch between light and dark',
      shows: '"Light or dark" is set to Light and the whole app turns light at once, then back to Dark. "System" follows the Windows setting.',
      uiLabels: ['Light or dark', 'Light', 'Dark', 'System'],
      poster: 'light',
      async run(ctx) {
        const { page } = ctx;
        const sel = settings(page).getByRole('combobox', { name: 'Light or dark' });
        await pickOption(ctx, sel, 'light');
        ctx.clip.mark('light');
        await ctx.pause(1400);
        await pickOption(ctx, sel, 'dark');
        await ctx.pause(500);
      },
    },
    {
      id: 'accent',
      title: 'Pick an accent colour',
      shows: 'Different swatches under "Accent colour" are clicked. The highlight colour of the app (buttons, the selected tab, toggles) changes with each one.',
      uiLabels: ['Accent colour'],
      poster: 'pink',
      async run(ctx) {
        const { page } = ctx;
        const swatches = settings(page).getByRole('radiogroup', { name: 'Accent colour' }).getByRole('radio');
        const n = await swatches.count();
        for (const i of [2, 3, Math.min(5, n - 1)]) await ctx.click(swatches.nth(i), { after: 1000 });
        ctx.clip.mark('pink');
        await ctx.click(swatches.nth(0), { after: 900 });
      },
    },
    {
      id: 'logo-colour',
      title: 'Change the logo colour',
      shows: 'A colour is picked under "Logo colour" and the Settings window is closed: the ChannelCraft logo at the top of the side bar now has the new colour. In the real app the title bar and the taskbar icon follow it too; shortcuts and the Start menu keep the standard Aurora logo.',
      uiLabels: ['Logo colour'],
      async run(ctx) {
        const { page } = ctx;
        const swatches = settings(page).getByRole('radiogroup', { name: 'Logo colour' }).getByRole('radio');
        await ctx.hover(settings(page).getByText('Logo colour', { exact: true }), { hold: 500 });
        await ctx.click(swatches.nth(2), { after: 900 });
        await ctx.click(swatches.nth(5), { after: 900 });
        await ctx.click(settings(page).getByRole('button', { name: /^Close/ }).first(), { after: 900 });
        await ctx.hover(page.getByText('ChannelCraft Studio', { exact: true }).first(), { hold: 1400 });
      },
    },
    {
      id: 'interface-size',
      title: 'Make everything bigger',
      shows: '"Interface size" is set to "Extra large (125%)": all text and buttons grow. Then it goes back to Normal, and the Settings window is closed.',
      uiLabels: ['Interface size', 'Extra large (125%)', 'Normal'],
      poster: 'big',
      async before(ctx) {
        // Back to the standard logo, and Settings open at Appearance again.
        const { page } = ctx;
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await settings(page).getByRole('tab', { name: 'Appearance' }).click();
        await settings(page).getByRole('radiogroup', { name: 'Logo colour' }).getByRole('radio').nth(0).click();
        await page.waitForTimeout(700);
      },
      async run(ctx) {
        const { page } = ctx;
        const sel = () => settings(page).getByRole('combobox', { name: 'Interface size' });
        await pickOption(ctx, sel(), '1.25');
        ctx.clip.mark('big');
        await ctx.pause(1500);
        await pickOption(ctx, sel(), '1');
        await ctx.pause(400);
        await ctx.press('Escape', 600);
      },
    },
    {
      id: 'simple-advanced',
      title: 'Simple or Advanced',
      shows: 'In the editor, the "Simple" / "Advanced" switch is at the top. Advanced adds panels to the tools column (Library, Options, Files), names Colours "Variables" and shows every setting with file names and the XML. Simple goes back to the plain names and the most useful settings.',
      uiLabels: ['Simple', 'Advanced', 'Library', 'Variables', 'Options', 'Files'],
      poster: 'advanced',
      async before(ctx) {
        await quickTheme(ctx.page, 'Arcade Nights');
        await quickClear(ctx.page);
      },
      async run(ctx) {
        const { page } = ctx;
        const mode = page.getByRole('group', { name: 'Editor mode' });
        await ctx.hover(mode, { hold: 500 });
        await ctx.click(mode.getByRole('button', { name: 'Advanced' }), { after: 1000 });
        await ctx.moveTo(dockButton(page, 'library'), { ms: 900 });
        await ctx.pause(400);
        await ctx.moveTo(dockButton(page, 'files'), { ms: 900 });
        ctx.clip.mark('advanced');
        await ctx.pause(800);
        await ctx.click(mode.getByRole('button', { name: 'Simple' }), { after: 1100 });
      },
    },
  ],
};
