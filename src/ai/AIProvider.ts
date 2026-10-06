import { AIRequest, AIResponse } from './types';

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  generateText(request: Omit<AIRequest, 'provider'>): Promise<AIResponse>;
}
