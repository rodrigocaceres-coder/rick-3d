import flags from '../systems/flags.js';
import audio from '../engine/audio.js';
import data from '../data/phone.json';

// Summer's phone: the quest log. Q opens it once Morty has borrowed it. Everything it shows comes from
// story flags and src/data/phone.json, so it is always up to date.
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; e.textContent = text; return e; };

function render() {
  $('phone-app').textContent = data.app;
  $('phone-title').textContent = data.title;
  $('phone-sub').textContent = data.subtitle;
  const tasks = $('phone-tasks');
  tasks.innerHTML = '';
  let nowSet = false;
  for (const t of data.tasks.filter((x) => flags.check(x.show))) {
    const done = flags.check(t.done);
    const li = el('li', done ? 'done' : nowSet ? '' : 'now', t.text);
    if (!done) nowSet = true;
    tasks.appendChild(li);
  }
  $('phone-parts-label').textContent = data.partsLabel;
  const parts = $('phone-parts');
  parts.innerHTML = '';
  data.parts.forEach((p) => parts.appendChild(el('span', flags.check(p.flag) ? 'got' : '', p.name)));
  $('phone-pockets-label').textContent = data.pocketsLabel;
  const have = data.pockets.filter((p) => flags.check(p.flag) && !(p.gone && flags.check(p.gone)));
  $('phone-pockets').textContent = have.length ? have.map((p) => p.name).join(', ') : data.pocketsEmpty;
  $('phone-note').textContent = data.notes.find((n) => flags.check(n.if)).text;
  $('phone-close').textContent = data.close;
}

const phone = {
  open() { render(); $('phone').classList.add('on'); audio.sfx('menu_select.mp3'); },
  close() { $('phone').classList.remove('on'); audio.sfx('menu_move.mp3'); },
};

export default phone;
