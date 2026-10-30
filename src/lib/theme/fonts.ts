// Free fonts (SIL Open Font License) from the Google Fonts repository, downloaded into a theme
// when chosen. All of these work in EmulationStation (TTF).

export interface CatalogFont {
  id: string;
  label: string;
  file: string;
  url: string;
  style: string;
}

const BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/';

const f = (id: string, label: string, path: string, style: string): CatalogFont => ({
  id,
  label,
  file: decodeURIComponent(path.split('/').pop()!).replace(/[[\],]/g, '_'),
  url: BASE + path,
  style,
});

export const FONT_CATALOG: CatalogFont[] = [
  f('bebas', 'Bebas Neue', 'bebasneue/BebasNeue-Regular.ttf', 'Tall, bold headlines'),
  f('orbitron', 'Orbitron', 'orbitron/Orbitron%5Bwght%5D.ttf', 'Futuristic, techy'),
  f('vt323', 'VT323', 'vt323/VT323-Regular.ttf', 'Old terminal screen'),
  f('pressstart', 'Press Start 2P', 'pressstart2p/PressStart2P-Regular.ttf', '8-bit arcade pixels'),
  f('nunito', 'Nunito', 'nunito/Nunito%5Bwght%5D.ttf', 'Soft and friendly'),
  f('exo2', 'Exo 2', 'exo2/Exo2%5Bwght%5D.ttf', 'Modern, sporty'),
  f('poppins', 'Poppins', 'poppins/Poppins-SemiBold.ttf', 'Clean and geometric'),
  f('audiowide', 'Audiowide', 'audiowide/Audiowide-Regular.ttf', 'Retro-future racing'),
  f('inter', 'Inter', 'inter/Inter%5Bopsz%2Cwght%5D.ttf', 'Neutral, very readable'),
  f('playfair', 'Playfair Display', 'playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf', 'Elegant magazine serif'),
  f('silkscreen', 'Silkscreen', 'silkscreen/Silkscreen-Regular.ttf', 'Tiny pixel caps'),
  f('montserrat', 'Montserrat', 'montserrat/Montserrat%5Bwght%5D.ttf', 'Smart and modern'),
  f('righteous', 'Righteous', 'righteous/Righteous-Regular.ttf', 'Rounded retro display'),
  f('russo', 'Russo One', 'russoone/RussoOne-Regular.ttf', 'Heavy, punchy'),
  f('monoton', 'Monoton', 'monoton/Monoton-Regular.ttf', 'Neon tube lettering (titles only)'),
  f('rajdhani', 'Rajdhani', 'rajdhani/Rajdhani-SemiBold.ttf', 'Narrow sci-fi'),
  f('pixelify', 'Pixelify Sans', 'pixelifysans/PixelifySans%5Bwght%5D.ttf', 'Readable pixel font'),
  f('lilita', 'Lilita One', 'lilitaone/LilitaOne-Regular.ttf', 'Chunky cartoon'),
  f('fredoka', 'Fredoka', 'fredoka/Fredoka%5Bwdth%2Cwght%5D.ttf', 'Bubbly and playful'),
  f('spacegrotesk', 'Space Grotesk', 'spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf', 'Quirky grotesk'),
  f('manrope', 'Manrope', 'manrope/Manrope%5Bwght%5D.ttf', 'Crisp and businesslike'),
  f('dmserif', 'DM Serif Display', 'dmserifdisplay/DMSerifDisplay-Regular.ttf', 'Friendly display serif'),
  f('lora', 'Lora', 'lora/Lora%5Bwght%5D.ttf', 'Warm book serif'),
  f('cinzel', 'Cinzel', 'cinzel/Cinzel%5Bwght%5D.ttf', 'Classical capitals, luxurious'),
  f('quicksand', 'Quicksand', 'quicksand/Quicksand%5Bwght%5D.ttf', 'Rounded and gentle'),
  f('mochiy', 'Mochiy Pop One', 'mochiypopone/MochiyPopOne-Regular.ttf', 'Cute and chunky'),
  f('pacifico', 'Pacifico', 'pacifico/Pacifico-Regular.ttf', 'Flowing script (titles)'),
  f('bangers', 'Bangers', 'bangers/Bangers-Regular.ttf', 'Comic-book shouting'),
  f('bungee', 'Bungee', 'bungee/Bungee-Regular.ttf', 'Chunky arcade signage'),
  f('michroma', 'Michroma', 'michroma/Michroma-Regular.ttf', 'Wide space-age'),
  f('sharetech', 'Share Tech Mono', 'sharetechmono/ShareTechMono-Regular.ttf', 'Terminal monospace'),
  f('creepster', 'Creepster', 'creepster/Creepster-Regular.ttf', 'Spooky drips (titles)'),
];

/** A font's name from its file path: "Inter_opsz_wght_.ttf" and "Inter[opsz,wght].ttf" give "Inter". */
export function fontName(path: string): string {
  return (
    path
      .replace(/^.*[\\/]/, '')
      .replace(/\.[^.]+$/, '')
      // Variable-font axis tags, as [wght] or saved as _wght_ (the catalogue swaps [ ] , for _).
      .replace(/_(?:[a-z]{4}|[A-Z]{4})(?:_(?:[a-z]{4}|[A-Z]{4}))*_$/, '')
      .replace(/\[.*?\]|-(Regular|VariableFont.*)$/gi, '')
      .replace(/[-_]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim() || 'Font'
  );
}

export function catalogFont(id: string): CatalogFont | undefined {
  return FONT_CATALOG.find((x) => x.id === id);
}
