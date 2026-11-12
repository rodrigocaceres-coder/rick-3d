import { tween, ease } from '../engine/tween.js';

// The 2D layer on top of the 3D picture: letterbox bars, fades, the goal line, key hints, title cards.
const $ = (id) => document.getElementById(id);
const fadeEl = $('fade'), flashEl = $('flash'), card = $('card');
let fadeNow = 1;
let toastTimer = 0;

const hud = {
  // Black movie bars slide in for cutscenes and dialogue
  cinema(on) { document.body.classList.toggle('cinema', on); document.body.classList.toggle('play', !on); },

  fade(to, seconds = 0.6) {
    const from = fadeNow;
    return tween(seconds, (t) => { fadeNow = from + (to - from) * t; fadeEl.style.opacity = fadeNow; }, ease.linear);
  },

  flash(strength = 0.9, seconds = 0.35) {
    return tween(seconds, (t) => { flashEl.style.opacity = strength * (1 - t); }, ease.out);
  },

  goal(text) { $('goal').textContent = text; $('goal').classList.toggle('on', Boolean(text)); },

  // Key hint above something Morty can use. x and y are screen pixels.
  prompt(text, x, y) {
    const el = $('prompt');
    if (!text) { el.classList.remove('on'); return; }
    $('prompt-text').textContent = text;
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    el.classList.add('on');
  },

  caption(text) { $('caption').textContent = text || $('caption').textContent; $('caption').classList.toggle('on', Boolean(text)); },

  toast(text) {
    $('toast').textContent = text; $('toast').classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('on'), 1400);
  },

  card({ small = '', big = '', hint = '', solid = false }) {
    $('card-small').textContent = small;
    $('card-big').innerHTML = big;
    $('card-hint').textContent = hint;
    card.classList.toggle('solid', solid);
    card.classList.remove('on');
    void card.offsetWidth; // restart the slam animation
    card.classList.add('on');
  },
  hideCard() { card.classList.remove('on'); },
};

export default hud;
