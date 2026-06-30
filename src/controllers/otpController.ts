import { Request, Response } from 'express';
import { whatsappService } from '../lib/whatsappService';
import { logWhatsAppMessage } from '../lib/whatsappLog';

const { SMS_API_URL, SMS_VERIFY_URL, SMS_API_KEY } = process.env;

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('222')) return `+${digits}`;
  if (digits.length === 8) return `+222${digits}`;
  return `+${digits}`;
}

// In-memory OTP store used when WhatsApp delivers the code
const otpStore = new Map<string, { code: string; expires: number }>();

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(req: Request, res: Response) {
  const { phone } = req.body as { phone?: string };
  if (!phone) return res.status(400).json({ error: 'Phone is required' });

  const phoneNumber = normalizePhone(phone);

  // WhatsApp path — generate + store our own OTP and deliver via WhatsApp
  if (whatsappService.isConnected()) {
    const code = generateCode();
    otpStore.set(phoneNumber, { code, expires: Date.now() + 10 * 60 * 1000 });
    const msg =
      `🔐 *7alan* — رمز التحقق\n\n` +
      `رمزك السري هو: *${code}*\n\n` +
      `صالح لمدة ١٠ دقائق ⏱\n` +
      `لا تشاركه مع أحد 🔒`;
    try {
      await whatsappService.sendMessage(phoneNumber, msg);
      logWhatsAppMessage({ adminId: null, recipient: phoneNumber, content: msg, type: 'OTP', status: 'SENT' });
      return res.json({ ok: true, via: 'whatsapp' });
    } catch (err: any) {
      // WhatsApp send failed — fall through to SMS
      otpStore.delete(phoneNumber);
      logWhatsAppMessage({ adminId: null, recipient: phoneNumber, content: msg, type: 'OTP', status: 'FAILED', error: err.message });
      console.error('[OTP] WhatsApp send failed, falling back to SMS:', err.message);
    }
  }

  // SMS fallback
  try {
    const response = await fetch(SMS_API_URL!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SMS_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await response.json() as any;
    if (!data.success) {
      console.error('sendOtp error', data);
      return res.status(502).json({ error: 'Failed to send OTP' });
    }

    res.json({ ok: true, via: 'sms' });
  } catch (err: any) {
    console.error('sendOtp error', err.message);
    res.status(502).json({ error: 'Failed to send OTP' });
  }
}

export async function verifyOtp(req: Request, res: Response) {
  const { phone, code } = req.body as { phone?: string; code?: string };
  if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required' });

  const phoneNumber = normalizePhone(phone);
  const trimmedCode = String(code).trim();

  // Check WhatsApp-originated OTP store first
  const stored = otpStore.get(phoneNumber);
  if (stored) {
    if (Date.now() > stored.expires) {
      otpStore.delete(phoneNumber);
      return res.status(400).json({ error: 'Code expired' });
    }
    if (stored.code !== trimmedCode) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    otpStore.delete(phoneNumber);
    return res.json({ ok: true, verified: true });
  }

  // SMS verification fallback
  try {
    const response = await fetch(SMS_VERIFY_URL!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SMS_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, otp: trimmedCode }),
    });

    const data = await response.json() as any;
    if (!data.success) {
      console.error('verifyOtp failed', data);
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    res.json({ ok: true, verified: true });
  } catch (err: any) {
    console.error('verifyOtp error', err.message);
    res.status(502).json({ error: 'Verification failed' });
  }
}
