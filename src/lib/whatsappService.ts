import { Client, LocalAuth } from 'whatsapp-web.js';
import { EventEmitter } from 'events';
import qrcode from 'qrcode';

export type WhatsAppStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

interface StatusPayload {
  status: WhatsAppStatus;
  qr: string | null;   // base64 PNG data URL when CONNECTING
  phone: string | null;
}

class WhatsAppService extends EventEmitter {
  private client: Client | null = null;
  private _status: WhatsAppStatus = 'DISCONNECTED';
  private _qr: string | null = null;  // base64 PNG
  private _phone: string | null = null;

  getStatus(): StatusPayload {
    return { status: this._status, qr: this._qr, phone: this._phone };
  }

  isConnected(): boolean {
    return this._status === 'CONNECTED';
  }

  // Drops the reference immediately (so a new initialize() starts a fresh
  // browser) and tears down the old Puppeteer browser/page in the background.
  // Without this, the orphaned page survives and whatsapp-web.js re-injects
  // its page bindings into it on the next connect, throwing
  // "window['onQRChangedEvent'] already exists".
  private destroyClient(): void {
    const client = this.client;
    this.client = null;
    if (client) {
      client.destroy().catch((err) => console.error('[WhatsApp] Failed to destroy client', err));
    }
  }

  async initialize(): Promise<void> {
    if (this.client) return; // already initializing or connected

    this._status = 'CONNECTING';
    this._qr = null;
    this._phone = null;

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: './.whatsapp-session' }),
      puppeteer: {
        executablePath: '/usr/bin/google-chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      },
    });

    this.client.on('qr', async (rawQr: string) => {
      try {
        const dataUrl = await qrcode.toDataURL(rawQr);
        this._qr = dataUrl;
        this._status = 'CONNECTING';
        this.emit('update', this.getStatus());
      } catch (err) {
        console.error('[WhatsApp] QR generation failed', err);
      }
    });

    this.client.on('ready', () => {
      this._qr = null;
      this._status = 'CONNECTED';
      this._phone = this.client?.info?.wid?.user ?? null;
      console.log('[WhatsApp] Connected as', this._phone);
      this.emit('update', this.getStatus());
    });

    this.client.on('auth_failure', (msg: string) => {
      console.error('[WhatsApp] Auth failure', msg);
      this._status = 'DISCONNECTED';
      this._qr = null;
      this.destroyClient();
      this.emit('update', this.getStatus());
    });

    this.client.on('disconnected', () => {
      console.log('[WhatsApp] Disconnected');
      this._status = 'DISCONNECTED';
      this._qr = null;
      this._phone = null;
      this.destroyClient();
      this.emit('update', this.getStatus());
    });

    await this.client.initialize();
  }

  async sendMessage(phone: string, text: string): Promise<void> {
    if (!this.client || this._status !== 'CONNECTED') {
      throw new Error('WhatsApp not connected');
    }
    const digits = phone.replace(/\D/g, '');
    const chatId = `${digits}@c.us`;
    await this.client.sendMessage(chatId, text);
  }

  async logout(): Promise<void> {
    if (this.client) {
      try { await this.client.logout(); } catch { /* ignore */ }
      try { await this.client.destroy(); } catch { /* ignore */ }
      this.client = null;
    }
    this._status = 'DISCONNECTED';
    this._qr = null;
    this._phone = null;
    this.emit('update', this.getStatus());
  }
}

export const whatsappService = new WhatsAppService();
