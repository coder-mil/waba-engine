import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => console.error('DB error:', err));

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flows (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT '',
      definition JSONB DEFAULT '{}',
      states JSONB DEFAULT '[]',
      edges JSONB DEFAULT '[]',
      is_active BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      activated_at TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_logs (
      id SERIAL PRIMARY KEY,
      from_number VARCHAR(20) NOT NULL,
      body TEXT NOT NULL,
      direction VARCHAR(10) NOT NULL,
      intent VARCHAR(100),
      state VARCHAR(50),
      score DECIMAL(3,2),
      timestamp TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      phone VARCHAR(50) PRIMARY KEY,
      flow_id INTEGER REFERENCES flows(id),
      current_state VARCHAR(100),
      context_data JSONB DEFAULT '{}',
      last_activity TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_logs_from ON message_logs(from_number)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON message_logs(timestamp DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON user_sessions(last_activity)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS nlp_flows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(100) UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT FALSE,
    default_answer TEXT DEFAULT 'Desculpe, não entendi. Pode reformular?',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS nlp_answers (
    id SERIAL PRIMARY KEY,
    flow_id INTEGER REFERENCES nlp_flows(id) ON DELETE CASCADE,
    question VARCHAR(500) NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    answer TEXT NOT NULL,
    buttons JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_nlp_flows_path ON nlp_flows(path)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_nlp_answers_flow ON nlp_answers(flow_id)`);

  console.log('✅ Tabelas NLP criadas');
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getActiveFlow() {
  const result = await pool.query('SELECT * FROM flows WHERE is_active = true LIMIT 1');
  return result.rows[0] || null;
}

export async function saveMessageLog(data: {
  from: string;
  body: string;
  direction: 'inbound' | 'outbound';
  intent?: string;
  state?: string;
  score?: number;
}) {
  await pool.query(
    `INSERT INTO message_logs (from_number, body, direction, intent, state, score)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [data.from, data.body, data.direction, data.intent || null, data.state || null, data.score || null]
  );
}

export async function getUserSession(phone: string) {
  const result = await pool.query('SELECT * FROM user_sessions WHERE phone = $1', [phone]);
  return result.rows[0] || null;
}

// ─── NLP Flows & Answers ─────────────────────────────────────────────────────

export async function getAllNlpFlows() {
  const result = await pool.query('SELECT * FROM nlp_flows ORDER BY created_at DESC');
  return result.rows;
}

export async function getNlpFlowById(id: number) {
  const result = await pool.query('SELECT * FROM nlp_flows WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getNlpFlowByPath(path: string) {
  const result = await pool.query('SELECT * FROM nlp_flows WHERE path = $1', [path]);
  return result.rows[0] || null;
}

export async function createNlpFlow(data: {
  name: string;
  path: string;
  description?: string;
  defaultAnswer?: string;
}) {
  const result = await pool.query(
    `INSERT INTO nlp_flows (name, path, description, default_answer)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.name, data.path, data.description || '', data.defaultAnswer || 'Desculpe, não entendi. Pode reformular?']
  );
  return result.rows[0];
}

export async function updateNlpFlow(id: number, data: {
  name?: string;
  path?: string;
  description?: string;
  defaultAnswer?: string;
}) {
  const result = await pool.query(
    `UPDATE nlp_flows SET
       name = COALESCE($1, name),
       path = COALESCE($2, path),
       description = COALESCE($3, description),
       default_answer = COALESCE($4, default_answer),
       updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [data.name, data.path, data.description, data.defaultAnswer, id]
  );
  return result.rows[0];
}

export async function deleteNlpFlow(id: number) {
  await pool.query('DELETE FROM nlp_flows WHERE id = $1', [id]);
}

export async function activateNlpFlow(id: number) {
  await pool.query('UPDATE nlp_flows SET is_active = false');
  const result = await pool.query(
    'UPDATE nlp_flows SET is_active = true WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
}

export async function getActiveNlpFlows() {
  const result = await pool.query('SELECT * FROM nlp_flows WHERE is_active = true');
  return result.rows;
}

export async function getNlpAnswersByFlow(flowId: number) {
  const result = await pool.query(
    'SELECT * FROM nlp_answers WHERE flow_id = $1 ORDER BY created_at DESC',
    [flowId]
  );
  return result.rows;
}

export async function createNlpAnswer(data: {
  flowId: number;
  question: string;
  keywords: string[];
  answer: string;
  buttons?: any[];
}) {
  const result = await pool.query(
    `INSERT INTO nlp_answers (flow_id, question, keywords, answer, buttons)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.flowId, data.question, data.keywords, JSON.stringify(data.buttons || [])]
  );
  return result.rows[0];
}

export async function updateNlpAnswer(id: number, data: {
  question?: string;
  keywords?: string[];
  answer?: string;
  buttons?: any[];
  isActive?: boolean;
}) {
  const result = await pool.query(
    `UPDATE nlp_answers SET
       question = COALESCE($1, question),
       keywords = COALESCE($2, keywords),
       answer = COALESCE($3, answer),
       buttons = COALESCE($4, buttons),
       is_active = COALESCE($5, is_active)
     WHERE id = $6 RETURNING *`,
    [data.question, data.keywords, data.answer, data.buttons ? JSON.stringify(data.buttons) : null, data.isActive, id]
  );
  return result.rows[0];
}

export async function deleteNlpAnswer(id: number) {
  await pool.query('DELETE FROM nlp_answers WHERE id = $1', [id]);
}

export async function getTrainedAnswers(flowId: number) {
  const result = await pool.query(
    'SELECT * FROM nlp_answers WHERE flow_id = $1 AND is_active = true',
    [flowId]
  );
  return result.rows;
}

export async function upsertUserSession(phone: string, data: {
  flowId?: number;
  currentState?: string;
  contextData?: Record<string, any>;
}) {
  await pool.query(
    `INSERT INTO user_sessions (phone, flow_id, current_state, context_data, last_activity)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (phone) DO UPDATE SET
       flow_id = EXCLUDED.flow_id,
       current_state = EXCLUDED.current_state,
       context_data = EXCLUDED.context_data,
       last_activity = NOW()`,
    [phone, data.flowId || null, data.currentState || null, JSON.stringify(data.contextData || {})]
  );
}