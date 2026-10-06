/**
 * BehaviorEngine — Finite-state behavior system with weighted transitions,
 * cooldowns, and natural behavior flow.
 */

import type { PetState, MoodValues, EnvironmentInfo, PetPosition, PetSettings } from '../types';

// ─── Transition Definitions ─────────────────────────────────────────────────

interface Transition {
  to: PetState;
  weight: number;
  minDuration: number;   // min ms before transition can happen
  cooldownMs: number;     // ms cooldown after leaving a state
}

const TRANSITIONS: Partial<Record<PetState, Transition[]>> = {
  IDLE: [
    { to: 'WALKING', weight: 20, minDuration: 5000, cooldownMs: 5000 },
    { to: 'SITTING', weight: 15, minDuration: 5000, cooldownMs: 6000 },
    { to: 'LOOKING', weight: 15, minDuration: 4000, cooldownMs: 4000 },
    { to: 'STRETCHING', weight: 8, minDuration: 8000, cooldownMs: 12000 },
    { to: 'SLEEPING', weight: 5, minDuration: 10000, cooldownMs: 25000 },
    { to: 'CURIOUS', weight: 10, minDuration: 5000, cooldownMs: 8000 },
    { to: 'WAVING', weight: 5, minDuration: 6000, cooldownMs: 15000 },
  ],
  WALKING: [
    { to: 'IDLE', weight: 35, minDuration: 3000, cooldownMs: 2000 },
    { to: 'SITTING', weight: 20, minDuration: 4000, cooldownMs: 4000 },
    { to: 'LOOKING', weight: 15, minDuration: 2000, cooldownMs: 3000 },
    { to: 'STRETCHING', weight: 10, minDuration: 5000, cooldownMs: 8000 },
  ],
  SITTING: [
    { to: 'IDLE', weight: 30, minDuration: 4000, cooldownMs: 3000 },
    { to: 'SLEEPING', weight: 15, minDuration: 6000, cooldownMs: 15000 },
    { to: 'LOOKING', weight: 20, minDuration: 3000, cooldownMs: 3000 },
    { to: 'STRETCHING', weight: 15, minDuration: 5000, cooldownMs: 8000 },
    { to: 'WALKING', weight: 15, minDuration: 5000, cooldownMs: 4000 },
  ],
  SLEEPING: [
    { to: 'IDLE', weight: 40, minDuration: 10000, cooldownMs: 8000 },
    { to: 'STRETCHING', weight: 35, minDuration: 8000, cooldownMs: 5000 },
    { to: 'SITTING', weight: 25, minDuration: 12000, cooldownMs: 5000 },
  ],
  STRETCHING: [
    { to: 'IDLE', weight: 40, minDuration: 3000, cooldownMs: 5000 },
    { to: 'WALKING', weight: 30, minDuration: 2000, cooldownMs: 3000 },
    { to: 'SITTING', weight: 20, minDuration: 2000, cooldownMs: 3000 },
  ],
  LOOKING: [
    { to: 'IDLE', weight: 35, minDuration: 2000, cooldownMs: 2000 },
    { to: 'WALKING', weight: 25, minDuration: 2000, cooldownMs: 3000 },
    { to: 'CURIOUS', weight: 15, minDuration: 1500, cooldownMs: 6000 },
    { to: 'SITTING', weight: 15, minDuration: 3000, cooldownMs: 3000 },
  ],
  CURIOUS: [
    { to: 'IDLE', weight: 30, minDuration: 3000, cooldownMs: 3000 },
    { to: 'LOOKING', weight: 25, minDuration: 2000, cooldownMs: 2000 },
    { to: 'WALKING', weight: 25, minDuration: 2000, cooldownMs: 3000 },
    { to: 'HAPPY', weight: 10, minDuration: 2000, cooldownMs: 10000 },
  ],
  HAPPY: [
    { to: 'IDLE', weight: 40, minDuration: 3000, cooldownMs: 5000 },
    { to: 'WALKING', weight: 30, minDuration: 2000, cooldownMs: 3000 },
    { to: 'EXCITED', weight: 15, minDuration: 2000, cooldownMs: 12000 },
  ],
  CONFUSED: [
    { to: 'IDLE', weight: 50, minDuration: 2000, cooldownMs: 3000 },
    { to: 'LOOKING', weight: 30, minDuration: 2000, cooldownMs: 3000 },
  ],
  EXCITED: [
    { to: 'HAPPY', weight: 40, minDuration: 3000, cooldownMs: 5000 },
    { to: 'IDLE', weight: 30, minDuration: 4000, cooldownMs: 3000 },
    { to: 'WALKING', weight: 20, minDuration: 2000, cooldownMs: 3000 },
  ],
  WAVING: [
    { to: 'IDLE', weight: 40, minDuration: 3000, cooldownMs: 10000 },
    { to: 'HAPPY', weight: 30, minDuration: 2000, cooldownMs: 5000 },
    { to: 'SITTING', weight: 20, minDuration: 3000, cooldownMs: 5000 },
  ],
  THINKING: [
    { to: 'IDLE', weight: 50, minDuration: 3000, cooldownMs: 3000 },
    { to: 'CONFUSED', weight: 20, minDuration: 2000, cooldownMs: 5000 },
  ],
};

// ─── Behavior Engine ─────────────────────────────────────────────────────────

export class BehaviorEngine {
  private currentState: PetState = 'IDLE';
  private stateEnteredAt: number = Date.now();
  private cooldowns: Map<PetState, number> = new Map();
  private lastTransitionCheck: number = Date.now();
  private transitionCheckInterval: number = 1000; // check every second
  private storedState: PetState | null = null;

  constructor(initialState: PetState = 'IDLE') {
    this.currentState = initialState;
    this.stateEnteredAt = Date.now();
  }

  get state(): PetState {
    return this.currentState;
  }

  get stateAge(): number {
    return Date.now() - this.stateEnteredAt;
  }

  /**
   * Force a state change (e.g., from user interaction)
   */
  forceState(newState: PetState): void {
    if (newState !== this.currentState) {
      this.cooldowns.set(this.currentState, Date.now());
      this.currentState = newState;
      this.stateEnteredAt = Date.now();
    }
  }

  update(mood: MoodValues, env: EnvironmentInfo | null, pos: PetPosition, settings: PetSettings): boolean {
    const now = Date.now();

    // Don't check too frequently
    if (now - this.lastTransitionCheck < this.transitionCheckInterval) {
      return false;
    }
    this.lastTransitionCheck = now;

    // Get available transitions
    const transitions = TRANSITIONS[this.currentState];
    if (!transitions || transitions.length === 0) {
      return false;
    }

    const stateAge = now - this.stateEnteredAt;

    // Filter valid transitions
    const valid = transitions.filter((t) => {
      // Must have been in state long enough
      if (stateAge < t.minDuration) return false;

      // Check cooldown
      const lastLeft = this.cooldowns.get(t.to);
      if (lastLeft && now - lastLeft < t.cooldownMs) return false;

      return true;
    });

    if (valid.length === 0) return false;

    // Apply mood modifiers to weights
    const weighted = valid.map((t) => {
      let weight = t.weight;

      // Mood influences
      if (t.to === 'SLEEPING' && mood.sleepiness > 60) weight *= 2;
      if (t.to === 'SLEEPING' && mood.energy > 70) weight *= 0.3;
      if (t.to === 'HAPPY' && mood.happiness > 70) weight *= 1.5;
      if (t.to === 'WALKING' && mood.energy > 60) weight *= 1.3;
      if (t.to === 'EXCITED' && mood.happiness > 80) weight *= 1.5;
      if (t.to === 'CURIOUS' && mood.curiosity > 60) weight *= 1.5;
      if (t.to === 'IDLE' && mood.energy < 30) weight *= 1.5;

      // Environment influences
      if (env) {
        // Idle time influence
        if (settings.idle_behavior) {
          if (env.idle_seconds > 120 && t.to === 'SITTING') weight *= 1.5;
          if (env.idle_seconds > 300 && t.to === 'SLEEPING') weight *= 2.0;
          if (env.idle_seconds > 30 && (t.to === 'WALKING' || t.to === 'EXCITED')) weight *= 0.5;

          // Active app influence (subtle)
          const app = env.active_app.name.toLowerCase();
          if ((app.includes('code') || app.includes('terminal')) && t.to === 'SITTING') weight *= 1.2;
          if ((app.includes('code') || app.includes('terminal')) && t.to === 'WALKING') weight *= 0.8;
        }

        // Cursor proximity
        if (settings.mouse_following) {
          const dx = env.cursor.x - pos.x;
          const dy = env.cursor.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 100) {
            if (t.to === 'LOOKING' || t.to === 'CURIOUS') weight *= 2.0;
            if (t.to === 'SLEEPING') weight *= 0.1;
          } else if (dist < 300) {
            if (t.to === 'LOOKING') weight *= 1.5;
          }
        }
      }

      // Longer in state = higher transition probability
      const ageFactor = Math.min(stateAge / 10000, 3);
      weight *= 1 + ageFactor * 0.3;

      return { ...t, adjustedWeight: Math.max(weight, 0.1) };
    });

    // Random weighted selection
    const totalWeight = weighted.reduce((sum, t) => sum + t.adjustedWeight, 0);

    // Only transition with some probability per check
    // Base chance is low (0.05) and grows slowly with age up to max 0.4
    const transitionChance = Math.min(0.05 + stateAge / 40000, 0.4);
    if (Math.random() > transitionChance) return false;

    let roll = Math.random() * totalWeight;
    for (const t of weighted) {
      roll -= t.adjustedWeight;
      if (roll <= 0) {
        this.forceState(t.to);
        return true;
      }
    }

    return false;
  }

  /**
   * React to an external event
   */
  reactToEvent(event: string): PetState | null {
    switch (event) {
      case 'PET_CLICK':
        this.storedState = null; // Clear stored state on higher priority event
        this.forceState('HAPPY');
        return 'HAPPY';
      case 'PET_DOUBLE_CLICK':
        this.storedState = null;
        this.forceState('EXCITED');
        return 'EXCITED';
      case 'PET_DRAG_START':
        this.storedState = null;
        this.forceState('DRAGGED');
        return 'DRAGGED';
      case 'PET_DRAG_END':
        this.forceState('CONFUSED');
        return 'CONFUSED';
      case 'PET_HOVER_ENTER':
        // Do not interrupt high-priority or peaceful states
        if (['DRAGGED', 'SLEEPING', 'EXCITED', 'HAPPY', 'CONFUSED', 'WAVING'].includes(this.currentState)) {
          return null;
        }
        // Brief curious reaction
        this.storedState = this.currentState;
        this.forceState('CURIOUS');
        return 'CURIOUS';
      case 'PET_HOVER_EXIT':
        // If we are still in CURIOUS from the hover, we can return to the stored state
        if (this.storedState && this.currentState === 'CURIOUS') {
          this.forceState(this.storedState);
        }
        this.storedState = null;
        return null;
      case 'MOUSE_NEAR':
        // Environment proximity (not direct hit area hover).
        // Only trigger if idle, DO NOT WAKE if sleeping.
        if (this.currentState === 'IDLE') {
          this.forceState('LOOKING');
          return 'LOOKING';
        }
        return null;
      case 'USER_IDLE':
        if (this.stateAge > 15000 && this.currentState !== 'SLEEPING') {
          this.forceState('SLEEPING');
          return 'SLEEPING';
        }
        return null;
      
      // --- AI Reactions ---
      case 'AI_STARTED':
        if (this.currentState !== 'SLEEPING') {
          this.storedState = this.currentState;
          this.forceState('THINKING');
          return 'THINKING';
        }
        return null;
      case 'AI_COMPLETED':
        this.forceState('HAPPY');
        return 'HAPPY';
      case 'AI_FAILED':
        this.forceState('CONFUSED');
        return 'CONFUSED';

      default:
        return null;
    }
  }
}
