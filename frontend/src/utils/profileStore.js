// Lightweight localStorage persistence for the driver's Profile and carrier
// Settings, so a saved profile can auto-fill the New Trip form. No backend/auth
// here — this is per-device convenience data, keyed under a small namespace.

const PROFILE_KEY = 'eld.profile';
const SETTINGS_KEY = 'eld.settings';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — fail silently, it's only convenience data */
  }
}

export const loadProfile  = () => read(PROFILE_KEY);
export const saveProfile  = (data) => write(PROFILE_KEY, data);
export const loadSettings = () => read(SETTINGS_KEY);
export const saveSettings = (data) => write(SETTINGS_KEY, data);

// Map the saved Profile + Settings onto the TripForm's driver/vehicle fields.
// Returns only the fields that actually have a value, plus a flag for whether
// there's anything to fill — so the form can hide the auto-fill button when the
// profile is empty.
export function tripPrefillFromStore() {
  const p = loadProfile() || {};
  const s = loadSettings() || {};
  const driver = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  const carrier = (s.carrier && s.carrier.name) || '';
  const truck = (s.vehicle && s.vehicle.truckNum) || '';

  const prefill = {};
  if (driver)  prefill.driver = driver;
  if (carrier) prefill.carrier = carrier;
  if (truck)   prefill.truck = truck;

  return { prefill, hasAny: Object.keys(prefill).length > 0 };
}
