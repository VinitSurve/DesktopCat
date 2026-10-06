import { describe, it, expect } from 'vitest';
import { calculateNextTrigger } from './ReminderUtils';
import type { Reminder } from './ReminderTypes';

describe('ReminderUtils - calculateNextTrigger', () => {
  const baseReminder = {
    id: '1',
    title: 'Test',
    enabled: true,
    completed: false,
    createdAt: 0,
  };

  it('One-time reminder calculates correctly', () => {
    const now = 1000;
    const r: Reminder = { ...baseReminder, type: 'ONCE', scheduledAt: 5000 };
    expect(calculateNextTrigger(r, now)).toBe(5000);
  });

  it('Completed one-time reminder does not fire again', () => {
    const now = 1000;
    const r: Reminder = { ...baseReminder, type: 'ONCE', scheduledAt: 5000, completed: true };
    expect(calculateNextTrigger(r, now)).toBeUndefined();
  });

  it('One-time reminder in the past returns undefined', () => {
    const now = 10000;
    const r: Reminder = { ...baseReminder, type: 'ONCE', scheduledAt: 5000 };
    expect(calculateNextTrigger(r, now)).toBeUndefined();
  });

  it('Interval reminder calculates next occurrence', () => {
    const now = 1000;
    const r: Reminder = { ...baseReminder, type: 'INTERVAL', intervalMinutes: 5 };
    // 5 mins = 300,000 ms
    expect(calculateNextTrigger(r, now)).toBe(1000 + 300000);
  });

  it('Interval reminder calculates next occurrence after multiple missed intervals', () => {
    const now = 1000000; // A long time has passed
    const r: Reminder = { 
      ...baseReminder, 
      type: 'INTERVAL', 
      intervalMinutes: 5, 
      lastTriggeredAt: 1000 // Last triggered way in the past
    };
    const next = calculateNextTrigger(r, now);
    expect(next).toBeGreaterThan(now);
    expect(next! - now).toBeLessThanOrEqual(300000);
  });

  it('Daily reminder calculates next occurrence today', () => {
    const now = new Date('2023-10-01T10:00:00').getTime();
    const r: Reminder = { ...baseReminder, type: 'DAILY', timeOfDay: '15:30' };
    
    const next = calculateNextTrigger(r, now);
    expect(new Date(next!).toISOString()).toBe(new Date('2023-10-01T15:30:00').toISOString());
  });

  it('Daily reminder calculates next occurrence tomorrow if past time', () => {
    const now = new Date('2023-10-01T16:00:00').getTime();
    const r: Reminder = { ...baseReminder, type: 'DAILY', timeOfDay: '15:30' };
    
    const next = calculateNextTrigger(r, now);
    expect(new Date(next!).toISOString()).toBe(new Date('2023-10-02T15:30:00').toISOString());
  });

  it('Weekly reminder calculates next occurrence', () => {
    // 2023-10-01 is a Sunday (0)
    const now = new Date('2023-10-01T10:00:00').getTime();
    // Schedule for Wednesday (3) at 15:30
    const r: Reminder = { ...baseReminder, type: 'WEEKLY', timeOfDay: '15:30', weekdays: [3] };
    
    const next = calculateNextTrigger(r, now);
    // Should be Oct 4th
    expect(new Date(next!).toISOString()).toBe(new Date('2023-10-04T15:30:00').toISOString());
  });

  it('Disabled reminder does not trigger', () => {
    const now = 1000;
    const r: Reminder = { ...baseReminder, type: 'ONCE', scheduledAt: 5000, enabled: false };
    expect(calculateNextTrigger(r, now)).toBeUndefined();
  });
});
