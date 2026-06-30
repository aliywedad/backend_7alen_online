import { prisma } from './prisma';

export function logAction(
  adminId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ADJUST',
  page: string,
  opts?: {
    resourceId?: string;
    resourceName?: string;
    details?: Record<string, unknown>;
  },
): void {
  // Fire-and-forget — never blocks the response, never throws
  prisma.auditLog.create({
    data: {
      adminId,
      action,
      page,
      resourceId:   opts?.resourceId   ?? null,
      resourceName: opts?.resourceName ?? null,
      details:      opts?.details ? JSON.stringify(opts.details) : null,
    },
  }).catch((err) => console.error('audit log error', err));
}
