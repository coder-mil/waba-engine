import * as express from 'express';
import apiRouter from './flowRoutes';
import webhookRouter from './webhookRoutes';
import { initNLU } from './nlu';
import { initDB } from './db';

const app = express();

app.use(express.json());
app.use(express.static('public'));
app.use('/api', apiRouter);
app.use(webhookRouter);

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