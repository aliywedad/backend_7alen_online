import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

const router = Router();

export type CallStatus = 'RINGING' | 'ACTIVE' | 'ENDED';

interface CallSession {
  id: string;
  channelName: string;
  customerId: string;
  customerName: string;
  status: CallStatus;
  startedAt: string;
}

const activeCalls = new Map<string, CallSession>();

function buildToken(channelName: string, uid: number): string | null {
  const appId   = process.env.AGORA_APP_ID;
  const appCert = process.env.AGORA_APP_CERTIFICATE;
  if (!appId || !appCert || appCert === 'your_app_certificate_here') return null;
  try {
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    return RtcTokenBuilder.buildTokenWithUid(appId, appCert, channelName, uid, RtcRole.PUBLISHER, expiry, expiry);
  } catch {
    return null;
  }
}

// ── Token endpoint (called by both mobile and web before joining) ─────────────
router.get('/token', authenticate, (req: Request, res: Response) => {
  const { channel, uid } = req.query as { channel?: string; uid?: string };
  if (!channel) return res.status(400).json({ error: 'channel is required' });
  const token = buildToken(channel, Number(uid ?? 0));
  // token is null when App Certificate is not configured → pass null to Agora (test mode)
  res.json({ token });
});

// ── Customer: start a call ────────────────────────────────────────────────────
router.post('/ring', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  const callId = uuidv4();
  const channelName = `support-${callId.slice(0, 8)}`;

  const session: CallSession = {
    id: callId,
    channelName,
    customerId: user.id,
    customerName: user.name ?? 'Customer',
    status: 'RINGING',
    startedAt: new Date().toISOString(),
  };

  activeCalls.set(callId, session);

  const token = buildToken(channelName, 0);
  res.json({ callId, channelName, token });
});

// ── Customer: poll their own call status ──────────────────────────────────────
router.get('/:id/status', authenticate, (req: Request, res: Response) => {
  const call = activeCalls.get(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found or ended' });
  res.json(call);
});

// ── Admin: list active / ringing calls ────────────────────────────────────────
router.get('/active', authenticate, requireRole('ADMIN', 'SUPERADMIN'), (_req, res: Response) => {
  const calls = [...activeCalls.values()];
  res.json({ calls });
});

// ── Admin: accept a call (also gets a fresh token) ───────────────────────────
router.post('/:id/accept', authenticate, requireRole('ADMIN', 'SUPERADMIN'), (req: Request, res: Response) => {
  const call = activeCalls.get(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  call.status = 'ACTIVE';
  const token = buildToken(call.channelName, 1); // uid 1 = admin
  res.json({ ok: true, channelName: call.channelName, token });
});

// ── Either party: end a call ──────────────────────────────────────────────────
router.post('/:id/end', authenticate, (req: Request, res: Response) => {
  const call = activeCalls.get(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  activeCalls.delete(req.params.id);
  res.json({ ok: true });
});

export default router;
