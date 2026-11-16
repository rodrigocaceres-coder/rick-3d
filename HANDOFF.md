# Handoff: Rick and Morty 3D, final day (Nov 16)

Upload this file (and PROCESS.md if you need detail) to a normal Claude chat to finish the project.
Demo: Nov 17, 8:25am, live.

## Where things stand
- The game is finished and live: https://rodrigocaceres-coder.github.io/rick-3d/
- Repo: https://github.com/rodrigocaceres-coder/rick-3d (every push to main redeploys in about a minute)
- 10 build sessions, all logged in PROCESS.md, last commit pushed. New builds are over (cut line was Nov 15).
- Not yet checked by a real player at real speed: the whole episode after the Session 10 change, and the bonus caption right after the boss win.

## The episode (for slides)
1. Cold open in the garage, title card, then the Smith house: Beth (rude or kind answer, the sandwich), Summer (her phone is the quest log, Q), Jerry and his lawn chair.
2. Garage: Rick, passed out, explains the busted portal gun. The cracked crystal is still in it; the canister and chip flew out.
3. Shrimp Rick's lab: 3 rooms of portal puzzles (crates and beams through portals, guards, a tripwire). Get the canister, find a Shrimp Police badge, switch off the portal jammer.
4. Citadel of Ricks: the Take a Number puzzle (Desk Rick, Guard Rick, Cop Rick takes the badge as a bribe). The chip is in the lost and found. Shrimp Rick cuts the line.
5. Boss: turn-based fight vs Shrimp Rick in the garage, camera cuts, timed Space press, tank phase, Portal Banish. Ending and post-credits gag.
6. Bonus level after the ending: Blips and Chitz arcade, Ticket Tumble (2500 tickets wins Rick's spare crystal).

Also: autosave with Continue / New episode, automatic glow switch for slow laptops.

## How it was made (for slides)
- Three.js and Vite, vanilla JavaScript. All 3D models built in code (low poly), no model files.
- Code AI: Claude Code (Claude Opus 5.5) for design, code and testing. Test bots played the full episode in the browser.
- Image AI (earlier, 2D game): Gemini portraits, used only in the dialogue box.
- Key revisions: paper-cutout look rejected for low poly (Session 1); story order fixed twice (Session 6, Session 10); Ticket Tumble made easier three times; Blips and Chitz moved to a bonus level because the playthrough felt too long.
- Screenshot evidence, including "v1 vs v2" before/after shots: process/screenshots/ (55 files).

## Left to do
1. Play the whole episode at real speed (about 30 min). Note anything that feels off.
2. Friend playtest (about 45 min). Watch without helping, note where they get stuck.
3. Slides (1 to 2 hours).
4. Fill in the 10 blank "Why:" lines in PROCESS.md (about 20 min). Only Rodrigo can write these.
5. Log the playtest and slides as a final PROCESS.md entry.

## Demo-day safety
- Practice on the laptop you will present from.
- Skip links if something goes wrong live: add `?lab=1`, `?citadel`, `?boss` or `?arcade` to the URL. `?low` turns the glow off for a slow laptop. M mutes.
- Backup if school wifi fails: on the Mac run `npm run build` then `npx vite preview`, and open the local link.

## When to go back to Claude Code
Any bug or tweak found in the playtest needs the code: open Claude Code in ~/rick-3d. CLAUDE.md there has the full context.
