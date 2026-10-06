import type { Reminder } from './ReminderTypes';

export function calculateNextTrigger(reminder: Reminder, fromTime: number = Date.now()): number | undefined {
  if (!reminder.enabled || reminder.completed) return undefined;

  switch (reminder.type) {
    case 'ONCE':
      if (reminder.scheduledAt && reminder.scheduledAt > fromTime) {
        return reminder.scheduledAt;
      }
      return undefined; // In the past

    case 'INTERVAL':
      if (reminder.intervalMinutes && reminder.intervalMinutes > 0) {
        if (reminder.lastTriggeredAt) {
          // If we missed multiple intervals, we don't want it to spam in the past.
          // We calculate the NEXT valid interval from current time.
          const intervalMs = reminder.intervalMinutes * 60 * 1000;
          let next = reminder.lastTriggeredAt + intervalMs;
          while (next <= fromTime) {
            next += intervalMs;
          }
          return next;
        } else {
          return fromTime + reminder.intervalMinutes * 60 * 1000;
        }
      }
      return undefined;

    case 'DAILY':
    case 'WEEKLY':
      if (!reminder.timeOfDay) return undefined;
      const [hoursStr, minsStr] = reminder.timeOfDay.split(':');
      const targetHours = parseInt(hoursStr, 10);
      const targetMins = parseInt(minsStr, 10);

      const d = new Date(fromTime);
      d.setHours(targetHours, targetMins, 0, 0);

      if (d.getTime() <= fromTime) {
        d.setDate(d.getDate() + 1);
      }

      if (reminder.type === 'WEEKLY' && reminder.weekdays && reminder.weekdays.length > 0) {
        for (let i = 0; i < 7; i++) {
          if (reminder.weekdays.includes(d.getDay())) {
            break;
          }
          d.setDate(d.getDate() + 1);
        }
      }

      return d.getTime();
  }
}
