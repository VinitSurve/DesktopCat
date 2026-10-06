import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { ClipboardService } from '../clipboard/ClipboardService';
import './AIResultPage.css';

interface AIResultPayload {
  originalText?: string;
  resultText?: string;
  action?: string;
  provider?: string;
  model?: string;
  error?: string;
}

export function AIResultPage() {
  const [payload, setPayload] = useState<AIResultPayload | null>(null);

  useEffect(() => {
    // Listen for the payload from the main window
    const unlisten = listen<AIResultPayload>('ai-result-data', (event) => {
      setPayload(event.payload);
    });
    
    // Tell the main window we are ready
    emit('ai-result-ready');

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const closeWindow = () => {
    getCurrentWindow().hide();
  };

  const handleCopy = async () => {
    if (payload?.resultText) {
      await ClipboardService.writeText(payload.resultText);
      // Briefly show copied state or close
      closeWindow();
    }
  };

  const handleReplace = async () => {
    if (payload?.resultText) {
      await ClipboardService.writeText(payload.resultText);
      // Wait a tiny bit and paste via RobotJS/enigo? We don't have native paste yet.
      // So just copy it, and user can paste.
      // A true replace would simulate Cmd+V. Let's just copy for now.
      closeWindow();
    }
  };

  return (
    <div className="ai-result-container" data-tauri-drag-region>
      <div className="ai-result-header" data-tauri-drag-region>
        <span className="ai-result-title">🐱 PixelPaw AI</span>
        <button className="ai-result-close" onClick={closeWindow}>✕</button>
      </div>
      
      {!payload ? (
        <div className="ai-result-body">Loading...</div>
      ) : payload.error ? (
        (() => {
          let status = 'Unknown';
          let reason = payload.error;
          const match = payload.error?.match(/HTTP (\d+) — (.*)/);
          if (match) {
            status = match[1];
            reason = match[2];
          }
          return (
            <div className="ai-result-body">
              <div className="ai-result-text" style={{ color: '#ff453a' }}>
                <strong>AI request failed</strong><br /><br />
                Provider: {payload.provider || 'Unknown'}<br />
                Model: {payload.model || 'Unknown'}<br />
                Status: {status}<br /><br />
                Reason:<br />
                {reason}
              </div>
              <div className="ai-result-actions">
                <button className="ai-btn" onClick={() => invoke('open_settings_window')}>Open AI Settings</button>
                <button className="ai-btn primary" onClick={closeWindow}>Close</button>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="ai-result-body">
          <div className="ai-result-text">
            {payload.resultText}
          </div>
          <div className="ai-result-meta">
            Processed by {payload.provider}
          </div>
          
          <div className="ai-result-actions">
            <button className="ai-btn primary" onClick={handleCopy}>Copy</button>
            <button className="ai-btn" onClick={handleReplace}>Replace Clipboard</button>
            <button className="ai-btn" onClick={closeWindow}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
