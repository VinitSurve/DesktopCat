/**
 * MovementEngine — Handles smooth pet movement with easing,
 * edge avoidance, wandering, and screen boundary detection.
 */

import type { Direction, PetState, MonitorInfo } from '../types';

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_SPEED = 0.8; // pixels per frame at 60fps
const ACCELERATION = 0.03;
const DECELERATION = 0.05;
const MAX_SPEED = 2.5;
const EDGE_MARGIN = 20;
const WANDER_CHANGE_INTERVAL = [3000, 8000] as const; // ms range

// ─── Movement Engine ─────────────────────────────────────────────────────────

export class MovementEngine {
  private x: number = 0;
  private y: number = 0;
  private velocityX: number = 0;
  private velocityY: number = 0;
  private targetX: number | null = null;
  private targetY: number | null = null;
  private _direction: Direction = 'right';
  private speedMultiplier: number = 1.0;
  private lastWanderChange: number = 0;
  private nextWanderInterval: number = 5000;
  private screenBounds: { x: number; y: number; width: number; height: number } = {
    x: 0, y: 0, width: 2560, height: 1600,
  };
  private petSize: number = 220; // Logical size
  private scaleFactor: number = 2;

  constructor(initialX: number, initialY: number) {
    this.x = initialX;
    this.y = initialY;
  }

  // ─── Getters ────────────────────────────────────────────────────────────

  get position() {
    return { x: this.x, y: this.y };
  }

  get direction(): Direction {
    return this._direction;
  }

  get isMoving(): boolean {
    return Math.abs(this.velocityX) > 0.1 || Math.abs(this.velocityY) > 0.1;
  }

  get hasArrived(): boolean {
    return this.targetX === null && this.targetY === null && !this.isMoving;
  }

  get hasTarget(): boolean {
    return this.targetX !== null && this.targetY !== null;
  }

  get currentScaleFactor(): number {
    return this.scaleFactor;
  }

  // ─── Setters ────────────────────────────────────────────────────────────

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  setSpeedMultiplier(m: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(3, m));
  }

  setPetSize(size: number): void {
    this.petSize = size;
  }

  setScreenBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.screenBounds = bounds;
  }

  updateMonitorInfo(monitor: MonitorInfo): void {
    this.scaleFactor = monitor.scale_factor;
    this.screenBounds = {
      x: monitor.x,
      y: monitor.y,
      width: monitor.width,
      height: monitor.height,
    };
  }

  // ─── Movement Commands ──────────────────────────────────────────────────

  moveTo(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  stopMoving(): void {
    this.targetX = null;
    this.targetY = null;
  }

  // ─── Update (called each frame) ────────────────────────────────────────

  update(state: PetState, _deltaTime: number): void {
    const now = Date.now();
    const speed = BASE_SPEED * this.speedMultiplier;

    // Only move in walking-compatible states
    const shouldMove = state === 'WALKING' || state === 'EXCITED' || state === 'CURIOUS';

    if (shouldMove) {
      // Wander: pick a random target if we don't have one
      if (this.targetX === null || this.targetY === null) {
        if (now - this.lastWanderChange > this.nextWanderInterval) {
          this.pickWanderTarget();
          this.lastWanderChange = now;
          this.nextWanderInterval = WANDER_CHANGE_INTERVAL[0] +
            Math.random() * (WANDER_CHANGE_INTERVAL[1] - WANDER_CHANGE_INTERVAL[0]);
        }
      }

      if (this.targetX !== null && this.targetY !== null) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
          // Arrived
          this.targetX = null;
          this.targetY = null;
          this.velocityX *= 0.8;
          this.velocityY *= 0.8;
        } else {
          // Accelerate toward target
          const nx = dx / dist;
          const ny = dy / dist;
          this.velocityX += nx * ACCELERATION * speed;
          this.velocityY += ny * ACCELERATION * speed;

          // Cap speed
          const currentSpeed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
          const maxSpd = MAX_SPEED * this.speedMultiplier;
          if (currentSpeed > maxSpd) {
            this.velocityX = (this.velocityX / currentSpeed) * maxSpd;
            this.velocityY = (this.velocityY / currentSpeed) * maxSpd;
          }

          // Update direction
          if (Math.abs(this.velocityX) > 0.1) {
            this._direction = this.velocityX > 0 ? 'right' : 'left';
          }
        }
      }
    } else {
      // Decelerate when not supposed to move
      this.velocityX *= (1 - DECELERATION);
      this.velocityY *= (1 - DECELERATION);
      if (Math.abs(this.velocityX) < 0.05) this.velocityX = 0;
      if (Math.abs(this.velocityY) < 0.05) this.velocityY = 0;
      this.targetX = null;
      this.targetY = null;
    }

    // Apply velocity
    this.x += this.velocityX;
    this.y += this.velocityY;

    // Clamp to screen bounds
    this.clampToScreen();
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private pickWanderTarget(): void {
    const physicalPetSize = this.petSize * this.scaleFactor;
    const margin = EDGE_MARGIN * this.scaleFactor + physicalPetSize / 2;
    const minX = this.screenBounds.x + margin;
    const maxX = this.screenBounds.x + this.screenBounds.width - margin;
    const minY = this.screenBounds.y + margin;
    const maxY = this.screenBounds.y + this.screenBounds.height - margin;

    // Prefer nearby targets for natural movement
    const range = 300;
    this.targetX = this.x + (Math.random() - 0.5) * range;
    this.targetY = this.y + (Math.random() - 0.5) * range * 0.3; // less vertical movement

    // Clamp target
    this.targetX = Math.max(minX, Math.min(maxX, this.targetX));
    this.targetY = Math.max(minY, Math.min(maxY, this.targetY));
  }

  private clampToScreen(): void {
    const physicalPetSize = this.petSize * this.scaleFactor;
    const margin = EDGE_MARGIN * this.scaleFactor;
    const minX = this.screenBounds.x + margin;
    const maxX = this.screenBounds.x + this.screenBounds.width - physicalPetSize - margin;
    const minY = this.screenBounds.y + margin;
    const maxY = this.screenBounds.y + this.screenBounds.height - physicalPetSize - margin;

    if (this.x < minX) {
      this.x = minX;
      this.velocityX = Math.abs(this.velocityX) * 0.5;
      this._direction = 'right';
    }
    if (this.x > maxX) {
      this.x = maxX;
      this.velocityX = -Math.abs(this.velocityX) * 0.5;
      this._direction = 'left';
    }
    if (this.y < minY) {
      this.y = minY;
      this.velocityY = Math.abs(this.velocityY) * 0.5;
    }
    if (this.y > maxY) {
      this.y = maxY;
      this.velocityY = -Math.abs(this.velocityY) * 0.5;
    }
  }
}
