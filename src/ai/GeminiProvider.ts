import { invoke } from '@tauri-apps/api/core';
import { AIProvider } from './AIProvider';
import { AIRequest, AIResponse } from './types';

export class GeminiProvider implements AIProvider {
  name = 'GEMINI';

  async isAvailable(): Promise<boolean> {
    try {
      const hasKey: boolean = await invoke('has_gemini_key');
      return hasKey;
    } catch {
      return false;
    }
  }

  async generateText(request: Omit<AIRequest, 'provider'>): Promise<AIResponse> {
    if (!request.model) {
      throw new Error("Model is required for GeminiProvider");
    }
    
    const fullRequest: AIRequest = {
      ...request,
      provider: 'GEMINI',
      model: request.model,
    };
    
    let attempt = 0;
    const maxRetries = 3;

    while (attempt <= maxRetries) {
      try {
        const res: any = await invoke('ai_generate', { request: fullRequest });
        console.log(`[AI] provider=GEMINI model=${res.model} status=SUCCESS duration=${res.duration_ms}ms`);
        
        return {
          text: res.text,
          provider: 'GEMINI',
          model: res.model,
          durationMs: res.duration_ms,
        };
      } catch (e: any) {
        const errStr = e?.message || e?.toString() || 'Unknown error';
        console.log(`[AI DEBUG] Gemini error (Attempt ${attempt + 1}/${maxRetries + 1}): ${errStr}`);
        
        const match = errStr.match(/HTTP (\d+)/);
        if (match && attempt < maxRetries) {
          const status = parseInt(match[1], 10);
          if ([408, 429, 500, 502, 503, 504].includes(status)) {
            attempt++;
            const delayMs = Math.pow(2, attempt - 1) * 1000 + (Math.random() * 200);
            console.log(`[AI DEBUG] Retrying transient error in ${delayMs.toFixed(0)}ms...`);
            await new Promise(r => setTimeout(r, delayMs));
            continue;
          }
        }
        throw new Error(errStr);
      }
    }
    throw new Error("Max retries exceeded");
  }
}
