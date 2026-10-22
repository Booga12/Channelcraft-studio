// Playful lines shown while the window waits on a long job. Lines for the step that is running
// come first; then the general ones, in a fresh random order each time they run out.

const GENERAL = [
  'Blowing on the cartridge…',
  'Untangling controller cables…',
  'Polishing the pixels…',
  'Rewinding the VHS tapes…',
  'Adjusting the tracking…',
  'Inserting coin…',
  'Waiting for player two…',
  'Calibrating the light gun…',
  'Feeding the save-file mascot…',
  'Defragmenting the memory card…',
  'Counting extra lives…',
  'Checking under the couch for the remote…',
  'Spinning the disc up to speed…',
  'Lining up the scanlines…',
  'Teaching the sprites to flicker less…',
  'Warming up the CRT…',
  'Pressing Start…',
  'Finding the secret warp zone…',
  'Asking the princess which castle…',
  'Sorting the cartridges alphabetically…',
  'Restocking the arcade tokens…',
  'Mashing buttons for good luck…',
  'Charging the rumble pack…',
  'Loading level 1-1…',
  'Turning it off and on again…',
  'Pretending the loading bar is accurate…',
  'Entering the Konami code…',
  'Saving at the typewriter…',
  'Drawing the box art by hand…',
  'Collecting all the coins on the way…',
  'Swapping disc 1 for disc 2…',
  'Dusting the shelf of classics…',
  'Choosing a starter… this could take a while…',
  'Booting in 16 bits…',
  'Hiding an easter egg somewhere…',
];

export const STEP_QUIPS: Record<string, string[]> = {
  folder: ['Making room on the shelf…', 'Labelling a fresh cartridge…', 'Unboxing a brand-new console…'],
  open: ['Reading the manual (for once)…', 'Plugging in the AV cables…'],
  art: ['Dusting off the console logos…', 'Borrowing the box art…', 'Copying the logos, one console at a time…'],
  design: ['Painting the backdrop…', 'Picking the perfect shade of purple…', 'Placing every cover just so…'],
  fonts: ['Teaching the fonts to read…', 'Downloading letters, one glyph at a time…', 'Kerning very carefully…'],
  save: ['Writing it all to the memory card…', 'Do not turn off the power…', 'Saving… please don’t pull the plug…'],
};

/** Hands out lines without repeating any until all have been shown. */
export class QuipBag {
  #bag: string[] = [];
  #steps = new Map<string, string[]>();
  #last = '';

  next(step?: string | null): string {
    if (step && STEP_QUIPS[step]) {
      let left = this.#steps.get(step);
      if (!left) this.#steps.set(step, (left = shuffle([...STEP_QUIPS[step]])));
      const line = left.shift();
      if (line) return (this.#last = line);
    }
    if (!this.#bag.length) {
      this.#bag = shuffle([...GENERAL]);
      // Don't start a new round with the line just shown.
      if (this.#bag[0] === this.#last) this.#bag.push(this.#bag.shift()!);
    }
    return (this.#last = this.#bag.shift()!);
  }
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
