import { useState, useCallback } from "react";

const STORAGE_KEY = "myplayer_config";

interface Config {
  skipSeconds: number;
}

const DEFAULT_CONFIG: Config = {
  skipSeconds: 10,
};

function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config: Config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function useConfig() {
  const [config, setConfig] = useState<Config>(loadConfig);

  const updateConfig = useCallback((partial: Partial<Config>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      saveConfig(next);
      return next;
    });
  }, []);

  return { config, updateConfig };
}
