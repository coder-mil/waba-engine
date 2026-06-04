import * as express from 'express';
import { sendReply } from './whatsappClient';

const router = express.Router();

router.get('/api/hello', (req, res) => {
    res.json('World');
});

// POST /api/send → enviar mensagem WhatsApp (auth via VERIFY_TOKEN no header)
router.post('/api/send', async (req, res) => {
    const authHeader = req.headers['x-verify-token'];
    if (authHeader !== process.env.VERIFY_TOKEN) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const { to, text } = req.body;
    if (!to || !text) {
        res.status(400).json({ error: 'Missing "to" or "text" in body' });
        return;
    }

    try {
        const result = await sendReply(to, text);
        res.json({ success: true, result });
    } catch (err: any) {
        console.error('Erro ao enviar:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;