import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "palladiumGameSettings";

const defaultSettings = {
  usePainStagger: true,
  useMoraleRouting: true,
  useInsanityTrauma: true,
};

const GameSettingsContext = createContext({
  settings: defaultSettings,
  updateSettings: () => {},
  resetSettings: () => {},
});

export function GameSettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (err) {
      console.warn("Failed to load game settings:", err);
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn("Failed to save game settings:", err);
    }
  }, [settings]);

  const updateSettings = (partial) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const resetSettings = () => setSettings(defaultSettings);

  return (
    <GameSettingsContext.Provider
      value={{ settings, updateSettings, resetSettings }}
    >
      {children}
    </GameSettingsContext.Provider>
  );
}

export function useGameSettings() {
  return useContext(GameSettingsContext);
}

