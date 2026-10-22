// Dailies: games with a new puzzle every day. Checked live on Oct 22, 2026.
// The panel keeps a checklist for today (this device, local midnight).
export const DAILIES = [
  ['Words', [
    ['https://www.nytimes.com/games/wordle/index.html', 'Wordle', 'the original five letters'],
    ['https://www.nytimes.com/games/connections', 'Connections', 'four groups of four'],
    ['https://www.nytimes.com/games/strands', 'Strands', 'a word search with a theme'],
    ['https://www.nytimes.com/puzzles/spelling-bee', 'Spelling Bee', 'seven letters, how many words'],
    ['https://www.nytimes.com/crosswords/game/mini', 'The Mini', 'a crossword in a minute'],
    ['https://wafflegame.net/daily', 'Waffle', 'swap letters into six words'],
    ['https://squaredle.app/', 'Squaredle', 'trace words through a grid'],
    ['https://contexto.me/', 'Contexto', 'guess the word by how close you are'],
  ]],
  ['Places and time', [
    ['https://worldle.teuteuf.fr/', 'Worldle', 'name the country from its shape'],
    ['https://globle-game.com/', 'Globle', 'warmer, colder, across the globe'],
    ['https://travle.earth/', 'Travle', 'walk from one country to another'],
    ['https://timeguessr.com/', 'TimeGuessr', 'where and when was this photo taken'],
    ['https://www.chronophoto.app/daily.html', 'Chronophoto', 'guess the year of a photo'],
  ]],
  ['Music, film and games', [
    ['https://www.spotle.io/', 'Spotle', 'a new music artist every day'],
    ['https://bandle.app/', 'Bandle', 'name the song one instrument at a time'],
    ['https://framed.wtf/', 'Framed', 'name the movie from six frames'],
    ['https://guessthe.game/', 'GuessThe.Game', 'name the video game from screenshots'],
  ]],
  ['People and animals', [
    ['https://personaguesser.com/', 'PersonaGuesser', 'a new person every day'],
    ['https://poeltl.nbpa.com/', 'Poeltl', 'guess the NBA player'],
    ['https://metazooa.com/', 'Metazooa', 'guess the animal through the tree of life'],
  ]],
  ['Numbers and logic', [
    ['https://www.nerdlegame.com/', 'Nerdle', 'Wordle, but it is maths'],
    ['https://www.linkedin.com/games/queens/', 'Queens', 'one queen per row, column and colour'],
    ['https://costcodle.com/', 'Costcodle', 'guess the Costco price'],
    ['https://angle.wtf/', 'Angle', 'guess the angle in four tries'],
  ]],
].map(([group, items]) => ({ group, items: items.map(([url, name, desc]) => ({ url, name, desc })) }));
