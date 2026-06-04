import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface State {
  id: string;
  label: string;
  type: 'normal' | 'initial' | 'final';
  position: { x: number; y: number };
  action?: { type: 'send' | 'goto' | 'end'; text?: string; nextState?: string };
  intent?: string;
  answer?: string;
}

interface Edge {
  id: string;
  from: string;
  to: string;
  label?: string;
  intent?: string;
}

interface Flow {
  id: number;
  name: string;
  description: string;
  definition: {
    intents?: Array<{ name: string; phrases: string[]; answer?: string }>;
  };
  states: State[];
  edges: Edge[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Flow Editor Component ─────────────────────────────────────────────────────

interface CanvasProps {
  states: State[];
  edges: Edge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMoveState: (id: string, x: number, y: number) => void;
  onConnect: (from: string, to: string) => void;
  connectingFrom: string | null;
}

const Canvas: React.FC<CanvasProps> = ({ states, edges, selectedId, onSelect, onMoveState, onConnect, connectingFrom }) => {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [tempEdge, setTempEdge] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const STATE_W = 160;
  const STATE_H = 60;

  const handleMouseDown = (e: React.MouseEvent, stateId: string) => {
    e.stopPropagation();
    const state = states.find(s => s.id === stateId);
    if (!state) return;
    setDragging(stateId);
    setDragOffset({ x: e.clientX - state.position.x, y: e.clientY - state.position.y });
    onSelect(stateId);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;
      onMoveState(dragging, Math.max(0, x), Math.max(0, y));
    }
    if (connectingFrom && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setTempEdge({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, [dragging, dragOffset, connectingFrom, onMoveState]);

  const handleMouseUp = () => {
    setDragging(null);
    setTempEdge(null);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) onSelect(null);
  };

  const getStateCenter = (state: State) => ({
    x: state.position.x + STATE_W / 2,
    y: state.position.y + STATE_H / 2,
  });

  return (
    <svg
      ref={svgRef}
      className="flow-canvas"
      style={{ width: '100%', height: '600px', background: '#1a1a2e', cursor: connectingFrom ? 'crosshair' : 'default' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
    >
      {/* Grid pattern */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2a2a4a" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Edges */}
      {edges.map(edge => {
        const fromState = states.find(s => s.id === edge.from);
        const toState = states.find(s => s.id === edge.to);
        if (!fromState || !toState) return null;
        const f = getStateCenter(fromState);
        const t = getStateCenter(toState);
        const dx = t.x - f.x;
        const dy = t.y - f.y;
        const mx = (f.x + t.x) / 2;
        const my = (f.y + t.y) / 2;
        const curve = Math.min(Math.abs(dx) * 0.3, 80);
        const labelOffset = Math.abs(dy) > 30 ? -10 : 20;

        return (
          <g key={edge.id}>
            <path
              d={`M ${f.x} ${f.y} C ${f.x + curve} ${f.y}, ${t.x - curve} ${t.y}, ${t.x} ${t.y}`}
              fill="none"
              stroke="#4a9eff"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
            {edge.label && (
              <text x={mx} y={my + labelOffset} fill="#fff" fontSize="12" textAnchor="middle">{edge.label}</text>
            )}
          </g>
        );
      })}

      {/* Temporary edge while connecting */}
      {connectingFrom && tempEdge && (() => {
        const from = states.find(s => s.id === connectingFrom);
        if (!from) return null;
        const f = getStateCenter(from);
        const curve = Math.min(Math.abs(tempEdge.x - f.x) * 0.3, 80);
        return (
          <path
            d={`M ${f.x} ${f.y} C ${f.x + curve} ${f.y}, ${tempEdge.x - curve} ${tempEdge.y}, ${tempEdge.x} ${tempEdge.y}`}
            fill="none"
            stroke="#ff9f4a"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
        );
      })()}

      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#4a9eff" />
        </marker>
      </defs>

      {/* States */}
      {states.map(state => {
        const isSelected = selectedId === state.id;
        const borderColor = state.type === 'initial' ? '#00ff88' : state.type === 'final' ? '#ff4a6e' : isSelected ? '#4a9eff' : '#3a3a5a';
        const bgColor = state.type === 'initial' ? 'rgba(0,255,136,0.1)' : state.type === 'final' ? 'rgba(255,74,110,0.1)' : 'rgba(74,158,255,0.05)';

        return (
          <g
            key={state.id}
            transform={`translate(${state.position.x}, ${state.position.y})`}
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => handleMouseDown(e, state.id)}
            onDoubleClick={() => onSelect(state.id)}
          >
            <rect width={STATE_W} height={STATE_H} rx="8" fill={bgColor} stroke={borderColor} strokeWidth={isSelected ? 2 : 1} />
            {state.type === 'initial' && <circle cx="12" cy={STATE_H / 2} r="6" fill="#00ff88" />}
            {state.type === 'final' && <rect x="4" y={STATE_H / 2 - 8} width="16" height="16" rx="4" fill="#ff4a6e" />}
            <text x={STATE_W / 2} y={STATE_H / 2 - 6} fill="#fff" fontSize="13" textAnchor="middle" fontWeight="bold">{state.label}</text>
            {state.action?.type === 'send' && state.action.text && (
              <text x={STATE_W / 2} y={STATE_H / 2 + 12} fill="#888" fontSize="10" textAnchor="middle">
                {state.action.text.slice(0, 20)}{state.action.text.length > 20 ? '…' : ''}
              </text>
            )}
            {/* Connection handle */}
            <circle
              cx={STATE_W}
              cy={STATE_H / 2}
              r="6"
              fill="#4a9eff"
              opacity="0.7"
              style={{ cursor: 'crosshair' }}
              onMouseDown={(e) => { e.stopPropagation(); onConnect(state.id, ''); }}
            />
          </g>
        );
      })}
    </svg>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function FlowEditor() {
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [currentFlow, setCurrentFlow] = useState<Flow | null>(null);
  const [states, setStates] = useState<State[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'flows' | 'editor'>('flows');
  const [editingIntent, setEditingIntent] = useState(false);
  const [intents, setIntents] = useState<Array<{ name: string; phrases: string[]; answer: string }>>([]);

  // Load flows on mount
  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    try {
      const res = await fetch('/api/flows');
      const data = await res.json();
      setFlows(data.flows || []);
    } catch (err) {
      console.error('Erro ao carregar flows:', err);
    }
  };

  const selectFlow = async (flowId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/flows/${flowId}`);
      const data = await res.json();
      const flow = data.flow;
      setCurrentFlow(flow);
      setStates(flow.states || []);
      setEdges(flow.edges || []);
      setIntents(flow.definition?.intents || []);
      setActiveTab('editor');
      setSelectedId(null);
    } catch (err) {
      console.error('Erro ao selecionar flow:', err);
    }
    setLoading(false);
  };

  const createFlow = async () => {
    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Novo Flow', description: '' }),
      });
      const data = await res.json();
      await loadFlows();
      await selectFlow(data.flow.id);
    } catch (err) {
      console.error('Erro ao criar flow:', err);
    }
  };

  const saveFlow = async () => {
    if (!currentFlow) return;
    setLoading(true);
    try {
      await fetch(`/api/flows/${currentFlow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentFlow.name,
          description: currentFlow.description,
          definition: { intents },
          states,
          edges,
        }),
      });
      await loadFlows();
    } catch (err) {
      console.error('Erro ao salvar:', err);
    }
    setLoading(false);
  };

  const deleteFlow = async (flowId: number) => {
    if (!confirm('Remover este flow?')) return;
    try {
      await fetch(`/api/flows/${flowId}`, { method: 'DELETE' });
      if (currentFlow?.id === flowId) {
        setCurrentFlow(null);
        setStates([]);
        setEdges([]);
        setActiveTab('flows');
      }
      await loadFlows();
    } catch (err) {
      console.error('Erro ao deletar:', err);
    }
  };

  const activateFlow = async (flowId: number) => {
    try {
      await fetch(`/api/flows/${flowId}/activate`, { method: 'POST' });
      await loadFlows();
    } catch (err) {
      console.error('Erro ao ativar flow:', err);
    }
  };

  const trainNLU = async () => {
    if (!currentFlow) return;
    try {
      await fetch('/api/nlu/train', { method: 'POST' });
      alert('NLU treinado com sucesso!');
    } catch (err) {
      console.error('Erro ao treinar NLU:', err);
    }
  };

  // State management
  const addState = (type: State['type'] = 'normal') => {
    const id = `state_${Date.now()}`;
    const count = states.filter(s => s.type === type).length + 1;
    const label = type === 'initial' ? 'Início' : type === 'final' ? 'Fim' : `State ${count}`;
    const newState: State = {
      id,
      label,
      type,
      position: {
        x: type === 'initial' ? 50 : type === 'final' ? 600 : 300 + Math.random() * 200,
        y: type === 'initial' ? 250 : type === 'final' ? 250 : 100 + Math.random() * 300,
      },
    };
    if (type === 'final') newState.action = { type: 'end' };
    setStates([...states, newState]);
    setSelectedId(id);
  };

  const updateState = (id: string, updates: Partial<State>) => {
    setStates(states.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteState = (id: string) => {
    setStates(states.filter(s => s.id !== id));
    setEdges(edges.filter(e => e.from !== id && e.to !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleMoveState = (id: string, x: number, y: number) => {
    updateState(id, { position: { x, y } });
  };

  const handleConnect = (from: string, to: string) => {
    if (!to) {
      // Start connecting
      setConnectingFrom(from);
      return;
    }
    if (connectingFrom && from !== to) {
      // Complete connection
      const existing = edges.find(e => e.from === connectingFrom && e.to === to);
      if (!existing) {
        setEdges([...edges, { id: `edge_${Date.now()}`, from: connectingFrom, to }]);
      }
    }
    setConnectingFrom(null);
  };

  const selectedState = states.find(s => s.id === selectedId);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flow-editor" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f1e', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #2a2a4a', display: 'flex', alignItems: 'center', gap: 16, background: '#1a1a2e' }}>
        <button onClick={() => navigate('/')} style={{ padding: '6px 16px', background: '#3a3a5a', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>← Voltar</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Flow Editor</h1>
        {currentFlow && (
          <>
            <input
              value={currentFlow.name}
              onChange={e => setCurrentFlow({ ...currentFlow, name: e.target.value })}
              style={{ background: 'transparent', border: '1px solid #3a3a5a', borderRadius: 6, padding: '6px 12px', color: '#fff', fontSize: 16, width: 200 }}
            />
            <button onClick={saveFlow} disabled={loading} style={{ padding: '6px 16px', background: '#4a9eff', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
            <button onClick={trainNLU} style={{ padding: '6px 16px', background: '#00cc88', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>Treinar NLU</button>
          </>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2a2a4a', background: '#1a1a2e' }}>
        <button
          onClick={() => setActiveTab('flows')}
          style={{ padding: '10px 24px', background: 'none', border: 'none', color: activeTab === 'flows' ? '#4a9eff' : '#888', borderBottom: activeTab === 'flows' ? '2px solid #4a9eff' : '2px solid transparent', cursor: 'pointer', fontWeight: 600 }}
        >
          Flows
        </button>
        <button
          onClick={() => setActiveTab('editor')}
          disabled={!currentFlow}
          style={{ padding: '10px 24px', background: 'none', border: 'none', color: activeTab === 'editor' ? '#4a9eff' : '#888', borderBottom: activeTab === 'editor' ? '2px solid #4a9eff' : '2px solid transparent', cursor: currentFlow ? 'pointer' : 'not-allowed', fontWeight: 600 }}
        >
          Editor {currentFlow ? `— ${currentFlow.name}` : ''}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'flows' && (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Meus Flows</h2>
              <button onClick={createFlow} style={{ padding: '8px 20px', background: '#4a9eff', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14 }}>+ Novo Flow</button>
            </div>
            {flows.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Nenhum flow ainda. Clique em "Novo Flow" para começar.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {flows.map(flow => (
                  <div key={flow.id} style={{ background: '#1a1a2e', border: `1px solid ${flow.is_active ? '#00cc88' : '#2a2a4a'}`, borderRadius: 10, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{flow.name}</h3>
                        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{flow.description || 'Sem descrição'}</p>
                      </div>
                      {flow.is_active && (
                        <span style={{ background: '#00cc8833', color: '#00cc88', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Ativo</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button onClick={() => selectFlow(flow.id)} style={{ flex: 1, padding: '6px 0', background: '#4a9eff', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 }}>Editar</button>
                      {!flow.is_active && (
                        <button onClick={() => activateFlow(flow.id)} style={{ flex: 1, padding: '6px 0', background: '#00cc8833', border: 'none', borderRadius: 6, color: '#00cc88', cursor: 'pointer', fontSize: 13 }}>Ativar</button>
                      )}
                      <button onClick={() => deleteFlow(flow.id)} style={{ padding: '6px 12px', background: '#ff4a6e33', border: 'none', borderRadius: 6, color: '#ff4a6e', cursor: 'pointer', fontSize: 13 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'editor' && currentFlow && (
          <div style={{ display: 'flex', height: 'calc(100vh - 130px)' }}>
            {/* Canvas */}
            <div style={{ flex: 1, position: 'relative' }}>
              <Canvas
                states={states}
                edges={edges}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMoveState={handleMoveState}
                onConnect={handleConnect}
                connectingFrom={connectingFrom}
              />

              {/* Toolbar overlay */}
              <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => addState('initial')} style={{ padding: '8px 16px', background: '#00ff8833', border: '1px solid #00ff88', borderRadius: 6, color: '#00ff88', cursor: 'pointer', fontSize: 13 }}>+ Início</button>
                <button onClick={() => addState('normal')} style={{ padding: '8px 16px', background: '#4a9eff33', border: '1px solid #4a9eff', borderRadius: 6, color: '#4a9eff', cursor: 'pointer', fontSize: 13 }}>+ State</button>
                <button onClick={() => addState('final')} style={{ padding: '8px 16px', background: '#ff4a6e33', border: '1px solid #ff4a6e', borderRadius: 6, color: '#ff4a6e', cursor: 'pointer', fontSize: 13 }}>+ Fim</button>
              </div>

              {/* Edge label popup */}
              {connectingFrom && (
                <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#1a1a2e', border: '1px solid #4a9eff', borderRadius: 8, padding: '12px 20px', fontSize: 13 }}>
                  Clique em outro state para conectar — <button onClick={() => setConnectingFrom(null)} style={{ color: '#4a9eff', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cancelar</button>
                </div>
              )}

              {states.length === 0 && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#666', fontSize: 16 }}>
                  Use os botões acima para adicionar states ao flow
                </div>
              )}
            </div>

            {/* Properties sidebar */}
            <div style={{ width: 300, borderLeft: '1px solid #2a2a4a', background: '#1a1a2e', overflowY: 'auto', padding: 16 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 14, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Propriedades</h3>
              {selectedState ? (
                <StateProperties
                  state={selectedState}
                  states={states}
                  onUpdate={(updates) => updateState(selectedState.id, updates)}
                  onDelete={() => deleteState(selectedState.id)}
                  onClose={() => setSelectedId(null)}
                />
              ) : (
                <p style={{ color: '#555', fontSize: 13 }}>Clique em um state para editar suas propriedades</p>
              )}

              {/* Intents section */}
              <div style={{ marginTop: 24, borderTop: '1px solid #2a2a4a', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Intents</h3>
                  <button onClick={() => setIntents([...intents, { name: '', phrases: [], answer: '' }])} style={{ padding: '4px 12px', background: '#4a9eff33', border: '1px solid #4a9eff', borderRadius: 4, color: '#4a9eff', cursor: 'pointer', fontSize: 12 }}>+ Intent</button>
                </div>
                {intents.map((intent, i) => (
                  <IntentRow key={i} intent={intent} onUpdate={(updated) => {
                    const newIntents = [...intents];
                    newIntents[i] = updated;
                    setIntents(newIntents);
                  }} onDelete={() => setIntents(intents.filter((_, idx) => idx !== i))} />
                ))}
                {intents.length === 0 && <p style={{ color: '#555', fontSize: 13 }}>Nenhum intent. Adicione phrases que disparam intents no NLU.</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .flow-editor button:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const StateProperties: React.FC<{
  state: State;
  states: State[];
  onUpdate: (updates: Partial<State>) => void;
  onDelete: () => void;
  onClose: () => void;
}> = ({ state, states, onUpdate, onDelete, onClose }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Label</label>
        <input value={state.label} onChange={e => onUpdate({ label: e.target.value })} style={{ width: '100%', padding: '8px 10px', background: '#0f0f1e', border: '1px solid #3a3a5a', borderRadius: 6, color: '#fff', boxSizing: 'border-box' }} />
      </div>

      <div>
        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Tipo</label>
        <select value={state.type} onChange={e => onUpdate({ type: e.target.value as State['type'] })} style={{ width: '100%', padding: '8px 10px', background: '#0f0f1e', border: '1px solid #3a3a5a', borderRadius: 6, color: '#fff' }}>
          <option value="normal">Normal</option>
          <option value="initial">Inicial</option>
          <option value="final">Final</option>
        </select>
      </div>

      {state.type !== 'final' && (
        <div>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Ação</label>
          <select
            value={state.action?.type || 'send'}
            onChange={e => onUpdate({ action: { type: e.target.value as 'send' | 'goto' | 'end', text: state.action?.text, nextState: state.action?.nextState } })}
            style={{ width: '100%', padding: '8px 10px', background: '#0f0f1e', border: '1px solid #3a3a5a', borderRadius: 6, color: '#fff' }}
          >
            <option value="send">Enviar Mensagem</option>
            <option value="goto">Ir para State</option>
          </select>
        </div>
      )}

      {state.action?.type === 'send' && (
        <div>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Mensagem</label>
          <textarea
            value={state.action.text || ''}
            onChange={e => onUpdate({ action: { ...state.action!, text: e.target.value } })}
            rows={3}
            style={{ width: '100%', padding: '8px 10px', background: '#0f0f1e', border: '1px solid #3a3a5a', borderRadius: 6, color: '#fff', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {state.action?.type === 'goto' && (
        <div>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Próximo State</label>
          <select
            value={state.action.nextState || ''}
            onChange={e => onUpdate({ action: { ...state.action!, nextState: e.target.value } })}
            style={{ width: '100%', padding: '8px 10px', background: '#0f0f1e', border: '1px solid #3a3a5a', borderRadius: 6, color: '#fff' }}
          >
            <option value="">Selecione…</option>
            {states.filter(s => s.id !== state.id).map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Intent (NLU match)</label>
        <input
          value={state.intent || ''}
          onChange={e => onUpdate({ intent: e.target.value })}
          placeholder="ex: greetings.hello"
          style={{ width: '100%', padding: '8px 10px', background: '#0f0f1e', border: '1px solid #3a3a5a', borderRadius: 6, color: '#fff', boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Resposta NLU</label>
        <input
          value={state.answer || ''}
          onChange={e => onUpdate({ answer: e.target.value })}
          placeholder="Resposta automática do NLU"
          style={{ width: '100%', padding: '8px 10px', background: '#0f0f1e', border: '1px solid #3a3a5a', borderRadius: 6, color: '#fff', boxSizing: 'border-box' }}
        />
      </div>

      <button onClick={onDelete} style={{ marginTop: 8, padding: '8px 0', background: '#ff4a6e22', border: '1px solid #ff4a6e', borderRadius: 6, color: '#ff4a6e', cursor: 'pointer', fontSize: 13 }}>Remover State</button>
    </div>
  );
};

const IntentRow: React.FC<{
  intent: { name: string; phrases: string[]; answer: string };
  onUpdate: (intent: { name: string; phrases: string[]; answer: string }) => void;
  onDelete: () => void;
}> = ({ intent, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [phraseInput, setPhraseInput] = useState('');

  const addPhrase = () => {
    if (!phraseInput.trim()) return;
    onUpdate({ ...intent, phrases: [...intent.phrases, phraseInput.trim()] });
    setPhraseInput('');
  };

  return (
    <div style={{ background: '#0f0f1e', border: '1px solid #2a2a4a', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={intent.name}
          onChange={e => onUpdate({ ...intent, name: e.target.value })}
          placeholder="intent.name"
          style={{ flex: 1, padding: '6px 10px', background: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 4, color: '#fff', fontSize: 13 }}
        />
        <button onClick={() => setExpanded(!expanded)} style={{ padding: '4px 8px', background: 'none', border: '1px solid #3a3a5a', borderRadius: 4, color: '#888', cursor: 'pointer', fontSize: 11 }}>
          {intent.phrases.length} phrases
        </button>
        <button onClick={onDelete} style={{ padding: '4px 8px', background: 'none', border: 'none', color: '#ff4a6e', cursor: 'pointer', fontSize: 13 }}>✕</button>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={phraseInput}
              onChange={e => setPhraseInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPhrase()}
              placeholder="Nova phrase…"
              style={{ flex: 1, padding: '6px 10px', background: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 4, color: '#fff', fontSize: 12 }}
            />
            <button onClick={addPhrase} style={{ padding: '6px 12px', background: '#4a9eff', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12 }}>Add</button>
          </div>
          {intent.phrases.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: '#1a1a2e', borderRadius: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#aaa' }}>{p}</span>
              <button onClick={() => onUpdate({ ...intent, phrases: intent.phrases.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#ff4a6e', cursor: 'pointer', fontSize: 11 }}>✕</button>
            </div>
          ))}
          <input
            value={intent.answer}
            onChange={e => onUpdate({ ...intent, answer: e.target.value })}
            placeholder="Resposta do intent…"
            style={{ width: '100%', padding: '6px 10px', background: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 4, color: '#fff', fontSize: 12, marginTop: 8, boxSizing: 'border-box' }}
          />
        </div>
      )}
    </div>
  );
};