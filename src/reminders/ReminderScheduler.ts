import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { useReminderStore } from './ReminderStore';
import { calculateNextTrigger } from './ReminderUtils';
import { AssistantEventBus } from '../assistant/AssistantEventBus';
import { usePetStore } from '../state/store';

export class ReminderScheduler {
  private timer: number | null = null;
  private isChecking: boolean = false;

  start() {
    if (this.timer) return;
    
    // Check every 10 seconds
    this.timer = window.setInterval(() => {
      this.checkReminders();
    }, 10000);
    
    // Initial check
    setTimeout(() => this.checkReminders(), 2000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async checkReminders() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const store = useReminderStore.getState();
      if (!store.loaded) {
        this.isChecking = false;
        return;
      }

      const now = Date.now();
      const reminders = store.reminders;

      for (const reminder of reminders) {
        if (!reminder.enabled || reminder.completed) continue;
        if (!reminder.nextTriggerAt) {
          // Calculate next trigger if it doesn't exist
          const next = calculateNextTrigger(reminder, now);
          if (next) {
            store.updateReminder(reminder.id, { nextTriggerAt: next });
          }
          continue;
        }

        // Is it due?
        if (now >= reminder.nextTriggerAt) {
          console.log(`[REMINDER] due id=${reminder.id} title=${reminder.title}`);
          await this.triggerReminder(reminder);
          
          // Reschedule or complete
          if (reminder.type === 'ONCE') {
            store.updateReminder(reminder.id, { 
              completed: true, 
              lastTriggeredAt: now 
            });
          } else {
            // Recalculate next occurrence from now
            // We use 'now' instead of 'reminder.nextTriggerAt' to avoid spamming missed intervals
            const next = calculateNextTrigger(reminder, now);
            store.updateReminder(reminder.id, { 
              lastTriggeredAt: now,
              nextTriggerAt: next
            });
          }
        }
      }
    } catch (err) {
      console.error('Scheduler error:', err);
    } finally {
      this.isChecking = false;
    }
  }

  private async triggerReminder(reminder: import('./ReminderTypes').Reminder) {
    // 1. Check Do Not Disturb / Quiet mode
    const env = usePetStore.getState().environment;
    let isQuietMode = false;
    if (env && env.active_app) {
      const appName = env.active_app.name.toLowerCase();
      // Simple heuristic for quiet mode
      if (appName.includes('zoom') || appName.includes('meet') || appName.includes('teams') || appName.includes('keynote') || appName.includes('powerpoint')) {
        isQuietMode = true;
      }
    }

    if (isQuietMode) {
      console.log(`[Scheduler] Suppressing reminder due to quiet mode: ${reminder.title}`);
      return; // It will just be marked as triggered and rescheduled.
    }

    // 2. Notify OS
    try {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }

      if (permissionGranted) {
        console.log(`[NOTIFICATION] suppressing native notification in favor of PixelPaw bubble`);
        // sendNotification({ title: 'PixelPaw', body: reminder.title });
        console.log(`[NOTIFICATION] success`);
      } else {
        console.log(`[NOTIFICATION] failure - permission denied`);
      }
    } catch (err) {
      console.log(`[NOTIFICATION] failure - error: ${err}`);
      console.error('Failed to send notification', err);
    }

    // 3. Cat Reaction
    console.log(`[REMINDER] event emitted`);
    AssistantEventBus.emit({ type: 'REMINDER_TRIGGERED', payload: reminder });
  }
}

export const globalScheduler = new ReminderScheduler();
