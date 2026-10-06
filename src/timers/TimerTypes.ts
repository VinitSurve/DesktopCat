export interface Timer {
  id: string;
  title: string;
  durationSeconds: number;
  remainingSeconds: number;
  state: 'STOPPED' | 'RUNNING' | 'PAUSED';
  lastTickAt?: number;
}
