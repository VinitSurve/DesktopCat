import type { AssistantEvent, AssistantEventHandler } from './AssistantEvents';

class EventBus {
  private listeners: AssistantEventHandler[] = [];

  subscribe(handler: AssistantEventHandler) {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  emit(event: AssistantEvent) {
    this.listeners.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error('Error in AssistantEventBus handler:', err);
      }
    });
  }
}

export const AssistantEventBus = new EventBus();
