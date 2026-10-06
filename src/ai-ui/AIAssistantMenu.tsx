import { useEffect, useRef } from 'react';
import '../components/PetMenu.css';

interface Props {
  x: number;
  y: number;
  onAction: (action: string) => void;
  onClose: () => void;
}

const AI_ACTIONS = [
  { id: 'ask_pixelpaw', label: 'Ask PixelPaw', icon: '🐱' },
  { id: 'fix_grammar', label: 'Fix Grammar', icon: '📝' },
  { id: 'rewrite', label: 'Rewrite', icon: '🔄' },
  { id: 'summarize', label: 'Summarize', icon: '📋' },
  { id: 'explain', label: 'Explain', icon: '🤔' },
  { id: 'make_professional', label: 'Make Professional', icon: '👔' },
  { id: 'make_casual', label: 'Make Casual', icon: '😎' },
  { id: 'shorten', label: 'Shorten', icon: '✂️' },
  { id: 'explain_code', label: 'Explain Code', icon: '💻' },
  { id: 'optimize_code', label: 'Optimize Code', icon: '⚡' },
];

export function AIAssistantMenu({ x, y, onAction, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
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

  const menuHeight = Math.min(AI_ACTIONS.length * 38 + 40, 300);
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(0, Math.min(x, window.innerWidth - 200)),
    top: Math.max(0, Math.min(y, window.innerHeight - menuHeight - 16)),
    maxHeight: '100vh',
    overflowY: 'auto',
  };

  return (
    <div ref={menuRef} className="pet-menu" style={menuStyle} role="menu">
      <div className="pet-menu__header">AI Assistant (Clipboard)</div>
      {AI_ACTIONS.map((item) => (
        <button
          key={item.id}
          className="pet-menu__item"
          onClick={() => {
            onAction(item.id);
            onClose();
          }}
          role="menuitem"
        >
          <span className="pet-menu__icon">{item.icon}</span>
          <span className="pet-menu__label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
