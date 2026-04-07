const PIXEL_ID = '1494594679053438';
const N8N_WEBHOOK_URL = 'https://n8n.multinexo.com.br/webhook/trajano319885-9382-b6e7-03fba8932ee6';

let instance = null;

class TrackingManager {
  constructor() {
    this.sentEventIds = new Set();
    this.pageLoadTime = Date.now();
  }

  // --- Utilitários ---

  async hashSHA256(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    const data = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  getCookie(name) {
    if (typeof document === 'undefined') return '';
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const c of cookies) {
      const [k, ...rest] = c.split('=');
      if (k === name) return decodeURIComponent(rest.join('='));
    }
    return '';
  }

  getFbCookies() {
    if (typeof window === 'undefined') return { fbc: '', fbp: '' };
    const fbp = this.getCookie('_fbp');
    let fbc = this.getCookie('_fbc');
    try {
      const url = new URL(window.location.href);
      const fbclid = url.searchParams.get('fbclid');
      if (!fbc && fbclid) {
        fbc = `fb.1.${Date.now()}.${fbclid}`;
      }
    } catch (_) {}
    return { fbc, fbp };
  }

  getOrCreateExternalId() {
    if (typeof window === 'undefined') return '';
    const key = 'visitor_external_id';
    const cached = localStorage.getItem(key);
    if (cached) return cached;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try { localStorage.setItem(key, id); } catch (_) {}
    return id;
  }

  gerarEventId(eventName) {
    return `${Date.now()}_${eventName}_${Math.random().toString(36).slice(2, 10)}`;
  }

  detectarDispositivo() {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent.toLowerCase();
    if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
    if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
    return 'desktop';
  }

  obterSistemaOperacional() {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios';
    if (ua.includes('linux')) return 'linux';
    return 'unknown';
  }

  getTimeOnPage() {
    return Math.round((Date.now() - this.pageLoadTime) / 1000);
  }

  getDomainOnly() {
    if (typeof window === 'undefined') return '';
    try {
      const url = new URL(window.location.href);
      return `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}/`;
    } catch (_) {
      return '';
    }
  }

  // --- Deduplicação ---

  shouldFireOncePerVisitor(key) {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(`once_${key}`) !== '1';
    } catch (_) {
      return false;
    }
  }

  markOncePerVisitor(key) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(`once_${key}`, '1'); } catch (_) {}
  }

  // --- Advanced Matching ---

  async buildAdvancedMatching({ nome, telefone, email, cidade }) {
    const parts = String(nome || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.length > 1 ? parts[parts.length - 1] : '';

    const phoneDigits = String(telefone || '').replace(/\D/g, '');
    const phoneNorm = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;

    const [em, ph, fn, ln, ct] = await Promise.all([
      this.hashSHA256(email),
      this.hashSHA256(phoneNorm),
      this.hashSHA256(firstName),
      this.hashSHA256(lastName),
      this.hashSHA256(cidade),
    ]);

    const { fbc, fbp } = this.getFbCookies();
    const external_id = this.getOrCreateExternalId();
    const client_user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    return {
      em: em || undefined,
      ph: ph || undefined,
      fn: fn || undefined,
      ln: ln || undefined,
      ct: ct || undefined,
      fbc: fbc || undefined,
      fbp: fbp || undefined,
      external_id: external_id || undefined,
      client_user_agent: client_user_agent || undefined,
    };
  }

  // --- Pixel ---

  applyAdvancedMatchingToPixel(userProps) {
    if (typeof window === 'undefined' || !window.fbq) return;
    const filtered = {};
    for (const [k, v] of Object.entries(userProps)) {
      if (v && k !== 'client_user_agent') filtered[k] = v;
    }
    window.fbq('init', PIXEL_ID, filtered);
  }

  firePixelEvent(eventName, eventId) {
    if (typeof window === 'undefined' || !window.fbq) return;
    window.fbq('track', eventName, {
      currency: 'BRL',
      content_type: 'product',
      content_id: 'atendimento',
    }, { eventID: eventId });
  }

  // --- N8N ---

  async sendToN8N(payload) {
    if (!N8N_WEBHOOK_URL) return { ok: false, reason: 'missing_url' };
    try {
      const resp = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return { ok: false, reason: `http_${resp.status}`, error: text };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'network', error: String(e?.message || e) };
    }
  }

  // --- Eventos principais ---

  async trackViewContent() {
    if (!this.shouldFireOncePerVisitor('view_content')) return;

    const eventId = this.gerarEventId('ViewContent');
    if (this.sentEventIds.has(eventId)) return;

    this.firePixelEvent('ViewContent', eventId);
    this.sentEventIds.add(eventId);
    this.markOncePerVisitor('view_content');

    const { fbc, fbp } = this.getFbCookies();
    const external_id = this.getOrCreateExternalId();
    const client_user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    void this.sendToN8N({
      event_name: 'ViewContent',
      event_id: eventId,
      timestamp: new Date().toISOString(),
      source: 'web',
      event_source_url: this.getDomainOnly(),
      fbc: fbc || undefined,
      fbp: fbp || undefined,
      external_id: external_id || undefined,
      client_user_agent: client_user_agent || undefined,
      device_type: this.detectarDispositivo(),
      operating_system: this.obterSistemaOperacional(),
      time_on_page: this.getTimeOnPage(),
    });
  }

  async trackContact({ nome, telefone, email, cidade }) {
    const eventId = this.gerarEventId('Contact');
    if (this.sentEventIds.has(eventId)) return;

    const userProps = await this.buildAdvancedMatching({ nome, telefone, email, cidade });

    this.applyAdvancedMatchingToPixel(userProps);
    this.firePixelEvent('Contact', eventId);
    this.sentEventIds.add(eventId);

    const phoneDigits = String(telefone || '').replace(/\D/g, '');
    const phoneNorm = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;

    void this.sendToN8N({
      event_name: 'Contact',
      event_id: eventId,
      timestamp: new Date().toISOString(),
      source: 'web',
      event_source_url: this.getDomainOnly(),
      em: userProps.em,
      ph: userProps.ph,
      fn: userProps.fn,
      ln: userProps.ln,
      ct: userProps.ct,
      fbc: userProps.fbc,
      fbp: userProps.fbp,
      external_id: userProps.external_id,
      client_user_agent: userProps.client_user_agent,
      cidade: cidade || undefined,
      nome: nome || undefined,
      telefone: phoneNorm || undefined,
      email: email || undefined,
      device_type: this.detectarDispositivo(),
      operating_system: this.obterSistemaOperacional(),
      time_on_page: this.getTimeOnPage(),
    });

    return { ok: true, event_id: eventId };
  }
}

export function getTrackingManager() {
  if (!instance) {
    instance = new TrackingManager();
  }
  return instance;
}

export default TrackingManager;
