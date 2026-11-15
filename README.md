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
7. On your computer, `npm run overlay` opens the small window above the game. Left side = your six. Only two buttons matter:
   - **1. My Pokémon** — click a slot, open that Pokémon’s summary, press the button, drag over the whole summary.
   - **2. The fight** — drag around the battle lines. Press again to stop.
   - **Edit moves** — if OCR misses a move, click it next to your Pokémon’s name, type the real move, and pick it from the list.
   - **Share** (title bar) — turn on so Discord screen share shows Slate to friends. Turn off again when you’re done.
   The call says which Pokémon to send and which move to click.

Weather buttons cover sun, rain, and sand. Health sliders cover a hurt Pokémon. Abilities such as Levitate, Flash Fire, and Water Absorb are included when you set them.

## Run it locally

Node.js 20 or newer, from https://nodejs.org.

On Windows, download the project as a zip, unzip it, and double-click `Start Overlay.bat`. The first start installs the app, then the small window opens above the game. The game can stay in its own folder.

From a terminal, the same start is:

```bash
npm install
npm run overlay
```

`npm run dev` opens the full page on port 3847. `npm test` checks the type chart and the fight calls. `npm run lint` runs ESLint.

## Deploy on Vercel

Import the GitHub repository. Vercel detects Next.js. Leave the build command as `npm run build` and do not set environment variables. The build regenerates the type catalog, then builds the app. Use Node.js 20 or newer.

## Data

Type matchups follow the Revolution Online chart, including Shadow. Species, moves, abilities, and base stats come from the main series, packaged by Pokémon Showdown under the MIT license (`@pkmn/dex`). A tutor that exists only on the server can be typed in anyway: the move search has an "Every move" list.

This is an unofficial fan tool. It is not affiliated with Pokémon Revolution Online, Nintendo, Game Freak, or Creatures. Pokémon is a trademark of Nintendo, Game Freak, and Creatures.
