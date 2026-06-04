import * as React from 'react';

type Message = {
  direction: 'inbound' | 'outbound';
  body: string;
  intent?: string;
  score?: number;
  created_at: string;
};

const API = '';

export default function Chat() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Load history on mount
  React.useEffect(() => {
    fetch(`${API}/api/chat/messages`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.messages)) setMessages(data.messages);
      })
      .catch(console.error);
  }, []);

  // Auto-scroll to bottom
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setLoading(true);

    // Optimistic user message
    setMessages(prev => [...prev, {
      direction: 'inbound',
      body: userText,
      created_at: new Date().toISOString(),
    }]);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText }),
      });
      const data = await res.json();
      if (data.success && data.response) {
        setMessages(prev => [...prev, {
          direction: 'outbound',
          body: data.response,
          created_at: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    fetch(`${API}/api/chat/reset`, { method: 'DELETE' })
      .then(() => setMessages([]))
      .catch(console.error);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f1e',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: '#1a1a2e',
        borderBottom: '1px solid #2a2a4a',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>💬 Chat Bot</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#666' }}>Bot Saudacao · FSM + NLU</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleReset}
            style={{
              background: '#1a1a2e',
              border: '1px solid #2a2a4a',
              borderRadius: 8,
              color: '#888',
              fontSize: 12,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            🔄 Novo Chat
          </button>
          <a
            href="/dashboard"
            style={{
              background: '#1a1a2e',
              border: '1px solid #2a2a4a',
              borderRadius: 8,
              color: '#888',
              fontSize: 12,
              padding: '6px 14px',
              textDecoration: 'none',
            }}
          >
            ← Voltar
          </a>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#444', marginTop: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
            <p style={{ fontSize: 14 }}>Envie uma mensagem para iniciar a conversa</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} />
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#666', fontSize: 13 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#4a9eff',
              animation: 'pulse 1s infinite',
            }} />
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#4a9eff',
              animation: 'pulse 1s infinite 0.2s',
            }} />
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#4a9eff',
              animation: 'pulse 1s infinite 0.4s',
            }} />
            <span style={{ marginLeft: 6 }}>digitando...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        background: '#1a1a2e',
        borderTop: '1px solid #2a2a4a',
        padding: '16px 24px',
        display: 'flex',
        gap: 12,
        flexShrink: 0,
      }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={loading}
          style={{
            flex: 1,
            background: '#0f0f1e',
            border: '1px solid #2a2a4a',
            borderRadius: 24,
            padding: '12px 20px',
            color: '#fff',
            fontSize: 15,
            outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = '#4a9eff'}
          onBlur={e => e.target.style.borderColor = '#2a2a4a'}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          style={{
            background: '#4a9eff',
            border: 'none',
            borderRadius: '50%',
            width: 48,
            height: 48,
            color: '#fff',
            fontSize: 18,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ➤
        </button>
      </form>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function ChatBubble({ msg }: { msg: Message }) {
  const isBot = msg.direction === 'outbound';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isBot ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '70%',
        background: isBot ? '#4a9eff' : '#1a1a2e',
        border: isBot ? 'none' : '1px solid #2a2a4a',
        borderRadius: isBot ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        padding: '10px 16px',
        fontSize: 14,
        lineHeight: 1.5,
      }}>
        <div>{msg.body}</div>
        <div style={{
          fontSize: 10,
          opacity: 0.6,
          marginTop: 4,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}>
          {msg.intent && (
            <span style={{
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 4,
              padding: '1px 6px',
              fontSize: 9,
            }}>
              {msg.intent}
            </span>
          )}
          {msg.score && (
            <span>{Math.round(msg.score * 100)}%</span>
          )}
        </div>
      </div>
    </div>
  );
}
