# Rick and Morty 3D: Total Rickall of Parts

3D remake of the 2D RPG in ~/rick-platformer (read-only: never edit that folder). Same school project, due Nov 17, 8:25am, live demo.
Story, characters and tone: ~/rick-platformer/STORY.md and its dialogue JSON. Process evidence is graded: log every session in PROCESS.md.

## Game
A playable episode: cold open, title card, the Smith house, portal puzzle, boss, post-credits gag.
Slice order: 1. Smith garage hub (built). 2. Shrimp Rick's lab (built Nov 12: 3 rooms, portal gun, guards, parts, Shrimp Rick entrance). 3. Turn-based boss vs Shrimp Rick in the garage (built Nov 12: rules from STORY.md, camera cuts, timed Space press, tank phase, Portal Banish, ending, post-credits gag).
4. Smith house and the family (built Nov 12: house set, Beth, Summer and Jerry, cold open ends in the house, sandwich handover, Summer's phone as the quest log on Q, Jerry's lawn chair, door to the garage).
5. Save progress (built Nov 12: autosave whenever Morty gets control back plus boss phase checkpoints, Continue / New episode on the start card, test links never touch the save).
6. Blips and Chitz (built Nov 12; a bonus level after the ending since Nov 16). 7. Citadel of Ricks (built Nov 12: Take a Number puzzle with Desk, Guard and Cop Rick, the chip in the lost and found, Shrimp Rick cuts the line).
Story order (changed Nov 16): the crystal is cracked but still in the gun, and its last charge opens a portal straight to Shrimp Rick's lab. The lab gives the canister; switching off Shrimp Rick's portal jammer in room 3 (where Morty also picks up a Shrimp Police badge) lets the gun jump to the Citadel. The chip is in the Citadel lost and found, and Cop Rick takes the badge as his bribe. Shrimp Rick follows, gets told to take a number, and Morty portals home. Then the boss in the garage. After the ending, a portal in the garage opens Blips and Chitz as a bonus level (Ticket Tumble wins Rick's spare crystal, his soda and a ring); its portal home stays open. The soda is always in the boss fight.

## Roadmap (set Nov 12, after slice 3)
One build per session, in this order. Each line is a goal, not a design: the building model owns how it looks, plays and fits the story, and may change the story threading if it makes a better episode. Read STORY.md and the 2D dialogue JSON for characters and tone first.
4. Smith house and the family: done, see Game above.
5. Save progress: done, see Game above.
6. Blips and Chitz: done, a bonus level after the ending since Nov 16 (Rodrigo: the playthrough was too long with it on the main path).
7. Citadel of Ricks: done, see Game above.
8. Lab extras: done (built Nov 12: crates and beams through portals; room 1 crate onto a plate opens the door, room 2 beam into a plug unclamps the canister, room 3 crate blocks a tripwire in front of the jammer; R drops a fresh crate).
Rules for every build: the episode must stay playable start to end after each session, the `?boss`, `?lab`, `?garage`, `?arcade` and `?citadel` test links keep working, test with a script before the commit, log the session.
Cut line: stop new builds at the end of Nov 15. Nov 16 is for fixes, a friend playtest and slides. If time runs short, drop from the bottom of the list.

## Stack
- Three.js 0.187 (pinned), Vite, vanilla JavaScript. Packages: three, vite. Ask before adding or removing any package.
- Run: `npm run dev`. Deploy target: GitHub Pages (vite base './').
- `?skip` skips the cold open (play starts in the house). `?garage` starts in the garage with Beth's errand done. `?lab=1`, `2` or `3` starts in that lab room. `?boss` starts at the boss fight (`?boss=fight` skips its opening, `?boss=2` starts at the tank phase, `&norebels` plays without Prawnsworth's help, `&nosandwich` without Beth's sandwich). `?arcade` starts at Blips and Chitz, the bonus level, as if the episode were finished (`?arcade=tip` with Glorp's tip heard). `?citadel` starts at the Citadel (`?citadel=cop` with Desk Rick and Guard Rick already passed). `?low` turns off the glow for slow laptops (the game also turns it off by itself under ~25 fps; `?speedtest` turns that check on in dev builds). M mutes.

## Look
- Low poly (Rodrigo rejected the first paper-cutout look on Nov 12). Characters and props are faceted models built in code in src/objects/models.js. No model files.
- Props use toon() (two-tone, outline hull). Floors and walls use soft() and cast no shadows. Characters use charMat (smooth light on flat faces). Glow comes from colors brighter than white.
- The 2D Gemini portraits appear only in the dialogue box.
- Keep lights low. Floors blow out to white fast.
- Never prompt image AI for show characters. Never use show audio.

## Layout
- src/engine/: core (renderer, glow), toon (materials, shapes), cameraRig, input, tween, audio
- src/areas/: one file per set, returns { group, bounds, colliders, spots, update }
- src/objects/: models (Morty, Rick, gun, walk cycle), ricks (the Citadel's Rick variants and Clerk Morty), family (Beth, Summer, Jerry, lawn chair, sandwich), player, portal (cutout.js is the unused first version)
- src/scenes/: cutscenes written with await (coldOpen), houseScene (the family, handovers, Jerry's chair, the house half of the cold open), labScene (portal gun, guards, pickups, jammer, escape to the Citadel), citadelScene (Take a Number puzzle, chip, Shrimp Rick cutting the line), bossScene (the staged fight), camera shot helpers
- src/ui/: hud (bars, fades, cards), dialogue (box and conversation runner), phone (Summer's phone, the quest log; content in src/data/phone.json), battleUi (HP bars, menu, timing ring, damage numbers)
- src/systems/: flags, save (localStorage slot), battleRules (boss fight numbers only, all tuning in RULES; change one value at a time)
- src/data/dialogue/: dialogue JSON, same format as the 2D game, plus two additions: a line can have an "if", and a node's "do" can run a staged action mid-conversation (onDo in converse). Never hardcode story dialogue in scenes.
- tools/cut_sheet.py: cuts Gemini sheets at full size with halo trim

## Testing
The preview pane throttles animation. In dev builds use `__game.step(1)` from the browser console tools to run the game forward one frame at a time (wait a tick between frames, or cutscene code never continues), and dispatch KeyboardEvents on window for input.
Stop the dev server after testing (music keeps playing otherwise).
Screenshots from the preview pane lag one paint behind: wait about 0.7 seconds, take a small throwaway screenshot, then the real one.

## PROCESS.md
One entry per session: goal, AI tools, key prompts word for word, what was built, key decisions, what went wrong and the revision, what was rejected and why, result, evidence files in process/, chat link, and a blank "Why:" line for Rodrigo.
End every session with a playable build and a commit.
