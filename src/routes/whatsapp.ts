import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { whatsappService } from '../lib/whatsappService';
import { logWhatsAppMessage } from '../lib/whatsappLog';

const router = Router();
router.use(authenticate, requireRole('ADMIN', 'SUPERADMIN'));

// Current connection status + QR if available
router.get('/status', (_req, res: Response) => {
  res.json(whatsappService.getStatus());
});

// SSE stream — pushes status updates in real time (QR refreshes, connect, disconnect)
router.get('/stream', (req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current state immediately
  res.write(`data: ${JSON.stringify(whatsappService.getStatus())}\n\n`);

  const onUpdate = (payload: object) => {
    try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch { /* client gone */ }
  };

  whatsappService.on('update', onUpdate);

  // Keepalive ping every 25 s so proxies don't close the connection
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 25_000);

  req.on('close', () => {
    clearInterval(ping);
    whatsappService.off('update', onUpdate);
  });
});

// Start / re-connect the WhatsApp client
router.post('/connect', async (_req, res: Response) => {
  try {
    await whatsappService.initialize();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to connect' });
  }
});

// Disconnect and clear session
router.post('/logout', async (_req, res: Response) => {
  try {
    await whatsappService.logout();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to disconnect' });
  }
});

// Send a custom message (admin / notifications)
router.post('/send', async (req: AuthRequest, res: Response) => {
  const { phone, message } = req.body as { phone?: string; message?: string };
  if (!phone || !message) return res.status(400).json({ error: 'phone and message are required' });
  try {
    await whatsappService.sendMessage(phone, message);
    logWhatsAppMessage({ adminId: req.user!.id, recipient: phone, content: message, type: 'MANUAL', status: 'SENT' });
    res.json({ ok: true });
  } catch (err: any) {
    logWhatsAppMessage({ adminId: req.user!.id, recipient: phone, content: message, type: 'MANUAL', status: 'FAILED', error: err.message });
    res.status(500).json({ error: err.message ?? 'Failed to send message' });
  }
});

export default router;
