import * as express from 'express';
import * as path from 'path';
import apiRouter from './flowRoutes';
import webhookRouter from './webhookRoutes';
import chatRouter from './chatRoutes';
import nlpRouter from './nlpRoutes';
import nlpWebhookRouter from './nlpWebhook';
import { initNLU, trainFromFlow } from './nlu';
import { initDB, getActiveFlow } from './db';

const app = express();

app.use(express.json());
app.use(express.static('public'));
app.use('/api', apiRouter);
app.use(chatRouter);
app.use(webhookRouter);
app.use('/api/nlp', nlpRouter);
app.use('/', nlpWebhookRouter);

// SPA fallback — todas as rotas não-API retornam o index.html
// para que o React Router (client-side) possahandle as rotas
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const port = process.env.PORT || 3000;

async function startup() {
  try {
    await initDB();
    console.log('✅ Database initialized');
  } catch (err) {
    console.warn('⚠️ Database init failed (continuing anyway):', err);
  }

  try {
    await initNLU();
    console.log('✅ NLU initialized');
  } catch (err) {
    console.warn('⚠️ NLU init failed (continuing anyway):', err);
  }

  app.listen(port, () => console.log(`Server listening on port: ${port}`));
}

startup();