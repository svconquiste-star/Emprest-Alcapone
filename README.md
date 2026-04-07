# Landing Page — Atendimento via WhatsApp

Landing page de atendimento via WhatsApp, configurada para deploy em Coolify com Traefik.

## Configuração

- **Framework**: Next.js 14 (App Router, JavaScript)
- **Deployment**: Coolify + Traefik
- **Meta Pixel**: `1494594679053438` (Core Config compliance)
- **WhatsApp**: `553799963270`

## Instalação Local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`

## Build para Produção

```bash
npm run build
npm start
```

## Core Config Compliance

- `autoConfig: false` — correspondência avançada manual
- Zero eventos custom — apenas PageView, ViewContent, Contact
- Zero parâmetros custom no Pixel
- `event_source_url` envia apenas domínio (sem path/query)
- Nenhum termo financeiro sensível no copy ou tracking

## Estrutura

```
app/
  layout.js          - Layout raiz (Pixel, fontes, providers)
  page.js            - Página principal (formulário + tracking)
  providers.js       - Providers de contexto
  globals.css        - Estilos globais
lib/
  tracking.js        - TrackingManager (Pixel + N8N)
  phoneValidator.js  - Validação de telefone
context/
  CityContext.js     - Provider de cidades
  WhatsAppContext.js  - Provider WhatsApp
hooks/
  useTracking.js     - Hook para TrackingManager
components/          - Componentes legados (placeholders)
```
