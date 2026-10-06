export type AIProviderName = 'OLLAMA' | 'GEMINI' | 'AUTO';

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  provider: AIProviderName;
  temperature?: number;
}

export interface AIResponse {
  text: string;
  provider: AIProviderName;
  model: string;
  durationMs: number;
}
