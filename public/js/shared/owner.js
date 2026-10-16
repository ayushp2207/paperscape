const STORAGE_KEY = 'paperscape.ownerId';

let cachedId;

// Anonymous per-browser identity. Clearing site data starts a fresh workspace.
export function getOwnerId() {
  if (cachedId) return cachedId;
  try {
    cachedId = localStorage.getItem(STORAGE_KEY);
    if (!cachedId) {
      cachedId = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, cachedId);
    }
  } catch {
    cachedId ??= crypto.randomUUID();
  }
  return cachedId;
}
