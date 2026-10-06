import { useEffect, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './ReminderBubblePage.css';

export function ReminderBubblePage() {
  const [data, setData] = useState({ title: '', message: '', icon: '', id: '', type: '' });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setData({
      title: searchParams.get('title') || '',
      message: searchParams.get('message') || '',
      icon: searchParams.get('icon') || '',
      id: searchParams.get('id') || '',
      type: searchParams.get('rtype') || 'REMINDER'
    });
    console.log('[PIXELPAW BUBBLE] page mounted with data:', Object.fromEntries(searchParams));
  }, []);

  const handleDone = () => {
    emit('bubble_action', { action: 'DONE', id: data.id, type: data.type });
    getCurrentWindow().close();
  };

  const handleSnooze = (mins: number) => {
    emit('bubble_action', { action: 'SNOOZE', id: data.id, type: data.type, minutes: mins });
    getCurrentWindow().close();
  };

  return (
    <div className="bubble-container">
      <div className="bubble-content">
        <div className="bubble-header">
          {data.icon && <span className="bubble-icon">{data.icon}</span>}
          <span className="bubble-message">{data.message}</span>
        </div>
        <div className="bubble-title">{data.title}</div>
        <div className="bubble-actions" style={{ marginTop: 12 }}>
          <button onClick={handleDone} className="bubble-btn primary">Done</button>
          {data.type === 'REMINDER' && (
            <>
              <button onClick={() => handleSnooze(10)} className="bubble-btn">10m</button>
              <button onClick={() => handleSnooze(30)} className="bubble-btn">30m</button>
            </>
          )}
        </div>
      </div>
      {/* Optional tiny pointer arrow here if CSS doesn't handle it */}
    </div>
  );
}
