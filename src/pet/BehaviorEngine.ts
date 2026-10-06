/**
 * BehaviorEngine — Finite-state behavior system with weighted transitions,
 * cooldowns, and natural behavior flow.
 */

import type { PetState, MoodValues, EnvironmentInfo, PetPosition, PetSettings } from '../types';
import { MoodEngine } from './MoodEngine';
import { InteractionEngine } from './InteractionEngine';
import { MIN_STATE_DURATIONS } from './CatConstants';

// ─── Transition Definitions ─────────────────────────────────────────────────

interface Transition {
  to: PetState;
  weight: number;
  minDuration: number;   // min ms before transition can happen
  cooldownMs: number;     // ms cooldown after leaving a state
}

const TRANSITIONS: Partial<Record<PetState, Transition[]>> = {
  IDLE: [
    { to: 'WALKING', weight: 20, minDuration: MIN_STATE_DURATIONS.IDLE, cooldownMs: 5000 },
    { to: 'SITTING', weight: 15, minDuration: MIN_STATE_DURATIONS.IDLE, cooldownMs: 6000 },
    { to: 'LOOKING', weight: 15, minDuration: MIN_STATE_DURATIONS.IDLE, cooldownMs: 4000 },
    { to: 'STRETCHING', weight: 8, minDuration: 8000, cooldownMs: 12000 },
    { to: 'SLEEPING', weight: 5, minDuration: 5000, cooldownMs: 30000 },
    { to: 'CURIOUS', weight: 10, minDuration: MIN_STATE_DURATIONS.IDLE, cooldownMs: 8000 },
    { to: 'YAWNING', weight: 8, minDuration: MIN_STATE_DURATIONS.IDLE, cooldownMs: 15000 },
    { to: 'CLEANING', weight: 5, minDuration: MIN_STATE_DURATIONS.IDLE, cooldownMs: 20000 },
  ],
  WALKING: [
    { to: 'IDLE', weight: 35, minDuration: MIN_STATE_DURATIONS.WALKING, cooldownMs: 2000 },
    { to: 'SITTING', weight: 20, minDuration: MIN_STATE_DURATIONS.WALKING, cooldownMs: 4000 },
    { to: 'LOOKING', weight: 15, minDuration: MIN_STATE_DURATIONS.WALKING, cooldownMs: 3000 },
    { to: 'STRETCHING', weight: 10, minDuration: MIN_STATE_DURATIONS.WALKING, cooldownMs: 8000 },
  ],
  SITTING: [
    { to: 'IDLE', weight: 30, minDuration: MIN_STATE_DURATIONS.SITTING, cooldownMs: 3000 },
    { to: 'SLEEPING', weight: 15, minDuration: 4000, cooldownMs: 15000 },
    { to: 'LOOKING', weight: 20, minDuration: MIN_STATE_DURATIONS.SITTING, cooldownMs: 3000 },
    { to: 'STRETCHING', weight: 15, minDuration: MIN_STATE_DURATIONS.SITTING, cooldownMs: 8000 },
    { to: 'WALKING', weight: 15, minDuration: MIN_STATE_DURATIONS.SITTING, cooldownMs: 4000 },
    { to: 'CLEANING', weight: 20, minDuration: MIN_STATE_DURATIONS.SITTING, cooldownMs: 15000 },
    { to: 'LICKING_PAW', weight: 15, minDuration: MIN_STATE_DURATIONS.SITTING, cooldownMs: 10000 },
  ],
  SLEEPING: [
    { to: 'IDLE', weight: 40, minDuration: MIN_STATE_DURATIONS.SLEEPING, cooldownMs: 8000 },
    { to: 'STRETCHING', weight: 35, minDuration: 8000, cooldownMs: 5000 },
    { to: 'SITTING', weight: 25, minDuration: 12000, cooldownMs: 5000 },
  ],
  STRETCHING: [
    { to: 'IDLE', weight: 40, minDuration: MIN_STATE_DURATIONS.STRETCHING, cooldownMs: 5000 },
    { to: 'WALKING', weight: 30, minDuration: MIN_STATE_DURATIONS.STRETCHING, cooldownMs: 3000 },
    { to: 'SITTING', weight: 20, minDuration: MIN_STATE_DURATIONS.STRETCHING, cooldownMs: 3000 },
    { to: 'YAWNING', weight: 20, minDuration: MIN_STATE_DURATIONS.STRETCHING, cooldownMs: 8000 },
  ],
  LOOKING: [
    { to: 'IDLE', weight: 35, minDuration: MIN_STATE_DURATIONS.LOOKING, cooldownMs: 2000 },
    { to: 'WALKING', weight: 25, minDuration: MIN_STATE_DURATIONS.LOOKING, cooldownMs: 3000 },
    { to: 'CURIOUS', weight: 15, minDuration: MIN_STATE_DURATIONS.LOOKING, cooldownMs: 6000 },
    { to: 'SITTING', weight: 15, minDuration: MIN_STATE_DURATIONS.LOOKING, cooldownMs: 3000 },
  ],
  CURIOUS: [
    { to: 'IDLE', weight: 30, minDuration: MIN_STATE_DURATIONS.CURIOUS, cooldownMs: 3000 },
    { to: 'LOOKING', weight: 25, minDuration: MIN_STATE_DURATIONS.CURIOUS, cooldownMs: 2000 },
    { to: 'WALKING', weight: 25, minDuration: MIN_STATE_DURATIONS.CURIOUS, cooldownMs: 3000 },
    { to: 'HAPPY', weight: 10, minDuration: MIN_STATE_DURATIONS.CURIOUS, cooldownMs: 10000 },
  ],
  HAPPY: [
    { to: 'IDLE', weight: 40, minDuration: MIN_STATE_DURATIONS.HAPPY, cooldownMs: 5000 },
    { to: 'WALKING', weight: 30, minDuration: MIN_STATE_DURATIONS.HAPPY, cooldownMs: 3000 },
    { to: 'EXCITED', weight: 15, minDuration: MIN_STATE_DURATIONS.HAPPY, cooldownMs: 12000 },
  ],
  CONFUSED: [
    { to: 'IDLE', weight: 50, minDuration: MIN_STATE_DURATIONS.CONFUSED, cooldownMs: 3000 },
    { to: 'LOOKING', weight: 30, minDuration: MIN_STATE_DURATIONS.CONFUSED, cooldownMs: 3000 },
  ],
  EXCITED: [
    { to: 'HAPPY', weight: 40, minDuration: MIN_STATE_DURATIONS.EXCITED, cooldownMs: 5000 },
    { to: 'IDLE', weight: 30, minDuration: MIN_STATE_DURATIONS.EXCITED, cooldownMs: 3000 },
    { to: 'WALKING', weight: 20, minDuration: MIN_STATE_DURATIONS.EXCITED, cooldownMs: 3000 },
  ],
  WAVING: [
    { to: 'IDLE', weight: 40, minDuration: MIN_STATE_DURATIONS.WAVING, cooldownMs: 10000 },
    { to: 'HAPPY', weight: 30, minDuration: MIN_STATE_DURATIONS.WAVING, cooldownMs: 5000 },
    { to: 'SITTING', weight: 20, minDuration: MIN_STATE_DURATIONS.WAVING, cooldownMs: 5000 },
  ],
  THINKING: [
    { to: 'IDLE', weight: 50, minDuration: MIN_STATE_DURATIONS.THINKING, cooldownMs: 3000 },
    { to: 'CONFUSED', weight: 20, minDuration: MIN_STATE_DURATIONS.THINKING, cooldownMs: 5000 },
  ],
  YAWNING: [
    { to: 'IDLE', weight: 50, minDuration: MIN_STATE_DURATIONS.YAWNING, cooldownMs: 5000 },
    { to: 'SLEEPING', weight: 30, minDuration: MIN_STATE_DURATIONS.YAWNING, cooldownMs: 5000 },
  ],
  CLEANING: [
    { to: 'SITTING', weight: 50, minDuration: MIN_STATE_DURATIONS.CLEANING, cooldownMs: 5000 },
    { to: 'IDLE', weight: 20, minDuration: MIN_STATE_DURATIONS.CLEANING, cooldownMs: 5000 },
    { to: 'SLEEPING', weight: 20, minDuration: MIN_STATE_DURATIONS.CLEANING, cooldownMs: 5000 },
  ],
  LICKING_PAW: [
    { to: 'SITTING', weight: 50, minDuration: MIN_STATE_DURATIONS.LICKING_PAW, cooldownMs: 5000 },
    { to: 'CLEANING', weight: 30, minDuration: MIN_STATE_DURATIONS.LICKING_PAW, cooldownMs: 2000 },
  ],
  POUNCING: [
    { to: 'IDLE', weight: 60, minDuration: MIN_STATE_DURATIONS.POUNCING, cooldownMs: 1000 },
    { to: 'LOOKING', weight: 40, minDuration: MIN_STATE_DURATIONS.POUNCING, cooldownMs: 1000 },
  ],
  STARTLED: [
    { to: 'LOOKING', weight: 60, minDuration: MIN_STATE_DURATIONS.STARTLED, cooldownMs: 1000 },
    { to: 'CONFUSED', weight: 40, minDuration: MIN_STATE_DURATIONS.STARTLED, cooldownMs: 1000 },
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
  
  public moodEngine = new MoodEngine();
  public interactionEngine = new InteractionEngine();

  constructor(initialState: PetState = 'IDLE') {
    this.currentState = initialState;
    this.stateEnteredAt = Date.now();
  }

  get state(): PetState {
    return this.currentState;
  }
  
  get currentMood(): MoodValues {
    return this.moodEngine.current;
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

  update(_mood: MoodValues, env: EnvironmentInfo | null, pos: PetPosition, settings: PetSettings): boolean {
    const now = Date.now();

    // Don't check too frequently
    if (now - this.lastTransitionCheck < this.transitionCheckInterval) {
      return false;
    }
    this.lastTransitionCheck = now;
    
    // Update underlying systems
    this.moodEngine.update(this.currentState, env);
    
    // Cursor interaction state machine
    if (env && settings.mouse_following) {
      const isHighPriority = ['DRAGGED', 'SLEEPING', 'EXCITED', 'HAPPY', 'CONFUSED', 'WAVING', 'POUNCING', 'STARTLED'].includes(this.currentState);
      const isCursorDriven = this.interactionEngine.isChasingOrApproaching();
      
      // Do not overwrite high-priority state unless cursor logic is actively driving it
      if (!isHighPriority || isCursorDriven) {
        const cursorAction = this.interactionEngine.updateCursorLogic(pos, env.cursor);
        if (cursorAction) {
          this.forceState(cursorAction);
          return true;
        }
      }
    }

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

      // Mood influences using MoodEngine internal values
      const currentMood = this.moodEngine.current;
      if (t.to === 'SLEEPING' && currentMood.sleepiness > 60) weight *= 2;
      if (t.to === 'SLEEPING' && currentMood.energy > 70) weight *= 0.3;
      if (t.to === 'HAPPY' && currentMood.happiness > 70) weight *= 1.5;
      if (t.to === 'WALKING' && currentMood.energy > 60) weight *= 1.3;
      if (t.to === 'EXCITED' && currentMood.happiness > 80) weight *= 1.5;
      if (t.to === 'CURIOUS' && currentMood.curiosity > 60) weight *= 1.5;
      if (t.to === 'IDLE' && currentMood.energy < 30) weight *= 1.5;

      // Environment influences
      if (env) {
        // Idle time influence
        if (settings.idle_behavior) {
          if (env.idle_seconds > 10 && t.to === 'SITTING') weight *= 2.0;
          if (env.idle_seconds > 20 && t.to === 'SLEEPING') weight *= 50.0; // Fast dev test path
          if (env.idle_seconds > 30 && (t.to === 'WALKING' || t.to === 'EXCITED')) weight *= 0.1;
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
    if (event.startsWith('REMINDER_') || event.startsWith('TIMER_')) {
      console.log(`[CAT] reminder reaction received: ${event}`);
    }
    switch (event) {
      case 'PET_CLICK':
      case 'PET_DOUBLE_CLICK':
        this.storedState = null;
        const interactionState = this.interactionEngine.handlePetClick();
        this.forceState(interactionState);
        return interactionState;
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
        // Now handled by InteractionEngine natively in update loop.
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

      // --- Assistant Reactions ---
      case 'REMINDER_CREATED':
        this.forceState('HAPPY');
        return 'HAPPY';
      case 'TIMER_STARTED':
        this.forceState('SITTING'); // Focuses briefly
        return 'SITTING';
      case 'REMINDER_TRIGGERED':
      case 'TIMER_COMPLETED':
        this.forceState('EXCITED');
        return 'EXCITED';

      default:
        return null;
    }
  }
}
