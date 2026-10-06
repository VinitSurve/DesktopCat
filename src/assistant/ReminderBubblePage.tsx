import { useEffect, useState } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import './ReminderBubblePage.css';

interface BubbleData {
  id: string;
  title: string;
  message: string;
  icon?: string;
  type: 'REMINDER' | 'TIMER';
}

export function ReminderBubblePage() {
  const [data, setData] = useState<BubbleData | null>(null);

  useEffect(() => {
    // Listen for data
    const unlisten = listen<BubbleData>('set_bubble_data', (event) => {
      setData(event.payload);
    });

    // Notify main window we are ready
    emit('bubble_ready');

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleDone = () => {
    if (data) {
      emit('bubble_action', { action: 'DONE', id: data.id, type: data.type });
    }
  };

  const handleSnooze = (mins: number) => {
    if (data) {
      emit('bubble_action', { action: 'SNOOZE', id: data.id, type: data.type, minutes: mins });
    }
  };

  if (!data) return <div className="bubble-container empty"></div>;

  return (
    <div className="bubble-container">
      <div className="bubble-content">
        <div className="bubble-header">
          {data.icon && <span className="bubble-icon">{data.icon}</span>}
          <span className="bubble-message">{data.message}</span>
        </div>
        <div className="bubble-title">{data.title}</div>
        <div className="bubble-actions">
          <button onClick={handleDone} className="bubble-btn primary">Done</button>
          {data.type === 'REMINDER' && (
            <>
              <button onClick={() => handleSnooze(10)} className="bubble-btn">10m</button>
              <button onClick={() => handleSnooze(30)} className="bubble-btn">30m</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
