export type ReminderType = 'ONCE' | 'INTERVAL' | 'DAILY' | 'WEEKLY';

export interface Reminder {
  id: string;
  title: string;
  type: ReminderType;
  
  // Settings based on type:
  scheduledAt?: number;      // Epoch ms for ONCE
  intervalMinutes?: number;  // For INTERVAL
  timeOfDay?: string;        // "HH:MM" 24h format for DAILY/WEEKLY
  weekdays?: number[];       // [0..6] (Sunday=0) for WEEKLY

  enabled: boolean;
  completed: boolean;
  createdAt: number;
  lastTriggeredAt?: number;
  nextTriggerAt?: number;    // Calculated epoch ms for next trigger
}
