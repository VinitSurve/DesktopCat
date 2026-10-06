/**
 * SettingsPage — Polished settings UI for PixelPaw.
 * Rendered in the settings window.
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { PetSettings } from '../types';
import './SettingsPage.css';

type SettingsTab = 'general' | 'pet' | 'ai' | 'advanced';

export function SettingsPage() {
  const [settings, setSettings] = useState<PetSettings | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const [geminiKeyStatus, setGeminiKeyStatus] = useState<string>('Loading...');
  const [newGeminiKey, setNewGeminiKey] = useState<string>('');
  
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<string | null>(null);
  
  useEffect(() => {
    invoke<PetSettings>('get_settings').then(setSettings).catch(console.error);
    checkGeminiKey();
  }, []);

  const checkGeminiKey = () => {
    invoke<boolean>('has_gemini_key')
      .then(has => setGeminiKeyStatus(has ? 'Connected' : 'Not configured'))
      .catch(() => setGeminiKeyStatus('Error reading keychain'));
  };

  const handleSaveGeminiKey = async () => {
    if (!newGeminiKey.trim()) return;
    try {
      await invoke('set_gemini_key', { key: newGeminiKey.trim() });
      setNewGeminiKey('');
      checkGeminiKey();
    } catch (e) {
      console.error(e);
      setGeminiKeyStatus('Failed to save key');
    }
  };

  const handleRemoveGeminiKey = async () => {
    try {
      await invoke('delete_gemini_key');
      checkGeminiKey();
    } catch (e) {
      console.error(e);
    }
  };

  const updateSetting = <K extends keyof PetSettings>(key: K, value: PetSettings[K]) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    invoke('update_settings', { settings: updated }).catch(console.error);
  };

  if (!settings) {
    return (
      <div className="settings-page">
        <div className="settings-loading">Loading…</div>
      </div>
    );
  }

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: '🏠' },
    { id: 'pet', label: 'Pet & Behavior', icon: '🐱' },
    { id: 'ai', label: 'AI & Privacy', icon: '✨' },
  ];

  return (
    <div className="settings-page">
      <div className="settings-sidebar">
        <div className="settings-sidebar__title">PixelPaw</div>
        <nav className="settings-sidebar__nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-sidebar__item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="settings-sidebar__icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="settings-sidebar__version">v0.1.0</div>
      </div>

      <div className="settings-content">
        {activeTab === 'general' && (
          <div className="settings-section">
            <h2>General</h2>

            <div className="settings-group">
              <label className="settings-toggle">
                <span className="settings-toggle__label">Always on Top</span>
                <input
                  type="checkbox"
                  checked={settings.always_on_top}
                  onChange={(e) => updateSetting('always_on_top', e.target.checked)}
                />
                <span className="settings-toggle__switch" />
              </label>
            </div>
            
            <div className="settings-group settings-group--info" style={{ marginTop: '2rem' }}>
              <p className="settings-info">
                PixelPaw v0.1.0 — Phase 1.6
              </p>
              <p className="settings-info settings-info--muted">
                AI features, screen awareness, and computer control will be available in future updates.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'pet' && (
          <div className="settings-section">
            <h2>Pet & Behavior</h2>

            <div className="settings-group">
              <label className="settings-toggle" style={{ marginBottom: '1.5rem' }}>
                <span className="settings-toggle__label">Random Movement</span>
                <input
                  type="checkbox"
                  checked={settings.random_movement}
                  onChange={(e) => updateSetting('random_movement', e.target.checked)}
                />
                <span className="settings-toggle__switch" />
              </label>

              <div className="settings-field">
                <span className="settings-field__label">Size</span>
                <div className="settings-segmented">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      className={`settings-segmented__btn ${settings.size === size ? 'active' : ''}`}
                      onClick={() => updateSetting('size', size)}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-field">
                <span className="settings-field__label">Speed</span>
                <div className="settings-slider-row">
                  <input
                    type="range"
                    min="0.3"
                    max="2.5"
                    step="0.1"
                    value={settings.speed}
                    onChange={(e) => updateSetting('speed', parseFloat(e.target.value))}
                    className="settings-slider"
                  />
                  <span className="settings-slider__value">{settings.speed.toFixed(1)}×</span>
                </div>
              </div>

              <div className="settings-field">
                <span className="settings-field__label">Opacity</span>
                <div className="settings-slider-row">
                  <input
                    type="range"
                    min="0.3"
                    max="1"
                    step="0.05"
                    value={settings.opacity}
                    onChange={(e) => updateSetting('opacity', parseFloat(e.target.value))}
                    className="settings-slider"
                  />
                  <span className="settings-slider__value">{Math.round(settings.opacity * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'ai' && (
          <div className="settings-section">
            <h2>AI & Privacy</h2>

            <div className="settings-group">
              <div className="settings-field">
                <span className="settings-field__label">AI Provider</span>
                <div className="settings-segmented">
                  {(['AUTO', 'OLLAMA', 'GEMINI'] as const).map((provider) => (
                    <button
                      key={provider}
                      className={`settings-segmented__btn ${settings.ai_provider === provider ? 'active' : ''}`}
                      onClick={() => updateSetting('ai_provider', provider)}
                    >
                      {provider}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-field">
                <span className="settings-field__label">Local Model (Ollama)</span>
                <input
                  type="text"
                  value={settings.local_model}
                  onChange={(e) => updateSetting('local_model', e.target.value)}
                  className="settings-input"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #444', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                  placeholder="e.g. qwen2.5:0.5b"
                />
              </div>

              <div className="settings-field">
                <span className="settings-field__label">Gemini Model</span>
                <input
                  type="text"
                  value={settings.gemini_model}
                  onChange={(e) => updateSetting('gemini_model', e.target.value)}
                  className="settings-input"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #444', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                  placeholder="e.g. gemini-2.5-flash"
                />
              </div>

              <div className="settings-field" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="settings-field__label">Gemini API Key</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: geminiKeyStatus === 'Connected' ? '#34c759' : '#ff9f0a' }}>
                    Status: {geminiKeyStatus}
                  </span>
                  {geminiKeyStatus === 'Connected' && (
                    <button onClick={handleRemoveGeminiKey} style={{ background: 'transparent', border: 'none', color: '#ff453a', cursor: 'pointer' }}>Remove</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    value={newGeminiKey}
                    onChange={(e) => setNewGeminiKey(e.target.value)}
                    className="settings-input"
                    style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #444', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                    placeholder="Enter new API key (securely stored in Keychain)"
                  />
                  <button 
                    onClick={handleSaveGeminiKey}
                    disabled={!newGeminiKey.trim()}
                    style={{ padding: '6px 12px', borderRadius: '6px', background: '#007aff', color: 'white', border: 'none', cursor: 'pointer', opacity: newGeminiKey.trim() ? 1 : 0.5 }}
                  >
                    Save
                  </button>
                </div>
                
                <div style={{ marginTop: '12px' }}>
                  <button 
                    className="ai-btn"
                    disabled={testStatus === 'loading'}
                    onClick={async () => {
                      console.log("[GEMINI TEST] BUTTON CLICKED");
                      console.log("[GEMINI TEST] starting connection test");
                      console.log("[GEMINI TEST] provider=GEMINI");
                      console.log(`[GEMINI TEST] model=${settings.gemini_model}`);
                      
                      setTestStatus('loading');
                      setTestResult('Testing Gemini...');
                      
                      try {
                        console.log("[GEMINI TEST] invoking backend");
                        const res = await invoke<any>('test_gemini_connection', { model: settings.gemini_model });
                        console.log("[GEMINI TEST] backend returned");
                        
                        if (res.success) {
                          console.log("[GEMINI TEST] SUCCESS");
                          setTestStatus('success');
                          setTestResult(`✓ Gemini connection successful\nModel: ${res.model}`);
                        } else {
                          console.log(`[GEMINI TEST] FAILED`);
                          console.log(`[GEMINI TEST] ERROR=${res.message}`);
                          setTestStatus('error');
                          setTestResult(`✗ Gemini connection failed\nHTTP: ${res.status || 'Unknown'}\nReason: ${res.message}`);
                        }
                      } catch (e: any) {
                        console.log(`[GEMINI TEST] FAILED`);
                        console.log(`[GEMINI TEST] ERROR=${e.message || e}`);
                        setTestStatus('error');
                        setTestResult(`✗ Gemini connection failed\nReason: ${e.message || e}`);
                      }
                    }}
                  >
                    {testStatus === 'loading' ? 'Testing...' : 'Test Gemini Connection'}
                  </button>
                  {testResult && (
                    <div style={{ 
                      marginTop: '8px', 
                      padding: '8px 12px', 
                      borderRadius: '6px', 
                      fontSize: '13px', 
                      whiteSpace: 'pre-line',
                      background: testStatus === 'success' ? 'rgba(52, 199, 89, 0.1)' : testStatus === 'error' ? 'rgba(255, 69, 58, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                      color: testStatus === 'success' ? '#34c759' : testStatus === 'error' ? '#ff453a' : 'white'
                    }}>
                      {testResult}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="settings-group settings-group--info" style={{ marginTop: '2rem' }}>
              <p className="settings-info">
                Privacy Note: The Clipboard AI Assistant only reads the clipboard when you explicitly request an action via the menu. PixelPaw does not silently monitor your clipboard.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
