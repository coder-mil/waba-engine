import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface LogEntry {
  id: number;
  from_number: string;
  body: string;
  direction: 'inbound' | 'outbound';
  intent: string | null;
  state: string | null;
  score: string | null;
  timestamp: string;
}

interface Session {
  phone: string;
  flow_id: number | null;
  current_state: string | null;
  context_data: Record<string, any>;
  last_activity: string;
}

interface Flow {
  id: number;
  name: string;
  is_active: boolean;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'logs' | 'sessions' | 'flows'>('logs');
  const [filterFrom, setFilterFrom] = useState('');
  const [nluTestInput, setNluTestInput] = useState('');
  const [nluResult, setNluResult] = useState<any>(null);
  const [testingNlu, setTestingNlu] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  useEffect(() => {
    if (activeTab === 'logs' && logs.length > 0) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadLogs(), loadSessions(), loadFlows()]);
    setLoading(false);
  };

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterFrom) params.set('from', filterFrom);
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/logs/sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Erro ao carregar sessões:', err);
    }
  };

  const loadFlows = async () => {
    try {
      const res = await fetch('/api/flows');
      const data = await res.json();
      setFlows(data.flows || []);
    } catch (err) {
      console.error('Erro ao carregar flows:', err);
    }
  };

  const testNLU = async () => {
    if (!nluTestInput.trim()) return;
    setTestingNlu(true);
    try {
      const res = await fetch(`/api/nlu/test?q=${encodeURIComponent(nluTestInput)}`);
      const data = await res.json();
      setNluResult(data);
    } catch (err) {
      console.error('Erro ao testar NLU:', err);
    }
    setTestingNlu(false);
  };

  const clearLogs = async () => {
    if (!confirm('Limpar todos os logs?')) return;
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' });
      if (res.ok) setLogs([]);
    } catch (err) {
      console.error('Erro ao limpar logs:', err);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatRelative = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s atrás`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m atrás`;
    const h = Math.floor(m / 60);
    return `${h}h atrás`;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f1e', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #2a2a4a', display: 'flex', alignItems: 'center', gap: 16, background: '#1a1a2e' }}>
        <button onClick={() => navigate('/')} style={{ padding: '6px 16px', background: '#3a3a5a', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>← Voltar</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <div style={{ flex: 1 }} />
        <button onClick={() => setRefreshKey(k => k + 1)} disabled={loading} style={{ padding: '6px 16px', background: '#3a3a5a', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>
          {loading ? '⟳ Carregando…' : '⟳ Atualizar'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2a2a4a', background: '#1a1a2e', padding: '0 24px' }}>
        <button
          onClick={() => setActiveTab('logs')}
          style={{ padding: '10px 20px', background: 'none', border: 'none', color: activeTab === 'logs' ? '#4a9eff' : '#888', borderBottom: activeTab === 'logs' ? '2px solid #4a9eff' : '2px solid transparent', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
        >
          Logs de Mensagens
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          style={{ padding: '10px 20px', background: 'none', border: 'none', color: activeTab === 'sessions' ? '#4a9eff' : '#888', borderBottom: activeTab === 'sessions' ? '2px solid #4a9eff' : '2px solid transparent', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
        >
          Sessões Ativas
        </button>
        <button
          onClick={() => setActiveTab('flows')}
          style={{ padding: '10px 20px', background: 'none', border: 'none', color: activeTab === 'flows' ? '#4a9eff' : '#888', borderBottom: activeTab === 'flows' ? '2px solid #4a9eff' : '2px solid transparent', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
        >
          Flows
        </button>
      </div>

      {/* NLU Test Bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #2a2a4a', display: 'flex', gap: 12, alignItems: 'center', background: '#12122a' }}>
        <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>TESTE NLU:</span>
        <input
          value={nluTestInput}
          onChange={e => setNluTestInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && testNLU()}
          placeholder="Digite uma mensagem para testar classificação…"
          style={{ flex: 1, padding: '8px 14px', background: '#0f0f1e', border: '1px solid #3a3a5a', borderRadius: 6, color: '#fff', fontSize: 14 }}
        />
        <button onClick={testNLU} disabled={testingNlu} style={{ padding: '8px 20px', background: '#4a9eff', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14 }}>
          {testingNlu ? 'Testando…' : 'Testar'}
        </button>
        {nluResult && (
          <div style={{ background: '#1a2a1a', border: '1px solid #00cc88', borderRadius: 6, padding: '6px 14px', fontSize: 13 }}>
            <span style={{ color: '#888' }}>Intent: </span>
            <span style={{ color: '#00cc88', fontWeight: 600 }}>{nluResult.intent || 'null'}</span>
            <span style={{ color: '#888', marginLeft: 12 }}>Score: </span>
            <span style={{ color: '#4a9eff' }}>{nluResult.score?.toFixed(3) || 'null'}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {activeTab === 'logs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#888' }}>Filtrar por número:</span>
                <input
                  value={filterFrom}
                  onChange={e => setFilterFrom(e.target.value)}
                  placeholder="+55 21 99999..."
                  style={{ padding: '6px 12px', background: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 6, color: '#fff', fontSize: 13, width: 180 }}
                />
                <button onClick={() => { setRefreshKey(k => k + 1); }} style={{ padding: '6px 14px', background: '#3a3a5a', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12 }}>Aplicar</button>
              </div>
              <button onClick={clearLogs} style={{ padding: '6px 14px', background: '#ff4a6e33', border: '1px solid #ff4a6e', borderRadius: 6, color: '#ff4a6e', cursor: 'pointer', fontSize: 12 }}>Limpar Logs</button>
            </div>

            {logs.length === 0 ? (
              <p style={{ color: '#555', textAlign: 'center', padding: '40px 0' }}>Nenhuma mensagem registrada ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {logs.slice().reverse().map(log => (
                  <div key={log.id} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '10px 14px',
                    background: log.direction === 'inbound' ? '#1a1a2e' : '#1a1a2e',
                    borderLeft: `3px solid ${log.direction === 'inbound' ? '#ff9f4a' : '#4a9eff'}`,
                    borderRadius: 6,
                    marginBottom: 4,
                  }}>
                    <div style={{ minWidth: 60 }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: log.direction === 'inbound' ? '#ff9f4a22' : '#4a9eff22',
                        color: log.direction === 'inbound' ? '#ff9f4a' : '#4a9eff',
                      }}>
                        {log.direction === 'inbound' ? 'IN' : 'OUT'}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#888' }}>{log.from_number}</span>
                        {log.intent && (
                          <span style={{ fontSize: 11, color: '#00cc88', background: '#00cc8822', padding: '1px 6px', borderRadius: 4 }}>
                            {log.intent}
                          </span>
                        )}
                        {log.state && (
                          <span style={{ fontSize: 11, color: '#4a9eff', background: '#4a9eff22', padding: '1px 6px', borderRadius: 4 }}>
                            {log.state}
                          </span>
                        )}
                        {log.score && (
                          <span style={{ fontSize: 11, color: '#888' }}>{parseFloat(log.score).toFixed(2)}</span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: '#ddd' }}>{log.body}</p>
                    </div>
                    <span style={{ fontSize: 11, color: '#555', minWidth: 80, textAlign: 'right' }}>
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div>
            {sessions.length === 0 ? (
              <p style={{ color: '#555', textAlign: 'center', padding: '40px 0' }}>Nenhuma sessão ativa.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.map(session => (
                  <div key={session.phone} style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontFamily: 'monospace' }}>{session.phone}</h3>
                        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                          {session.current_state && (
                            <span style={{ color: '#4a9eff' }}>State: {session.current_state}</span>
                          )}
                          <span style={{ color: '#888' }}>Última atividade: {formatRelative(session.last_activity)}</span>
                        </div>
                        {session.context_data && Object.keys(session.context_data).length > 0 && (
                          <details style={{ marginTop: 8 }}>
                            <summary style={{ fontSize: 12, color: '#666', cursor: 'pointer' }}>Ver contexto</summary>
                            <pre style={{ fontSize: 11, color: '#555', background: '#0f0f1e', padding: 8, borderRadius: 4, overflowX: 'auto', marginTop: 4 }}>
                              {JSON.stringify(session.context_data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: '#555' }}>{formatTime(session.last_activity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'flows' && (
          <div>
            {flows.length === 0 ? (
              <p style={{ color: '#555', textAlign: 'center', padding: '40px 0' }}>Nenhum flow criado ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {flows.map(flow => (
                  <div key={flow.id} style={{ background: '#1a1a2e', border: `1px solid ${flow.is_active ? '#00cc88' : '#2a2a4a'}`, borderRadius: 8, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16 }}>{flow.name}</h3>
                        {flow.is_active && (
                          <span style={{ fontSize: 11, color: '#00cc88', background: '#00cc8833', padding: '2px 8px', borderRadius: 10, marginTop: 4, display: 'inline-block' }}>Ativo</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => navigate('/editor')} style={{ padding: '6px 14px', background: '#4a9eff', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12 }}>Editor</button>
                        <button onClick={() => navigate('/')} style={{ padding: '6px 14px', background: '#3a3a5a', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12 }}>Preview</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .dashboard button:disabled { opacity: 0.5; }
        pre { white-space: pre-wrap; word-break: break-all; }
      `}</style>
    </div>
  );
}