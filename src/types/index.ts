// ─── Pet States ──────────────────────────────────────────────────────────────

export type PetState =
  | 'IDLE'
  | 'WALKING'
  | 'SITTING'
  | 'SLEEPING'
  | 'STRETCHING'
  | 'LOOKING'
  | 'CURIOUS'
  | 'HAPPY'
  | 'CONFUSED'
  | 'EXCITED'
  | 'DRAGGED'
  | 'THINKING'
  | 'WAVING';

export type Direction = 'left' | 'right';

// ─── Animation ───────────────────────────────────────────────────────────────

export interface AnimationFrame {
  duration: number; // ms per frame
}

export interface Animation {
  name: string;
  frames: number; // number of frames
  fps: number;
  loop: boolean;
  /** Optional callback when animation completes (for non-looping) */
  onComplete?: () => void;
}

export type AnimationName =
  | 'idle'
  | 'walk'
  | 'sit'
  | 'sleep'
  | 'stretch'
  | 'look'
  | 'happy'
  | 'confused'
  | 'excited'
  | 'thinking'
  | 'dragged'
  | 'wave';

// ─── Mood System ─────────────────────────────────────────────────────────────

export interface MoodValues {
  happiness: number;    // 0-100
  energy: number;       // 0-100
  curiosity: number;    // 0-100
  sleepiness: number;   // 0-100
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface PetSettings {
  size: 'small' | 'medium' | 'large';
  speed: number;
  opacity: number;
  always_on_top: boolean;
  random_movement: boolean;
  mouse_following: boolean;
  keyboard_reactions: boolean;
  idle_behavior: boolean;
  launch_at_login: boolean;
  start_pet_automatically: boolean;
  sound_enabled: boolean;
  sound_volume: number;
  battery_saver: boolean;
  // AI Settings
  ai_provider: 'AUTO' | 'OLLAMA' | 'GEMINI';
  local_model: string;
  gemini_model: string;
}

// ─── Position ────────────────────────────────────────────────────────────────

export interface PetPosition {
  x: number;
  y: number;
}

// ─── Monitor ─────────────────────────────────────────────────────────────────

export interface MonitorInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  scale_factor: number;
  name?: string;
}

// ─── Environment Awareness ───────────────────────────────────────────────────

export interface CursorInfo {
  x: number;
  y: number;
}

export interface AppInfo {
  name: string;
  bundle_id: string;
}

export interface EnvironmentInfo {
  cursor: CursorInfo;
  active_app: AppInfo;
  idle_seconds: number;
}

// ─── Behavior ────────────────────────────────────────────────────────────────

export interface BehaviorTransition {
  to: PetState;
  weight: number;
  cooldown: number; // ms
  condition?: () => boolean;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type PetEventType =
  | 'MOUSE_NEAR'
  | 'MOUSE_CLICK'
  | 'PET_CLICK'
  | 'PET_DOUBLE_CLICK'
  | 'PET_RIGHT_CLICK'
  | 'PET_HOVER_ENTER'
  | 'PET_HOVER_EXIT'
  | 'PET_DRAG_START'
  | 'PET_DRAG_END'
  | 'USER_IDLE'
  | 'MENU_ACTION';

export interface PetEvent {
  type: PetEventType;
  payload?: unknown;
  timestamp: number;
}

// ─── Size Config ─────────────────────────────────────────────────────────────

export const PET_SIZES = {
  small: { window: 160, gridScale: 2 },
  medium: { window: 220, gridScale: 3 },
  large: { window: 280, gridScale: 4 },
} as const;
