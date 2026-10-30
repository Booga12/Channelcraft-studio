// Guide 2 on the website: "Make your first theme" (the New theme wizard, then the editor).
import { dialog, dockButton, editorReady, NO_TOUR } from '../helpers.mjs';

const next = (page) => dialog(page).getByRole('button', { name: 'Next', exact: true });

export default {
  slug: 'first-theme',
  title: 'Make your first theme',
  order: 2,
  // The editor tour isn't part of this guide.
  localStorage: NO_TOUR,
  cursorStart: [1180, 700],
  steps: [
    {
      id: 'open-wizard',
      title: 'Open the New theme wizard and name your theme',
      shows: 'On the start screen, "Start a new theme" is clicked. The "Make my theme" wizard opens with the name "My Theme" already selected, and typing "Arcade Nights" replaces it.',
      uiLabels: ['Start a new theme', 'Make my theme', 'Name and style', 'Next'],
      poster: 'named',
      async run(ctx) {
        const { page } = ctx;
        await ctx.hover(page.getByRole('button', { name: /Start a new theme/ }), { hold: 300 });
        await ctx.click(page.getByRole('button', { name: /Start a new theme/ }), { after: 700 });
        const name = dialog(page).locator('input').first();
        await name.waitFor();
        await ctx.pause(500);
        // The name is selected when the wizard opens, so typing replaces it.
        await ctx.type('Arcade Nights');
        ctx.clip.mark('named');
        await ctx.pause(600);
        await ctx.moveTo(next(page), { ms: 700 });
      },
    },
    {
      id: 'pick-style',
      title: 'Pick a style',
      shows: 'Under "What style do you like?" the Gaming style is clicked. The wizard moves to the Design step and shows only the five gaming designs, each with a picture of how it looks, with the first one (Arcade Neon) already chosen.',
      uiLabels: ['What style do you like?', 'Gaming', 'Design', 'Pick a design'],
      async run(ctx) {
        const { page } = ctx;
        const d = dialog(page);
        await ctx.hover(d.getByText('What style do you like?'), { hold: 500 });
        await ctx.click(d.getByRole('button', { name: /^Gaming/ }).first(), { after: 1200 });
        await ctx.moveTo(d.locator('label').filter({ hasText: 'Esports' }), { ms: 900 });
        await ctx.pause(500);
        await ctx.moveTo(d.locator('label').filter({ hasText: 'Boss Fight' }), { ms: 800 });
      },
    },
    {
      id: 'pick-design',
      title: 'Choose a design',
      shows: 'The "Arcade Marquee" design (gold on deep red) is clicked and gets the highlight; the line at the top of the wizard now names it with its layouts. Every design comes with its own colours, fonts, artwork and layouts.',
      uiLabels: ['Pick a design', 'Arcade Marquee'],
      async run(ctx) {
        const { page } = ctx;
        const card = dialog(page).locator('label').filter({ hasText: 'Arcade Marquee' });
        await ctx.hover(card, { hold: 400 });
        await ctx.click(card, { after: 900 });
        await ctx.moveTo(next(page), { ms: 900 });
      },
    },
    {
      id: 'choose-layouts',
      title: 'Choose how the consoles and games are shown',
      shows: 'Next goes to the System menu step, where "Wheel on the right" is picked for the console logos. Next again goes to the Game list step, where the "Cinema" layout is picked (fan art filling the screen behind a big title, the list on the right). Each card is a small picture of the screen.',
      uiLabels: ['Next', 'System menu', 'Wheel on the right', 'Game list', 'Cinema', 'Create and open'],
      async run(ctx) {
        const { page } = ctx;
        const d = dialog(page);
        await ctx.click(next(page), { after: 1000 });
        await ctx.click(d.getByRole('button', { name: /^Wheel on the right\b/ }).first(), { after: 1000 });
        await ctx.click(next(page), { after: 1100 });
        const cards = d.locator('button[aria-pressed]');
        await ctx.click(cards.nth(1), { after: 1000 });
        await ctx.moveTo(d.getByRole('button', { name: 'Create and open', exact: true }), { ms: 900 });
      },
    },
    {
      id: 'create',
      title: 'Create the theme and open it',
      shows: '"Create and open" is clicked. A progress card shows the theme being built (theme folder, console logos and pictures, the design, fonts, saving), then the editor opens with the new theme in the live preview.',
      uiLabels: ['Create and open', 'Building “Arcade Nights”'],
      hold: 1800,
      async run(ctx) {
        const { page } = ctx;
        await ctx.click(dialog(page).getByRole('button', { name: 'Create and open', exact: true }), { after: 200 });
        await ctx.clip.cut(() => editorReady(page, 'Arcade Nights'), { keep: 2.6, tail: 0.3 });
        await ctx.pause(800);
      },
    },
    {
      id: 'editor-tour',
      title: 'Find your way around the editor',
      shows: 'A quick look around the editor: the screen menu at the top (System menu, game lists), the tools column on the left (Presets, Colours, Sound, Assets, Layers, History), the live preview in the middle, and Try in RetroBat and Save at the top right.',
      uiLabels: ['Game list (detailed)', 'Presets', 'Colours', 'Sound', 'Assets', 'Layers', 'History', 'Try in RetroBat', 'Saved'],
      async run(ctx) {
        const { page } = ctx;
        await ctx.hover(page.getByTitle('Which screen of the theme to show'), { hold: 900 });
        await ctx.hover(dockButton(page, 'presets'), { hold: 700 });
        await ctx.moveTo(dockButton(page, 'history'), { ms: 1300 });
        await ctx.pause(500);
        await ctx.moveTo({ x: 820, y: 470 }, { ms: 900 });
        await ctx.pause(600);
        await ctx.hover(page.getByRole('button', { name: /Try in RetroBat/ }), { hold: 900 });
        await ctx.hover(page.locator('[data-tour=save]'), { hold: 900 });
      },
    },
  ],
};
