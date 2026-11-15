# Slate

Slate is a fight coach for Pokémon Revolution Online. It sits beside the game, or floats on top of it, and tells you which move to click in plain language.

It explains the type chart, including the server's Shadow type, and it ranks the four moves on your Pokémon against the one in front of you. It does not press buttons in the game, read memory, or play for you.

## Use it during a fight

1. Run the app and open it next to the game.
2. The first screen is a practice fight: Charizard against Magnemite. Read the cream card. That card is the call.
3. Replace the practice team with the six Pokémon you actually use. Search a name, set the level, nature, ability, and four moves.
4. When a fight starts, search the Pokémon in front of you.
5. If the summary window is open, type the six stats in. The size of the hit stops being a guess.
6. Hidden Power on this server is not a Normal move. Set the type the summary shows. It is never Normal or Fairy, and the power is 60.
7. Open **Game overlay**. That panel is the in-fight view: the call, your four moves, and your six. On your computer, `npm run overlay` opens it as its own window and keeps that window above Pokémon Revolution Online. Drag the top bar to place it. Alt+Shift+S lets clicks pass through to the game.

Weather buttons cover sun, rain, and sand. Health sliders cover a hurt Pokémon. Abilities such as Levitate, Flash Fire, and Water Absorb are included when you set them.

## Run it locally

Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the app on port 3847. `npm run overlay` opens the always-on-top panel. `npm test` checks the type chart and the fight calls. `npm run lint` runs ESLint.

## Deploy on Vercel

Import the GitHub repository. Vercel detects Next.js. Leave the build command as `npm run build` and do not set environment variables. The build regenerates the type catalog, then builds the app. Use Node.js 20 or newer.

## Data

Type matchups follow the Revolution Online chart, including Shadow. Species, moves, abilities, and base stats come from the main series, packaged by Pokémon Showdown under the MIT license (`@pkmn/dex`). A tutor that exists only on the server can be typed in anyway: the move search has an "Every move" list.

This is an unofficial fan tool. It is not affiliated with Pokémon Revolution Online, Nintendo, Game Freak, or Creatures. Pokémon is a trademark of Nintendo, Game Freak, and Creatures.
