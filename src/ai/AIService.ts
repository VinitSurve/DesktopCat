import { LocalProvider } from './LocalProvider';
import { GeminiProvider } from './GeminiProvider';
import { AIProviderName, AIRequest, AIResponse } from './types';
import { usePetStore } from '../state/store';

const localProvider = new LocalProvider();
const geminiProvider = new GeminiProvider();

export const AIService = {
  async getProvider(preferred: AIProviderName): Promise<import('./AIProvider').AIProvider> {
    if (preferred === 'AUTO') {
      const isLocalAvailable = await localProvider.isAvailable();
      if (isLocalAvailable) return localProvider;
      
      const isGeminiAvailable = await geminiProvider.isAvailable();
      if (isGeminiAvailable) return geminiProvider;
      
      throw new Error('No AI providers available. Please start Ollama or configure Gemini API key.');
    }
    
    if (preferred === 'OLLAMA') {
      const available = await localProvider.isAvailable();
      if (!available) throw new Error('Ollama is not available on http://127.0.0.1:11434');
      return localProvider;
    }
    
    if (preferred === 'GEMINI') {
      const available = await geminiProvider.isAvailable();
      if (!available) throw new Error('Gemini API key is not configured');
      return geminiProvider;
    }
    
    throw new Error(`Unknown provider: ${preferred}`);
  },

  async generate(request: Omit<AIRequest, 'provider'>): Promise<AIResponse> {
    // In a real implementation we would fetch settings for preferred provider
    // For now we'll use AUTO
    // Wait, let's fetch settings from store!
    const settings = usePetStore.getState().settings;
    // Assuming settings has an `ai_provider` field. Let's cast for now:
    const providerName: AIProviderName = (settings as any).ai_provider || 'AUTO';

    const provider = await this.getProvider(providerName);
    
    // Attach the correct model based on the resolved provider
    const resolvedModel = provider.name === 'GEMINI' ? settings.gemini_model : settings.local_model;
    const finalModel = request.model || resolvedModel;
    const fullRequest = {
      ...request,
      model: finalModel,
    };
    
    console.log(`[AI] provider=${provider.name} model=${finalModel} action=START`);
    return provider.generateText(fullRequest);
  }
};
