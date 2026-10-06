/**
 * PetCanvas — The main canvas component that renders the pixel-art pet
 * and handles all user interactions (click, drag, right-click).
 */

import { useRef, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { renderPet } from '../pet/PetRenderer';
import { usePetStore } from '../state/store';
import type { PetState, Direction } from '../types';
import { PET_SIZES } from '../types';

interface PetCanvasProps {
  petState: PetState;
  direction: Direction;
  isPaused: boolean;
  onPetClick: () => void;
  onPetDoubleClick: () => void;
  onPetRightClick: (x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPetHoverEnter: () => void;
  onPetHoverExit: () => void;
}

export function PetCanvas({
  petState,
  direction,
  isPaused,
  onPetClick,
  onPetDoubleClick,
  onPetRightClick,
  onDragStart,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
  onPetHoverEnter,
  onPetHoverExit,
}: PetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const isHoveringCatRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastClickRef = useRef<number>(0);
  const frameRef = useRef(0);

  const pointerStateRef = useRef({
    x: 0,
    y: 0,
    lastX: 0,
    lastY: 0,
    lastTime: performance.now(),
    speed: 0,
    mode: 'SLOW' as 'SLOW' | 'FAST',
  });

  const SLOW_POINTER_THRESHOLD = 300; // pixels per second
  const FAST_POINTER_THRESHOLD = 600; // pixels per second

  const settings = usePetStore((s) => s.settings);
  const sizeConfig = PET_SIZES[settings.size];
  const canvasSize = sizeConfig.window;
  const gridScale = sizeConfig.gridScale;

  // ─── Animation Loop ───────────────────────────────────────────────────

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Freeze time and frames when paused
    const time = isPaused ? 0 : performance.now();

    const shouldSkip = petState === 'SLEEPING' && frameRef.current % 3 !== 0 && !isPaused;
    
    if (!isPaused) {
      frameRef.current++;
    }

    if (!shouldSkip) {
      // High DPI support
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== canvasSize * dpr || canvas.height !== canvasSize * dpr) {
        canvas.width = canvasSize * dpr;
        canvas.height = canvasSize * dpr;
        canvas.style.width = `${canvasSize}px`;
        canvas.style.height = `${canvasSize}px`;
        ctx.scale(dpr, dpr);
      }

      // If paused, we still render to prevent canvas clearing on resize, but animations freeze (time=0).
      renderPet(ctx, canvasSize, canvasSize, petState, direction, frameRef.current, time, gridScale);
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, [petState, direction, isPaused, canvasSize, gridScale]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animate]);

  // ─── Click-Through Management ─────────────────────────────────────────

  useEffect(() => {
    const appWindow = getCurrentWindow();

    const handleMouseEnter = () => {
      appWindow.setIgnoreCursorEvents(false).catch(() => {});
      onMouseEnter();
    };

    const handleMouseLeave = () => {
      if (isHoveringCatRef.current) {
        isHoveringCatRef.current = false;
        onPetHoverExit();
      }
      onMouseLeave();
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mouseenter', handleMouseEnter);
      canvas.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('mouseenter', handleMouseEnter);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [onMouseEnter, onMouseLeave]);

  // ─── Interaction Handlers ─────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) return; // right click handled separately

    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;

      if (!isDraggingRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        isDraggingRef.current = true;
        onDragStart();

        // Use Tauri's native drag
        getCurrentWindow().startDragging().catch(() => {});
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        onDragEnd();
      } else {
        // Click detection
        const now = Date.now();
        if (now - lastClickRef.current < 300) {
          onPetDoubleClick();
        } else {
          onPetClick();
        }
        lastClickRef.current = now;
      }

      dragStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onPetClick, onPetDoubleClick, onDragStart, onDragEnd]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onPetRightClick(e.clientX, e.clientY);
  }, [onPetRightClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) return;

    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    // Cat bounds (roughly 24x36 pixels around center, scaled)
    const padding = 5; 
    const catLeft = canvasSize / 2 - (12 * gridScale) - padding;
    const catRight = canvasSize / 2 + (12 * gridScale) + padding;
    const catTop = canvasSize / 2 - (18 * gridScale) - padding;
    const catBottom = canvasSize / 2 + (18 * gridScale) + padding;

    const ps = pointerStateRef.current;
    
    ps.x = x;
    ps.y = y;

    const now = performance.now();
    const dt = (now - ps.lastTime) / 1000;
    
    if (dt > 0) {
      const dx = x - ps.lastX;
      const dy = y - ps.lastY;
      const dist = Math.hypot(dx, dy);
      const rawSpeed = dist / dt;
      ps.speed = ps.speed * 0.8 + rawSpeed * 0.2; // Smoothing
    }
    
    ps.lastX = x;
    ps.lastY = y;
    ps.lastTime = now;

    // Hysteresis
    if (ps.mode === 'SLOW' && ps.speed > FAST_POINTER_THRESHOLD) {
      ps.mode = 'FAST';
    } else if (ps.mode === 'FAST' && ps.speed < SLOW_POINTER_THRESHOLD) {
      ps.mode = 'SLOW';
    }

    const isOverCat = x >= catLeft && x <= catRight && y >= catTop && y <= catBottom;

    const shouldHover = isOverCat && ps.mode === 'SLOW';

    if (shouldHover && !isHoveringCatRef.current) {
      isHoveringCatRef.current = true;
      onPetHoverEnter();
    } else if (!shouldHover && isHoveringCatRef.current) {
      isHoveringCatRef.current = false;
      onPetHoverExit();
    }
  }, [canvasSize, gridScale, onPetHoverEnter, onPetHoverExit]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: canvasSize,
        height: canvasSize,
        cursor: isDraggingRef.current ? 'grabbing' : 'pointer',
        opacity: settings.opacity,
        imageRendering: 'auto',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
    />
  );
}
