import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

type Flow = {
  id: number;
  name: string;
  path: string;
  description: string;
  is_active: boolean;
  default_answer: string;
  created_at: string;
};

type Answer = {
  id: number;
  flow_id: number;
  question: string;
  keywords: string[];
  answer: string;
  buttons: Array<{ label: string; value: string }>;
  is_active: boolean;
  created_at: string;
};

type MatchResult = {
  answer: Answer | null;
  matchedBy: 'keyword' | 'question' | 'default';
  score: number;
};

const API = '';

export default function NlpQA() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState<Answer | null>(null);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [flowForm, setFlowForm] = useState({ name: '', path: '', description: '', defaultAnswer: '' });
  const [answerForm, setAnswerForm] = useState({ question: '', keywords: '', answer: '', buttons: '' });
  const navigate = useNavigate();

  const loadFlows = useCallback(async () => {
    const r = await fetch(`${API}/api/nlp/flows`);
    const d = await r.json();
    setFlows(d.flows || []);
    if (d.flows?.length && !selectedFlow) setSelectedFlow(d.flows[0]);
  }, []);

  const loadAnswers = useCallback(async (flowId: number) => {
    const r = await fetch(`${API}/api/nlp/flows/${flowId}/answers`);
    const d = await r.json();
    setAnswers(d.answers || []);
  }, []);

  useEffect(() => { loadFlows(); }, []);

  useEffect(() => {
    if (selectedFlow) loadAnswers(selectedFlow.id);
  }, [selectedFlow, loadAnswers]);

  async function activateFlow(id: number) {
    await fetch(`${API}/api/nlp/flows/${id}/activate`, { method: 'POST' });
    loadFlows();
  }

  async function deleteFlow(id: number) {
    if (!confirm('Remover flow e todas as respostas?')) return;
    await fetch(`${API}/api/nlp/flows/${id}`, { method: 'DELETE' });
    setSelectedFlow(null);
    loadFlows();
  }

  async function saveFlow() {
    setLoading(true);
    try {
      if (editingAnswer) {
        // Editing flow
        await fetch(`${API}/api/nlp/flows/${editingAnswer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flowForm),
        });
      } else {
        await fetch(`${API}/api/nlp/flows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flowForm),
        });
      }
      setShowFlowModal(false);
      setFlowForm({ name: '', path: '', description: '', defaultAnswer: '' });
      loadFlows();
    } finally {
      setLoading(false);
    }
  }

  async function saveAnswer() {
    if (!selectedFlow) return;
    setLoading(true);
    try {
      const keywords = answerForm.keywords.split(',').map(k => k.trim()).filter(Boolean);
      const buttons: Array<{ label: string; value: string }> = [];
      if (answerForm.buttons.trim()) {
        try { buttons.push(...JSON.parse(answerForm.buttons)); } catch { /* ignore */ }
      }

      if (editingAnswer && editingAnswer.id) {
        await fetch(`${API}/api/nlp/answers/${editingAnswer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...answerForm, keywords, buttons }),
        });
      } else {
        await fetch(`${API}/api/nlp/flows/${selectedFlow.id}/answers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: answerForm.question, keywords, answer: answerForm.answer, buttons }),
        });
      }
      setShowAnswerModal(false);
      setEditingAnswer(null);
      setAnswerForm({ question: '', keywords: '', answer: '', buttons: '' });
      loadAnswers(selectedFlow.id);
    } finally {
      setLoading(false);
    }
  }

  async function deleteAnswer(id: number) {
    if (!confirm('Remover resposta?')) return;
    await fetch(`${API}/api/nlp/answers/${id}`, { method: 'DELETE' });
    if (selectedFlow) loadAnswers(selectedFlow.id);
  }

  async function runTest() {
    if (!testQuery.trim() || !selectedFlow) return;
    const r = await fetch(`${API}/api/nlp/flows/${selectedFlow.id}/test?q=${encodeURIComponent(testQuery)}`);
    const d = await r.json();
    setTestResult(d);
  }

  function openEditFlow(flow: Flow) {
    setFlowForm({ name: flow.name, path: flow.path, description: flow.description || '', defaultAnswer: flow.default_answer || '' });
    setEditingAnswer(flow as any);
    setShowFlowModal(true);
  }

  function openNewFlow() {
    setFlowForm({ name: '', path: '', description: '', defaultAnswer: '' });
    setEditingAnswer(null);
    setShowFlowModal(true);
  }

  function openNewAnswer() {
    setAnswerForm({ question: '', keywords: '', answer: '', buttons: '' });
    setEditingAnswer(null);
    setShowAnswerModal(true);
  }

  function openEditAnswer(ans: Answer) {
    setAnswerForm({
      question: ans.question,
      keywords: ans.keywords.join(', '),
      answer: ans.answer,
      buttons: JSON.stringify(ans.buttons),
    });
    setEditingAnswer(ans);
    setShowAnswerModal(true);
  }

  const S = {
    page: { minHeight: '100vh', background: '#0f0f1e', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: '24px' },
    header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, borderBottom: '1px solid #2a2a4a', paddingBottom: 16 },
    title: { fontSize: 24, fontWeight: 800, margin: 0, background: 'linear-gradient(90deg, #4a9eff, #00cc88)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    badge: (active: boolean) => ({ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: active ? '#00cc88' : '#444', color: '#fff', textTransform: 'uppercase' as const }),
    grid: { display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: 20, alignItems: 'start' },
    panel: { background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 16 },
    btn: (primary?: boolean) => ({
      padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
      background: primary ? '#4a9eff' : '#2a2a4a', color: '#fff',
    }),
    input: { width: '100%', padding: '8px 12px', background: '#0f0f1e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#fff', fontSize: 14, boxSizing: 'border-box' as const },
    label: { display: 'block', fontSize: 12, color: '#888', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 1 },
    row: { display: 'flex', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #2a2a4a' },
    card: (selected?: boolean) => ({
      padding: '12px', borderRadius: 8, border: `1px solid ${selected ? '#4a9eff' : '#2a2a4a'}`,
      background: selected ? '#1a2a4a' : '#1a1a2e', cursor: 'pointer', marginBottom: 8,
    }),
    tag: { display: 'inline-block', padding: '2px 6px', background: '#2a2a4a', borderRadius: 4, fontSize: 11, color: '#aaa', marginRight: 4 },
    answerCard: { padding: '12px', border: '1px solid #2a2a4a', borderRadius: 8, marginBottom: 8, background: '#1a1a2e' },
    modal: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modalContent: { background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 16, padding: 24, width: 520, maxHeight: '80vh', overflowY: 'auto' as const },
    testBox: { padding: 12, background: '#0f0f1e', border: '1px solid #2a2a4a', borderRadius: 8, marginTop: 12 },
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>🤖 NLP Q&A</h1>
        <button style={S.btn()} onClick={() => navigate('/')}>← Home</button>
        <button style={S.btn(true)} onClick={openNewFlow}>+ Novo Flow</button>
      </div>

      {/* Flow selector */}
      <div style={S.grid}>
        {/* Flows list */}
        <div style={S.panel}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Flows</h3>
          {flows.map(f => (
            <div key={f.id} style={S.card(selectedFlow?.id === f.id)} onClick={() => setSelectedFlow(f)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 14 }}>{f.name}</strong>
                <span style={S.badge(f.is_active)}>{f.is_active ? 'ON' : 'OFF'}</span>
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>/{f.path}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 11 }} onClick={e => { e.stopPropagation(); openEditFlow(f); }}>Editar</button>
                {!f.is_active && <button style={{ ...S.btn(true), padding: '4px 10px', fontSize: 11 }} onClick={e => { e.stopPropagation(); activateFlow(f.id); }}>Ativar</button>}
                <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 11, background: '#3a2a2a' }} onClick={e => { e.stopPropagation(); deleteFlow(f.id); }}>X</button>
              </div>
            </div>
          ))}
          {flows.length === 0 && <p style={{ fontSize: 13, color: '#666', textAlign: 'center', margin: '20px 0' }}>Nenhum flow. Crie o primeiro!</p>}
        </div>

        {/* Answers list */}
        <div style={S.panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
              Respostas {selectedFlow ? `— ${selectedFlow.name}` : ''}
            </h3>
            {selectedFlow && (
              <button style={S.btn(true)} onClick={openNewAnswer}>+ Resposta</button>
            )}
          </div>

          {!selectedFlow && (
            <p style={{ fontSize: 13, color: '#666', textAlign: 'center', margin: '40px 0' }}>Selecione um flow para ver respostas</p>
          )}

          {answers.map(ans => (
            <div key={ans.id} style={S.answerCard}>
              <div style={{ marginBottom: 6 }}>
                <strong style={{ fontSize: 13, color: '#4a9eff' }}>{ans.question || '(sem pergunta)'}</strong>
                <span style={S.badge(ans.is_active) as React.CSSProperties}>{ans.is_active ? 'ativa' : 'inativa'}</span>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
                Keywords: {ans.keywords.map(k => <span key={k} style={S.tag}>{k}</span>)}
              </div>
              <div style={{ fontSize: 13, color: '#ccc', marginBottom: ans.buttons?.length ? 8 : 0 }}>
                → {ans.answer.substring(0, 100)}{ans.answer.length > 100 ? '...' : ''}
              </div>
              {ans.buttons?.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  {ans.buttons.map((b, i) => (
                    <span key={i} style={{ padding: '2px 8px', background: '#2a2a4a', borderRadius: 4, fontSize: 11, color: '#aaa' }}>{b.label}</span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 11 }} onClick={() => openEditAnswer(ans)}>Editar</button>
                <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 11, background: '#3a2a2a' }} onClick={() => deleteAnswer(ans.id)}>X</button>
              </div>
            </div>
          ))}

          {selectedFlow && answers.length === 0 && (
            <p style={{ fontSize: 13, color: '#666', textAlign: 'center', margin: '30px 0' }}>Nenhuma resposta. Crie a primeira!</p>
          )}
        </div>

        {/* Test panel */}
        <div style={S.panel}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Testar</h3>
          <input
            style={S.input}
            placeholder="Digite uma mensagem..."
            value={testQuery}
            onChange={e => setTestQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runTest()}
          />
          <button style={{ ...S.btn(true), width: '100%', marginTop: 8 }} onClick={runTest}>Testar</button>

          {testResult && (
            <div style={S.testBox}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
                matchedBy: <strong style={{ color: testResult.matchedBy === 'default' ? '#ff6b6b' : '#00cc88' }}>{testResult.matchedBy}</strong>
                {' '}score: <strong>{testResult.score.toFixed(2)}</strong>
              </div>
              <div style={{ fontSize: 13, color: '#4a9eff', marginBottom: 6 }}>→ {testResult.answer?.answer}</div>
              {testResult.answer?.buttons?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Botões:</div>
                  {testResult.answer.buttons.map((b, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#aaa', padding: '2px 0' }}>• {b.label}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedFlow && (
            <div style={{ marginTop: 20, padding: 12, background: '#0f0f1e', borderRadius: 8, border: '1px solid #2a2a4a' }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Webhook URL</div>
              <code style={{ fontSize: 11, color: '#4a9eff', wordBreak: 'break-all' }}>
                /{selectedFlow.path}/webhook
              </code>
              <div style={{ fontSize: 11, color: '#666', marginTop: 8, marginBottom: 4 }}>Default answer</div>
              <div style={{ fontSize: 12, color: '#888' }}>{selectedFlow.default_answer}</div>
            </div>
          )}
        </div>
      </div>

      {/* Flow Modal */}
      {showFlowModal && (
        <div style={S.modal} onClick={() => setShowFlowModal(false)}>
          <div style={S.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: 18 }}>{editingAnswer ? 'Editar Flow' : 'Novo Flow'}</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Nome</label>
              <input style={S.input} value={flowForm.name} onChange={e => setFlowForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Atendimento" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Path (URL)</label>
              <input style={S.input} value={flowForm.path} onChange={e => setFlowForm(f => ({ ...f, path: e.target.value.replace(/\s/g, '-').toLowerCase() }))} placeholder="Ex: atendimento" />
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>URL: /{flowForm.path}/webhook</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Descrição</label>
              <input style={S.input} value={flowForm.description} onChange={e => setFlowForm(f => ({ ...f, description: e.target.value }))} placeholder="Opcional" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Resposta padrão (fallback)</label>
              <input style={S.input} value={flowForm.defaultAnswer} onChange={e => setFlowForm(f => ({ ...f, defaultAnswer: e.target.value }))} placeholder="Desculpe, não entendi..." />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={S.btn()} onClick={() => setShowFlowModal(false)}>Cancelar</button>
              <button style={S.btn(true)} onClick={saveFlow} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Answer Modal */}
      {showAnswerModal && (
        <div style={S.modal} onClick={() => setShowAnswerModal(false)}>
          <div style={S.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: 18 }}>{editingAnswer ? 'Editar Resposta' : 'Nova Resposta'}</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Pergunta (ex: o que você oferece?)</label>
              <input style={S.input} value={answerForm.question} onChange={e => setAnswerForm(f => ({ ...f, question: e.target.value }))} placeholder="Ex: Que serviços você tem?" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Keywords (separadas por vírgula)</label>
              <input style={S.input} value={answerForm.keywords} onChange={e => setAnswerForm(f => ({ ...f, keywords: e.target.value }))} placeholder="Ex: serviço, oferta, produto" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Resposta</label>
              <textarea style={{ ...S.input, height: 80, resize: 'vertical' }} value={answerForm.answer} onChange={e => setAnswerForm(f => ({ ...f, answer: e.target.value }))} placeholder="Resposta que o bot vai enviar..." />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Botões (JSON array — opcional)</label>
              <input style={S.input} value={answerForm.buttons} onChange={e => setAnswerForm(f => ({ ...f, buttons: e.target.value }))} placeholder='[{"label":"Sim","value":"sim"},{"label":"Não","value":"nao"}]' />
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Máx 3 botões Quick Reply</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={S.btn()} onClick={() => setShowAnswerModal(false)}>Cancelar</button>
              <button style={S.btn(true)} onClick={saveAnswer} disabled={loading || !answerForm.answer}>{loading ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
