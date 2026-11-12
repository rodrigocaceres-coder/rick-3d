// Story flags: one shared store of named values. Dialogue sets them, the game reads them.
// Same idea and same condition strings as the 2D game: "flag" is true when set, "!flag" when not set.
const store = {};

const flags = {
  get: (name) => store[name],
  set(name, value = true) { store[name] = value; },
  setMany(obj = {}) { Object.assign(store, obj); },
  check(cond) {
    if (!cond) return true;
    return cond.startsWith('!') ? !store[cond.slice(1)] : Boolean(store[cond]);
  },
};

export default flags;
