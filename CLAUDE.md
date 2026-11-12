# Rick and Morty 3D: Total Rickall of Parts

3D remake of the 2D RPG in ~/rick-platformer (read-only: never edit that folder). Same school project, due Nov 17, 8:25am, live demo.
Story, characters and tone: ~/rick-platformer/STORY.md and its dialogue JSON. Process evidence is graded: log every session in PROCESS.md.

## Game
A playable episode: cold open, title card, portal puzzle, boss, post-credits gag.
Slice order: 1. Smith garage hub (built). 2. Shrimp Rick's lab (built Nov 12: 3 rooms, portal gun, guards, parts, Shrimp Rick entrance). 3. Turn-based boss vs Shrimp Rick (rules in STORY.md) staged with camera cuts and a timed Space press. Add areas only after these three feel great.
Story change from 2D: all 3 gun parts land in the shrimp lab.

## Stack
- Three.js 0.187 (pinned), Vite, vanilla JavaScript. Packages: three, vite. Ask before adding or removing any package.
- Run: `npm run dev`. Deploy target: GitHub Pages (vite base './').
- `?skip` skips the cold open. `?lab=1`, `2` or `3` starts in that lab room. `?low` turns off the glow for slow laptops. M mutes.

## Look
- Low poly (Rodrigo rejected the first paper-cutout look on Nov 12). Characters and props are faceted models built in code in src/objects/models.js. No model files.
- Props use toon() (two-tone, outline hull). Floors and walls use soft() and cast no shadows. Characters use charMat (smooth light on flat faces). Glow comes from colors brighter than white.
- The 2D Gemini portraits appear only in the dialogue box.
- Keep lights low. Floors blow out to white fast.
- Never prompt image AI for show characters. Never use show audio.

## Layout
- src/engine/: core (renderer, glow), toon (materials, shapes), cameraRig, input, tween, audio
- src/areas/: one file per set, returns { group, bounds, colliders, spots, update }
- src/objects/: models (Morty, Rick, gun, walk cycle), player, portal (cutout.js is the unused first version)
- src/scenes/: cutscenes written with await (coldOpen), labScene (portal gun, guards, pickups, ending), camera shot helpers
- src/ui/: hud (bars, fades, cards), dialogue (box and conversation runner)
- src/data/dialogue/: dialogue JSON, same format as the 2D game. Never hardcode story dialogue in scenes.
- tools/cut_sheet.py: cuts Gemini sheets at full size with halo trim

## Testing
The preview pane throttles animation. In dev builds use `__game.step(frames)` from the browser console tools to run the game forward, and dispatch KeyboardEvents on window for input.
Stop the dev server after testing (music keeps playing otherwise).

## PROCESS.md
One entry per session: goal, AI tools, key prompts word for word, what was built, key decisions, what went wrong and the revision, what was rejected and why, result, evidence files in process/, chat link, and a blank "Why:" line for Rodrigo.
End every session with a playable build and a commit.
