export type AIProviderName = 'OLLAMA' | 'GEMINI' | 'AUTO';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  messages?: AIMessage[];
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
