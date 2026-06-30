import { prisma } from './prisma';

export function logWhatsAppMessage(opts: {
  adminId?: string | null;
  recipient: string;
  content: string;
  type: 'MANUAL' | 'OTP';
  status: 'SENT' | 'FAILED';
  error?: string;
}): void {
  prisma.whatsAppMessage.create({
    data: {
      adminId:   opts.adminId ?? null,
      recipient: opts.recipient,
      content:   opts.content,
      type:      opts.type,
      status:    opts.status,
      error:     opts.error ?? null,
    },
  }).catch((err) => console.error('[whatsappLog]', err));
}
