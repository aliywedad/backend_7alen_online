import 'dotenv/config'; // reload
import { app } from './app';
import { prisma } from './lib/prisma';
import { whatsappService } from './lib/whatsappService';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 7alan API running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV ?? 'development'}`);

  // Auto-restore WhatsApp session if one was saved previously
  whatsappService.initialize().catch((err) =>
    console.error('[WhatsApp] Auto-connect failed:', err.message),
  );
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
