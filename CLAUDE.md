# Rick and Morty 3D: Total Rickall of Parts

3D remake of the 2D RPG in ~/rick-platformer (read-only: never edit that folder). Same school project, due Nov 17, 8:25am, live demo.
Story, characters and tone: ~/rick-platformer/STORY.md and its dialogue JSON. Process evidence is graded: log every session in PROCESS.md.

## Game
A playable episode: cold open, title card, the Smith house, portal puzzle, boss, post-credits gag.
Slice order: 1. Smith garage hub (built). 2. Shrimp Rick's lab (built Nov 12: 3 rooms, portal gun, guards, parts, Shrimp Rick entrance). 3. Turn-based boss vs Shrimp Rick in the garage (built Nov 12: rules from STORY.md, camera cuts, timed Space press, tank phase, Portal Banish, ending, post-credits gag).
4. Smith house and the family (built Nov 12: house set, Beth, Summer and Jerry, cold open ends in the house, sandwich handover, Summer's phone as the quest log on Q, Jerry's lawn chair, door to the garage).
Story change from 2D: all 3 gun parts land in the shrimp lab.

## Roadmap (set Nov 12, after slice 3)
One build per session, in this order. Each line is a goal, not a design: the building model owns how it looks, plays and fits the story, and may change the story threading if it makes a better episode. Read STORY.md and the 2D dialogue JSON for characters and tone first.
4. Smith house and the family: done, see Game above.
5. Save progress. Flags, parts, items and area in localStorage (try/catch), a Continue option on the start card. Done: refresh mid-episode and carry on.
6. Blips and Chitz. An arcade set, Gorbi and Glorp, one arcade challenge that is fun in 3D, the arcade soda as its reward. Done: reachable by portal, beatable, sets a flag the boss fight reads. (The soda is free in the fight until then: give it a "flag" in src/data/items.json like the sandwich has.)
7. Citadel of Ricks. A queue of bureaucrat Ricks and the Take a Number dialogue puzzle. Done: reachable, beatable, worth the trip (a reward or a story beat).
8. Lab extras: crates and beams through portals, cut from Session 2. Done: one new puzzle beat per room, old solutions still work.
Rules for every build: the episode must stay playable start to end after each session, the `?boss`, `?lab` and `?garage` test links keep working, test with a script before the commit, log the session.
Cut line: stop new builds at the end of Nov 15. Nov 16 is for fixes, a friend playtest and slides. If time runs short, drop from the bottom of the list.

## Stack
- Three.js 0.187 (pinned), Vite, vanilla JavaScript. Packages: three, vite. Ask before adding or removing any package.
- Run: `npm run dev`. Deploy target: GitHub Pages (vite base './').
- `?skip` skips the cold open (play starts in the house). `?garage` starts in the garage with Beth's errand done. `?lab=1`, `2` or `3` starts in that lab room. `?boss` starts at the boss fight (`?boss=fight` skips its opening, `?boss=2` starts at the tank phase, `&norebels` plays without Prawnsworth's help, `&nosandwich` without Beth's sandwich). `?low` turns off the glow for slow laptops. M mutes.

## Look
- Low poly (Rodrigo rejected the first paper-cutout look on Nov 12). Characters and props are faceted models built in code in src/objects/models.js. No model files.
- Props use toon() (two-tone, outline hull). Floors and walls use soft() and cast no shadows. Characters use charMat (smooth light on flat faces). Glow comes from colors brighter than white.
- The 2D Gemini portraits appear only in the dialogue box.
- Keep lights low. Floors blow out to white fast.
- Never prompt image AI for show characters. Never use show audio.

## Layout
- src/engine/: core (renderer, glow), toon (materials, shapes), cameraRig, input, tween, audio
- src/areas/: one file per set, returns { group, bounds, colliders, spots, update }
- src/objects/: models (Morty, Rick, gun, walk cycle), family (Beth, Summer, Jerry, lawn chair, sandwich), player, portal (cutout.js is the unused first version)
- src/scenes/: cutscenes written with await (coldOpen), houseScene (the family, handovers, Jerry's chair, the house half of the cold open), labScene (portal gun, guards, pickups, ending), bossScene (the staged fight), camera shot helpers
- src/ui/: hud (bars, fades, cards), dialogue (box and conversation runner), phone (Summer's phone, the quest log; content in src/data/phone.json), battleUi (HP bars, menu, timing ring, damage numbers)
- src/systems/: flags, battleRules (boss fight numbers only, all tuning in RULES; change one value at a time)
- src/data/dialogue/: dialogue JSON, same format as the 2D game, plus two additions: a line can have an "if", and a node's "do" can run a staged action mid-conversation (onDo in converse). Never hardcode story dialogue in scenes.
- tools/cut_sheet.py: cuts Gemini sheets at full size with halo trim

## Testing
The preview pane throttles animation. In dev builds use `__game.step(1)` from the browser console tools to run the game forward one frame at a time (wait a tick between frames, or cutscene code never continues), and dispatch KeyboardEvents on window for input.
Stop the dev server after testing (music keeps playing otherwise).
Screenshots from the preview pane lag one paint behind: wait about 0.7 seconds, take a small throwaway screenshot, then the real one.

## PROCESS.md
One entry per session: goal, AI tools, key prompts word for word, what was built, key decisions, what went wrong and the revision, what was rejected and why, result, evidence files in process/, chat link, and a blank "Why:" line for Rodrigo.
End every session with a playable build and a commit.
