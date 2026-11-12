// Music and sound effects. Files are the AI-made tracks from the 2D game (Gemini music, ElevenLabs effects).
// Browsers block sound until the first key press, so music starts after the "press Space" card.
import { clock } from './tween.js';

const base =`${import.meta.env.BASE_URL}assets/audio/`;
const MUSIC_VOL = 0.15;
const SFX_VOL = 0.5;
let muted = false;
let music = null;
const cache = {};

const audio = {
  music(file) {
    if (music) { music.pause(); music = null; }
    if (!file) return;
    music = new Audio(base + file);
    music.loop = true;
    music.volume = muted ? 0 : MUSIC_VOL;
    music.play().catch(() => {});
  },
  sfx(file, volume = 1) {
    if (muted || clock.timeScale > 1) return; // no sound while a cutscene is being skipped
    const a = (cache[file] ??= new Audio(base + file)).cloneNode();
    a.volume = Math.min(1, SFX_VOL * volume);
    a.play().catch(() => {});
  },
  toggleMute() {
    muted = !muted;
    if (music) music.volume = muted ? 0 : MUSIC_VOL;
    return muted;
  },
};

export default audio;
