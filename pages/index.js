import Head from 'next/head';
import { useEffect, useState } from 'react';
import styles from '../styles/home.module.css';

const PIXEL_ID = '2006224949946315';
const N8N_WEBHOOK_URL = 'https://n8n.multinexo.com.br/webhook/71aaee93-3d59-44b0-a313-creditopkaique';
const CONTENT_TYPE = 'landing_page';
const CONTENT_ID = 'emprest_nunes_creditop';
const CURRENCY = 'BRL';

function generateEventId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function hashSHA256(value) {
  if (!value) return '';
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function detectarDispositivo() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
  return 'desktop';
}

function obterSistemaOperacional() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function isValidPhoneDigits(phoneDigits) {
  return phoneDigits.length === 10 || phoneDigits.length === 11;
}

function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateEventData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Payload inválido'] };
  }
  if (!data.event_id || typeof data.event_id !== 'string') errors.push('event_id é obrigatório e deve ser string');
  if (!data.event_name || typeof data.event_name !== 'string') errors.push('event_name é obrigatório e deve ser string');
  if (!data.timestamp || typeof data.timestamp !== 'number') errors.push('timestamp é obrigatório e deve ser number');
  if (data.currency && typeof data.currency !== 'string') errors.push('currency deve ser string');
  if (data.scroll_percentage != null && typeof data.scroll_percentage !== 'number') errors.push('scroll_percentage deve ser number');
  if (data.time_on_page != null && typeof data.time_on_page !== 'number') errors.push('time_on_page deve ser number');

  if (data.em && typeof data.em !== 'string') errors.push('em deve ser string');
  if (data.ph && typeof data.ph !== 'string') errors.push('ph deve ser string');
  if (data.em && !/^[a-f0-9]{64}$/i.test(data.em)) errors.push('em deve ser hash SHA-256');
  if (data.ph && !/^[a-f0-9]{64}$/i.test(data.ph)) errors.push('ph deve ser hash SHA-256');

  return { valid: errors.length === 0, errors };
}

function sanitizeForPixel(payload) {
  const sanitized = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
      return;
    }
    if (typeof value === 'object') {
      try {
        sanitized[key] = JSON.parse(JSON.stringify(value));
      } catch (_) {}
    }
  });
  if (!sanitized.content_type) sanitized.content_type = CONTENT_TYPE;
  if (!sanitized.content_id) sanitized.content_id = CONTENT_ID;
  if (!sanitized.currency) sanitized.currency = CURRENCY;
  return sanitized;
}

const sentEventIds = new Set();

async function sendToN8n(payload) {
  const body = {
    timestamp: new Date(payload.timestamp).toISOString(),
    source: 'web',
    ...payload,
  };

  const resp = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`N8N webhook falhou: ${resp.status} ${text}`);
  }
}

async function trackEvent({
  event_name,
  pixelMethod = 'trackCustom',
  pixelEventName,
  data = {},
  event_id,
}) {
  const now = Date.now();
  const resolvedEventId = event_id || generateEventId();
  const safeData = { ...(data || {}) };
  delete safeData.event_id;
  delete safeData.event_name;
  delete safeData.timestamp;
  delete safeData.content_type;
  delete safeData.content_id;
  delete safeData.currency;
  const payload = {
    event_id: resolvedEventId,
    event_name,
    timestamp: now,
    content_type: CONTENT_TYPE,
    content_id: CONTENT_ID,
    currency: CURRENCY,
    ...safeData,
    device_type: detectarDispositivo(),
    os: obterSistemaOperacional(),
    client_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  const { valid, errors } = validateEventData(payload);
  if (!valid) {
    console.warn('[tracking] Evento descartado por validação:', event_name, errors);
    return { ok: false, reason: 'validation', errors };
  }

  if (sentEventIds.has(payload.event_id)) {
    console.warn('[tracking] Evento duplicado descartado:', payload.event_id, event_name);
    return { ok: false, reason: 'duplicate' };
  }

  sentEventIds.add(payload.event_id);
  const pixelPayload = sanitizeForPixel(payload);

  try {
    if (typeof window !== 'undefined' && window.fbq) {
      const name = pixelEventName || event_name;
      window.fbq(pixelMethod, name, pixelPayload, { eventID: payload.event_id });
    }
  } catch (e) {
    console.warn('[tracking] Falha ao enviar para Pixel:', event_name, e);
  }

  try {
    await sendToN8n(payload);
  } catch (e) {
    console.warn('[tracking] Falha ao enviar para N8N:', event_name, e);
    return { ok: false, reason: 'n8n', error: String(e?.message || e) };
  }

  return { ok: true, event_id: payload.event_id };
}

export default function Home() {
  const [selectedCity, setSelectedCity] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');

  const [timeOnPageSeconds, setTimeOnPageSeconds] = useState(0);
  const [maxScrollPercentage, setMaxScrollPercentage] = useState(0);

  const phoneDigits = normalizePhone(phone);
  const canStartConversation = Boolean(whatsappEnabled && selectedCity && isValidPhoneDigits(phoneDigits));
  const whatsappMessage = `Olá! Quero fazer uma simulação de empréstimo. Moro ${selectedCity || '[CIDADE]'} e meu telefone é ${phoneDigits || '[TELEFONE]'}`;
  const whatsappLink = `https://wa.me/5531995248167?text=${encodeURIComponent(whatsappMessage)}`;

  const cidades = [
    "RIO MANSO","ITATIAIUÇU","ITAUNA","DIVINÓPOLIS","MATEUS LEME",
    "JUATUBA","BRUMADINHO","MARIO CAMPOS","IGARAPÉ","SÃO JOAQUIM DE BICAS",
    "CONTAGEM","BELO HORIZONTE","SARZEDO","IBIRITÉ"
  ];

  const atendidas = new Set(cidades);

  useEffect(() => {
    document.body.style.overflow = showModal ? 'hidden' : 'auto';
  }, [showModal]);

  useEffect(() => {
    const startedAt = Date.now();
    const tick = setInterval(() => {
      setTimeOnPageSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    const milestones = new Set([25, 50, 75, 100]);
    const fired = new Set();
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      const pct = scrollHeight > 0 ? Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100))) : 0;
      setMaxScrollPercentage((prev) => Math.max(prev, pct));

      milestones.forEach((m) => {
        if (pct >= m && !fired.has(m)) {
          fired.add(m);
          trackEvent({
            event_name: 'ScrollMilestone',
            data: {
              scroll_percentage: m,
              time_on_page: Math.floor((Date.now() - startedAt) / 1000),
            },
          });
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    trackEvent({
      event_name: 'ViewContent',
      pixelMethod: 'track',
      pixelEventName: 'ViewContent',
      data: {},
    });

    return () => {
      clearInterval(tick);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      setEmailError('');
      return;
    }
    if (!isValidEmail(normalized)) {
      setEmailError('Email inválido');
      return;
    }
    setEmailError('');
  }, [email]);

  useEffect(() => {
    const digits = normalizePhone(phone);
    if (!digits) {
      setPhoneError('Telefone é obrigatório');
      return;
    }
    if (!isValidPhoneDigits(digits)) {
      setPhoneError('Telefone inválido. Use o formato: DD + 8 ou 9 dígitos (ex: 31987654321 ou 3187654321)');
      return;
    }
    setPhoneError('');
  }, [phone]);

  const handleCityClick = (cidade) => {
    setSelectedCity(cidade);

    trackEvent({
      event_name: 'ViewContent',
      pixelMethod: 'track',
      pixelEventName: 'ViewContent',
      data: { cidade },
    });

    if (cidade === "OUTRA CIDADE" || !atendidas.has(cidade)) {
      setWhatsappEnabled(false);
      setShowModal(true);

      trackEvent({
        event_name: 'CityNotAvailable',
        data: { cidade },
      });
      return;
    }
    setWhatsappEnabled(true);
  };

  const startWhatsAppConversation = async (e) => {
    e?.preventDefault?.();

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const phoneOk = isValidPhoneDigits(normalizedPhone);
    const emailOk = isValidEmail(normalizedEmail);

    if (!selectedCity || !whatsappEnabled || !phoneOk || !emailOk) {
      const errorReasons = [];
      if (!selectedCity || !whatsappEnabled) errorReasons.push('cidade');
      if (!phoneOk) errorReasons.push('telefone');
      if (!emailOk) errorReasons.push('email');

      await trackEvent({
        event_name: 'ValidationError',
        data: {
          cidade: selectedCity,
          validation_errors: errorReasons.join(','),
        },
      });
      return;
    }

    const em = normalizedEmail ? await hashSHA256(normalizedEmail) : '';
    const ph = normalizedPhone ? await hashSHA256(normalizedPhone) : '';
    const fn = name ? await hashSHA256(String(name).trim().toLowerCase()) : '';

    const common = {
      cidade: selectedCity,
      time_on_page: timeOnPageSeconds,
      scroll_percentage: maxScrollPercentage,
      phone: normalizedPhone,
      email: normalizedEmail,
      em: em || undefined,
      ph: ph || undefined,
      fn: fn || undefined,
    };

    await trackEvent({
      event_name: 'WhatsAppButtonClick',
      data: common,
    });

    await trackEvent({
      event_name: 'Lead',
      pixelMethod: 'track',
      pixelEventName: 'Lead',
      data: common,
    });

    const contactResult = await trackEvent({
      event_name: 'Contact',
      pixelMethod: 'track',
      pixelEventName: 'Contact',
      data: common,
    });

    if (!contactResult.ok) {
      await trackEvent({
        event_name: 'ContactError',
        data: {
          ...common,
          error_reason: contactResult.reason,
        },
      });
      return;
    }

    setTimeout(() => {
      window.open(whatsappLink, '_blank', 'noopener,noreferrer');
    }, 80);
  };

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <meta name="theme-color" content="#030814" />
        <meta name="description" content="LP oficial — escolha sua cidade e libere o atendimento exclusivo no WhatsApp." />
        <title>Simulação de Empréstimo | Atendimento via WhatsApp</title>

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap"
          rel="stylesheet"
        />

        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s){
                if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)
              }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init','${PIXEL_ID}');
              fbq('track','PageView');
            `
          }}
        />
        <noscript>
          <img height="1" width="1" style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`} alt="" />
        </noscript>
      </Head>

      <div className={styles.shell}>
        <div className={styles.content}>
          <header className={styles.hero} role="banner">
            <div className={styles.heroLeft}>
              <div className={styles.heroPill}>
                <i className="fa-solid fa-sparkles"></i>
                Linha exclusiva Creditop
              </div>
              <p className={styles.heroSubtitle}>Empréstimo sofisticado para você</p>
              <p className={styles.heroLead}>
                Atuamos como concierge financeiro: analisamos o seu cenário, apresentamos as melhores condições e
                conduzimos toda a assinatura dentro de um fluxo seguro via WhatsApp.
              </p>
              <ul className={styles.heroHighlights} aria-label="Diferenciais imediatos">
                <li><span>Especialistas certificados</span> acompanham cada etapa da simulação.</li>
                <li><span>Taxas transparentes</span> e aprovadas somente após sua confirmação.</li>
                <li><span>Checklist guiado</span> para documentos e assinatura digital sem fricção.</li>
              </ul>
              <ul className={styles.heroStats} aria-label="Indicadores de confiança">
                <li>
                  <strong>+2.500</strong>
                  <span>Contratos aprovados</span>
                </li>
                <li>
                  <strong>94%</strong>
                  <span>Clientes que indicam</span>
                </li>
                <li>
                  <strong>24h</strong>
                  <span>Média de liberação</span>
                </li>
              </ul>
            </div>

            <aside className={styles.heroRight}>
              <div className={styles.heroPanel} aria-label="Seleção de cidade e WhatsApp">
                <div className={styles.panelHead}>
                  <span><i className="fa-solid fa-location-dot"></i> Malha de atendimento</span>
                  <h2>Qual cidade você mora?</h2>
                </div>
                <p className={styles.panelNote}>Quando a cidade é confirmada, o link direto com um especialista é liberado.</p>
                <div className={styles.cityGrid} role="group" aria-label="Lista de cidades atendidas">
                  {cidades.map((cidade) => (
                    <button
                      key={cidade}
                      type="button"
                      className={`${styles.cityBtn} ${selectedCity === cidade ? styles.selected : ''}`}
                      onClick={() => handleCityClick(cidade)}
                    >
                      <span className={styles.label}>{cidade}</span>
                      <span className={styles.dot} aria-hidden="true"></span>
                    </button>
                  ))}
                </div>
                <button
                  className={styles.cityLink}
                  type="button"
                  onClick={() => handleCityClick("OUTRA CIDADE")}
                >
                  Minha cidade não está na lista
                </button>

                <div className={styles.formGrid} aria-label="Dados para iniciar atendimento">
                  <div className={styles.field}>
                    <label className={styles.labelText} htmlFor="name">Nome (opcional)</label>
                    <input
                      id="name"
                      className={styles.input}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      autoComplete="name"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.labelText} htmlFor="email">Email (opcional)</label>
                    <input
                      id="email"
                      className={`${styles.input} ${emailError ? styles.inputError : ''}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      autoComplete="email"
                      inputMode="email"
                    />
                    {emailError ? <div className={styles.errorText}>{emailError}</div> : null}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.labelText} htmlFor="phone">Telefone</label>
                    <input
                      id="phone"
                      className={`${styles.input} ${phoneError ? styles.inputError : ''}`}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="DD + 8 ou 9 dígitos"
                      autoComplete="tel"
                      inputMode="numeric"
                    />
                    {phoneError ? <div className={styles.errorText}>{phoneError}</div> : null}
                  </div>
                </div>
                <div className={styles.cta}>
                  <button
                    type="button"
                    onClick={startWhatsAppConversation}
                    className={`${styles.btn} ${styles.btnWhats} ${!canStartConversation ? styles.btnDisabled : styles.active}`}
                    disabled={!canStartConversation}
                    aria-disabled={!canStartConversation}
                  >
                    <i className="fa-brands fa-whatsapp"></i>
                    Iniciar Conversa
                  </button>
                  <small>Atendimento humano e sigiloso.</small>
                </div>
              </div>
            </aside>
          </header>

          <main>
            <section aria-labelledby="benefits">
              <div className={styles.sectionHead}>
                <h2 id="benefits">Por que escolher nossa equipe</h2>
                <p>Experiência boutique para quem busca crédito com discrição, velocidade e acompanhamento especializado até o PIX cair na sua conta.</p>
              </div>
              <div className={styles.features}>
                <article className={styles.featureCard}>
                  <i className="fa-solid fa-shield-heart"></i>
                  <h3>Proteção total</h3>
                  <p>Documentos validados com segurança digital e equipe treinada para garantir confidencialidade.</p>
                </article>
                <article className={styles.featureCard}>
                  <i className="fa-solid fa-person-chalkboard"></i>
                  <h3>Especialista dedicado</h3>
                  <p>Você fala com uma pessoa real que guia cada etapa da simulação até a assinatura.</p>
                </article>
                <article className={styles.featureCard}>
                  <i className="fa-solid fa-bolt"></i>
                  <h3>Liberação ágil</h3>
                  <p>Processos digitalizados que aceleram análise e desembolso, sem filas e sem complicação.</p>
                </article>
                <article className={styles.featureCard}>
                  <i className="fa-solid fa-mobile-screen"></i>
                  <h3>WhatsApp first</h3>
                  <p>Todo o fluxo acontece no aplicativo que você já usa, com registros para consultar quando quiser.</p>
                </article>
              </div>
            </section>

            <section className={styles.section} aria-labelledby="steps">
              <div className={styles.sectionHead}>
                <h2 id="steps">Como funciona na prática</h2>
                <p>Transparência em cada etapa, com status atualizado e um especialista ao seu lado.</p>
              </div>
              <div className={styles.timeline}>
                <article className={styles.step}>
                  <span>1</span>
                  <h3>Selecione a cidade</h3>
                  <p>Confirmamos se sua região já está ativa. Caso não esteja, você recebe o aviso e entra na fila de expansão.</p>
                </article>
                <article className={styles.step}>
                  <span>2</span>
                  <h3>Conversa no WhatsApp</h3>
                  <p>Especialista faz as perguntas essenciais e monta a simulação sob medida para seu perfil.</p>
                </article>
                <article className={styles.step}>
                  <span>3</span>
                  <h3>Envio de documentos</h3>
                  <p>Upload guiado com checklist simples. Tudo conferido e protegido com autenticação.</p>
                </article>
                <article className={styles.step}>
                  <span>4</span>
                  <h3>Assinatura e PIX</h3>
                  <p>Contrato digital, assinatura segura e liberação do valor imediatamente após aprovação.</p>
                </article>
              </div>
            </section>

            <section className={styles.proof} aria-labelledby="proof">
              <div className={styles.testimonial}>
                <div className={styles.sectionHead} style={{ marginBottom: '18px' }}>
                  <h2 id="proof">Voz de quem já recebeu</h2>
                </div>
                <blockquote className={styles.blockquote}>
                  "Quando selecionei minha cidade, em menos de 5 minutos já estava conversando com a equipe. Me explicaram taxas, me ajudaram com os documentos e o PIX bateu no mesmo dia."
                  <footer>— Juliana P., Juatuba</footer>
                </blockquote>
              </div>
              <div className={styles.numbers} aria-label="Indicadores">
                <div>
                  <strong>94%</strong>
                  <span>Satisfação média nos atendimentos</span>
                </div>
                <div>
                  <strong>R$ 12 mi</strong>
                  <span>Em crédito liberado em 2024</span>
                </div>
                <div>
                  <strong>5min</strong>
                  <span>Tempo médio para iniciar a conversa</span>
                </div>
                <div>
                  <strong>Zero</strong>
                  <span>Custos para simular e cancelar</span>
                </div>
              </div>
            </section>

            <section className={styles.section} aria-labelledby="faq">
              <div className={styles.sectionHead}>
                <h2 id="faq">Perguntas frequentes</h2>
                <p>Informações rápidas para você começar agora mesmo.</p>
              </div>
              <div className={styles.faq}>
                <details className={styles.details}>
                  <summary className={styles.summary}>Os dados enviados ficam seguros?</summary>
                  <p>Sim. Utilizamos armazenamento criptografado e acesso restrito à equipe responsável. Todos os dados podem ser excluídos mediante solicitação.</p>
                </details>
                <details className={styles.details}>
                  <summary className={styles.summary}>Existe algum custo para simular?</summary>
                  <p>Não. A análise é 100% gratuita e somente seguimos para assinatura se você aprovar as condições.</p>
                </details>
                <details className={styles.details}>
                  <summary className={styles.summary}>Quais documentos preciso ter em mãos?</summary>
                  <p>Documento oficial com foto, comprovante de renda e comprovante de residência atualizado. Caso precise de algo extra, avisaremos durante o atendimento.</p>
                </details>
                <details className={styles.details}>
                  <summary className={styles.summary}>E se a minha cidade ainda não estiver disponível?</summary>
                  <p>Mostramos um aviso e registramos seu interesse para priorizar a expansão. Assim que liberarmos, você recebe uma mensagem automática no WhatsApp.</p>
                </details>
              </div>
            </section>
          </main>

          <footer className={styles.footer}>
            <span>© {new Date().getFullYear()} Atendimento via WhatsApp. Todos os direitos reservados.</span>
          </footer>
        </div>
      </div>

      <div className={`${styles.modal} ${showModal ? styles.active : ''}`} role="dialog" aria-modal="true" aria-labelledby="modalTitle" aria-describedby="modalMessage">
        <div className={styles.modalBox}>
          <h2 id="modalTitle">Aviso importante</h2>
          <p id="modalMessage">No Momento Não Estamos Atuando Na Cidade Selecionada, Mas Breve iremos chegar Na Sua Cidade</p>
          <div className={styles.modalActions}>
            <button className={styles.modalBtn} type="button" onClick={() => setShowModal(false)}>
              Entendi
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
