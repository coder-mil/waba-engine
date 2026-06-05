import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  buttons: Button[];
  is_active: boolean;
  created_at: string;
};

type Button = { label: string; value: string };

type MatchResult = {
  answer: Answer | null;
  matchedBy: 'keyword' | 'question' | 'default';
  score: number;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const C = {
  bg: '#0f0f1e',
  surface: '#1a1a2e',
  border: '#2a2a4a',
  primary: '#4a9eff',
  success: '#00cc88',
  danger: '#ff6b6b',
  text: '#fff',
  muted: '#666',
  label: '#888',
};

const S = {
  page: { minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif', padding: '24px' },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${C.border}` },
  title: { fontSize: 22, fontWeight: 800, margin: 0, background: `linear-gradient(90deg, ${C.primary}, ${C.success})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as React.CSSProperties,
  tabBar: { display: 'flex', gap: 4, marginBottom: 20, background: C.surface, borderRadius: 10, padding: 4 },
  tab: (active: boolean) => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
    background: active ? C.primary : 'transparent', color: active ? '#fff' : C.muted, transition: 'all 0.2s',
  }),
  panel: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 },
  panelTitle: { fontSize: 12, color: C.label, textTransform: 'uppercase' as const, letterSpacing: 1, margin: '0 0 16px 0', fontWeight: 700 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' },
  btn: (primary?: boolean, danger?: boolean) => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
    background: danger ? '#3a2020' : primary ? C.primary : '#ffffff10', color: danger ? C.danger : primary ? '#fff' : C.muted,
  }),
  btnSm: (primary?: boolean) => ({
    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
    background: primary ? C.primary : 'transparent', color: primary ? '#fff' : C.muted,
  }),
  input: { width: '100%', padding: '9px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, boxSizing: 'border-box' as const, outline: 'none' },
  inputFocus: { borderColor: C.primary },
  label: { display: 'block', fontSize: 12, color: C.label, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 },
  textarea: { width: '100%', padding: '9px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, boxSizing: 'border-box' as const, outline: 'none', resize: 'vertical' as const },
  card: (selected?: boolean) => ({
    padding: '12px 14px', borderRadius: 8, border: `1px solid ${selected ? C.primary : C.border}`,
    background: selected ? '#1a2a4a' : 'transparent', cursor: 'pointer', marginBottom: 8,
  }),
  answerCard: (active: boolean) => ({
    padding: '14px', borderRadius: 8, border: `1px solid ${active ? C.success + '44' : C.border}`,
    background: active ? '#0a2a1a' : 'transparent', marginBottom: 8, transition: 'all 0.2s',
  }),
  badge: (active: boolean) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
    background: active ? C.success + '22' : '#ffffff10', color: active ? C.success : C.muted,
    textTransform: 'uppercase' as const, letterSpacing: 1,
  }),
  tag: { display: 'inline-block', padding: '2px 7px', background: '#ffffff10', borderRadius: 4, fontSize: 11, color: C.muted, marginRight: 4, marginBottom: 4 },
  modal: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modalContent: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: 560, maxHeight: '88vh', overflowY: 'auto' as const },
  divider: { borderBottom: `1px solid ${C.border}`, margin: '16px 0' },
  webhookBox: { padding: '12px 16px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` },
  emptyState: { textAlign: 'center' as const, padding: '40px 20px', color: C.muted, fontSize: 14 },
  previewBox: { padding: '12px', background: '#0a1a2a', borderRadius: 8, border: `1px solid ${C.primary}44`, marginTop: 12 },
  testResultBox: (matchedBy: string) => ({
    padding: '12px', background: C.bg, borderRadius: 8, border: `1px solid ${matchedBy === 'default' ? C.danger + '44' : C.success + '44'}`, marginTop: 12,
  }),
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function NlpQA() {
  const navigate = useNavigate();

  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'qa' | 'settings'>('qa');

  // Flow modal
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowForm, setFlowForm] = useState({ name: '', path: '', description: '', defaultAnswer: '' });
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);

  // Answer modal
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [answerForm, setAnswerForm] = useState({ question: '', keywords: '', answer: '' });
  const [buttons, setButtons] = useState<Button[]>([]);
  const [editingAnswer, setEditingAnswer] = useState<Answer | null>(null);

  const [webhookBase, setWebhookBase] = useState('');
  const [inputFocus, setInputFocus] = useState<Record<string, boolean>>({});

  // ─── Load data ───────────────────────────────────────────────────────────────

  const loadFlows = useCallback(async () => {
    const r = await fetch(`/api/nlp/flows`);
    const d = await r.json();
    setFlows(d.flows || []);
    if (d.flows?.length && !selectedFlow) setSelectedFlow(d.flows[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAnswers = useCallback(async (flowId: number) => {
    const r = await fetch(`/api/nlp/flows/${flowId}/answers`);
    const d = await r.json();
    setAnswers(d.answers || []);
  }, []);

  useEffect(() => {
    loadFlows();
    setWebhookBase(window.location.origin);
  }, [loadFlows]);

  useEffect(() => {
    if (selectedFlow) loadAnswers(selectedFlow.id);
  }, [selectedFlow, loadAnswers]);

  // ─── Flow actions ────────────────────────────────────────────────────────────

  function openNewFlow() {
    setFlowForm({ name: '', path: '', description: '', defaultAnswer: 'Desculpe, não entendi. Pode reformular?' });
    setEditingFlow(null);
    setShowFlowModal(true);
  }

  function openEditFlow(flow: Flow) {
    setFlowForm({ name: flow.name, path: flow.path, description: flow.description || '', defaultAnswer: flow.default_answer || '' });
    setEditingFlow(flow);
    setShowFlowModal(true);
  }

  async function saveFlow() {
    setLoading(true);
    try {
      if (editingFlow) {
        await fetch(`/api/nlp/flows/${editingFlow.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flowForm),
        });
      } else {
        await fetch('/api/nlp/flows', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flowForm),
        });
      }
      setShowFlowModal(false);
      loadFlows();
    } finally {
      setLoading(false);
    }
  }

  async function activateFlow(id: number) {
    await fetch(`/api/nlp/flows/${id}/activate`, { method: 'POST' });
    loadFlows();
  }

  async function deleteFlow(id: number) {
    if (!confirm('Remover flow e todas as respostas?')) return;
    await fetch(`/api/nlp/flows/${id}`, { method: 'DELETE' });
    if (selectedFlow?.id === id) setSelectedFlow(null);
    loadFlows();
  }

  // ─── Answer actions ──────────────────────────────────────────────────────────

  function openNewAnswer() {
    setAnswerForm({ question: '', keywords: '', answer: '' });
    setButtons([]);
    setEditingAnswer(null);
    setShowAnswerModal(true);
  }

  function openEditAnswer(ans: Answer) {
    setAnswerForm({ question: ans.question, keywords: ans.keywords.join(', '), answer: ans.answer });
    setButtons(ans.buttons || []);
    setEditingAnswer(ans);
    setShowAnswerModal(true);
  }

  async function saveAnswer() {
    if (!selectedFlow) return;
    setLoading(true);
    try {
      const payload = {
        question: answerForm.question,
        keywords: answerForm.keywords.split(',').map((k: string) => k.trim()).filter(Boolean),
        answer: answerForm.answer,
        buttons,
      };
      if (editingAnswer) {
        await fetch(`/api/nlp/answers/${editingAnswer.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`/api/nlp/flows/${selectedFlow.id}/answers`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setShowAnswerModal(false);
      loadAnswers(selectedFlow.id);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAnswer(id: number, currentActive: boolean) {
    await fetch(`/api/nlp/answers/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !currentActive }),
    });
    if (selectedFlow) loadAnswers(selectedFlow.id);
  }

  async function deleteAnswer(id: number) {
    if (!confirm('Remover resposta?')) return;
    await fetch(`/api/nlp/answers/${id}`, { method: 'DELETE' });
    if (selectedFlow) loadAnswers(selectedFlow.id);
  }

  async function runTest() {
    if (!testQuery.trim() || !selectedFlow) return;
    const r = await fetch(`/api/nlp/flows/${selectedFlow.id}/test?q=${encodeURIComponent(testQuery)}`);
    const d = await r.json();
    setTestResult(d);
  }

  // ─── Buttons builder ─────────────────────────────────────────────────────────

  function addButton() {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { label: '', value: '' }]);
  }

  function updateButton(i: number, field: 'label' | 'value', val: string) {
    const updated = [...buttons];
    updated[i] = { ...updated[i], [field]: val };
    setButtons(updated);
  }

  function removeButton(i: number) {
    setButtons(buttons.filter((_, idx) => idx !== i));
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>🤖 NLP Q&amp;A</h1>
        <button style={S.btn()} onClick={() => navigate('/')}>← Home</button>
        <button style={S.btn(true)} onClick={openNewFlow}>+ Novo Flow</button>
      </div>

      {/* Flow tabs */}
      {flows.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {flows.map(f => (
            <div
              key={f.id}
              onClick={() => setSelectedFlow(f)}
              style={{
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: selectedFlow?.id === f.id ? '#1a2a4a' : C.surface,
                border: `1px solid ${selectedFlow?.id === f.id ? C.primary : C.border}`,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</span>
              {f.is_active && <span style={{ ...S.badge(true), fontSize: 9 }}>ON</span>}
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      {selectedFlow && (
        <div style={S.tabBar}>
          <button style={S.tab(tab === 'qa')} onClick={() => setTab('qa')}>Q&amp;A</button>
          <button style={S.tab(tab === 'settings')} onClick={() => setTab('settings')}>Configurações</button>
        </div>
      )}

      {/* ── Q&A Tab ── */}
      {tab === 'qa' && (
        <div style={S.grid3}>
          {/* Left: Q&A List */}
          <div>
            {/* Create answer button */}
            {selectedFlow && (
              <div style={{ marginBottom: 16 }}>
                <button style={S.btn(true)} onClick={openNewAnswer}>+ Nova Resposta</button>
              </div>
            )}

            {!selectedFlow && (
              <div style={S.panel}>
                <div style={S.emptyState}>Selecione um flow para gerenciar Q&amp;As</div>
              </div>
            )}

            {selectedFlow && answers.length === 0 && (
              <div style={S.panel}>
                <div style={S.emptyState}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                  Nenhuma resposta ainda.<br />Clique em "+ Nova Resposta" para começar.
                </div>
              </div>
            )}

            {answers.map(ans => (
              <div key={ans.id} style={S.answerCard(ans.is_active)}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: C.primary, fontWeight: 600, marginBottom: 2 }}>
                      {ans.question || <span style={{ color: C.muted, fontStyle: 'italic' }}>(sem pergunta)</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {ans.keywords.slice(0, 6).map(k => <span key={k} style={S.tag}>{k}</span>)}
                      {ans.keywords.length > 6 && <span style={{ ...S.tag, color: C.label }}>+{ans.keywords.length - 6}</span>}
                      <span style={S.badge(ans.is_active)}>{ans.is_active ? 'ativa' : 'inativa'}</span>
                    </div>
                  </div>
                  {/* Toggle + actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                    <button
                      style={S.btnSm(ans.is_active)}
                      onClick={() => toggleAnswer(ans.id, ans.is_active)}
                      title={ans.is_active ? 'Desativar' : 'Ativar'}
                    >
                      {ans.is_active ? '🔴' : '⚪'}
                    </button>
                    <button style={S.btnSm()} onClick={() => openEditAnswer(ans)}>Editar</button>
                    <button style={{ ...S.btnSm(), color: C.danger }} onClick={() => deleteAnswer(ans.id)}>✕</button>
                  </div>
                </div>

                {/* Answer preview */}
                <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5, marginBottom: ans.buttons.length ? 8 : 0 }}>
                  → {ans.answer.length > 120 ? ans.answer.substring(0, 120) + '…' : ans.answer}
                </div>

                {/* Buttons preview */}
                {ans.buttons.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ans.buttons.map((b, i) => (
                      <span key={i} style={{
                        padding: '4px 10px', background: '#ffffff10', border: `1px solid ${C.border}`,
                        borderRadius: 20, fontSize: 12, color: '#aaa',
                      }}>
                        {b.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right: Test + webhook */}
          <div>
            {/* Test panel */}
            <div style={S.panel}>
              <div style={S.panelTitle}>Testar</div>
              <input
                style={{ ...S.input, ...(inputFocus.test ? { borderColor: C.primary } : {}) }}
                placeholder="Digite uma mensagem..."
                value={testQuery}
                onChange={e => setTestQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runTest()}
                onFocus={() => setInputFocus(f => ({ ...f, test: true }))}
                onBlur={() => setInputFocus(f => ({ ...f, test: false }))}
              />
              <button style={{ ...S.btn(true), width: '100%', marginTop: 10 }} onClick={runTest}>Testar ▶</button>

              {testResult && (
                <div style={S.testResultBox(testResult.matchedBy)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: C.label }}>matchedBy</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: testResult.matchedBy === 'default' ? C.danger : C.success,
                    }}>
                      {testResult.matchedBy.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: C.label, marginBottom: 6 }}>
                    score: <strong style={{ color: '#fff' }}>{testResult.score.toFixed(2)}</strong>
                  </div>
                  <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>
                    → {testResult.answer?.answer}
                  </div>
                  {testResult.answer?.buttons && testResult.answer?.buttons.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {testResult.answer.buttons.map((b, i) => (
                        <span key={i} style={{
                          padding: '4px 10px', background: '#ffffff10', borderRadius: 20, fontSize: 12, color: '#aaa',
                        }}>
                          {b.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick test history */}
              {testQuery && (
                <div style={{ marginTop: 12 }}>
                  <button style={{ ...S.btn(), width: '100%', fontSize: 12 }} onClick={() => { setTestQuery(''); setTestResult(null); }}>
                    Limpar teste
                  </button>
                </div>
              )}
            </div>

            {/* Webhook info */}
            {selectedFlow && (
              <div style={{ ...S.panel, marginTop: 16 }}>
                <div style={S.panelTitle}>Webhook WhatsApp</div>
                <div style={S.webhookBox}>
                  <div style={{ fontSize: 11, color: C.label, marginBottom: 6 }}>URL do Webhook</div>
                  <code style={{ fontSize: 12, color: C.primary, wordBreak: 'break-all', lineHeight: 1.5 }}>
                    {webhookBase}/{selectedFlow.path}/webhook
                  </code>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                  Configure esta URL no Meta Business → Webhooks do seu WhatsApp Business.
                  O <code style={{ color: C.label }}>verify_token</code> deve ser igual à variável <code style={{ color: C.label }}>VERIFY_TOKEN</code> do seu <code style={{ color: C.label }}>.env</code>.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Settings Tab ── */}
      {tab === 'settings' && selectedFlow && (
        <div style={{ maxWidth: 600 }}>
          <div style={S.panel}>
            <div style={S.panelTitle}>Configurações do Flow</div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Nome</label>
              <input style={S.input} value={flowForm.name} onChange={e => setFlowForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Atendimento" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Path (URL)</label>
              <input style={S.input} value={flowForm.path}
                onChange={e => setFlowForm(f => ({ ...f, path: e.target.value.replace(/\s/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                placeholder="ex: atendimento"
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                URL: <code style={{ color: C.primary }}>{webhookBase}/{flowForm.path || '…'}/webhook</code>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Descrição</label>
              <input style={S.input} value={flowForm.description} onChange={e => setFlowForm(f => ({ ...f, description: e.target.value }))} placeholder="Opcional" />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Resposta padrão (fallback)</label>
              <textarea style={S.textarea} rows={3} value={flowForm.defaultAnswer}
                onChange={e => setFlowForm(f => ({ ...f, defaultAnswer: e.target.value }))}
                placeholder="Quando nenhuma resposta casar..."
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={S.btn()} onClick={() => { setTab('qa'); setFlowForm({ name: selectedFlow.name, path: selectedFlow.path, description: selectedFlow.description || '', defaultAnswer: selectedFlow.default_answer || '' }); }}>
                Cancelar
              </button>
              <button style={S.btn(true)} onClick={saveFlow} disabled={loading}>
                {loading ? 'Salvando…' : 'Salvar alterações'}
              </button>
              {!selectedFlow.is_active && (
                <button style={{ ...S.btn(true), background: C.success }} onClick={() => activateFlow(selectedFlow.id)}>
                  Ativar Flow ✓
                </button>
              )}
              <button style={{ ...S.btn(), color: C.danger, marginLeft: 'auto' }} onClick={() => deleteFlow(selectedFlow.id)}>
                Remover flow
              </button>
            </div>
          </div>

          {/* Webhook full info */}
          <div style={{ ...S.panel, marginTop: 16 }}>
            <div style={S.panelTitle}>Como configurar no Meta</div>
            <ol style={{ fontSize: 13, color: C.muted, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
              <li>Acesse <strong style={{ color: '#fff' }}>Meta Business Suite</strong> → Seu WhatsApp Business</li>
              <li>Vá em <strong style={{ color: '#fff' }}>Configurações</strong> → <strong style={{ color: '#fff' }}>Webhooks</strong></li>
              <li>Clique em <strong style={{ color: '#fff' }}>Adicionar URL de retorno de chamada</strong></li>
              <li>Digite: <code style={{ color: C.primary }}>{webhookBase}/{selectedFlow.path}/webhook</code></li>
              <li>Informe o <strong style={{ color: '#fff' }}>verify_token</strong> (same as your <code style={{ color: C.label }}>VERIFY_TOKEN</code> env var)</li>
              <li>Em "Campos de assinatura", habilite <strong style={{ color: '#fff' }}>messages</strong></li>
              <li>Salve e aguarde a verificação</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── Answer Modal ── */}
      {showAnswerModal && (
        <div style={S.modal} onClick={() => setShowAnswerModal(false)}>
          <div style={S.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700 }}>
              {editingAnswer ? 'Editar Resposta' : 'Nova Resposta'}
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Pergunta</label>
              <input
                style={{ ...S.input, ...(inputFocus.question ? { borderColor: C.primary } : {}) }}
                value={answerForm.question}
                onChange={e => setAnswerForm(f => ({ ...f, question: e.target.value }))}
                onFocus={() => setInputFocus(f => ({ ...f, question: true }))}
                onBlur={() => setInputFocus(f => ({ ...f, question: false }))}
                placeholder="Ex: Quais serviços você oferece?"
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Texto que o usuário pode enviar para acionar esta resposta</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Keywords (separadas por vírgula)</label>
              <input
                style={{ ...S.input, ...(inputFocus.keywords ? { borderColor: C.primary } : {}) }}
                value={answerForm.keywords}
                onChange={e => setAnswerForm(f => ({ ...f, keywords: e.target.value }))}
                onFocus={() => setInputFocus(f => ({ ...f, keywords: true }))}
                onBlur={() => setInputFocus(f => ({ ...f, keywords: false }))}
                placeholder="Ex: serviço, oferta, produto, valor"
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Se qualquer keyword aparecer no texto, esta resposta é priorizada</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Resposta</label>
              <textarea
                style={{ ...S.textarea, ...(inputFocus.answer ? { borderColor: C.primary } : {}) }}
                rows={4}
                value={answerForm.answer}
                onChange={e => setAnswerForm(f => ({ ...f, answer: e.target.value }))}
                onFocus={() => setInputFocus(f => ({ ...f, answer: true }))}
                onBlur={() => setInputFocus(f => ({ ...f, answer: false }))}
                placeholder="Resposta que o bot vai enviar..."
              />
            </div>

            {/* Buttons builder */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...S.label, margin: 0 }}>Botões Quick Reply</label>
                {buttons.length < 3 && (
                  <button style={S.btnSm(true)} onClick={addButton}>+ Adicionar</button>
                )}
              </div>

              {buttons.length === 0 && (
                <div style={{ fontSize: 12, color: C.muted, textAlign: 'center' as const, padding: '12px 0', background: '#ffffff05', borderRadius: 8 }}>
                  Nenhum botão. <button style={{ background: 'none', border: 'none', color: C.primary, cursor: 'pointer', fontSize: 12 }} onClick={addButton}>Adicionar botão</button>
                </div>
              )}

              {buttons.map((btn, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input
                    style={{ ...S.input, flex: 1 }}
                    value={btn.label}
                    onChange={e => updateButton(i, 'label', e.target.value)}
                    placeholder="Label (ex: Sim)"
                    maxLength={25}
                  />
                  <input
                    style={{ ...S.input, flex: 1 }}
                    value={btn.value}
                    onChange={e => updateButton(i, 'value', e.target.value)}
                    placeholder="Value (ex: sim)"
                  />
                  <button style={{ ...S.btn(), padding: '6px 10px', color: C.danger, flexShrink: 0 }} onClick={() => removeButton(i)}>✕</button>
                </div>
              ))}

              {buttons.length > 0 && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  {buttons.length}/3 botões · Máximo 25 caracteres por label
                </div>
              )}
            </div>

            {/* Preview */}
            {answerForm.answer && (
              <div style={S.previewBox}>
                <div style={{ fontSize: 11, color: C.label, marginBottom: 6 }}>Preview</div>
                <div style={{ fontSize: 13, color: '#ccc', marginBottom: buttons.length ? 8 : 0 }}>
                  {answerForm.answer.length > 100 ? answerForm.answer.substring(0, 100) + '…' : answerForm.answer}
                </div>
                {buttons.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {buttons.filter(b => b.label).map((b, i) => (
                      <span key={i} style={{
                        padding: '5px 12px', background: '#ffffff10', border: `1px solid ${C.border}`,
                        borderRadius: 20, fontSize: 12, color: '#aaa',
                      }}>
                        {b.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button style={S.btn()} onClick={() => setShowAnswerModal(false)}>Cancelar</button>
              <button style={S.btn(true)} onClick={saveAnswer} disabled={loading || !answerForm.answer}>
                {loading ? 'Salvando…' : (editingAnswer ? 'Salvar' : 'Criar Resposta')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
