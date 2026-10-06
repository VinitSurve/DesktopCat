import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Reminder } from './ReminderTypes';
import { AssistantEventBus } from '../assistant/AssistantEventBus';

interface ReminderStore {
  reminders: Reminder[];
  loaded: boolean;
  loadReminders: () => Promise<void>;
  addReminder: (reminder: Reminder) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
}

const persistReminders = async (reminders: Reminder[]) => {
  try {
    const data = JSON.stringify(reminders);
    await invoke('save_data', { key: 'reminders', data });
  } catch (err) {
    console.error('Failed to save reminders:', err);
  }
};

export const useReminderStore = create<ReminderStore>((set) => ({
  reminders: [],
  loaded: false,

  loadReminders: async () => {
    try {
      const data = await invoke<string>('load_data', { key: 'reminders' });
      if (data) {
        const parsed = JSON.parse(data) as Reminder[];
        set({ reminders: parsed, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch (err) {
      console.error('Failed to load reminders:', err);
      set({ loaded: true });
    }
  },

  addReminder: (reminder) => {
    set((state) => {
      const newReminders = [...state.reminders, reminder];
      persistReminders(newReminders);
      return { reminders: newReminders };
    });
    AssistantEventBus.emit({ type: 'REMINDER_CREATED', payload: reminder });
  },

  updateReminder: (id, updates) => {
    set((state) => {
      const newReminders = state.reminders.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      );
      persistReminders(newReminders);
      return { reminders: newReminders };
    });
  },

  deleteReminder: (id) => {
    set((state) => {
      const newReminders = state.reminders.filter((r) => r.id !== id);
      persistReminders(newReminders);
      return { reminders: newReminders };
    });
  },
}));
