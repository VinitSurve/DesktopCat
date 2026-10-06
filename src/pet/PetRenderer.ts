/**
 * PetRenderer — Draws the pure pixel-art orange kitten.
 * Uses a virtual grid to snap all shapes to integers and auto-generate outlines.
 */

import type { PetState, Direction } from '../types';

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLORS = {
  orange: '#E8893A',
  orangeLight: '#F4B66A',
  orangeDark: '#C76A22',
  cream: '#FFE2B8',
  outline: '#4A2A20',
  eye: '#2A211D',
  white: '#FFFFFF',
  pink: '#E87979',
  innerEar: '#F29A9A',
  stripe: '#B85E2D',
  zzz: '#88AADD',
  question: '#DC6464',
  sparkle: '#FFD700',
};

// ─── Grid Engine ─────────────────────────────────────────────────────────────

class PixelGrid {
  private grid: (string | null)[][];
  private size = 80; // Large enough for all animations
  private cx = 40;
  private cy = 40;

  constructor() {
    this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill(null));
  }

  rect(x: number, y: number, w: number, h: number, color: string) {
    const startX = Math.round(x + this.cx);
    const startY = Math.round(y + this.cy);
    for (let i = 0; i < Math.round(w); i++) {
      for (let j = 0; j < Math.round(h); j++) {
        if (startX + i >= 0 && startX + i < this.size && startY + j >= 0 && startY + j < this.size) {
          this.grid[startY + j][startX + i] = color;
        }
      }
    }
  }

  px(x: number, y: number, color: string) {
    this.rect(x, y, 1, 1, color);
  }

  render(ctx: CanvasRenderingContext2D, screenCx: number, screenCy: number, scale: number) {
    // 1. Outlines (8-way for solid retro outline)
    ctx.fillStyle = COLORS.outline;
    const drawn = Array(this.size).fill(null).map(() => Array(this.size).fill(false));
    
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.grid[y][x]) {
          const neighbors = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0],           [1, 0],
            [-1, 1],  [0, 1],  [1, 1],
          ];
          for (const [dx, dy] of neighbors) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
              if (!this.grid[ny][nx] && !drawn[ny][nx]) {
                ctx.fillRect(
                  Math.round(screenCx + (nx - this.cx) * scale),
                  Math.round(screenCy + (ny - this.cy) * scale),
                  scale,
                  scale
                );
                drawn[ny][nx] = true;
              }
            }
          }
        }
      }
    }

    // 2. Colors
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const color = this.grid[y][x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(
            Math.round(screenCx + (x - this.cx) * scale),
            Math.round(screenCy + (y - this.cy) * scale),
            scale,
            scale
          );
        }
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface DrawContext {
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  scale: number;
  direction: Direction;
  frame: number;
  time: number;
}

const frames = (d: DrawContext, speedMs: number, count: number) =>
  Math.floor(d.time / speedMs) % count;

// ─── Parts ───────────────────────────────────────────────────────────────────

function drawHead(
  g: PixelGrid,
  ox: number,
  oy: number,
  blink: boolean,
  expression: 'normal' | 'happy' | 'surprised' | 'confused' | 'sleeping' | 'thinking' = 'normal',
  earTwitch: boolean = false
) {
  // Ears
  let leftEarY = oy - 15;
  let rightEarY = oy - 15;
  if (expression === 'confused') rightEarY += 2; // Head tilt effect
  if (earTwitch) leftEarY += 1;
  
  g.rect(ox - 9, leftEarY, 5, 5, COLORS.orange);
  g.rect(ox - 8, leftEarY + 1, 3, 3, COLORS.innerEar);
  g.rect(ox + 4, rightEarY, 5, 5, COLORS.orange);
  g.rect(ox + 5, rightEarY + 1, 3, 3, COLORS.innerEar);
  
  // Base head
  g.rect(ox - 10, oy - 11, 20, 13, COLORS.orange);
  
  // Cheeks
  g.rect(ox - 11, oy - 3, 2, 4, COLORS.orange);
  g.rect(ox + 9, oy - 3, 2, 4, COLORS.orange);

  // Stripes on forehead
  g.rect(ox - 4, oy - 11, 2, 3, COLORS.stripe);
  g.rect(ox, oy - 11, 2, 4, COLORS.stripe);
  g.rect(ox + 4, oy - 11, 2, 3, COLORS.stripe);
  
  // Cream muzzle area
  g.rect(ox - 7, oy - 3, 14, 6, COLORS.cream);
  g.rect(ox - 9, oy - 1, 2, 3, COLORS.cream);
  g.rect(ox + 7, oy - 1, 2, 3, COLORS.cream);

  // Nose
  g.rect(ox - 1, oy - 1, 3, 2, COLORS.pink);
  
  // Eyes
  if (blink || expression === 'happy' || expression === 'sleeping') {
    // closed eyes
    g.rect(ox - 7, oy - 4, 4, 1, COLORS.eye);
    g.rect(ox + 3, oy - 4, 4, 1, COLORS.eye);
    if (expression === 'happy') {
       g.rect(ox - 7, oy - 5, 1, 1, COLORS.eye);
       g.rect(ox - 4, oy - 5, 1, 1, COLORS.eye);
       g.rect(ox + 3, oy - 5, 1, 1, COLORS.eye);
       g.rect(ox + 6, oy - 5, 1, 1, COLORS.eye);
    }
  } else if (expression === 'surprised' || expression === 'confused') {
    // wide eyes
    g.rect(ox - 7, oy - 6, 4, 5, COLORS.eye);
    g.rect(ox + 3, oy - 6, 4, 5, COLORS.eye);
    g.rect(ox - 6, oy - 5, 2, 2, COLORS.white);
    g.rect(ox + 4, oy - 5, 2, 2, COLORS.white);
  } else if (expression === 'thinking') {
    // looking up
    g.rect(ox - 7, oy - 5, 4, 4, COLORS.eye);
    g.rect(ox + 3, oy - 5, 4, 4, COLORS.eye);
    g.rect(ox - 6, oy - 5, 2, 2, COLORS.white);
    g.rect(ox + 4, oy - 5, 2, 2, COLORS.white);
  } else {
    // normal eyes
    // Left Eye
    g.rect(ox - 7, oy - 5, 4, 4, COLORS.eye);
    
    // Right Eye
    g.rect(ox + 3, oy - 5, 4, 4, COLORS.eye);
    
    // highlight
    g.rect(ox - 5, oy - 4, 2, 2, COLORS.white);
    g.rect(ox + 5, oy - 4, 2, 2, COLORS.white);
  }
}

function drawTail(g: PixelGrid, wagPhase: number, ox: number, oy: number) {
  if (wagPhase === 0) {
    g.rect(ox - 14, oy + 4, 6, 4, COLORS.orange);
    g.rect(ox - 16, oy + 2, 4, 6, COLORS.orange);
    g.rect(ox - 17, oy - 2, 4, 5, COLORS.orange);
  } else if (wagPhase === 1 || wagPhase === 3) {
    g.rect(ox - 13, oy + 5, 6, 4, COLORS.orange);
    g.rect(ox - 15, oy + 4, 4, 6, COLORS.orange);
    g.rect(ox - 16, oy, 4, 5, COLORS.orange);
  } else if (wagPhase === 2) {
    g.rect(ox - 12, oy + 6, 6, 4, COLORS.orange);
    g.rect(ox - 14, oy + 6, 4, 5, COLORS.orange);
    g.rect(ox - 15, oy + 2, 4, 5, COLORS.orange);
  } else if (wagPhase === 4) {
    // Wrapped around body (for sitting)
    g.rect(ox - 10, oy + 8, 20, 4, COLORS.orange);
    g.rect(ox + 6, oy + 6, 6, 6, COLORS.orange);
    g.rect(ox + 8, oy + 2, 4, 6, COLORS.orange);
  }
}

// ─── States ──────────────────────────────────────────────────────────────────

function drawIdle(g: PixelGrid, d: DrawContext) {
  const breathe = frames(d, 600, 2); // 0 or 1
  const wag = frames(d, 400, 4); // 0..3
  const blink = frames(d, 3500, 10) === 0;
  const earTwitch = frames(d, 150, 40) === 0; // Quick twitch every ~6 seconds

  drawTail(g, wag, 0, breathe);
  
  // Back Legs
  g.rect(-6, 12, 4, 4, COLORS.orangeDark);
  g.rect(2, 12, 4, 4, COLORS.orangeDark);
  
  // Body
  g.rect(-9, 2 + breathe, 18, 12 - breathe, COLORS.orange);
  g.rect(-7, 5 + breathe, 14, 9 - breathe, COLORS.cream);
  
  // Front Legs
  g.rect(-5, 12 + breathe, 4, 4 - breathe, COLORS.orange);
  g.rect(1, 12 + breathe, 4, 4 - breathe, COLORS.orange);
  
  drawHead(g, 0, breathe, blink, 'normal', earTwitch);
}

function drawWalk(g: PixelGrid, d: DrawContext) {
  const walkPhase = frames(d, 150, 4); 
  const bob = (walkPhase % 2 === 0) ? 0 : 1;
  const blink = frames(d, 3000, 10) === 0;

  drawTail(g, walkPhase, 0, bob);
  
  // Back Legs
  if (walkPhase === 0 || walkPhase === 2) {
    g.rect(-7, 12, 4, 4, COLORS.orangeDark); 
    g.rect(3, 12, 4, 4, COLORS.orangeDark);  
  } else if (walkPhase === 1) {
    g.rect(-9, 11, 4, 4, COLORS.orangeDark); 
    g.rect(5, 11, 4, 4, COLORS.orangeDark);  
  } else {
    g.rect(-5, 12, 4, 4, COLORS.orangeDark); 
    g.rect(1, 12, 4, 4, COLORS.orangeDark);
  }
  
  // Body
  g.rect(-9, 2 + bob, 18, 12, COLORS.orange);
  g.rect(-7, 5 + bob, 14, 9, COLORS.cream);
  
  // Front Legs
  if (walkPhase === 0 || walkPhase === 2) {
    g.rect(-5, 12 + bob, 4, 4, COLORS.orange);
    g.rect(1, 12 + bob, 4, 4, COLORS.orange);
  } else if (walkPhase === 1) {
    g.rect(-3, 12 + bob, 4, 4, COLORS.orange);
    g.rect(3, 11 + bob, 4, 4, COLORS.orange); 
  } else {
  g.rect(-7, 11 + bob, 4, 4, COLORS.orange); 
    g.rect(-1, 12 + bob, 4, 4, COLORS.orange);
  }
  
  drawHead(g, 0, bob, blink, 'normal', false);
}

function drawSit(g: PixelGrid, d: DrawContext) {
  const breathe = frames(d, 700, 2);
  const blink = frames(d, 4000, 10) === 0;

  drawTail(g, 4, 0, 0); // Wrapped tail
  
  // Sit Body
  g.rect(-9, 4 + breathe, 18, 10 - breathe, COLORS.orange);
  g.rect(-7, 6 + breathe, 14, 8 - breathe, COLORS.cream);
  
  // Front Legs straight
  g.rect(-5, 10 + breathe, 4, 6 - breathe, COLORS.orange);
  g.rect(1, 10 + breathe, 4, 6 - breathe, COLORS.orange);
  
  drawHead(g, 0, 2 + breathe, blink, 'normal', false);
}

function drawSleep(g: PixelGrid, d: DrawContext) {
  const breathe = frames(d, 1000, 2);
  
  // Curled Tail
  g.rect(-12, 6, 20, 6, COLORS.orange);
  g.rect(6, 4, 6, 8, COLORS.orange);
  
  // Body blob
  g.rect(-9, 6 - breathe, 16, 6 + breathe, COLORS.orange);
  g.rect(-5, 7 - breathe, 10, 5 + breathe, COLORS.cream);
  
  // Head resting low
  drawHead(g, -2, 6 - breathe, true, 'sleeping');

  // Z particles
  const zPhase = frames(d, 500, 6);
  if (zPhase > 0) {
    const zx = 6 + zPhase * 3;
    const zy = -6 - zPhase * 4;
    // Draw small 'z'
    g.rect(zx, zy, 4, 1, COLORS.zzz);
    g.rect(zx + 2, zy + 1, 1, 1, COLORS.zzz);
    g.rect(zx + 1, zy + 2, 1, 1, COLORS.zzz);
    g.rect(zx, zy + 3, 4, 1, COLORS.zzz);
  }
}

function drawStretch(g: PixelGrid) {
  // Long body
  g.rect(-14, 6, 24, 8, COLORS.orange);
  g.rect(-12, 8, 20, 6, COLORS.cream);
  
  // Tail up
  g.rect(-16, -4, 4, 12, COLORS.orange);
  g.rect(-15, -6, 2, 2, COLORS.orange);

  // Back legs extended back
  g.rect(-16, 12, 6, 4, COLORS.orangeDark);
  
  // Front legs extended forward
  g.rect(10, 12, 6, 4, COLORS.orange);
  
  // Head low
  drawHead(g, 8, 8, true, 'happy');
}

function drawHappy(g: PixelGrid, d: DrawContext) {
  const jump = frames(d, 200, 2) * 2;
  
  drawTail(g, 1, 0, -jump);
  
  g.rect(-9, 2 - jump, 18, 12, COLORS.orange);
  g.rect(-7, 5 - jump, 14, 9, COLORS.cream);
  
  g.rect(-5, 12 - jump, 4, 4, COLORS.orange);
  g.rect(1, 12 - jump, 4, 4, COLORS.orange);
  
  drawHead(g, 0, -jump, true, 'happy');

  // Sparkles
  if (jump > 0) {
    g.px(-14, -12, COLORS.sparkle);
    g.px(-13, -11, COLORS.sparkle);
    g.px(-15, -11, COLORS.sparkle);
    g.px(-14, -10, COLORS.sparkle);

    g.px(14, -6, COLORS.sparkle);
    g.px(15, -5, COLORS.sparkle);
    g.px(13, -5, COLORS.sparkle);
    g.px(14, -4, COLORS.sparkle);
  }
}

function drawConfused(g: PixelGrid) {
  drawTail(g, 0, 0, 0);
  
  g.rect(-9, 2, 18, 12, COLORS.orange);
  g.rect(-7, 5, 14, 9, COLORS.cream);
  
  g.rect(-5, 12, 4, 4, COLORS.orange);
  g.rect(1, 12, 4, 4, COLORS.orange);
  
  drawHead(g, 0, 0, false, 'confused');

  // Question mark
  const qx = 12;
  const qy = -18;
  g.rect(qx, qy, 4, 1, COLORS.question);
  g.rect(qx - 1, qy + 1, 2, 2, COLORS.question);
  g.rect(qx + 3, qy + 1, 2, 2, COLORS.question);
  g.rect(qx + 2, qy + 3, 2, 1, COLORS.question);
  g.rect(qx + 1, qy + 4, 2, 2, COLORS.question);
  g.rect(qx + 1, qy + 7, 2, 2, COLORS.question);
}

function drawThinking(g: PixelGrid) {
  drawTail(g, 4, 0, 0); // Wrapped
  
  // Sit Body
  g.rect(-9, 4, 18, 10, COLORS.orange);
  g.rect(-7, 6, 14, 8, COLORS.cream);
  
  // One leg up to chin
  g.rect(-5, 10, 4, 6, COLORS.orange);
  g.rect(4, 2, 4, 4, COLORS.orange); // Paw on chin
  
  drawHead(g, 0, 2, false, 'thinking');

  // Bubble
  const bx = 12;
  const by = -14;
  g.px(bx, by, COLORS.white);
  g.rect(bx + 2, by - 4, 2, 2, COLORS.white);
  g.rect(bx + 4, by - 12, 6, 6, COLORS.white);
}

function drawDragged(g: PixelGrid, d: DrawContext) {
  const swing = Math.sin(d.time * 0.01) * 2;
  
  // Tail hangs down
  g.rect(-3, 14, 4, 8, COLORS.orange);
  
  // Long body
  g.rect(-8 + swing, -2, 16, 16, COLORS.orange);
  g.rect(-6 + swing, 2, 12, 12, COLORS.cream);
  
  // Legs hang
  g.rect(-5 + swing, 12, 4, 8, COLORS.orange);
  g.rect(1 + swing, 12, 4, 8, COLORS.orange);
  
  drawHead(g, 0, -4, false, 'surprised');
}

function drawWave(g: PixelGrid, d: DrawContext) {
  const wave = Math.sin(d.time * 0.015) * 4;
  
  drawTail(g, 4, 0, 0); // Wrapped
  
  g.rect(-9, 4, 18, 10, COLORS.orange);
  g.rect(-7, 6, 14, 8, COLORS.cream);
  
  // Left leg stands
  g.rect(-5, 10, 4, 6, COLORS.orange);
  
  // Right leg waves (rotates up)
  g.rect(10, 4 + wave, 6, 4, COLORS.orange);
  
  drawHead(g, 0, 2, false, 'happy');
}

function drawYawn(g: PixelGrid, _d: DrawContext) {
  drawTail(g, 4, 0, 0); // Sitting tail
  g.rect(-6, 12, 12, 4, COLORS.orangeDark);
  g.rect(-9, 4, 18, 10, COLORS.orange);
  g.rect(-7, 7, 14, 7, COLORS.cream);
  g.rect(-5, 11, 10, 5, COLORS.orange);
  drawHead(g, 0, 0, true, 'normal'); 
  // Mouth open (override)
  g.rect(-2, 1, 4, 3, COLORS.pink);
  g.rect(-1, 2, 2, 1, COLORS.orangeDark);
}

function drawClean(g: PixelGrid, d: DrawContext) {
  const lickPhase = frames(d, 300, 2);
  drawTail(g, 4, 0, 0);
  g.rect(-6, 12, 12, 4, COLORS.orangeDark);
  g.rect(-9, 4, 18, 10, COLORS.orange);
  g.rect(-7, 7, 14, 7, COLORS.cream);
  // Head slightly down
  drawHead(g, 0, 2, true, 'normal');
  // Paw moving
  if (lickPhase === 0) {
    g.rect(2, 6, 4, 5, COLORS.orange);
  } else {
    g.rect(2, 4, 4, 5, COLORS.orange);
  }
}

function drawPounce(g: PixelGrid) {
  // Crouched
  g.rect(-10, 10, 20, 6, COLORS.orange);
  g.rect(-8, 12, 16, 4, COLORS.cream);
  drawHead(g, 0, 6, false, 'surprised');
}

function drawStartled(g: PixelGrid) {
  // standing tall
  drawTail(g, 2, 0, -4);
  g.rect(-6, 8, 4, 8, COLORS.orangeDark);
  g.rect(2, 8, 4, 8, COLORS.orangeDark);
  g.rect(-9, -2, 18, 12, COLORS.orange);
  g.rect(-7, 1, 14, 9, COLORS.cream);
  drawHead(g, 0, -4, false, 'surprised');
}


function drawReminding(g: PixelGrid, d: DrawContext) {
  // Attentive pose, facing forward (or slightly forward)
  // Subtle body bounce
  const bounce = Math.sin(d.time / 200) > 0 ? 1 : 0;
  
  // Subtle tail movement
  drawTail(g, 4, 0, Math.sin(d.time / 400) * 2);
  
  // Body (sitting upright/attentive)
  g.rect(-6, 8 - bounce, 12, 8, COLORS.orangeDark); // Legs
  g.rect(-9, - bounce, 18, 10, COLORS.orange);
  g.rect(-7, 3 - bounce, 14, 7, COLORS.cream);
  
  // Optional raised paw (right paw raised slightly)
  g.rect(4, 2 - bounce, 4, 6, COLORS.orange); // Raised paw
  g.rect(-6, 8 - bounce, 4, 4, COLORS.orange); // Left paw grounded

  // Head facing forward, occasional blink
  const isBlinking = d.time % 4000 < 150;
  const expr = isBlinking ? 'sleeping' : 'normal';
  
  drawHead(g, 0, -2 - bounce, true, expr);
}

// ─── Main Render ─────────────────────────────────────────────────────────────

export function renderPet(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: PetState,
  direction: Direction,
  frame: number,
  time: number,
  scale: number
) {
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  if (direction === 'left') {
    ctx.scale(-1, 1);
  }

  const g = new PixelGrid();
  const d: DrawContext = { ctx, cx: 0, cy: 0, scale, direction, frame, time };

  switch (state) {
    case 'IDLE':
      drawIdle(g, d);
      break;
    case 'WALKING':
      drawWalk(g, d);
      break;
    case 'SITTING':
      drawSit(g, d);
      break;
    case 'SLEEPING':
      drawSleep(g, d);
      break;
    case 'STRETCHING':
      drawStretch(g);
      break;
    case 'DRAGGED':
      drawDragged(g, d);
      break;
    case 'HAPPY':
    case 'EXCITED':
      drawHappy(g, d);
      break;
    case 'CONFUSED':
      drawConfused(g);
      break;
    case 'THINKING':
      drawThinking(g);
      break;
    case 'WAVING':
      drawWave(g, d);
      break;
    case 'YAWNING':
      drawYawn(g, d);
      break;
    case 'CLEANING':
    case 'LICKING_PAW':
      drawClean(g, d);
      break;
    case 'POUNCING':
      drawPounce(g);
      break;
    case 'STARTLED':
      drawStartled(g);
      break;
    case 'REMINDING':
      drawReminding(g, d);
      break;
    default:
      drawIdle(g, d);
      break;
  }

  g.render(ctx, 0, 0, scale);
  ctx.restore();
}
