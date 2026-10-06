import { useState, useEffect, useRef } from 'react';
import { emit } from '@tauri-apps/api/event';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AIService } from '../ai/AIService';
import { AIMessage } from '../ai/types';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import './AskPixelPawPage.css';

const PIXELPAW_SYSTEM_PROMPT = `You are PixelPaw, a tiny digital desktop cat companion.
Your personality is friendly, playful, concise, helpful, and slightly cat-like.
Do NOT force cat jokes into every response. Keep your personality subtle.
Never annoy the user. Never pretend to have emotions as facts. Never be overly childish.
You assist the user with their questions, code, and daily tasks.`;

export function AskPixelPawPage() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useClipboard, setUseClipboard] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load history
  useEffect(() => {
    const saved = localStorage.getItem('pixelpaw_chat_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Save history
  useEffect(() => {
    localStorage.setItem('pixelpaw_chat_history', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearChat = () => {
    if (window.confirm('Clear this conversation?')) {
      setMessages([]);
      localStorage.removeItem('pixelpaw_chat_history');
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    let prompt = text;
    if (useClipboard) {
      try {
        const clipboardText = await readText();
        if (clipboardText) {
          prompt = `Clipboard context:\n${clipboardText}\n\nUser request:\n${text}`;
        }
      } catch (err) {
        console.error('Clipboard read failed', err);
      }
    }

    const newUserMsg: AIMessage = { role: 'user', content: prompt };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setUseClipboard(false);
    setIsLoading(true);

    emit('ai_chat_started').catch(() => {});

    try {
      const response = await AIService.generate({
        prompt,
        systemPrompt: PIXELPAW_SYSTEM_PROMPT,
        messages: messages, // Send history
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
      emit('ai_chat_success').catch(() => {});
    } catch (err: any) {
      let errorMsg = 'An unexpected error occurred.';
      if (err.message) {
        errorMsg = err.message.includes('fetch') || err.message.includes('HTTP')
          ? "PixelPaw couldn't reach the AI provider right now.\n\nTry again, or switch to Local in AI Settings."
          : `Error: ${err.message}`;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      emit('ai_chat_error').catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const quickActions = [
    "Explain something",
    "Help me write",
    "Debug my code",
    "Brainstorm an idea",
    "Ask anything"
  ];

  return (
    <div className="ask-pixelpaw-container">
      <header className="ask-pixelpaw-header">
        <div className="header-title">
          <span className="header-icon">🐱</span>
          <div>
            <h1>PixelPaw</h1>
            <p>Your tiny desktop companion</p>
          </div>
        </div>
        <button className="clear-btn" onClick={clearChat} title="Clear conversation">🗑️</button>
      </header>

      <div className="chat-area">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>What can I help you with?</p>
            <div className="quick-actions">
              {quickActions.map(action => (
                <button key={action} onClick={() => setInput(action)}>{action}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-bubble ${msg.role}`}>
                {msg.role === 'assistant' && <span className="msg-avatar">🐱</span>}
                <div className="msg-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-bubble assistant">
                <span className="msg-avatar">🐱</span>
                <div className="msg-content loading-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="input-area">
        {useClipboard && (
          <div className="context-chip" onClick={() => setUseClipboard(false)}>
            📋 Clipboard attached <span>×</span>
          </div>
        )}
        <div className="input-row">
          <button 
            className={`ctx-btn ${useClipboard ? 'active' : ''}`}
            onClick={() => setUseClipboard(!useClipboard)}
            title="Attach clipboard"
          >
            +
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask PixelPaw..."
            disabled={isLoading}
            rows={1}
          />
          <button 
            className="send-btn" 
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
