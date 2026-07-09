import { useState, useRef, useEffect } from 'react';
import { getGroqResponseStream } from '../services/groqService';
import { Send, X, Bot, User, Loader2 } from 'lucide-react';

export default function SupportChat({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: Date.now(),
      role: 'assistant',
      content: "Hi! I'm your CheckIn Care support assistant 👋\n\nI can help you with medications, reminders, adherence tracking, and navigating the app. What can I help you with today?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim() || loading) return;

    const userText = inputValue.trim();
    const newUserMsg = {
      id: Date.now(),
      role: 'user',
      content: userText,
      timestamp: new Date()
    };
    
    // Create new array with user message to pass to API (we only need role/content)
    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);
    setInputValue("");
    setLoading(true);
    setError(null);

    // Filter messages for API (remove UI-only fields)
    const apiMessages = newMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    try {
      let fullResponse = '';
      const aiMsgId = Date.now() + 1;
      
      // Add empty AI message placeholder
      setMessages(prev => [...prev, {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true
      }]);

      await getGroqResponseStream(apiMessages, null, (chunk) => {
        fullResponse += chunk;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === aiMsgId 
              ? { ...msg, content: fullResponse, isLoading: false }
              : msg
          )
        );
      });
    } catch (err) {
      console.error("❌ Error:", err);
      setError(err.message);
      // Remove the loading message if it failed completely
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg.role === 'assistant' && lastMsg.content === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px',
      right: '30px',
      width: '100%',
      maxWidth: '380px',
      height: '600px',
      maxHeight: 'calc(100vh - 120px)',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 12px 28px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      overflow: 'hidden',
      animation: 'slideUp 0.3s ease-out forwards',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #2563eb, #0d9488)',
        padding: '16px',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>CheckIn Care Support</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', opacity: 0.9 }}>
              <div style={{ width: '8px', height: '8px', backgroundColor: '#4ade80', borderRadius: '50%' }}></div>
              AI Assistant · Online
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X size={20} />
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          color: '#ef4444',
          padding: '10px 16px',
          fontSize: '0.85rem',
          borderBottom: '1px solid #fee2e2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14}/></button>
        </div>
      )}

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        backgroundColor: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
              width: '100%',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <div style={{
                display: 'flex',
                gap: '8px',
                maxWidth: '85%',
                flexDirection: isUser ? 'row-reverse' : 'row'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: isUser ? '#dbeafe' : 'var(--border)',
                  color: isUser ? '#2563eb' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '4px'
                }}>
                  {isUser ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                <div style={{
                  backgroundColor: isUser ? '#2563eb' : '#ffffff',
                  color: isUser ? '#ffffff' : '#1e293b',
                  padding: '12px 16px',
                  borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  border: isUser ? 'none' : '1px solid var(--border)',
                  fontSize: '0.95rem',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.isLoading && !msg.content ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                      Thinking...
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
              <span style={{
                fontSize: '0.7rem',
                color: '#94a3b8',
                marginTop: '4px',
                padding: isUser ? '0 36px 0 0' : '0 0 0 36px'
              }}>
                {formatTime(msg.timestamp)}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '16px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid var(--border)'
      }}>
        <form onSubmit={handleSendMessage} style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me anything about CheckIn Care..."
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '24px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              fontSize: '0.95rem',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#2563eb'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: !inputValue.trim() || loading ? 'var(--border)' : '#2563eb',
              color: !inputValue.trim() || loading ? '#94a3b8' : 'white',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !inputValue.trim() || loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s, transform 0.1s',
            }}
            onMouseDown={(e) => { if (inputValue.trim() && !loading) e.currentTarget.style.transform = 'scale(0.95)' }}
            onMouseUp={(e) => { if (inputValue.trim() && !loading) e.currentTarget.style.transform = 'scale(1)' }}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {loading ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={20} style={{ marginLeft: '2px' }} />}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* Mobile overrides */
        @media (max-width: 480px) {
          div[style*="width: 100%; maxWidth: 380px"] {
            bottom: 0 !important;
            right: 0 !important;
            max-width: 100% !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
          }
          div[style*="borderTopLeftRadius: 16px"] {
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
