import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Timer } from './TimerTypes';
import { AssistantEventBus } from '../assistant/AssistantEventBus';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

interface TimerStore {
  timers: Timer[];
  loaded: boolean;
  loadTimers: () => Promise<void>;
  addTimer: (timer: Timer) => void;
  updateTimer: (id: string, updates: Partial<Timer>) => void;
  deleteTimer: (id: string) => void;
  startTimer: (id: string) => void;
  pauseTimer: (id: string) => void;
  resetTimer: (id: string) => void;
  tickTimers: () => void;
}

const persistTimers = async (timers: Timer[]) => {
  try {
    const data = JSON.stringify(timers);
    await invoke('save_data', { key: 'timers', data });
  } catch (err) {
    console.error('Failed to save timers:', err);
  }
};

const notifyTimerComplete = async (title: string) => {
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }
    if (permissionGranted) {
      sendNotification({ title: 'PixelPaw Timer', body: title });
    }
  } catch (err) {
    console.error('Failed to send notification', err);
  }
};

export const useTimerStore = create<TimerStore>((set) => ({
  timers: [],
  loaded: false,

  loadTimers: async () => {
    try {
      const data = await invoke<string>('load_data', { key: 'timers' });
      if (data) {
        const parsed = JSON.parse(data) as Timer[];
        // Re-calculate remaining seconds based on lastTickAt
        const now = Date.now();
        const adjusted = parsed.map(t => {
          if (t.state === 'RUNNING' && t.lastTickAt) {
            const elapsed = Math.floor((now - t.lastTickAt) / 1000);
            t.remainingSeconds = Math.max(0, t.remainingSeconds - elapsed);
            if (t.remainingSeconds === 0) {
              t.state = 'STOPPED' as const;
              // We won't notify here since it happened while app was closed, 
              // but we will reset state.
            }
          }
          t.lastTickAt = now;
          return t;
        });
        set({ timers: adjusted, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch (err) {
      console.error('Failed to load timers:', err);
      set({ loaded: true });
    }
  },

  addTimer: (timer) => {
    set((state) => {
      const newTimers = [...state.timers, timer];
      persistTimers(newTimers);
      return { timers: newTimers };
    });
  },

  updateTimer: (id, updates) => {
    set((state) => {
      const newTimers = state.timers.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      );
      persistTimers(newTimers);
      return { timers: newTimers };
    });
  },

  deleteTimer: (id) => {
    set((state) => {
      const newTimers = state.timers.filter((t) => t.id !== id);
      persistTimers(newTimers);
      return { timers: newTimers };
    });
  },

  startTimer: (id) => {
    set((state) => {
      const newTimers = state.timers.map(t => {
        if (t.id === id) {
          AssistantEventBus.emit({ type: 'TIMER_STARTED', payload: t });
          return { ...t, state: 'RUNNING' as const, lastTickAt: Date.now() };
        }
        return t;
      });
      persistTimers(newTimers);
      return { timers: newTimers };
    });
  },

  pauseTimer: (id) => {
    set((state) => {
      const newTimers = state.timers.map(t =>
        t.id === id ? { ...t, state: 'PAUSED' as const } : t
      );
      persistTimers(newTimers);
      return { timers: newTimers };
    });
  },

  resetTimer: (id) => {
    set((state) => {
      const newTimers = state.timers.map(t => {
        if (t.id === id) {
          AssistantEventBus.emit({ type: 'TIMER_CANCELLED', payload: t });
          return { ...t, state: 'STOPPED' as const, remainingSeconds: t.durationSeconds, lastTickAt: undefined };
        }
        return t;
      });
      persistTimers(newTimers);
      return { timers: newTimers };
    });
  },

  tickTimers: () => {
    const now = Date.now();
    set((state) => {
      let changed = false;
      const newTimers = state.timers.map(t => {
        if (t.state === 'RUNNING' && t.lastTickAt) {
          const elapsed = Math.floor((now - t.lastTickAt) / 1000);
          if (elapsed >= 1) {
            changed = true;
            const newRemaining = Math.max(0, t.remainingSeconds - elapsed);
            if (newRemaining === 0) {
              notifyTimerComplete(t.title);
              AssistantEventBus.emit({ type: 'TIMER_COMPLETED', payload: t });
              return { ...t, state: 'STOPPED' as const, remainingSeconds: 0, lastTickAt: undefined };
            } else {
              return { ...t, remainingSeconds: newRemaining, lastTickAt: now };
            }
          }
        } else if (t.state === 'RUNNING' && !t.lastTickAt) {
          changed = true;
          return { ...t, lastTickAt: now };
        }
        return t;
      });
      if (changed) {
        // Debounce persist slightly to avoid disk I/O every second
        // But for simplicity we just do it occasionally or let React do it.
        // Let's not persist every second. We only persist on pause/start/complete.
        return { timers: newTimers };
      }
      return state;
    });
  }
}));
