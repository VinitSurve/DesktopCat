import type { MoodValues, PetState, EnvironmentInfo } from '../types';
import { MOOD_DECAY_RATE, ENERGY_DECAY_RATE_ACTIVE, ENERGY_RECOVERY_RATE_RESTING } from './CatConstants';

export class MoodEngine {
  private mood: MoodValues = {
    happiness: 60,
    energy: 100,
    curiosity: 50,
    sleepiness: 0,
  };

  get current(): MoodValues {
    return { ...this.mood };
  }

  update(currentState: PetState, env: EnvironmentInfo | null) {
    // 1. Energy
    if (['WALKING', 'EXCITED', 'POUNCING'].includes(currentState)) {
      this.mood.energy = Math.max(0, this.mood.energy - ENERGY_DECAY_RATE_ACTIVE);
      this.mood.sleepiness = Math.min(100, this.mood.sleepiness + 0.5);
    } else if (['SLEEPING', 'SITTING', 'IDLE'].includes(currentState)) {
      this.mood.energy = Math.min(100, this.mood.energy + ENERGY_RECOVERY_RATE_RESTING);
      if (currentState === 'SLEEPING') {
        this.mood.sleepiness = Math.max(0, this.mood.sleepiness - 2.0);
      }
    }

    // 2. Curiosity decays slowly towards 50
    if (this.mood.curiosity > 50) this.mood.curiosity -= MOOD_DECAY_RATE;
    else if (this.mood.curiosity < 50) this.mood.curiosity += MOOD_DECAY_RATE;

    // 3. Happiness drifts towards 60
    if (this.mood.happiness > 60) this.mood.happiness -= MOOD_DECAY_RATE * 0.5;
    else if (this.mood.happiness < 60) this.mood.happiness += MOOD_DECAY_RATE * 0.5;

    // Time of day subtle effects (if we want to use local time)
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      this.mood.sleepiness = Math.min(100, this.mood.sleepiness + 0.1);
    } else if (hour >= 8 && hour <= 12) {
      this.mood.energy = Math.min(100, this.mood.energy + 0.1);
    }

    // Environment/Active app
    if (env && env.active_app) {
      const appName = env.active_app.name.toLowerCase();
      if (appName.includes('game') || appName.includes('steam')) {
        this.mood.curiosity = Math.min(100, this.mood.curiosity + 0.5);
      } else if (appName.includes('code') || appName.includes('terminal')) {
        this.mood.sleepiness = Math.min(100, this.mood.sleepiness + 0.1);
      }
    }
  }

  boost(stat: keyof MoodValues, amount: number) {
    this.mood[stat] = Math.max(0, Math.min(100, this.mood[stat] + amount));
  }
}
