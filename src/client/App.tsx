import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import FlowEditor from './pages/FlowEditor';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import NlpQA from './pages/NlpQA';

const Home = () => (
  <div style={{
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a3e 100%)',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <div style={{ textAlign: 'center', maxWidth: 600 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px 0', background: 'linear-gradient(90deg, #4a9eff, #00cc88)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        WhatsApp Bot Builder
      </h1>
      <p style={{ fontSize: 16, color: '#888', margin: '0 0 40px 0' }}>
        FSM + NLU + Editor Visual · Construa chatbots inteligentes sem código
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'left' }}>
        <NavCard
          to="/editor"
          icon="🎨"
          title="Flow Editor"
          description="Crie e edite fluxos de conversa com editor visual drag-and-drop"
        />
        <NavCard
          to="/nlp-qa"
          icon="🤖"
          title="NLP Q&A"
          description="Perguntas e Respostas com keywords e botões Quick Reply"
        />
        <NavCard
          to="/dashboard"
          icon="📊"
          title="Dashboard"
          description="Monitore logs, sessões ativas e teste o NLU em tempo real"
        />
        <NavCard
          to="/chat"
          icon="💬"
          title="Chat Bot"
          description="Teste seu bot em tempo real via chat web"
        />
      </div>

      {process.env.NODE_ENV === 'development' && (
        <div style={{ marginTop: 40, padding: 16, background: '#1a1a2e', borderRadius: 10, border: '1px solid #2a2a4a' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Debug</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <DevButton href="/api/flows" label="GET /api/flows" />
            <DevButton href="/api/logs" label="GET /api/logs" />
            <DevButton href="/webhook/info" label="GET /webhook/info" />
            <DevButton href="/api/nlu/test?q=oi" label="GET /api/nlu/test?q=oi" />
          </div>
        </div>
      )}
    </div>
  </div>
);

const NavCard: React.FC<{ to: string; icon: string; title: string; description: string }> = ({ to, icon, title, description }) => (
  <a href={to} style={{
    display: 'block',
    background: '#1a1a2e',
    border: '1px solid #2a2a4a',
    borderRadius: 12,
    padding: 24,
    textDecoration: 'none',
    color: '#fff',
    transition: 'border-color 0.2s, transform 0.2s',
    cursor: 'pointer',
  }}
  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = '#4a9eff'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2a2a4a'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
  >
    <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
    <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700 }}>{title}</h3>
    <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.5 }}>{description}</p>
  </a>
);

const DevButton: React.FC<{ href: string; label: string }> = ({ href, label }) => (
  <a href={href} style={{
    padding: '6px 14px',
    background: '#0f0f1e',
    border: '1px solid #3a3a5a',
    borderRadius: 6,
    color: '#888',
    fontSize: 12,
    fontFamily: 'monospace',
    textDecoration: 'none',
    transition: 'border-color 0.2s',
  }}
  onMouseOver={e => (e.currentTarget as HTMLElement).style.borderColor = '#4a9eff'}
  onMouseOut={e => (e.currentTarget as HTMLElement).style.borderColor = '#3a3a5a'}
  >
    {label}
  </a>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<FlowEditor />} />
        <Route path="/nlp-qa" element={<NlpQA />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}