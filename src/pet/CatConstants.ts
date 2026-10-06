import { PetState } from '../types';

export const MOOD_DECAY_RATE = 0.5; // per update
export const ENERGY_DECAY_RATE_ACTIVE = 2.0;
export const ENERGY_RECOVERY_RATE_RESTING = 1.0;

export const MIN_STATE_DURATIONS: Record<PetState, number> = {
  IDLE: 3000,
  WALKING: 2000,
  SITTING: 4000,
  SLEEPING: 10000,
  STRETCHING: 4000,
  LOOKING: 2000,
  CURIOUS: 3000,
  HAPPY: 3000,
  CONFUSED: 3000,
  EXCITED: 3000,
  DRAGGED: 500,
  THINKING: 2000,
  WAVING: 3000,
  YAWNING: 3000,
  CLEANING: 5000,
  LICKING_PAW: 4000,
  POUNCING: 1000,
  STARTLED: 1500,
  REMINDING: 5000,
};

export const BEHAVIOR_WEIGHTS = {
  // Base transition weights, modified by MoodEngine
  CURSOR_INTERACTION: {
    IGNORE: 30,
    WATCH: 30,
    APPROACH: 25,
    CHASE_POUNCE: 15,
  }
};
