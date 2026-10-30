// Placeholder tiles (gradient + glyph). Swap in real icons once you have the rights to use them.
export const GAMES = {
  lineage2: { name: "Lineage II", hue: 30, glyph: "L" },
  cabal: { name: "Cabal", hue: 220, glyph: "C" },
  cod: { name: "Call of Duty", hue: 0, glyph: "✦" },
  diablo: { name: "Diablo", hue: 10, glyph: "D" },
  lordnine: { name: "Lordnine", hue: 40, glyph: "IX" },
  nowa: { name: "Nowa", hue: 35, glyph: "N" },
  raven: { name: "Raven", hue: 250, glyph: "R" },
  odin: { name: "Odin", hue: 200, glyph: "Ø" },
  pokemon: { name: "Pokémon GO", hue: 205, glyph: "◓" },
  idleHeroes: { name: "Idle Heroes", hue: 330, glyph: "H" },
  ragnarok: { name: "Ragnarok", hue: 320, glyph: "R" },
  summoners: { name: "Summoners", hue: 45, glyph: "S" },
  roblox: { name: "Roblox", hue: 0, glyph: "◼" },
  royale: { name: "Royale", hue: 160, glyph: "♛" },
  starRail: { name: "Star Rail", hue: 230, glyph: "✶" },
  journey: { name: "Journey", hue: 350, glyph: "J" },
  lineageM: { name: "Lineage M", hue: 15, glyph: "M" },
  yokai: { name: "Yo-kai", hue: 215, glyph: "Y" },
  zenonia: { name: "Zenonia", hue: 25, glyph: "Z" },
  genshin: { name: "Genshin", hue: 40, glyph: "G" },
  heroes: { name: "Heroes", hue: 345, glyph: "H" },
  nightCrows: { name: "Night Crows", hue: 50, glyph: "N" },
  hit2: { name: "HIT2", hue: 5, glyph: "H2" },
  mir4: { name: "MIR4", hue: 0, glyph: "M4" },
  legends: { name: "Legends", hue: 270, glyph: "L" },
};

// Shown per plan slug; heavier plans list heavier titles.
const SUPPORTED_GAMES = {
  uvip: ["idleHeroes", "roblox", "pokemon", "summoners", "royale", "yokai"],
  gvip: ["ragnarok", "roblox", "pokemon", "cabal", "odin", "idleHeroes", "raven", "zenonia"],
  kvip: ["cabal", "odin", "raven", "lineageM", "nowa", "summoners", "journey", "hit2", "zenonia"],
  mvip: ["lineage2", "lineageM", "mir4", "nightCrows", "odin", "raven", "starRail", "cod", "hit2"],
  svip: ["lineage2", "diablo", "genshin", "starRail", "mir4", "nightCrows", "lordnine", "cod", "odin", "legends"],
};
const DEFAULT_GAMES = ["roblox", "pokemon", "idleHeroes", "ragnarok", "summoners", "royale"];

export function gamesForPlan(slug) {
  return SUPPORTED_GAMES[slug] ?? DEFAULT_GAMES;
}
