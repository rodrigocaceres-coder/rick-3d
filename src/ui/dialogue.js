import flags from '../systems/flags.js';
import audio from '../engine/audio.js';
import { clock } from '../engine/tween.js';

// Dialogue box and the conversation runner. Conversations live in src/data/dialogue/*.json in the same
// format as the 2D game: entry rules pick a start node, nodes have lines, optional choices, flags to set.
const $ = (id) => document.getElementById(id);
const root = $('dialogue'), portrait = $('dlg-portrait'), nameEl = $('dlg-name'), textEl = $('dlg-text');
const choicesEl = $('dlg-choices'), arrow = $('dlg-arrow');
const base = `${import.meta.env.BASE_URL}assets/portraits/`;
const CHAR_MS = 26;
const ADVANCE = ['Space', 'Enter'];

let onKey = null; // the current key handler, one at a time
window.addEventListener('keydown', (e) => { if (!e.repeat && onKey) onKey(e); });
root.addEventListener('click', () => onKey?.({ code: 'Space' }));

let lastSpeaker = '';

// Show one line with a typewriter effect. First key press finishes the line, second moves on.
export function say({ speaker, mood = 'neutral', text }) {
  root.classList.add('on');
  choicesEl.innerHTML = '';
  nameEl.textContent = speaker;
  portrait.src = `${base}${speaker.toLowerCase().replace(/\s+/g, '')}_${mood}.png`;
  if (speaker !== lastSpeaker) { portrait.classList.remove('enter'); void portrait.offsetWidth; portrait.classList.add('enter'); }
  lastSpeaker = speaker;
  arrow.classList.remove('on');

  return new Promise((resolve) => {
    if (clock.timeScale > 1) { textEl.textContent = text; resolve(); return; } // cutscene is being skipped
    let n = 0;
    portrait.classList.add('talk');
    const finish = () => {
      clearInterval(timer);
      textEl.textContent = text;
      portrait.classList.remove('talk');
      arrow.classList.add('on');
      n = text.length;
    };
    const timer = setInterval(() => {
      n++;
      textEl.textContent = text.slice(0, n);
      if (n % 3 === 0 && text[n - 1] !== ' ') audio.sfx('blip.mp3', 0.35);
      if (n >= text.length) finish();
    }, CHAR_MS);
    onKey = (e) => {
      if (!ADVANCE.includes(e.code)) return;
      if (n < text.length) { finish(); return; }
      onKey = null;
      arrow.classList.remove('on');
      resolve();
    };
  });
}

// Show 2 or 3 choices. Up/Down or W/S to move, Space or Enter to pick, or click one. Resolves with the index.
export function choose(texts) {
  let sel = 0;
  const draw = () => [...choicesEl.children].forEach((el, i) => el.classList.toggle('sel', i === sel));
  return new Promise((resolve) => {
    const pick = (i) => { onKey = null; audio.sfx('menu_select.mp3'); choicesEl.innerHTML = ''; resolve(i); };
    texts.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'choice';
      el.textContent = t;
      el.addEventListener('click', (ev) => { ev.stopPropagation(); pick(i); });
      choicesEl.appendChild(el);
    });
    draw();
    onKey = (e) => {
      if (['ArrowDown', 'KeyS'].includes(e.code)) { sel = (sel + 1) % texts.length; audio.sfx('menu_move.mp3'); draw(); }
      else if (['ArrowUp', 'KeyW'].includes(e.code)) { sel = (sel + texts.length - 1) % texts.length; audio.sfx('menu_move.mp3'); draw(); }
      else if (ADVANCE.includes(e.code)) pick(sel);
    };
  });
}

export function closeDialogue() { root.classList.remove('on'); lastSpeaker = ''; onKey = null; }

// Run a whole conversation. onLine(line) is called before each line so the camera can cut to the speaker.
// Returns the list of "do" actions the conversation asked for (for example { portal: true }).
export async function converse(convo, { onLine } = {}) {
  const todo = [];
  let id = convo.entry.find((e) => flags.check(e.if))?.goto;
  while (id) {
    const node = convo.nodes[id];
    id = null;
    flags.setMany(node.set);
    for (const line of node.lines ?? []) { onLine?.(line); await say(line); }
    if (node.do) todo.push(node.do);
    if (node.choices) {
      const options = node.choices.filter((c) => flags.check(c.if));
      const c = options[await choose(options.map((o) => o.text))];
      flags.setMany(c.set);
      if (c.do) todo.push(c.do);
      id = c.goto;
    } else {
      id = node.goto ?? null;
    }
  }
  closeDialogue();
  return todo;
}
