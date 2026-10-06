export type AssistantEventType =
  | 'REMINDER_CREATED'
  | 'REMINDER_TRIGGERED'
  | 'TIMER_STARTED'
  | 'TIMER_COMPLETED'
  | 'TIMER_CANCELLED';

export interface AssistantEvent {
  type: AssistantEventType;
  payload?: any;
}

export type AssistantEventHandler = (event: AssistantEvent) => void;
