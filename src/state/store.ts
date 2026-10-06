/**
 * Zustand store for PixelPaw application state.
 * Manages pet state, mood, settings, and UI state.
 */

import { create } from 'zustand';
import type { PetState, Direction, MoodValues, PetSettings, PetPosition, EnvironmentInfo } from '../types';

// ─── Store Interface ─────────────────────────────────────────────────────────

interface PetStore {
  // Pet state
  petState: PetState;
  direction: Direction;
  isDragging: boolean;
  isPaused: boolean;
  frame: number;

  // Position
  position: PetPosition;

  // Mood
  mood: MoodValues;

  // Environment
  environment: EnvironmentInfo | null;

  // Settings
  settings: PetSettings;
  settingsLoaded: boolean;

  // UI
  menuOpen: boolean;
  menuPosition: { x: number; y: number };
  settingsWindowOpen: boolean;

  // Actions — Pet
  setPetState: (state: PetState) => void;
  setDirection: (dir: Direction) => void;
  setIsDragging: (dragging: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  setFrame: (frame: number) => void;

  // Actions — Position
  setPosition: (pos: PetPosition) => void;

  // Actions — Mood
  updateMood: (updates: Partial<MoodValues>) => void;
  tickMood: () => void;

  // Actions — Environment
  setEnvironment: (env: EnvironmentInfo | null) => void;

  // Actions — Settings
  setSettings: (settings: PetSettings) => void;
  updateSetting: <K extends keyof PetSettings>(key: K, value: PetSettings[K]) => void;
  setSettingsLoaded: (loaded: boolean) => void;

  // Actions — UI
  setMenuOpen: (open: boolean, position?: { x: number; y: number }) => void;
  setSettingsWindowOpen: (open: boolean) => void;
}

// ─── Default Settings ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: PetSettings = {
  size: 'medium',
  speed: 1.0,
  opacity: 1.0,
  always_on_top: true,
  random_movement: true,
  mouse_following: true,
  keyboard_reactions: true,
  idle_behavior: true,
  launch_at_login: false,
  start_pet_automatically: true,
  sound_enabled: false,
  sound_volume: 0.5,
  battery_saver: false,
  ai_provider: 'AUTO',
  local_model: 'qwen2.5:0.5b',
  gemini_model: 'gemini-3.6-flash',
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const usePetStore = create<PetStore>((set) => ({
  // Initial state
  petState: 'IDLE',
  direction: 'right',
  isDragging: false,
  isPaused: false,
  frame: 0,

  position: { x: 600, y: 400 },

  mood: {
    happiness: 70,
    energy: 80,
    curiosity: 60,
    sleepiness: 20,
  },

  environment: null,

  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,

  menuOpen: false,
  menuPosition: { x: 0, y: 0 },
  settingsWindowOpen: false,

  // Actions
  setPetState: (state) => set({ petState: state }),
  setDirection: (dir) => set({ direction: dir }),
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  setIsPaused: (paused) => set({ isPaused: paused }),
  setFrame: (frame) => set({ frame }),

  setPosition: (pos) => set({ position: pos }),

  updateMood: (updates) =>
    set((s) => ({
      mood: {
        happiness: clamp(updates.happiness ?? s.mood.happiness, 0, 100),
        energy: clamp(updates.energy ?? s.mood.energy, 0, 100),
        curiosity: clamp(updates.curiosity ?? s.mood.curiosity, 0, 100),
        sleepiness: clamp(updates.sleepiness ?? s.mood.sleepiness, 0, 100),
      },
    })),

  tickMood: () =>
    set((s) => ({
      mood: {
        happiness: clamp(s.mood.happiness - 0.01, 0, 100),
        energy: clamp(s.mood.energy - 0.02, 0, 100),
        curiosity: clamp(s.mood.curiosity + (Math.random() - 0.5) * 0.1, 0, 100),
        sleepiness: clamp(s.mood.sleepiness + 0.015, 0, 100),
      },
    })),

  setEnvironment: (env) => set({ environment: env }),

  setSettings: (settings) => set({ settings, settingsLoaded: true }),
  updateSetting: (key, value) =>
    set((s) => ({
      settings: { ...s.settings, [key]: value },
    })),
  setSettingsLoaded: (loaded) => set({ settingsLoaded: loaded }),

  setMenuOpen: (open, position) =>
    set((s) => ({
      menuOpen: open,
      menuPosition: position ?? s.menuPosition,
    })),
  setSettingsWindowOpen: (open) => set({ settingsWindowOpen: open }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
