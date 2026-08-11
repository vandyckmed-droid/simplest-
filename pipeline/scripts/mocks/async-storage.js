const store = new Map();
export default {
  getItem: (k) => Promise.resolve(store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    store.set(k, v);
    return Promise.resolve();
  },
  removeItem: (k) => {
    store.delete(k);
    return Promise.resolve();
  },
  getAllKeys: () => Promise.resolve([...store.keys()]),
  multiRemove: (keys) => {
    keys.forEach((k) => store.delete(k));
    return Promise.resolve();
  },
};
