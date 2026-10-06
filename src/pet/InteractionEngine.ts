import type { PetState, PetPosition, CursorInfo } from '../types';
import { BEHAVIOR_WEIGHTS } from './CatConstants';

type CursorState = 'NORMAL' | 'CURSOR_NEAR' | 'WATCHING' | 'APPROACHING' | 'CHASING' | 'POUNCING' | 'IGNORING';

export class InteractionEngine {
  private clickCount: number = 0;
  private lastClickTime: number = 0;
  private cursorState: CursorState = 'NORMAL';
  private cursorStateEnteredAt: number = Date.now();
  private lastCursorPos: CursorInfo | null = null;

  // Handle repeated clicks making the cat annoyed
  handlePetClick(): PetState {
    const now = Date.now();
    if (now - this.lastClickTime > 2000) {
      this.clickCount = 0;
    }
    
    this.clickCount++;
    this.lastClickTime = now;

    if (this.clickCount >= 5) {
      return 'CONFUSED'; // Represents annoyed for now
    } else if (this.clickCount >= 2) {
      return 'EXCITED';
    } else {
      return 'HAPPY';
    }
  }

  // Handle cursor logic
  updateCursorLogic(pos: PetPosition, cursor: CursorInfo): PetState | null {
    const now = Date.now();
    const stateAge = now - this.cursorStateEnteredAt;

    let cursorSpeed = 0;
    if (this.lastCursorPos) {
      const dx = cursor.x - this.lastCursorPos.x;
      const dy = cursor.y - this.lastCursorPos.y;
      cursorSpeed = Math.sqrt(dx * dx + dy * dy);
    }
    this.lastCursorPos = { ...cursor };

    // Cat is roughly in the center of a 240x240 window
    const catCenterX = pos.x + 120;
    const catCenterY = pos.y + 120;
    
    const dx = cursor.x - catCenterX;
    const dy = cursor.y - catCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Fast cursor -> ignore usually
    if (cursorSpeed > 2000 && this.cursorState !== 'CHASING') {
      this.setCursorState('IGNORING');
      return null;
    }

    if (this.cursorState === 'NORMAL' || this.cursorState === 'IGNORING') {
      if (dist < 200 && stateAge > 3000) {
        this.setCursorState('CURSOR_NEAR');
      }
    } else if (this.cursorState === 'CURSOR_NEAR') {
      // Make a decision
      const roll = Math.random() * 100;
      if (roll < BEHAVIOR_WEIGHTS.CURSOR_INTERACTION.IGNORE) {
        this.setCursorState('IGNORING');
      } else if (roll < BEHAVIOR_WEIGHTS.CURSOR_INTERACTION.IGNORE + BEHAVIOR_WEIGHTS.CURSOR_INTERACTION.WATCH) {
        this.setCursorState('WATCHING');
        return 'LOOKING';
      } else if (roll < BEHAVIOR_WEIGHTS.CURSOR_INTERACTION.IGNORE + BEHAVIOR_WEIGHTS.CURSOR_INTERACTION.WATCH + BEHAVIOR_WEIGHTS.CURSOR_INTERACTION.APPROACH) {
        this.setCursorState('APPROACHING');
        return 'WALKING'; // Moving towards cursor is handled by MovementEngine targeting
      } else {
        this.setCursorState('CHASING');
        return 'EXCITED'; // Fast movement towards cursor
      }
    } else if (this.cursorState === 'CHASING') {
      if (dist < 40 && stateAge > 500) {
        this.setCursorState('POUNCING');
        return 'POUNCING';
      }
      if (dist > 400 || stateAge > 4000) {
        this.setCursorState('NORMAL');
      }
    } else if (this.cursorState === 'POUNCING') {
      if (stateAge > 1000) {
        this.setCursorState('NORMAL');
        return 'IDLE';
      }
    } else if (this.cursorState === 'WATCHING' || this.cursorState === 'APPROACHING') {
      if (dist > 300 || stateAge > 5000) {
        this.setCursorState('NORMAL');
      }
    }

    return null;
  }

  private setCursorState(newState: CursorState) {
    if (this.cursorState !== newState) {
      this.cursorState = newState;
      this.cursorStateEnteredAt = Date.now();
    }
  }

  isChasingOrApproaching(): boolean {
    return this.cursorState === 'CHASING' || this.cursorState === 'APPROACHING';
  }
}
