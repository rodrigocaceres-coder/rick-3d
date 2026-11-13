import { camera } from '../engine/core.js';
import audio from '../engine/audio.js';
import { tween, wait, ease } from '../engine/tween.js';

// The boss fight's 2D layer: HP bars, the action menu, the timing ring, damage numbers, attack banners.
// Drawn by the browser on top of the 3D picture, like the dialogue box.
const $ = (id) => document.getElementById(id);
const root = $('battle'), menuEl = $('bmenu'), listEl = $('bmenu-list'), descEl = $('bmenu-desc');
const ring = $('ring'), ringLabel = $('ring-label'), banner = $('bbanner'), sauce = $('sauce'), pops = $('pops');

let onKey = null; // one key handler at a time (the menu or the timing ring)
window.addEventListener('keydown', (e) => { if (!e.repeat && onKey) onKey(e); });

// Where a point in the 3D world lands on the screen, in pixels. Kept inside the screen, so a ring or number
// for something out of shot (or behind the camera) still shows up near the edge instead of vanishing.
function toScreen(p) {
  const v = p.clone().project(camera);
  if (v.z > 1) { v.x = -v.x; v.y = -v.y; } // behind the camera: projection comes out mirrored
  const clamp = (n) => Math.min(0.85, Math.max(-0.85, n));
  return { x: (clamp(v.x) * 0.5 + 0.5) * innerWidth, y: (-clamp(v.y) * 0.5 + 0.5) * innerHeight };
}

function setBar(el, who, tags) {
  const pct = Math.max(0, who.hp / who.max);
  const fill = el.querySelector('.hp-fill');
  if (parseFloat(fill.style.width) > pct * 100 + 0.01) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  fill.style.width = el.querySelector('.hp-ghost').style.width = `${pct * 100}%`;
  fill.classList.toggle('mid', pct <= 0.5 && pct > 0.25);
  fill.classList.toggle('low', pct <= 0.25);
  el.querySelector('.hp-num').textContent = `${who.hp}/${who.max}`;
  el.querySelector('.hp-tags').innerHTML = tags.map(([text, kind]) => `<span class="tag ${kind}">${text}</span>`).join('');
}

const ui = {
  show(on) { root.classList.toggle('on', on); if (!on) { ui.hideMenu(); ui.sauce(false); ring.className = ''; } },

  // Redraw both HP bars and the little status tags under them
  refresh(s, bossName) {
    $('hp-boss').querySelector('.hp-name').textContent = bossName;
    setBar($('hp-morty'), s.morty, [
      s.defending && ['DEFENDING', 'good'], s.charged && ['NEXT SHOT x2', 'good'], s.sauced && ['SAUCE IN EYES', 'bad'],
    ].filter(Boolean));
    setBar($('hp-boss'), s.boss, [
      s.shelled && ['SHELL UP', 'bad'], s.attackDown > 0 && [`RATTLED ${s.attackDown}`, 'good'], s.slamReady && ['WINDING UP', 'warn'],
    ].filter(Boolean));
  },

  // options: [{ id, label, desc, hot, off }]. Up/Down or W/S to move, Space or Enter to pick, Escape for Back.
  // Resolves with the picked option's id.
  menu(options, start = 0) {
    let sel = Math.min(start, options.length - 1);
    listEl.innerHTML = '';
    options.forEach((o) => {
      const el = document.createElement('div');
      el.className = `bopt${o.hot ? ' hot' : ''}${o.off ? ' off' : ''}`;
      el.textContent = o.label;
      listEl.appendChild(el);
    });
    const draw = () => {
      [...listEl.children].forEach((el, i) => el.classList.toggle('sel', i === sel));
      descEl.textContent = options[sel].desc;
    };
    draw();
    menuEl.classList.add('on');
    return new Promise((resolve) => {
      const pick = (o) => {
        if (o.off) { audio.sfx('menu_move.mp3'); return; }
        onKey = null; audio.sfx('menu_select.mp3'); ui.hideMenu(); resolve(o.id);
      };
      onKey = (e) => {
        if (['ArrowDown', 'KeyS'].includes(e.code)) { sel = (sel + 1) % options.length; audio.sfx('menu_move.mp3'); draw(); }
        else if (['ArrowUp', 'KeyW'].includes(e.code)) { sel = (sel + options.length - 1) % options.length; audio.sfx('menu_move.mp3'); draw(); }
        else if (['Space', 'Enter'].includes(e.code)) pick(options[sel]);
        else if (['Escape', 'Backspace'].includes(e.code)) { const back = options.find((o) => o.id === 'back'); if (back) pick(back); }
      };
    });
  },
  hideMenu() { menuEl.classList.remove('on'); if (onKey) onKey = null; },

  // The timed Space press. A green ring shrinks onto a white ring over `lead` seconds; press Space as they meet.
  // at(): the 3D point the ring sits on. Resolves with 'perfect', 'good' or 'miss'. One press only.
  // It runs on the game clock (not a browser animation), so tests can step through it frame by frame.
  timing({ at, lead = 0.9, good = 0.2, perfect = 0.08, hint = '', wobble = 0 }) {
    return new Promise((resolve) => {
      let elapsed = 0, done = false;
      const p0 = toScreen(at());
      ring.style.transform = `translate(${p0.x}px, ${p0.y}px)`; // in place before it shows, so it never flashes at the corner
      ring.style.setProperty('--s', '3.2'); // start big: otherwise it shows the last ring's final size for a frame
      ring.className = 'on';
      ringLabel.textContent = hint;
      ringLabel.style.display = hint ? '' : 'none';
      const finish = (q) => {
        if (done) return;
        done = true; onKey = null;
        ring.className = `on done ${q}`;
        ringLabel.style.display = '';
        ringLabel.textContent = { perfect: 'PERFECT!', good: 'NICE!', miss: 'MISS' }[q];
        audio.sfx(q === 'miss' ? 'menu_move.mp3' : 'menu_select.mp3', q === 'perfect' ? 1.4 : 1);
        wait(0.45).then(() => { if (ring.classList.contains('done')) ring.className = ''; });
        resolve(q);
      };
      onKey = (e) => {
        if (e.code !== 'Space' && e.code !== 'Enter') return;
        const off = Math.abs(elapsed - lead);
        finish(off <= perfect ? 'perfect' : off <= good ? 'good' : 'miss');
      };
      const total = lead + good;
      tween(total, (t) => {
        if (done) return;
        elapsed = t * total;
        const p = toScreen(at());
        // Sauce in his eyes: the ring swims around
        const wx = wobble ? Math.sin(elapsed * 17) * wobble * innerHeight : 0, wy = wobble ? Math.cos(elapsed * 13) * wobble * innerHeight : 0;
        ring.style.transform = `translate(${p.x + wx}px, ${p.y + wy}px)`;
        ring.style.setProperty('--s', Math.max(0.55, 1 + ((lead - elapsed) / lead) * 2.2).toFixed(3));
        ring.classList.toggle('close', Math.abs(elapsed - lead) <= good);
      }, ease.linear).then(() => finish('miss'));
    });
  },

  // A number or word that pops up over a point in the world. kind: '', 'crit', 'hurt', 'heal', 'small'
  pop(text, worldPos, kind = '') {
    const p = toScreen(worldPos);
    const el = document.createElement('div');
    el.className = `pop ${kind}`;
    el.textContent = text;
    el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    pops.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  },

  // Attack name that slams in at the top, then leaves on its own
  async banner(text, seconds = 1.0, green = false) {
    banner.textContent = text;
    banner.classList.toggle('green', green);
    banner.classList.add('on');
    await wait(seconds);
    banner.classList.remove('on');
  },

  // Red splats on the camera lens
  sauce(on) {
    if (on && !sauce.children.length) {
      [[8, 12, 30], [62, 6, 26], [78, 48, 34], [18, 58, 28], [44, 30, 18], [38, 70, 22], [88, 14, 16]].forEach(([x, y, size], i) => {
        const b = document.createElement('i');
        Object.assign(b.style, { left: `${x}%`, top: `${y}%`, width: `${size}vh`, height: `${size * 0.85}vh`, transform: `rotate(${i * 47}deg)` });
        sauce.appendChild(b);
      });
    }
    sauce.classList.toggle('on', on);
  },
};

export default ui;
