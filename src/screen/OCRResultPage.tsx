import { useState, useEffect } from 'react';

import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { AIService } from '../ai/AIService';
import { usePetStore } from '../state/store';
import { AIRequest } from '../ai/types';
import './OCRResultPage.css';

interface OCRResult {
  text: string;
  duration_ms: number;
}

export function OCRResultPage() {
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const settings = usePetStore(state => state.settings);

  useEffect(() => {
    // Fetch the last OCR result from Rust natively
    invoke<OCRResult | null>('get_last_ocr_result')
      .then(res => {
        if (res) {
            setOcrResult(res);
        } else {
            setError("No text found or OCR failed.");
        }
      })
      .catch(e => setError(e.toString()));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') invoke('close_ocr_result_window');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopy = async () => {
    if (ocrResult?.text) {
      try {
        await writeText(ocrResult.text);
      } catch (e) {
        console.error("Failed to copy", e);
      }
    }
  };

  const handleAiAction = async (action: string) => {
    if (!ocrResult?.text) return;
    setIsProcessing(true);
    
    try {
      let systemPrompt = "You are a helpful assistant.";
      if (action === 'summarize') systemPrompt = "You are a professional assistant. Summarize the following text.";
      if (action === 'fix_grammar') systemPrompt = "You are a professional editor. Fix any grammatical errors in the following text, and provide only the corrected text.";
      if (action === 'explain') systemPrompt = "Explain the concepts in the following text clearly.";
      if (action === 'translate') systemPrompt = "Translate the following text to English, or if it is already in English, translate it to Spanish.";
      
      const request: AIRequest = {
        prompt: `Here is the text:\n\n${ocrResult.text}\n\nPlease perform the action.`,
        systemPrompt: systemPrompt,
        provider: settings.ai_provider,
        model: settings.gemini_model,
        temperature: 0.7
      };

      const result = await AIService.generate(request);
      
      // Now we open the AI Result Window to show the AI response!
      await invoke('open_ai_result_window');
      
      // Delay so the AI result window can mount
      setTimeout(() => {
        import('@tauri-apps/api/event').then(({ emit }) => {
            emit('ai-result-data', { result: result.text, provider: result.provider.toLowerCase() });
        });
        invoke('close_ocr_result_window'); // Close OCR window
      }, 500);
      
    } catch (e: any) {
      console.error("AI action failed:", e);
      alert("AI Action Failed: " + e.toString());
      setIsProcessing(false);
    }
  };

  if (error) {
      return (
          <div className="ocr-result-page" data-tauri-drag-region>
              <div className="ocr-header" data-tauri-drag-region>
                  <h2>OCR Failed</h2>
              </div>
              <div className="ocr-content error">{error}</div>
              <div className="ocr-footer">
                  <button className="ocr-btn" onClick={() => invoke('close_ocr_result_window')}>Close</button>
              </div>
          </div>
      );
  }

  return (
    <div className="ocr-result-page" data-tauri-drag-region>
      <div className="ocr-header" data-tauri-drag-region>
        <h2>Extracted Text</h2>
        <span className="ocr-meta">
            {ocrResult?.duration_ms ? `${ocrResult.duration_ms}ms` : ''}
        </span>
      </div>
      
      <div className="ocr-content-wrapper">
        <textarea 
            className="ocr-content" 
            readOnly 
            value={ocrResult?.text || "Reading screen..."}
        />
      </div>

      <div className="ocr-footer">
        <div className="ocr-actions">
            <button className="ocr-btn primary" onClick={handleCopy}>Copy</button>
            <button className="ocr-btn" onClick={() => handleAiAction('summarize')} disabled={isProcessing}>Summarize</button>
            <button className="ocr-btn" onClick={() => handleAiAction('fix_grammar')} disabled={isProcessing}>Fix Grammar</button>
            <button className="ocr-btn" onClick={() => handleAiAction('explain')} disabled={isProcessing}>Explain</button>
            <button className="ocr-btn" onClick={() => handleAiAction('translate')} disabled={isProcessing}>Translate</button>
        </div>
        <button className="ocr-btn close-btn" onClick={() => invoke('close_ocr_result_window')} disabled={isProcessing}>Close</button>
      </div>
    </div>
  );
}
