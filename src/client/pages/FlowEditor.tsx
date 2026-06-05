import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Types (mirror server/src/server/types/flow.ts v3) ───────────────────────

interface IntentDef {
  name: string;
  phrases: string[];
}

interface EntityDef {
  name: string;
  type: 'enum' | 'regex';
  values?: string[];   // for enum
  pattern?: string;    // for regex
}

interface NodeDef {
  id: string;
  label: string;
  answer?: string;
  edges: Array<{ when: string; to: string; set?: Record<string, string> }>;
  terminal?: boolean;
  // editor-only metadata (not persisted by runtime)
  position?: { x: number; y: number };
  type?: 'normal' | 'initial';  // initial is editor highlight only
}

interface FlowDefinition {
  intents: IntentDef[];
  entities?: EntityDef[];
  nodes: NodeDef[];
  initial_hint?: string;
  ttl_minutes?: number;
}

interface Flow {
  id: number;
  name: string;
  description: string;
  definition: FlowDefinition;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Canvas Component ────────────────────────────────────────────────────────

interface CanvasProps {
  nodes: NodeDef[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onConnect: (from: string, to: string) => void;
  connectingFrom: string | null;
}

const Canvas: React.FC<CanvasProps> = ({
  nodes,
  selectedId,
  onSelect,
  onMoveNode,
  onConnect,
  connectingFrom,
}) => {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [tempEdge, setTempEdge] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const NODE_W = 160;
  const NODE_H = 60;

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDragging(nodeId);
    setDragOffset({ x: e.clientX - (node.position?.x || 0), y: e.clientY - (node.position?.y || 0) });
    onSelect(nodeId);
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - dragOffset.x;
        const y = e.clientY - rect.top - dragOffset.y;
        onMoveNode(dragging, Math.max(0, x), Math.max(0, y));
      }
      if (connectingFrom && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setTempEdge({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    },
    [dragging, dragOffset, connectingFrom, onMoveNode]
  );

  const handleMouseUp = () => {
    setDragging(null);
    setTempEdge(null);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) onSelect(null);
  };

  const getNodeCenter = (node: NodeDef) => ({
    x: (node.position?.x || 0) + NODE_W / 2,
    y: (node.position?.y || 0) + NODE_H / 2,
  });

  return (
    <svg
      ref={svgRef}
      className="flow-canvas"
      style={{
        width: '100%',
        height: '600px',
        background: '#1a1a2e',
        cursor: connectingFrom ? 'crosshair' : 'default',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
    >
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2a2a4a" strokeWidth="0.5" />
        </pattern>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#4a9eff" />
        </marker>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Edges (flattened from every node's edges[]) */}
      {nodes.flatMap((node) =>
        node.edges.map((edge, i) => {
          const toNode = nodes.find(n => n.id === edge.to);
          if (!toNode) return null;
          const f = getNodeCenter(node);
          const t = getNodeCenter(toNode);
          const dx = t.x - f.x;
          const dy = t.y - f.y;
          const mx = (f.x + t.x) / 2;
          const my = (f.y + t.y) / 2;
          const curve = Math.min(Math.abs(dx) * 0.3, 80);
          const labelOffset = Math.abs(dy) > 30 ? -10 : 20;
          const key = `${node.id}__${i}__${edge.to}`;
          return (
            <g key={key}>
              <path
                d={`M ${f.x} ${f.y} C ${f.x + curve} ${f.y}, ${t.x - curve} ${t.y}, ${t.x} ${t.y}`}
                fill="none"
                stroke="#4a9eff"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
              {edge.when && (
                <text
                  x={mx}
                  y={my + labelOffset}
                  fill="#fff"
                  fontSize="11"
                  textAnchor="middle"
                  style={{ paintOrder: 'stroke', stroke: '#1a1a2e', strokeWidth: 3 }}
                >
                  {edge.when}
                </text>
              )}
            </g>
          );
        })
      )}

      {/* Temporary edge while connecting */}
      {connectingFrom && tempEdge && (() => {
        const from = nodes.find(n => n.id === connectingFrom);
        if (!from) return null;
        const f = getNodeCenter(from);
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

      {/* Nodes */}
      {nodes.map((node) => {
        const isSelected = selectedId === node.id;
        const isFallback = node.id === 'fallback';
        const isInitial = node.type === 'initial';
        const isTerminal = !!node.terminal;

        let borderColor = '#3a3a5a';
        let bgColor = 'rgba(74,158,255,0.05)';
        if (isFallback) {
          borderColor = '#ff4a6e';
          bgColor = 'rgba(255,74,110,0.08)';
        } else if (isInitial) {
          borderColor = '#00ff88';
          bgColor = 'rgba(0,255,136,0.1)';
        } else if (isTerminal) {
          borderColor = '#ff4a6e';
          bgColor = 'rgba(255,74,110,0.1)';
        } else if (isSelected) {
          borderColor = '#4a9eff';
        }

        return (
          <g
            key={node.id}
            transform={`translate(${node.position?.x || 0}, ${node.position?.y || 0})`}
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onDoubleClick={() => onSelect(node.id)}
          >
            <rect
              width={NODE_W}
              height={NODE_H}
              rx="8"
              fill={bgColor}
              stroke={borderColor}
              strokeWidth={isSelected ? 2 : 1}
              strokeDasharray={isFallback ? '4 4' : undefined}
            />
            {isInitial && <circle cx="12" cy={NODE_H / 2} r="6" fill="#00ff88" />}
            {isTerminal && <rect x="4" y={NODE_H / 2 - 8} width="16" height="16" rx="4" fill="#ff4a6e" />}
            <text
              x={NODE_W / 2}
              y={NODE_H / 2 - 6}
              fill="#fff"
              fontSize="13"
              textAnchor="middle"
              fontWeight="bold"
            >
              {node.label.length > 22 ? node.label.slice(0, 22) + '…' : node.label}
            </text>
            <text x={NODE_W / 2} y={NODE_H / 2 + 12} fill="#888" fontSize="10" textAnchor="middle">
              {isFallback ? '⚠️ Nó reservado' : node.answer ? node.answer.slice(0, 22) + (node.answer.length > 22 ? '…' : '') : 'sem answer'}
            </text>
            {/* Connection handle */}
            <circle
              cx={NODE_W}
              cy={NODE_H / 2}
              r="6"
              fill="#4a9eff"
              opacity="0.7"
              style={{ cursor: 'crosshair' }}
              onMouseDown={(e) => { e.stopPropagation(); onConnect(node.id, ''); }}
            />
          </g>
        );
      })}
    </svg>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function FlowEditor() {
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [currentFlow, setCurrentFlow] = useState<Flow | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'flows' | 'editor'>('flows');

  // ─── Data loading ─────────────────────────────────────────────────────────

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
      const flow: Flow = data.flow;
      // Ensure nodes have positions (defensive)
      const def = flow.definition || { intents: [], nodes: [] };
      if (!def.nodes) def.nodes = [];
      if (!def.intents) def.intents = [];
      def.nodes = def.nodes.map((n, i) => ({
        ...n,
        position: n.position || {
          x: 80 + (i % 4) * 220,
          y: 80 + Math.floor(i / 4) * 140,
        },
      }));
      // Ensure fallback node exists and is visible
      if (!def.nodes.find(n => n.id === 'fallback')) {
        def.nodes.push({
          id: 'fallback',
          label: 'Fallback',
          answer: 'Desculpe, não entendi. Pode reformular?',
          edges: [],
          terminal: false,
          position: { x: 500, y: 400 },
        });
      }
      setCurrentFlow({ ...flow, definition: def });
      setActiveTab('editor');
      setSelectedNodeId(null);
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

  const deleteFlow = async (flowId: number) => {
    if (!confirm('Remover este flow?')) return;
    try {
      await fetch(`/api/flows/${flowId}`, { method: 'DELETE' });
      if (currentFlow?.id === flowId) {
        setCurrentFlow(null);
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

  // ─── Definition mutations ────────────────────────────────────────────────

  const getDef = (): FlowDefinition | null => {
    return currentFlow ? currentFlow.definition : null;
  };

  const setDef = (newDef: FlowDefinition) => {
    if (!currentFlow) return;
    setCurrentFlow({ ...currentFlow, definition: newDef });
  };

  const updateNode = (id: string, updates: Partial<NodeDef>) => {
    const def = getDef();
    if (!def) return;
    const newDef = { ...def, nodes: def.nodes.map(n => (n.id === id ? { ...n, ...updates } : n)) };
    setDef(newDef);
  };

  const addNode = (kind: 'normal' | 'initial' | 'fallback' = 'normal') => {
    const def = getDef();
    if (!def) return;
    let id: string;
    let label: string;
    if (kind === 'fallback') {
      if (def.nodes.find(n => n.id === 'fallback')) {
        alert('Já existe um nó fallback.');
        return;
      }
      id = 'fallback';
      label = 'Fallback';
    } else {
      id = `node_${Date.now()}`;
      label = kind === 'initial' ? 'Início' : `Node ${def.nodes.length + 1}`;
    }
    const position = {
      x: kind === 'initial' ? 80 : kind === 'fallback' ? 500 : 300 + Math.random() * 200,
      y: kind === 'initial' ? 80 : kind === 'fallback' ? 400 : 100 + Math.random() * 300,
    };
    const newNode: NodeDef = {
      id,
      label,
      answer: kind === 'fallback' ? 'Desculpe, não entendi. Pode reformular?' : '',
      edges: [],
      type: kind === 'initial' ? 'initial' : 'normal',
      position,
    };
    // If creating an initial node, also set initial_hint
    const newDef: FlowDefinition = {
      ...def,
      nodes: [...def.nodes, newNode],
      initial_hint: kind === 'initial' ? id : def.initial_hint,
    };
    setDef(newDef);
    setSelectedNodeId(id);
  };

  const deleteNode = (id: string) => {
    const def = getDef();
    if (!def) return;
    if (id === 'fallback') {
      alert('O nó fallback é reservado e não pode ser removido.');
      return;
    }
    const newDef: FlowDefinition = {
      ...def,
      nodes: def.nodes
        .filter(n => n.id !== id)
        .map(n => ({ ...n, edges: n.edges.filter(e => e.to !== id) })),
    };
    if (newDef.initial_hint === id) newDef.initial_hint = undefined;
    setDef(newDef);
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleMoveNode = (id: string, x: number, y: number) => {
    updateNode(id, { position: { x, y } });
  };

  const handleConnect = (from: string, to: string) => {
    if (!to) {
      setConnectingFrom(from);
      return;
    }
    if (connectingFrom && from !== to) {
      const def = getDef();
      if (!def) return;
      const sourceNode = def.nodes.find(n => n.id === connectingFrom);
      if (!sourceNode) return;
      if (sourceNode.edges.find(e => e.to === to)) {
        setConnectingFrom(null);
        return;
      }
      updateNode(connectingFrom, {
        edges: [...sourceNode.edges, { when: 'intent:agendar', to }],
      });
    }
    setConnectingFrom(null);
  };

  // ─── Intent mutations ────────────────────────────────────────────────────

  const addIntent = () => {
    const def = getDef();
    if (!def) return;
    setDef({ ...def, intents: [...def.intents, { name: '', phrases: [] }] });
  };

  const updateIntent = (idx: number, updated: IntentDef) => {
    const def = getDef();
    if (!def) return;
    const newIntents = [...def.intents];
    newIntents[idx] = updated;
    setDef({ ...def, intents: newIntents });
  };

  const deleteIntent = (idx: number) => {
    const def = getDef();
    if (!def) return;
    setDef({ ...def, intents: def.intents.filter((_, i) => i !== idx) });
  };

  // ─── Entity mutations ────────────────────────────────────────────────────

  const addEntity = () => {
    const def = getDef();
    if (!def) return;
    const entities = def.entities || [];
    setDef({ ...def, entities: [...entities, { name: '', type: 'enum', values: [] }] });
  };

  const updateEntity = (idx: number, updated: EntityDef) => {
    const def = getDef();
    if (!def) return;
    const entities = def.entities || [];
    const newEntities = [...entities];
    newEntities[idx] = updated;
    setDef({ ...def, entities: newEntities });
  };

  const deleteEntity = (idx: number) => {
    const def = getDef();
    if (!def) return;
    const entities = def.entities || [];
    setDef({ ...def, entities: entities.filter((_, i) => i !== idx) });
  };

  // ─── Save ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!currentFlow) return;

    // Validation 1: 'none' intent is reserved
    if (currentFlow.definition.intents.some(i => i.name.trim() === 'none')) {
      alert('Erro: "none" é um intent reservado (usado para fallback). Renomeie essa intent.');
      return;
    }

    // Validation 2: must have a fallback node
    if (!currentFlow.definition.nodes.some(n => n.id === 'fallback')) {
      alert('Erro: deve existir um nó com id "fallback" (nó reservado).');
      return;
    }

    // Validation 3: edge.to must reference existing node ids
    const nodeIds = new Set(currentFlow.definition.nodes.map(n => n.id));
    for (const node of currentFlow.definition.nodes) {
      for (const edge of node.edges) {
        if (!nodeIds.has(edge.to)) {
          alert(`Erro: o nó "${node.label}" tem uma aresta apontando para "${edge.to}", que não existe.`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/flows/${currentFlow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentFlow.name,
          description: currentFlow.description,
          definition: currentFlow.definition,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      await loadFlows();
      alert('Flow salvo com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)));
    }
    setLoading(false);
  };

  const def = getDef();
  const selectedNode = def?.nodes.find(n => n.id === selectedNodeId) || null;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className="flow-editor"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0f0f1e',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid #2a2a4a',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: '#1a1a2e',
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '6px 16px',
            background: '#3a3a5a',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          ← Voltar
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Flow Editor</h1>
        {currentFlow && (
          <>
            <input
              value={currentFlow.name}
              onChange={e => setCurrentFlow({ ...currentFlow, name: e.target.value })}
              style={{
                background: 'transparent',
                border: '1px solid #3a3a5a',
                borderRadius: 6,
                padding: '6px 12px',
                color: '#fff',
                fontSize: 16,
                width: 200,
              }}
            />
            <input
              value={currentFlow.description}
              onChange={e => setCurrentFlow({ ...currentFlow, description: e.target.value })}
              placeholder="Descrição…"
              style={{
                background: 'transparent',
                border: '1px solid #3a3a5a',
                borderRadius: 6,
                padding: '6px 12px',
                color: '#fff',
                fontSize: 13,
                width: 200,
              }}
            />
            <button
              onClick={handleSave}
              disabled={loading}
              style={{
                padding: '6px 16px',
                background: '#4a9eff',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              onClick={trainNLU}
              style={{
                padding: '6px 16px',
                background: '#00cc88',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Treinar NLU
            </button>
          </>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2a2a4a', background: '#1a1a2e' }}>
        <button
          onClick={() => setActiveTab('flows')}
          style={{
            padding: '10px 24px',
            background: 'none',
            border: 'none',
            color: activeTab === 'flows' ? '#4a9eff' : '#888',
            borderBottom: activeTab === 'flows' ? '2px solid #4a9eff' : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Flows
        </button>
        <button
          onClick={() => setActiveTab('editor')}
          disabled={!currentFlow}
          style={{
            padding: '10px 24px',
            background: 'none',
            border: 'none',
            color: activeTab === 'editor' ? '#4a9eff' : '#888',
            borderBottom: activeTab === 'editor' ? '2px solid #4a9eff' : '2px solid transparent',
            cursor: currentFlow ? 'pointer' : 'not-allowed',
            fontWeight: 600,
          }}
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
              <button
                onClick={createFlow}
                style={{
                  padding: '8px 20px',
                  background: '#4a9eff',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                + Novo Flow
              </button>
            </div>
            {flows.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>
                Nenhum flow ainda. Clique em "Novo Flow" para começar.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                {flows.map(flow => (
                  <div
                    key={flow.id}
                    style={{
                      background: '#1a1a2e',
                      border: `1px solid ${flow.is_active ? '#00cc88' : '#2a2a4a'}`,
                      borderRadius: 10,
                      padding: 20,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{flow.name}</h3>
                        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                          {flow.description || 'Sem descrição'}
                        </p>
                      </div>
                      {flow.is_active && (
                        <span
                          style={{
                            background: '#00cc8833',
                            color: '#00cc88',
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 20,
                            fontWeight: 600,
                          }}
                        >
                          Ativo
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button
                        onClick={() => selectFlow(flow.id)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          background: '#4a9eff',
                          border: 'none',
                          borderRadius: 6,
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        Editar
                      </button>
                      {!flow.is_active && (
                        <button
                          onClick={() => activateFlow(flow.id)}
                          style={{
                            flex: 1,
                            padding: '6px 0',
                            background: '#00cc8833',
                            border: 'none',
                            borderRadius: 6,
                            color: '#00cc88',
                            cursor: 'pointer',
                            fontSize: 13,
                          }}
                        >
                          Ativar
                        </button>
                      )}
                      <button
                        onClick={() => deleteFlow(flow.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#ff4a6e33',
                          border: 'none',
                          borderRadius: 6,
                          color: '#ff4a6e',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'editor' && currentFlow && def && (
          <div style={{ display: 'flex', height: 'calc(100vh - 130px)' }}>
            {/* Canvas */}
            <div style={{ flex: 1, position: 'relative' }}>
              <Canvas
                nodes={def.nodes}
                selectedId={selectedNodeId}
                onSelect={setSelectedNodeId}
                onMoveNode={handleMoveNode}
                onConnect={handleConnect}
                connectingFrom={connectingFrom}
              />

              {/* Toolbar overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <button
                  onClick={() => addNode('initial')}
                  style={{
                    padding: '8px 16px',
                    background: '#00ff8833',
                    border: '1px solid #00ff88',
                    borderRadius: 6,
                    color: '#00ff88',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  + Início
                </button>
                <button
                  onClick={() => addNode('normal')}
                  style={{
                    padding: '8px 16px',
                    background: '#4a9eff33',
                    border: '1px solid #4a9eff',
                    borderRadius: 6,
                    color: '#4a9eff',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  + Node
                </button>
                <button
                  onClick={() => addNode('fallback')}
                  disabled={!!def.nodes.find(n => n.id === 'fallback')}
                  style={{
                    padding: '8px 16px',
                    background: '#ff4a6e22',
                    border: '1px solid #ff4a6e',
                    borderRadius: 6,
                    color: '#ff4a6e',
                    cursor: def.nodes.find(n => n.id === 'fallback') ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    opacity: def.nodes.find(n => n.id === 'fallback') ? 0.5 : 1,
                  }}
                >
                  + Fallback
                </button>
              </div>

              {/* Edge label popup */}
              {connectingFrom && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#1a1a2e',
                    border: '1px solid #4a9eff',
                    borderRadius: 8,
                    padding: '12px 20px',
                    fontSize: 13,
                  }}
                >
                  Clique em outro nó para conectar —{' '}
                  <button
                    onClick={() => setConnectingFrom(null)}
                    style={{
                      color: '#4a9eff',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {def.nodes.length === 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#666',
                    fontSize: 16,
                  }}
                >
                  Use os botões acima para adicionar nós ao flow
                </div>
              )}
            </div>

            {/* Properties sidebar */}
            <div
              style={{
                width: 320,
                borderLeft: '1px solid #2a2a4a',
                background: '#1a1a2e',
                overflowY: 'auto',
                padding: 16,
              }}
            >
              <h3
                style={{
                  margin: '0 0 16px 0',
                  fontSize: 14,
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Propriedades
              </h3>
              {selectedNode ? (
                <NodeProperties
                  node={selectedNode}
                  nodes={def.nodes}
                  entities={def.entities || []}
                  onUpdate={updates => updateNode(selectedNode.id, updates)}
                  onDelete={() => deleteNode(selectedNode.id)}
                  onClose={() => setSelectedNodeId(null)}
                />
              ) : (
                <p style={{ color: '#555', fontSize: 13 }}>Clique em um nó para editar suas propriedades</p>
              )}

              {/* Intents section */}
              <div
                style={{
                  marginTop: 24,
                  borderTop: '1px solid #2a2a4a',
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: '#888',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    Intents
                  </h3>
                  <button
                    onClick={addIntent}
                    style={{
                      padding: '4px 12px',
                      background: '#4a9eff33',
                      border: '1px solid #4a9eff',
                      borderRadius: 4,
                      color: '#4a9eff',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    + Intent
                  </button>
                </div>
                {def.intents.map((intent, i) => (
                  <IntentRow
                    key={i}
                    intent={intent}
                    onUpdate={updated => updateIntent(i, updated)}
                    onDelete={() => deleteIntent(i)}
                  />
                ))}
                {def.intents.length === 0 && (
                  <p style={{ color: '#555', fontSize: 13 }}>
                    Nenhum intent. Adicione phrases que disparam intents no NLU.
                  </p>
                )}
              </div>

              {/* Entities section */}
              <div
                style={{
                  marginTop: 24,
                  borderTop: '1px solid #2a2a4a',
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: '#888',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    Entities
                  </h3>
                  <button
                    onClick={addEntity}
                    style={{
                      padding: '4px 12px',
                      background: '#4a9eff33',
                      border: '1px solid #4a9eff',
                      borderRadius: 4,
                      color: '#4a9eff',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    + Entity
                  </button>
                </div>
                {(def.entities || []).map((entity, i) => (
                  <EntityRow
                    key={i}
                    entity={entity}
                    onUpdate={updated => updateEntity(i, updated)}
                    onDelete={() => deleteEntity(i)}
                  />
                ))}
                {(def.entities || []).length === 0 && (
                  <p style={{ color: '#555', fontSize: 13 }}>
                    Nenhuma entity. Adicione entities (enum ou regex) que podem ser extraídas do texto.
                  </p>
                )}
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

// ─── Sub-components ───────────────────────────────────────────────────────────

const NodeProperties: React.FC<{
  node: NodeDef;
  nodes: NodeDef[];
  entities: EntityDef[];
  onUpdate: (updates: Partial<NodeDef>) => void;
  onDelete: () => void;
  onClose: () => void;
}> = ({ node, nodes, entities, onUpdate, onDelete }) => {
  const isFallback = node.id === 'fallback';

  const updateEdge = (idx: number, updates: Partial<NodeDef['edges'][number]>) => {
    const newEdges = [...node.edges];
    newEdges[idx] = { ...newEdges[idx], ...updates };
    onUpdate({ edges: newEdges });
  };

  const addEdge = () => {
    const firstOther = nodes.find(n => n.id !== node.id);
    onUpdate({
      edges: [
        ...node.edges,
        { when: 'intent:agendar', to: firstOther ? firstOther.id : '' },
      ],
    });
  };

  const removeEdge = (idx: number) => {
    onUpdate({ edges: node.edges.filter((_, i) => i !== idx) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {isFallback && (
        <div
          style={{
            background: 'rgba(255,74,110,0.1)',
            border: '1px solid #ff4a6e',
            borderRadius: 6,
            padding: 8,
            fontSize: 12,
            color: '#ff4a6e',
          }}
        >
          ⚠️ Nó reservado (fallback). Sempre presente no flow; usado quando o NLU classifica
          como <code>none</code> ou nenhum edge casa.
        </div>
      )}

      <div>
        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Label</label>
        <input
          value={node.label}
          onChange={e => onUpdate({ label: e.target.value })}
          disabled={isFallback}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: '#0f0f1e',
            border: '1px solid #3a3a5a',
            borderRadius: 6,
            color: '#fff',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>ID</label>
        <input
          value={node.id}
          disabled
          style={{
            width: '100%',
            padding: '8px 10px',
            background: '#0f0f1e',
            border: '1px solid #3a3a5a',
            borderRadius: 6,
            color: '#888',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Answer</label>
        <textarea
          value={node.answer || ''}
          onChange={e => onUpdate({ answer: e.target.value })}
          rows={4}
          placeholder={'Use {{contexto.variavel}} e {{entity}} para templates.'}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: '#0f0f1e',
            border: '1px solid #3a3a5a',
            borderRadius: 6,
            color: '#fff',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        />
      </div>

      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!!node.terminal}
            onChange={e => onUpdate({ terminal: e.target.checked })}
          />
          <span>Terminal (encerra a conversa)</span>
        </label>
      </div>

      {/* Edges list */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <label style={{ fontSize: 11, color: '#888' }}>Edges</label>
          <button
            onClick={addEdge}
            style={{
              padding: '3px 10px',
              background: '#4a9eff33',
              border: '1px solid #4a9eff',
              borderRadius: 4,
              color: '#4a9eff',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            + Edge
          </button>
        </div>

        {node.edges.length === 0 && (
          <p style={{ color: '#555', fontSize: 12 }}>
            Sem edges. Conecte este nó a outros via drag no canvas, ou adicione um edge aqui.
          </p>
        )}

        {node.edges.map((edge, i) => {
          let whenError: string | null = null;
          if (edge.when.startsWith('intent:')) {
            const intentName = edge.when.slice('intent:'.length);
            if (intentName === 'none') {
              whenError = null; // 'none' is allowed (reserved)
            }
          }
          return (
            <div
              key={i}
              style={{
                background: '#0f0f1e',
                border: '1px solid #2a2a4a',
                borderRadius: 6,
                padding: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                <input
                  value={edge.when}
                  onChange={e => updateEdge(i, { when: e.target.value })}
                  placeholder="intent:agendar"
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    background: '#1a1a2e',
                    border: '1px solid #3a3a5a',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={() => removeEdge(i)}
                  style={{
                    padding: '4px 8px',
                    background: 'none',
                    border: '1px solid #3a3a5a',
                    borderRadius: 4,
                    color: '#ff4a6e',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  ✕
                </button>
              </div>
              {whenError && (
                <div style={{ fontSize: 11, color: '#ff4a6e', marginBottom: 6 }}>{whenError}</div>
              )}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#888' }}>→</span>
                <select
                  value={edge.to}
                  onChange={e => updateEdge(i, { to: e.target.value })}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    background: '#1a1a2e',
                    border: '1px solid #3a3a5a',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 12,
                  }}
                >
                  <option value="">Selecione destino…</option>
                  {nodes.filter(n => n.id !== node.id).map(n => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#666', display: 'block', marginBottom: 2 }}>
                  set (opcional, JSON)
                </label>
                <textarea
                  value={
                    edge.set
                      ? Object.entries(edge.set)
                          .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
                          .join(',\n')
                      : ''
                  }
                  onChange={e => {
                    const raw = e.target.value.trim();
                    if (!raw) {
                      updateEdge(i, { set: undefined });
                      return;
                    }
                    try {
                      const parsed = JSON.parse('{' + raw + '}');
                      updateEdge(i, { set: parsed });
                    } catch {
                      // ignore parse errors until valid
                    }
                  }}
                  rows={2}
                  placeholder={'ex:\n"nome": "{{entity}}"'}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: '#1a1a2e',
                    border: '1px solid #3a3a5a',
                    borderRadius: 4,
                    color: '#fff',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                    fontSize: 11,
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* Helper: list of declared intents/entities for reference */}
        {(entities.length > 0 || node.edges.some(e => e.when.startsWith('intent:'))) && (
          <div
            style={{
              background: '#0f0f1e',
              border: '1px solid #2a2a4a',
              borderRadius: 6,
              padding: 8,
              fontSize: 11,
              color: '#888',
            }}
          >
            <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>Referência rápida:</div>
            {entities.length > 0 && (
              <div>
                <strong>entities:</strong>{' '}
                {entities.map(e => e.name).filter(Boolean).join(', ') || '—'}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onDelete}
        disabled={isFallback}
        style={{
          marginTop: 8,
          padding: '8px 0',
          background: '#ff4a6e22',
          border: '1px solid #ff4a6e',
          borderRadius: 6,
          color: '#ff4a6e',
          cursor: isFallback ? 'not-allowed' : 'pointer',
          fontSize: 13,
          opacity: isFallback ? 0.5 : 1,
        }}
      >
        {isFallback ? 'Nó reservado (não pode remover)' : 'Remover Nó'}
      </button>
    </div>
  );
};

const IntentRow: React.FC<{
  intent: IntentDef;
  onUpdate: (intent: IntentDef) => void;
  onDelete: () => void;
}> = ({ intent, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [phraseInput, setPhraseInput] = useState('');

  const addPhrase = () => {
    if (!phraseInput.trim()) return;
    onUpdate({ ...intent, phrases: [...intent.phrases, phraseInput.trim()] });
    setPhraseInput('');
  };

  const isReservedNone = intent.name.trim() === 'none';

  return (
    <div
      style={{
        background: '#0f0f1e',
        border: `1px solid ${isReservedNone ? '#ff4a6e' : '#2a2a4a'}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={intent.name}
          onChange={e => onUpdate({ ...intent, name: e.target.value })}
          placeholder="intent.name"
          style={{
            flex: 1,
            padding: '6px 10px',
            background: '#1a1a2e',
            border: '1px solid #3a3a5a',
            borderRadius: 4,
            color: '#fff',
            fontSize: 13,
          }}
        />
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: '4px 8px',
            background: 'none',
            border: '1px solid #3a3a5a',
            borderRadius: 4,
            color: '#888',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          {intent.phrases.length} phrases
        </button>
        <button
          onClick={onDelete}
          style={{
            padding: '4px 8px',
            background: 'none',
            border: 'none',
            color: '#ff4a6e',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ✕
        </button>
      </div>
      {isReservedNone && (
        <div style={{ fontSize: 11, color: '#ff4a6e', marginTop: 6 }}>
          ⚠️ "none" é reservado (fallback). Renomeie para salvar.
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={phraseInput}
              onChange={e => setPhraseInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPhrase()}
              placeholder="Nova phrase…"
              style={{
                flex: 1,
                padding: '6px 10px',
                background: '#1a1a2e',
                border: '1px solid #3a3a5a',
                borderRadius: 4,
                color: '#fff',
                fontSize: 12,
              }}
            />
            <button
              onClick={addPhrase}
              style={{
                padding: '6px 12px',
                background: '#4a9eff',
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Add
            </button>
          </div>
          {intent.phrases.map((p, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 8px',
                background: '#1a1a2e',
                borderRadius: 4,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 12, color: '#aaa' }}>{p}</span>
              <button
                onClick={() =>
                  onUpdate({ ...intent, phrases: intent.phrases.filter((_, idx) => idx !== i) })
                }
                style={{ background: 'none', border: 'none', color: '#ff4a6e', cursor: 'pointer', fontSize: 11 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EntityRow: React.FC<{
  entity: EntityDef;
  onUpdate: (entity: EntityDef) => void;
  onDelete: () => void;
}> = ({ entity, onUpdate, onDelete }) => {
  const valuesText = entity.type === 'enum' && entity.values ? entity.values.join(', ') : '';

  return (
    <div
      style={{
        background: '#0f0f1e',
        border: '1px solid #2a2a4a',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <input
          value={entity.name}
          onChange={e => onUpdate({ ...entity, name: e.target.value } as EntityDef)}
          placeholder="entity.name"
          style={{
            flex: 1,
            padding: '6px 10px',
            background: '#1a1a2e',
            border: '1px solid #3a3a5a',
            borderRadius: 4,
            color: '#fff',
            fontSize: 13,
          }}
        />
        <select
          value={entity.type}
          onChange={e =>
            onUpdate({
              name: entity.name,
              type: e.target.value as 'enum' | 'regex',
              values: e.target.value === 'enum' ? entity.values || [] : undefined,
              pattern: e.target.value === 'regex' ? entity.pattern || '' : undefined,
            } as EntityDef)
          }
          style={{
            padding: '6px 8px',
            background: '#1a1a2e',
            border: '1px solid #3a3a5a',
            borderRadius: 4,
            color: '#fff',
            fontSize: 12,
          }}
        >
          <option value="enum">enum</option>
          <option value="regex">regex</option>
        </select>
        <button
          onClick={onDelete}
          style={{
            padding: '4px 8px',
            background: 'none',
            border: 'none',
            color: '#ff4a6e',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ✕
        </button>
      </div>
      {entity.type === 'enum' ? (
        <textarea
          value={valuesText}
          onChange={e =>
            onUpdate({
              name: entity.name,
              type: 'enum',
              values: e.target.value
                .split(',')
                .map(v => v.trim())
                .filter(Boolean),
            })
          }
          rows={2}
          placeholder="valores separados por vírgula: corte, barba, escova"
          style={{
            width: '100%',
            padding: '6px 10px',
            background: '#1a1a2e',
            border: '1px solid #3a3a5a',
            borderRadius: 4,
            color: '#fff',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontSize: 12,
          }}
        />
      ) : (
        <input
          value={entity.pattern || ''}
          onChange={e => onUpdate({ name: entity.name, type: 'regex', pattern: e.target.value })}
          placeholder="regex pattern, ex: \d{11}"
          style={{
            width: '100%',
            padding: '6px 10px',
            background: '#1a1a2e',
            border: '1px solid #3a3a5a',
            borderRadius: 4,
            color: '#fff',
            boxSizing: 'border-box',
            fontSize: 12,
            fontFamily: 'monospace',
          }}
        />
      )}
    </div>
  );
};
