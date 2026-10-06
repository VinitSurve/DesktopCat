import { useState, useEffect } from 'react';
import { useReminderStore } from '../reminders/ReminderStore';
import type { Reminder, ReminderType } from '../reminders/ReminderTypes';

export function RemindersTab() {
  const { reminders, loaded, loadReminders, addReminder, updateReminder, deleteReminder } = useReminderStore();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ReminderType>('ONCE');
  const [intervalMin, setIntervalMin] = useState(90);

  useEffect(() => {
    if (!loaded) loadReminders();
  }, [loaded, loadReminders]);

  const handleAdd = () => {
    if (!title.trim()) return;
    const newReminder: Reminder = {
      id: Date.now().toString(),
      title: title.trim(),
      type,
      enabled: true,
      completed: false,
      createdAt: Date.now(),
    };

    if (type === 'INTERVAL') {
      newReminder.intervalMinutes = intervalMin;
    } else if (type === 'ONCE') {
      // For simplicity in this UI, ONCE is 5 mins from now if not specified.
      // A full date picker would go here, but keeping it simple for the assistant phase.
      newReminder.scheduledAt = Date.now() + intervalMin * 60 * 1000;
    }

    addReminder(newReminder);
    setShowAdd(false);
    setTitle('');
  };

  const handlePreset = (title: string, type: ReminderType, min: number) => {
    setTitle(title);
    setType(type);
    setIntervalMin(min);
    setShowAdd(true);
  };

  if (!loaded) return <div>Loading reminders...</div>;

  return (
    <div className="settings-section">
      <h2>Reminders</h2>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Reminder</button>
        <button onClick={() => handlePreset('Drink Water', 'INTERVAL', 90)} className="btn-secondary">Preset: Water</button>
        <button onClick={() => handlePreset('Take a Break', 'INTERVAL', 60)} className="btn-secondary">Preset: Break</button>
      </div>

      {showAdd && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <div className="settings-row">
            <label>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Drink Water" />
          </div>
          <div className="settings-row">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ReminderType)}>
              <option value="INTERVAL">Interval</option>
              <option value="ONCE">Once (in minutes)</option>
              {/* DAILY and WEEKLY would have time pickers, omitted for brevity in Phase C demo */}
            </select>
          </div>
          <div className="settings-row">
            <label>Minutes</label>
            <input type="number" value={intervalMin} onChange={(e) => setIntervalMin(parseInt(e.target.value) || 0)} min={1} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={handleAdd} className="btn-primary">Save</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="reminders-list">
        {reminders.map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div>
              <div style={{ fontWeight: 'bold', textDecoration: r.completed ? 'line-through' : 'none', color: r.completed ? '#888' : '#fff' }}>{r.title}</div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>
                {r.type === 'INTERVAL' ? `Every ${r.intervalMinutes} minutes` : r.type}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => updateReminder(r.id, { enabled: !r.enabled })}
                className="btn-secondary"
                style={{ opacity: r.enabled ? 1 : 0.5 }}
              >
                {r.enabled ? 'ON' : 'OFF'}
              </button>
              <button onClick={() => deleteReminder(r.id)} className="btn-secondary" style={{ color: '#ff6b6b' }}>Delete</button>
            </div>
          </div>
        ))}
        {reminders.length === 0 && <div style={{ color: '#aaa', fontStyle: 'italic' }}>No reminders yet.</div>}
      </div>
    </div>
  );
}
