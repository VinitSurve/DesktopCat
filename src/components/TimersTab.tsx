import { useState, useEffect } from 'react';
import { useTimerStore } from '../timers/TimerStore';
import type { Timer } from '../timers/TimerTypes';

export function TimersTab() {
  const { timers, loaded, loadTimers, addTimer, deleteTimer, startTimer, pauseTimer, resetTimer } = useTimerStore();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(25);

  useEffect(() => {
    if (!loaded) loadTimers();
  }, [loaded, loadTimers]);

  const handleAdd = () => {
    if (!title.trim() || minutes <= 0) return;
    const newTimer: Timer = {
      id: Date.now().toString(),
      title: title.trim(),
      durationSeconds: minutes * 60,
      remainingSeconds: minutes * 60,
      state: 'STOPPED',
    };
    addTimer(newTimer);
    setShowAdd(false);
    setTitle('');
  };

  const handlePreset = (title: string, min: number) => {
    setTitle(title);
    setMinutes(min);
    setShowAdd(true);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!loaded) return <div>Loading timers...</div>;

  return (
    <div className="settings-section">
      <h2>Timers</h2>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ Custom Timer</button>
        <button onClick={() => handlePreset('Pomodoro', 25)} className="btn-secondary">25 Min</button>
        <button onClick={() => handlePreset('Break', 5)} className="btn-secondary">5 Min</button>
      </div>

      {showAdd && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <div className="settings-row">
            <label>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Study Session" />
          </div>
          <div className="settings-row">
            <label>Minutes</label>
            <input type="number" value={minutes} onChange={(e) => setMinutes(parseInt(e.target.value) || 0)} min={1} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={handleAdd} className="btn-primary">Save</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="timers-list">
        {timers.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{t.title}</div>
              <div style={{ fontSize: '24px', fontFamily: 'monospace', margin: '4px 0' }}>
                {formatTime(t.remainingSeconds)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {t.state === 'STOPPED' || t.state === 'PAUSED' ? (
                <button onClick={() => startTimer(t.id)} className="btn-primary">Start</button>
              ) : (
                <button onClick={() => pauseTimer(t.id)} className="btn-secondary">Pause</button>
              )}
              <button onClick={() => resetTimer(t.id)} className="btn-secondary">Reset</button>
              <button onClick={() => deleteTimer(t.id)} className="btn-secondary" style={{ color: '#ff6b6b' }}>Delete</button>
            </div>
          </div>
        ))}
        {timers.length === 0 && <div style={{ color: '#aaa', fontStyle: 'italic' }}>No timers yet.</div>}
      </div>
    </div>
  );
}
