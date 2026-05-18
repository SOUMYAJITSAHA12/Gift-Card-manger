const SETTINGS_KEY = "flipkart_gc_settings";

export interface AppSettings {
  fkCookie: string;
}

const DEFAULTS: AppSettings = {
  fkCookie: "",
};

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
