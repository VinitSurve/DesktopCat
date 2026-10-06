/**
 * PetMenu — A small, beautiful radial-inspired context menu.
 */

import { useEffect, useRef } from 'react';
import './PetMenu.css';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
}

interface PetMenuProps {
  x: number;
  y: number;
  onAction: (action: string) => void;
  onClose: () => void;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'ai_assistant', label: 'AI Assistant', icon: '✨' },
  { id: 'ocr_screen', label: 'Understand Screen', icon: '🔎' },
  { id: 'add_reminder', label: 'Add Reminder', icon: '⏰' },
  { id: 'timers', label: 'Timers', icon: '⏱️' },
  { id: 'sleep', label: 'Sleep', icon: '😴' },
  { id: 'wake', label: 'Wake Up', icon: '🐾' },
  { id: 'wave', label: 'Wave', icon: '👋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'quit', label: 'Quit', icon: '🚪' },
];

export function PetMenu({ x, y, onAction, onClose }: PetMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // Delay to avoid the right-click itself closing the menu
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuHeight = MENU_ITEMS.length * 38 + 16;
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(0, Math.min(x, window.innerWidth - 160)),
    top: Math.max(0, Math.min(y, window.innerHeight - menuHeight)),
    maxHeight: '100vh',
    overflowY: 'auto',
  };

  return (
    <div ref={menuRef} className="pet-menu" style={menuStyle} role="menu">
      <div className="pet-menu__header">PixelPaw</div>
      {MENU_ITEMS.map((item) => (
        <button
          key={item.id}
          className="pet-menu__item"
          onClick={() => {
            onAction(item.id);
            onClose();
          }}
          disabled={item.disabled}
          role="menuitem"
        >
          <span className="pet-menu__icon">{item.icon}</span>
          <span className="pet-menu__label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
