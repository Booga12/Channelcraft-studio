// The made-up game library of the demo RetroBat (make-demo.mjs). Every title, studio and
// description here is invented for the ChannelCraft how-to clips; the artwork is drawn by
// art.js. Nothing comes from a real game, a real company or anyone's own library.
//
// style: the kind of picture art.js draws (platformer, shmup, racer, puzzle, rpg, fighter,
// sports, adventure, brawler). palette: sky top, sky bottom, accent, highlight.

export const SYSTEMS = [
  {
    name: 'snes',
    ext: '.sfc',
    band: '16-BIT CARTRIDGE',
    games: [
      { title: 'Lantern Knight', year: '1994-06-17', dev: 'Halfmoon Works', pub: 'Brightside Soft', genre: 'Platform', players: '1', rating: 0.9, style: 'platformer', palette: ['#1b1f4b', '#f2a65a', '#ffd166', '#ffffff'], fav: true, plays: 23, desc: 'A young knight carries the last lantern through the Hollow Kingdom. Light braziers to open hidden paths, outwit shadow beasts and race the dawn across six hand-drawn worlds.' },
      { title: 'Star Courier', year: '1993-03-12', dev: 'Orbital Fox', pub: 'Orbital Fox', genre: "Shoot'em Up", players: '1-2', rating: 0.8, style: 'shmup', palette: ['#050816', '#2b1055', '#ff4f8b', '#7df9ff'], plays: 11, desc: 'Deliver urgent parcels across a war-torn star lane. A vertical shooter with chargeable shots, side pods you can aim, and a co-op mode where the second player flies the escort drone.' },
      { title: 'Crystal Hollow', year: '1995-11-02', dev: 'Northlight Studio', pub: 'Brightside Soft', genre: 'RPG', players: '1', rating: 0.95, style: 'rpg', palette: ['#0f3d3e', '#7fc8a9', '#f4d35e', '#fdf6e3'], fav: true, plays: 41, desc: 'When the singing crystals of Brookhaven fall silent, four unlikely friends set out to wake them. A turn-based adventure with a seasons system that changes towns, quests and the music.' },
      { title: 'Turbo Tangent', year: '1993-08-27', dev: 'Kitefield', pub: 'Kitefield', genre: 'Racing', players: '1-2', rating: 0.75, style: 'racer', palette: ['#ff7e5f', '#feb47b', '#2ec4b6', '#ffffff'], plays: 7, desc: 'Split-screen racing on coastal highways and mountain switchbacks. Draft behind rivals, time your boost on the straights and unlock eight cars with their own handling.' },
      { title: 'Block Bloom', year: '1992-04-09', dev: 'Paper Comet', pub: 'Quartz Owl', genre: 'Puzzle', players: '1-2', rating: 0.7, style: 'puzzle', palette: ['#2d1e2f', '#6a4c93', '#8ac926', '#ffca3a'], plays: 15, desc: 'Drop seed blocks, match four of a colour and watch the garden grow. Chain blooms to send weeds to your opponent in a frantic two-player mode.' },
      { title: 'Skyward Sprout', year: '1995-02-24', dev: 'Velvet Sprite', pub: 'Quartz Owl', genre: 'Platform', players: '1', rating: 0.85, style: 'platformer', palette: ['#4cc9f0', '#caf0f8', '#80ed99', '#ffffff'], plays: 9, desc: 'A tiny sprout climbs a beanstalk that reaches past the clouds. Glide on leaves, bounce on mushrooms and collect sunlight to grow new abilities.' },
      { title: 'Iron Tide', year: '1994-10-14', dev: 'Cobalt Forge', pub: 'Ironleaf', genre: 'Fighting', players: '1-2', rating: 0.72, style: 'fighter', palette: ['#14213d', '#fca311', '#e63946', '#ffffff'], plays: 4, desc: 'Twelve harbour brawlers fight for the Iron Tide belt. Simple controls, deep combos and a story mode with a different ending for every fighter.' },
    ],
  },
  {
    name: 'megadrive',
    ext: '.md',
    band: '16-BIT CARTRIDGE',
    games: [
      { title: 'Neon Velocity', year: '1992-07-03', dev: 'Kitefield', pub: 'Ironleaf', genre: 'Racing', players: '1-2', rating: 0.82, style: 'racer', palette: ['#10002b', '#7b2cbf', '#ff006e', '#3a86ff'], fav: true, plays: 19, desc: 'Night races through a city of neon. Every track has shortcuts through the back streets, and the soundtrack changes with your speed.' },
      { title: 'Sonar Strike', year: '1991-05-21', dev: 'Orbital Fox', pub: 'Ironleaf', genre: "Shoot'em Up", players: '1', rating: 0.78, style: 'shmup', palette: ['#001d3d', '#003566', '#ffc300', '#90e0ef'], plays: 8, desc: 'Pilot a mini-sub through sunken cities in this side-scrolling shooter. Ping the sonar to reveal hidden enemies and treasure in the dark.' },
      { title: 'Duskblade', year: '1993-09-30', dev: 'Marrow & Moss', pub: 'Brightside Soft', genre: 'Action', players: '1', rating: 0.88, style: 'adventure', palette: ['#2b2d42', '#ef233c', '#ffb703', '#edf2f4'], plays: 13, desc: 'A wandering swordsman crosses a land where the sun never fully sets. Fast sword combat, a grappling hook and bosses that learn from how you fight.' },
      { title: 'Rocket Rally Kids', year: '1994-03-18', dev: 'Tidewater Games', pub: 'Quartz Owl', genre: 'Sports', players: '1-4', rating: 0.68, style: 'sports', palette: ['#38b000', '#9ef01a', '#ff5400', '#ffffff'], plays: 6, desc: 'Rocket-boots football for up to four players. Score from the air, bounce off the walls and pick from twenty school teams.' },
      { title: 'Tower of Twelve', year: '1992-12-11', dev: 'Northlight Studio', pub: 'Northlight Studio', genre: 'RPG', players: '1', rating: 0.86, style: 'rpg', palette: ['#3d405b', '#81b29a', '#f2cc8f', '#f4f1de'], plays: 22, desc: 'Climb a tower with a different world on each of its twelve floors. Recruit monsters, craft spells from runes and decide who rules the top.' },
      { title: 'Street Comet', year: '1993-06-25', dev: 'Cobalt Forge', pub: 'Ironleaf', genre: "Beat'em Up", players: '1-2', rating: 0.76, style: 'brawler', palette: ['#1d3557', '#457b9d', '#f72585', '#f1faee'], plays: 10, desc: 'Two couriers on roller skates clean up Comet City. Grab street signs, chain skate kicks and team up for double moves in co-op.' },
      { title: 'Gem Cascade', year: '1991-10-08', dev: 'Paper Comet', pub: 'Quartz Owl', genre: 'Puzzle', players: '1-2', rating: 0.7, style: 'puzzle', palette: ['#03045e', '#0077b6', '#e0aaff', '#ffd60a'], plays: 5, desc: 'Line up falling gems in threes and set off sparkling chain reactions. Endless, timed and versus modes with a soundtrack that speeds up with you.' },
    ],
  },
  {
    name: 'n64',
    ext: '.z64',
    band: '64-BIT CARTRIDGE',
    games: [
      { title: 'Cloudhopper', year: '1998-08-21', dev: 'Velvet Sprite', pub: 'Brightside Soft', genre: 'Platform', players: '1', rating: 0.92, style: 'platformer', palette: ['#5390d9', '#bde0fe', '#ffafcc', '#ffffff'], fav: true, plays: 31, desc: 'Hop between floating islands in a 3D sky world. Every island is a playground of secrets, and the weather changes how you can move.' },
      { title: 'Orbit Rush', year: '1997-11-14', dev: 'Orbital Fox', pub: 'Orbital Fox', genre: 'Racing', players: '1-4', rating: 0.8, style: 'racer', palette: ['#0b090a', '#3c096c', '#ff9e00', '#e0e1dd'], plays: 17, desc: 'Anti-gravity racing on tracks that loop around moons. Four-player split screen, weapon pickups and a ghost mode to race your best lap.' },
      { title: 'Glacier Golf', year: '1999-02-05', dev: 'Tidewater Games', pub: 'Quartz Owl', genre: 'Sports', players: '1-4', rating: 0.66, style: 'sports', palette: ['#caf0f8', '#90e0ef', '#0077b6', '#ffffff'], plays: 3, desc: 'Mini golf on the ice: putts slide, holes move and penguins get in the way. Thirty-six silly holes and a course editor.' },
      { title: 'Wildwood Quest', year: '1998-05-29', dev: 'Northlight Studio', pub: 'Brightside Soft', genre: 'Adventure', players: '1', rating: 0.9, style: 'adventure', palette: ['#132a13', '#4f772d', '#ecf39e', '#fefae0'], plays: 26, desc: 'Explore a living forest with a fox who can talk to trees. Solve puzzles with the help of the seasons and uncover why the old woods are fading.' },
      { title: 'Mech Arena', year: '1999-09-17', dev: 'Cobalt Forge', pub: 'Ironleaf', genre: 'Fighting', players: '1-4', rating: 0.74, style: 'fighter', palette: ['#212529', '#495057', '#ff6b35', '#f8f9fa'], plays: 9, desc: 'Build a mech from salvaged parts and battle in arenas that fall apart around you. Up to four players, with every part changing how you fight.' },
      { title: 'Pocket Planets', year: '2000-03-10', dev: 'Paper Comet', pub: 'Quartz Owl', genre: 'Puzzle', players: '1-2', rating: 0.71, style: 'puzzle', palette: ['#240046', '#5a189a', '#ff7b00', '#ffd000'], plays: 6, desc: 'Fling tiny planets into orbit and use their gravity to guide comets home. A hundred puzzles and a sandbox for your own solar systems.' },
    ],
  },
  {
    name: 'psx',
    ext: '.chd',
    band: 'CD-ROM',
    games: [
      { title: 'Chrome Horizon', year: '1998-10-23', dev: 'Kitefield', pub: 'Ironleaf', genre: 'Racing', players: '1-2', rating: 0.87, style: 'racer', palette: ['#ff9a8b', '#ff6a88', '#2d00f7', '#ffffff'], fav: true, plays: 28, desc: 'A sunset road trip across a desert of chrome canyons. Tune your car between races, take on rivals at dusk and chase the horizon in endless mode.' },
      { title: 'Echoes of Aria', year: '1999-07-16', dev: 'Northlight Studio', pub: 'Northlight Studio', genre: 'RPG', players: '1', rating: 0.94, style: 'rpg', palette: ['#22223b', '#4a4e69', '#c9ada7', '#f2e9e4'], plays: 52, desc: 'A sweeping story about a bard whose songs can rewrite memories. Three discs of adventure, a battle system built on rhythm and choices that echo to the end.' },
      { title: 'Riverlight', year: '1997-04-04', dev: 'Marrow & Moss', pub: 'Brightside Soft', genre: 'Adventure', players: '1', rating: 0.83, style: 'adventure', palette: ['#023047', '#219ebc', '#ffb703', '#ffffff'], plays: 12, desc: 'Paddle a paper boat down a river that flows through dreams. A calm, beautiful adventure with gentle puzzles and a lantern that shows the way.' },
      { title: 'Vector Vanguard', year: '1996-12-06', dev: 'Orbital Fox', pub: 'Orbital Fox', genre: "Shoot'em Up", players: '1-2', rating: 0.79, style: 'shmup', palette: ['#000000', '#03071e', '#00f5d4', '#f15bb5'], plays: 14, desc: 'A wireframe shooter that bursts into colour as you play. Five stages, a combo system that rewards close calls and a synth soundtrack.' },
      { title: 'Midnight Dojo', year: '1997-09-12', dev: 'Cobalt Forge', pub: 'Ironleaf', genre: 'Fighting', players: '1-2', rating: 0.81, style: 'fighter', palette: ['#0d1b2a', '#1b263b', '#e0a458', '#e0e1dd'], plays: 18, desc: 'Masters of eight fighting styles meet in a dojo that opens only at midnight. Fluid 3D fighting with counters, throws and a training mode that teaches you the basics.' },
      { title: 'Bubble Foundry', year: '1996-05-17', dev: 'Paper Comet', pub: 'Quartz Owl', genre: 'Puzzle', players: '1-2', rating: 0.69, style: 'puzzle', palette: ['#003049', '#d62828', '#fcbf49', '#eae2b7'], plays: 7, desc: 'Run a factory that makes bubbles. Route coloured bubbles through pipes, pop matching groups and keep the machines from overflowing.' },
      { title: 'Skate Signal', year: '2000-08-25', dev: 'Tidewater Games', pub: 'Brightside Soft', genre: 'Sports', players: '1-2', rating: 0.77, style: 'sports', palette: ['#ff595e', '#ffca3a', '#1982c4', '#ffffff'], plays: 10, desc: 'Skate a city full of rails and ramps while you tag its walls with music. Chain tricks to the beat for huge scores.' },
    ],
  },
  {
    name: 'gba',
    ext: '.gba',
    band: 'HANDHELD',
    games: [
      { title: 'Pocket Paladin', year: '2003-04-11', dev: 'Northlight Studio', pub: 'Quartz Owl', genre: 'RPG', players: '1', rating: 0.88, style: 'rpg', palette: ['#606c38', '#283618', '#dda15e', '#fefae0'], fav: true, plays: 34, desc: 'A paladin no taller than a teacup defends the kitchen kingdom. A cosy role-playing game with crafting, cooking and battles against kitchen pests.' },
      { title: 'Pixel Pilots', year: '2002-06-28', dev: 'Orbital Fox', pub: 'Orbital Fox', genre: "Shoot'em Up", players: '1-2', rating: 0.76, style: 'shmup', palette: ['#03045e', '#023e8a', '#ff9f1c', '#cbf3f0'], plays: 9, desc: 'Bite-sized shooting missions made for playing on the bus. Upgrade your plane between flights and link up with a friend for co-op.' },
      { title: 'Tiny Tactics', year: '2004-02-20', dev: 'Paper Comet', pub: 'Brightside Soft', genre: 'Strategy', players: '1-2', rating: 0.84, style: 'puzzle', palette: ['#2a9d8f', '#264653', '#e9c46a', '#f4a261'], plays: 21, desc: 'Turn-based battles on a chessboard-sized map. Every unit has one special move, so each turn is a small puzzle.' },
      { title: 'Coral Run', year: '2001-09-07', dev: 'Velvet Sprite', pub: 'Quartz Owl', genre: 'Platform', players: '1', rating: 0.8, style: 'platformer', palette: ['#00b4d8', '#90e0ef', '#ff6b6b', '#ffffff'], plays: 11, desc: 'A crab with a borrowed shell runs, swims and climbs across a coral reef. Fast levels, hidden pearls and a time trial for every stage.' },
      { title: 'Sprint Sprites', year: '2002-11-15', dev: 'Kitefield', pub: 'Kitefield', genre: 'Racing', players: '1-4', rating: 0.73, style: 'racer', palette: ['#ffbe0b', '#fb5607', '#8338ec', '#ffffff'], plays: 8, desc: 'Fairies race on dragonflies through gardens and greenhouses. Link four handhelds together for the full racing party.' },
      { title: 'Ghost Lantern', year: '2005-10-28', dev: 'Marrow & Moss', pub: 'Brightside Soft', genre: 'Adventure', players: '1', rating: 0.86, style: 'adventure', palette: ['#10002b', '#240046', '#c77dff', '#e0aaff'], plays: 14, desc: 'Help friendly ghosts finish their unfinished business in a sleepy seaside town. A spooky but warm adventure full of small mysteries.' },
    ],
  },
  {
    name: 'arcade',
    ext: '.zip',
    band: 'ARCADE',
    games: [
      { title: 'Galaxy Rampart', year: '1982-05-01', dev: 'Lumen Bit', pub: 'Lumen Bit', genre: "Shoot'em Up", players: '1-2', rating: 0.8, style: 'shmup', palette: ['#000000', '#14062b', '#ffe600', '#ff2a6d'], fav: true, plays: 44, desc: 'Defend the rampart against waves of swooping invaders. Classic arcade shooting with a twist: shields you build from the wreckage.' },
      { title: 'Volt Runner', year: '1986-08-15', dev: 'Lumen Bit', pub: 'Lumen Bit', genre: 'Racing', players: '1', rating: 0.72, style: 'racer', palette: ['#0b132b', '#1c2541', '#5bc0be', '#ffffff'], plays: 12, desc: 'Race an electric bike along a highway of light before the battery runs out. Grab charge pods and dodge traffic at full throttle.' },
      { title: 'Dragon Gate Brawl', year: '1992-03-27', dev: 'Cobalt Forge', pub: 'Ironleaf', genre: 'Fighting', players: '1-2', rating: 0.85, style: 'fighter', palette: ['#370617', '#9d0208', '#ffba08', '#ffffff'], plays: 37, desc: 'Ten fighters battle at the Dragon Gate for the right to pass. Special moves, super meters and a secret boss for those who win without losing a round.' },
      { title: 'Moonbase Mayhem', year: '1984-11-09', dev: 'Lumen Bit', pub: 'Halfmoon Works', genre: "Shoot'em Up", players: '1-2', rating: 0.7, style: 'shmup', palette: ['#0d1b2a', '#415a77', '#e0e1dd', '#ff5d8f'], plays: 9, desc: 'Moon rocks are raining on the base. Spin your turret, blast the rocks and rescue astronauts before the dome cracks.' },
      { title: 'Bounce Brigade', year: '1985-06-21', dev: 'Halfmoon Works', pub: 'Halfmoon Works', genre: 'Platform', players: '1-2', rating: 0.74, style: 'platformer', palette: ['#ff006e', '#ffbe0b', '#3a86ff', '#ffffff'], plays: 16, desc: 'Bounce from floor to floor on springs and rescue the balloon folk. Single-screen platforming with a two-player race mode.' },
      { title: 'Hex Drop', year: '1990-01-19', dev: 'Paper Comet', pub: 'Lumen Bit', genre: 'Puzzle', players: '1-2', rating: 0.77, style: 'puzzle', palette: ['#212529', '#343a40', '#80ffdb', '#ff4d6d'], plays: 20, desc: 'Hexagon pieces fall into a honeycomb well. Rotate and drop them to close rings, and clear the board to reach the golden stage.' },
      { title: 'Turbo Pinball Zone', year: '1991-07-12', dev: 'Lumen Bit', pub: 'Lumen Bit', genre: 'Pinball', players: '1-4', rating: 0.68, style: 'sports', palette: ['#3a0ca3', '#7209b7', '#f72585', '#4cc9f0'], plays: 8, desc: 'A neon pinball table with ramps, a multiball lock and a jackpot that grows the longer you keep the ball alive.' },
    ],
  },
];

/** Picture folders and other files in the demo user's own folders. */
export const WALLPAPERS = [
  { file: 'Synthwave Sunset.jpg', style: 'racer', palette: ['#2b1055', '#ff6a88', '#ffd166', '#ffffff'] },
  { file: 'Deep Space.jpg', style: 'shmup', palette: ['#02010a', '#1b0b3a', '#7df9ff', '#ff4f8b'] },
  { file: 'Forest Morning.jpg', style: 'adventure', palette: ['#1b4332', '#95d5b2', '#ffd166', '#ffffff'] },
  { file: 'Arcade Night.jpg', style: 'brawler', palette: ['#10002b', '#3c096c', '#ff006e', '#4cc9f0'] },
];

/** Songs made by make-demo.mjs (see music.mjs), for the music guide. */
export const SONGS = [
  { file: 'Neon Skyline.ogg', bpm: 118, key: 57, mood: 'drive' },
  { file: 'Pixel Harbor.ogg', bpm: 96, key: 60, mood: 'calm' },
  { file: 'Midnight Arcade.ogg', bpm: 132, key: 55, mood: 'drive' },
];
