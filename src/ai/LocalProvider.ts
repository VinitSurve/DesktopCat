import { invoke } from '@tauri-apps/api/core';
import { AIProvider } from './AIProvider';
import { AIRequest, AIResponse } from './types';

export class LocalProvider implements AIProvider {
  name = 'OLLAMA';

  async isAvailable(): Promise<boolean> {
    try {
      const isOk: boolean = await invoke('check_ollama');
      return isOk;
    } catch {
      return false;
    }
  }

  async generateText(request: Omit<AIRequest, 'provider'>): Promise<AIResponse> {
    const fullRequest: AIRequest = {
      ...request,
      provider: 'OLLAMA',
    };
    
    // Convert Rust struct fields properly since invoke uses camelCase to snake_case if we send as JSON, 
    // but Tauri typically automatically handles camelCase from JS to snake_case in Rust.
    const res: any = await invoke('ai_generate', { request: fullRequest });
    
    return {
      text: res.text,
      provider: 'OLLAMA',
      model: res.model,
      durationMs: res.duration_ms,
    };
  }
}
