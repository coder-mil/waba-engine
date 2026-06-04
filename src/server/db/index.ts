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

  console.log('✅ Tabelas de banco criadas');
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