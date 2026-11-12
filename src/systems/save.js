// Save progress in the browser (localStorage). One slot. Every read and write is wrapped in try/catch:
// private windows and blocked storage throw, and the game must still run without saving.
const KEY = 'rick3d-save-v1';

const save = {
  // data: { area: 'house' | 'garage' | 'lab' | 'boss', phase?, flags: {...} }
  write(data) {
    try { localStorage.setItem(KEY, JSON.stringify({ ...data, at: Date.now() })); } catch { /* no storage: play on */ }
  },
  read() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      return data && data.area && data.flags ? data : null;
    } catch { return null; }
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
  },
};

export default save;
