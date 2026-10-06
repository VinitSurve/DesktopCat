import { useTimerStore } from './TimerStore';

export class TimerManager {
  private tickInterval: number | null = null;

  start() {
    if (this.tickInterval) return;
    this.tickInterval = window.setInterval(() => {
      useTimerStore.getState().tickTimers();
    }, 1000);
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}

export const globalTimerManager = new TimerManager();
