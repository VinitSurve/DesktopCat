import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

export const ClipboardService = {
  async readText(): Promise<string | null> {
    try {
      const text = await readText();
      return text || null;
    } catch (e) {
      console.error('Failed to read clipboard', e);
      return null;
    }
  },

  async writeText(text: string): Promise<boolean> {
    try {
      await writeText(text);
      return true;
    } catch (e) {
      console.error('Failed to write clipboard', e);
      return false;
    }
  }
};
