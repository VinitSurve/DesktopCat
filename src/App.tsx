/**
 * App — Main application component.
 * Routes between the pet view and settings view based on window context.
 */

import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PetView } from './PetView';
import { SettingsPage } from './components/SettingsPage';
import { AIResultPage } from './ai-ui/AIResultPage';
import { OCRSelectionPage } from './screen/OCRSelectionPage';
import { OCRResultPage } from './screen/OCRResultPage';
import { ReminderBubblePage } from './assistant/ReminderBubblePage';
import { AskPixelPawPage } from './assistant/AskPixelPawPage';
import './App.css';

export default function App() {
  const [windowLabel, setWindowLabel] = useState<string>('');

  useEffect(() => {
    const label = getCurrentWindow().label;
    setWindowLabel(label);
  }, []);

  // Route based on window label
  if (windowLabel === 'settings') {
    return <SettingsPage />;
  }
  
  if (windowLabel === 'ai_result') {
    return <AIResultPage />;
  }

  if (windowLabel === 'ocr_selection') {
    return <OCRSelectionPage />;
  }
  
  if (windowLabel === 'ocr_result') {
    return <OCRResultPage />;
  }

  if (windowLabel === 'reminder_window' || windowLabel === 'reminder_bubble') {
    return <ReminderBubblePage />;
  }

  if (windowLabel === 'ask_pixelpaw') {
    return <AskPixelPawPage />;
  }

  // Default: pet window
  return <PetView />;
}
