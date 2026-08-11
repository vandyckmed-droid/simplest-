// Persistence. Watchlist, portfolio weights, filters and theme survive a restart.
//
// AsyncStorage is treated as best-effort: if it is unavailable the app keeps
// working with in-memory state rather than failing to start.

let AsyncStorage = null;
try {
  // eslint-disable-next-line global-require
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const memory = new Map();
const PREFIX = 'momentumdesk:v1:';

export async function loadSetting(key, fallback) {
  try {
    if (!AsyncStorage) return memory.has(key) ? memory.get(key) : fallback;
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

export async function saveSetting(key, value) {
  try {
    memory.set(key, value);
    if (AsyncStorage) await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    // Losing a preference must never take the app down.
  }
}

export async function clearAll() {
  try {
    memory.clear();
    if (AsyncStorage) {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
    }
  } catch (e) {
    /* ignore */
  }
}
