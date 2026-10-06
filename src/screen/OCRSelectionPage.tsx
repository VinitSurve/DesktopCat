import { useState, useEffect, useCallback } from 'react';

import { invoke } from '@tauri-apps/api/core';
// Removed unused import
import './OCRSelectionPage.css';

interface Point { clientX: number; clientY: number; screenX: number; screenY: number; }

export function OCRSelectionPage() {
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        invoke('close_ocr_selection_window');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const point = { 
        clientX: e.clientX, 
        clientY: e.clientY, 
        screenX: e.screenX, 
        screenY: e.screenY 
    };
    setStartPoint(point);
    setCurrentPoint(point);
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setCurrentPoint({ 
        clientX: e.clientX, 
        clientY: e.clientY, 
        screenX: e.screenX, 
        screenY: e.screenY 
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(async () => {
    if (!isDragging || !startPoint || !currentPoint) return;
    setIsDragging(false);
    
    const clientW = Math.abs(currentPoint.clientX - startPoint.clientX);
    const clientH = Math.abs(currentPoint.clientY - startPoint.clientY);

    if (clientW < 10 || clientH < 10) {
      invoke('close_ocr_selection_window');
      return;
    }

    const x = Math.min(startPoint.screenX, currentPoint.screenX);
    const y = Math.min(startPoint.screenY, currentPoint.screenY);
    const w = Math.abs(currentPoint.screenX - startPoint.screenX);
    const h = Math.abs(currentPoint.screenY - startPoint.screenY);

    try {
      await invoke('process_ocr_selection', { x, y, w, h });
    } catch (e: any) {
      console.error("OCR Failed:", e);
      // Wait for process_ocr_selection to handle window closing if possible,
      // but since we moved orchestration to Rust, it will close the window itself.
    }
  }, [isDragging, startPoint, currentPoint]);

  let rectStyle: React.CSSProperties = { display: 'none' };
  if (isDragging && startPoint && currentPoint) {
    const x = Math.min(startPoint.clientX, currentPoint.clientX);
    const y = Math.min(startPoint.clientY, currentPoint.clientY);
    const w = Math.abs(currentPoint.clientX - startPoint.clientX);
    const h = Math.abs(currentPoint.clientY - startPoint.clientY);
    rectStyle = {
      display: 'block',
      left: x,
      top: y,
      width: w,
      height: h,
    };
  }

  return (
    <div 
      className="ocr-selection-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="ocr-selection-overlay"></div>
      
      {isDragging && startPoint && currentPoint && (
        <div className="ocr-selection-rect" style={rectStyle}>
           <div className="ocr-selection-label">OCR this area</div>
        </div>
      )}

      {!isDragging && (
        <div className="ocr-selection-hint">
          Click and drag to select text • ESC to cancel
        </div>
      )}
    </div>
  );
}
