# Rick and Morty 3D: Total Rickall of Parts

3D remake of the 2D RPG in ~/rick-platformer (read-only: never edit that folder). Same school project, due Nov 17, 8:25am, live demo.
Story, characters and tone: ~/rick-platformer/STORY.md and its dialogue JSON. Process evidence is graded: log every session in PROCESS.md.

## Game
A playable episode: cold open, title card, portal puzzle, boss, post-credits gag.
Slice order: 1. Smith garage hub (built). 2. Shrimp Rick's lab, 3 portal puzzle rooms, one gun part each, each part upgrades the gun. 3. Turn-based boss vs Shrimp Rick (rules in STORY.md) staged with camera cuts and a timed Space press. Add areas only after these three feel great.
Story change from 2D: all 3 gun parts land in the shrimp lab.

## Stack
- Three.js 0.187 (pinned), Vite, vanilla JavaScript. Packages: three, vite. Ask before adding or removing any package.
- Run: `npm run dev`. Deploy target: GitHub Pages (vite base './').
- `?skip` skips the cold open. `?low` turns off the glow for slow laptops. M mutes.

## Look
- Characters are paper cutouts (src/objects/cutout.js) using the Gemini art, animated in code. No 3D character models.
- Sets are boxes and cylinders from src/engine/toon.js (two-tone shading, inside-out outline hull). Glow comes from colors brighter than white.
- Keep cutouts under about 40% of screen height: the source sprites are only 210 px tall.
- Keep lights low. Floors blow out to white fast.
- Never prompt image AI for show characters. Never use show audio.

## Layout
- src/engine/: core (renderer, glow), toon (materials, shapes), cameraRig, input, tween, audio
- src/areas/: one file per set, returns { group, bounds, colliders, spots, update }
- src/objects/: cutout, player, portal
- src/scenes/: cutscenes written with await (coldOpen), camera shot helpers
- src/ui/: hud (bars, fades, cards), dialogue (box and conversation runner)
- src/data/dialogue/: dialogue JSON, same format as the 2D game. Never hardcode story dialogue in scenes.
- tools/cut_sheet.py: cuts Gemini sheets at full size with halo trim

## Testing
The preview pane throttles animation. In dev builds use `__game.step(frames)` from the browser console tools to run the game forward, and dispatch KeyboardEvents on window for input.
Stop the dev server after testing (music keeps playing otherwise).

## PROCESS.md
One entry per session: goal, AI tools, key prompts word for word, what was built, key decisions, what went wrong and the revision, what was rejected and why, result, evidence files in process/, chat link, and a blank "Why:" line for Rodrigo.
End every session with a playable build and a commit.
