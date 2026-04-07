const https = require('https');
const crypto = require('crypto');

const PIXEL_ID = '1494594679053438';
const ACCESS_TOKEN = 'EAASSHw8yBYIBRLmAc39L9wcRLsM0hRzeFnqm0G5Uh4BY39ONXDxxbZBcNwT6PMpZAcclPXAHZCK882nKvYRYEeCsiOSoHALE5oJlGEyoX3KyZCid7bhysWwlVnaASBtgE3LuaZBCikhf4x7EAZBeM40ifZAPKQZBIYurPTrZAmIru11AdtTHM7XjMlFqGbGgze7SGZCwZDZD';
const TEST_EVENT_CODE = 'TEST77068';

const PHONE_RAW = '553799963270';
const EVENT_SOURCE_URL = 'https://atendimento.com.br/';

function sha256(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function makeEventId(eventName) {
  return `${Date.now()}_${eventName}_${Math.random().toString(36).slice(2, 10)}`;
}

function sendEvent(eventData) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      data: [eventData],
      test_event_code: TEST_EVENT_CODE,
    });

    const options = {
      hostname: 'graph.facebook.com',
      path: `/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const phoneSha = sha256(PHONE_RAW);
  const externalId = sha256(`visitor_${Date.now()}`);
  const timestamp = Math.floor(Date.now() / 1000);

  const events = [
    {
      event_name: 'PageView',
      event_time: timestamp,
      event_id: makeEventId('PageView'),
      event_source_url: EVENT_SOURCE_URL,
      action_source: 'website',
      user_data: {
        ph: [phoneSha],
        external_id: [externalId],
        client_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    },
    {
      event_name: 'ViewContent',
      event_time: timestamp + 1,
      event_id: makeEventId('ViewContent'),
      event_source_url: EVENT_SOURCE_URL,
      action_source: 'website',
      user_data: {
        ph: [phoneSha],
        external_id: [externalId],
        client_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      custom_data: {
        currency: 'BRL',
        content_type: 'product',
        content_id: 'atendimento',
      },
    },
    {
      event_name: 'Contact',
      event_time: timestamp + 2,
      event_id: makeEventId('Contact'),
      event_source_url: EVENT_SOURCE_URL,
      action_source: 'website',
      user_data: {
        ph: [phoneSha],
        fn: [sha256('teste')],
        ln: [sha256('usuario')],
        ct: [sha256('sao paulo')],
        external_id: [externalId],
        client_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      custom_data: {
        currency: 'BRL',
        content_type: 'product',
        content_id: 'atendimento',
      },
    },
  ];

  console.log(`Enviando 3 eventos de teste para o Pixel ${PIXEL_ID}...`);
  console.log(`Test Event Code: ${TEST_EVENT_CODE}\n`);

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    console.log(`[${i + 1}/3] Enviando ${ev.event_name} (event_id: ${ev.event_id})...`);
    try {
      const result = await sendEvent(ev);
      console.log(`  Status: ${result.status}`);
      console.log(`  Response:`, JSON.stringify(result.body, null, 2));
      console.log('');
    } catch (err) {
      console.error(`  ERRO: ${err.message}\n`);
    }
  }

  console.log('Teste concluido!');
}

main();
