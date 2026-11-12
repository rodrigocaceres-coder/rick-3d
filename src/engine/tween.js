// Tiny animation helper. tween() runs a function from 0 to 1 over some seconds and returns a promise,
// so cutscenes read top to bottom with await. timeScale > 1 fast-forwards everything (used to skip cutscenes).
const active = [];
export const clock = { timeScale: 1, time: 0 };

export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
  outBack: (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

export function tween(seconds, fn, easing = ease.inOut) {
  return new Promise((resolve) => {
    active.push({ t: 0, seconds: Math.max(seconds, 0.0001), fn, easing, resolve });
  });
}

export const wait = (seconds) => tween(seconds, () => {});

// Called once per frame from the main loop with the real frame time
export function updateTweens(dt) {
  const step = dt * clock.timeScale;
  clock.time += step;
  for (let i = active.length - 1; i >= 0; i--) {
    const a = active[i];
    a.t = Math.min(a.t + step / a.seconds, 1);
    a.fn(a.easing(a.t));
    if (a.t >= 1) { active.splice(i, 1); a.resolve(); }
  }
}

export const lerp = (a, b, t) => a + (b - a) * t;
