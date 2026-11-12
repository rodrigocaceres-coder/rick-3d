# Process log: Rick and Morty 3D

The 3D remake of the 2D RPG in ~/rick-platformer. One entry per session. The 2D game's own log stays in its folder.

### Session 1, 2026-11-12
- Goal: Pitch the 3D version, then build the first playable piece: Smith garage hub, movement, film camera, dialogue, portal effect, cold open.
- AI types and tools: code AI (Claude Code, Claude Fable 5.2) for design, code and testing. No new image or audio AI this session: characters, portraits, music and sound effects are the Gemini and ElevenLabs outputs from the 2D game, re-cut for 3D.
- Key prompts (word for word):
  - "Build a 3D version of my Rick and Morty RPG, on steroids. You own the design and the build. Surprise me."
  - "Cinematic feel: lighting, effects, camera, transitions. The game should feel like an episode of the show."
  - "Start with the Smith garage hub, one portal puzzle area, and the boss. Add areas only once those three feel great."
  - "Go, build it"
- What was built:
  - New project in ~/rick-3d: Three.js 0.187 + Vite, vanilla JavaScript. Packages: three, vite. Nothing else.
  - Garage set built from boxes and cylinders to match the painted 2D garage (shelf, red tool cabinet, pegboard, garage door, jar shelves, workbench with humming tubes, cardboard boxes, paint cans). Two-tone cartoon shading, dark outlines on every prop, real shadows, glow on the tubes and jars.
  - Morty and Rick as paper cutouts that turn to face the camera. Morty: 8-direction movement with smooth speed-up, walk bob, lean, flip, squash on stop. Rick lies passed out with floating Z's.
  - Film camera: follows Morty in play; in dialogue it cuts to an over-the-shoulder shot of whoever speaks and slowly pushes in. Letterbox bars, screen shake, flash, fades.
  - Dialogue box with big portrait, typewriter text, choices, story flags. Same JSON format as the 2D game.
  - Green portal: swirl drawn by a small shader, wobbly rim, orbiting sparks, green light.
  - Cold open (about 25 seconds, Escape skips): portal rips open, Rick falls out spinning, the gun bounces and cracks, three glowing parts fly back into the portal, Rick says one line, Morty walks in, title card.
  - Playable loop: talk to Rick, check the gun, pull the trigger, the gun fires a portal, walk in, "Next: Shrimp Rick's lab" card, back to the garage.
- Key decisions:
  - Paper cutouts in 3D sets instead of 3D character models. Reuses the graded Gemini art, keeps the flat cartoon look, and there is no time before Nov 17 to model characters.
  - Story compressed for the 3-area slice: all 3 gun parts land in Shrimp Rick's lab (the 2D game spreads them over 3 areas). Rick's "where" line and the gun screen line were rewritten for this. Two new lines in the cold open: Rick "Nailed it. Zzzz." and Morty "Rick? What was that noise?"
  - Dialogue box is drawn by the browser (HTML) on top of the 3D picture, so text and portraits stay sharp.
  - Outlines are a second, slightly bigger copy of each shape drawn inside out in near-black. Cheap, and works on a slow laptop.
  - Cutscenes are written with await, one line per beat, and Escape fast-forwards time 40x instead of needing separate skip code.
- What went wrong or looked weak, and the revision:
  - Sprites from the 2D game were 144 px tall and blurry in 3D. Re-cut Morty and Rick from the original Gemini sheets at full size (210 px sprites, 340 px portraits) with a copy of tools/cut_sheet.py.
  - Cutouts had a white halo (pale pixels between the white page and the ink line). Added a 3-pass fringe trim to the cutter.
  - First render was too bright and the gun light blew the floor out to white. Cut every light to about a third, darker blue fill light.
  - Dialogue shots v1 were too close: characters filled half the screen and looked blurry, and Morty walked through Rick. Camera pulled back from 6.2 to 9 units, added a collision box for Rick and the gun.
  - Portal v1 was a solid white blob. Portal brightness 1.6 to 1.2, glow strength 0.85 to 0.5, so only the hot bands glow.
  - Title card v1 landed on top of Morty's face. It now cuts to a high wide shot of the garage first.
  - The preview pane runs the game in slow motion, so key-hold tests did nothing. Added a dev-only __game.step() hook to run frames by hand.
- Rejected, and why:
  - Full 3D character models: no time, and would not match the show's flat look.
  - Outline as a screen effect (edge detection): draws boxes around the flat cutouts and costs a second render of the scene.
  - Extra packages (animation library, post-processing library): Three.js already ships bloom, and a 40-line tween helper covers the animation.
  - A separate area for each gun part: the brief is 3 great areas first.
- Result: Playable from start card to the portal exit, no console errors, production build passes. Deployed to GitHub Pages at https://rodrigocaceres-coder.github.io/rick-3d/ (new public repo rodrigocaceres-coder/rick-3d, a GitHub Actions workflow rebuilds it on every push to main). Letterbox bars and real-time feel are not yet confirmed on Rodrigo's machine, because the preview pane throttles animation.
- Evidence files: process/screenshots/2026-11-12_s1_first-render-too-bright.jpg, _dialogue-v1-too-close-white-halo.jpg, _dialogue-v2.jpg, _portal-v1-blown-out.jpg, _cold-open-rick-falls.jpg, _cold-open-gun-parts.jpg, _title-card-v1-over-morty.jpg
- Chat link: Claude Code session "Rick and Morty 3D RPG" (desktop app link claude://claude.ai/epitaxy/local_a29351ea-a4fc-46bb-bbdc-587e649e7de1)
- Why:
