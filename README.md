# Lib Escutadora de Rede

POC de uma biblioteca leve e agnostica de framework para observar requisicoes HTTP no front-end e produzir diagnosticos provaveis sobre lentidao, erro ou instabilidade.

## Objetivos

- observar requisicoes feitas via `fetch`;
- observar requisicoes feitas via Axios;
- manter uma janela das ultimas requisicoes em memoria;
- normalizar rotas para reduzir exposicao de dados sensiveis;
- calcular metricas simples;
- classificar o estado atual da comunicacao;
- expor uma API simples para qualquer front-end, inclusive projetos legados.

## Compatibilidade

O build da POC foi configurado para:

- CommonJS;
- JavaScript ES5;
- declaracoes TypeScript;
- sem dependencia de React;
- sem dependencia obrigatoria de Axios;
- sem polyfills globais;
- sem leitura de body de request ou response.

## Uso

```ts
import { createNetworkListener } from '@henrique-olivier/network-listener';

const listener = createNetworkListener({
  slowRequestThresholdMs: 1500,
  maxSamples: 20,
  minimumSamplesToDiagnose: 5,
});

listener.installFetch();
listener.installAxios(axiosInstance);

const unsubscribe = listener.subscribe(function (diagnosis) {
  console.log(diagnosis);
});

listener.start();

// Depois, quando nao precisar mais observar:
listener.stop();
unsubscribe();
```

## Diagnostico

O snapshot atual pode ser obtido a qualquer momento:

```ts
const diagnosis = listener.getSnapshot();
```

Exemplo de retorno:

```ts
{
  status: 'degraded',
  probableCause: 'specific-endpoint',
  confidenceLevel: 'medium',
  reasons: ['Only one endpoint concentrates slow requests.'],
  summary: {
    requestCount: 20,
    errorRate: 0,
    timeoutRate: 0,
    slowRequestRate: 0.35,
    medianDurationMs: 700,
    p95DurationMs: 2300,
    affectedEndpointRatio: 0.2
  },
  affectedEndpoints: [
    {
      normalizedRoute: '/api/reports',
      requestCount: 7,
      errorRate: 0,
      timeoutRate: 0,
      slowRequestRate: 1,
      medianDurationMs: 1800,
      p95DurationMs: 2300,
      statusCodes: [],
      issueTypes: ['slow']
    }
  ]
}
```

## Privacidade

A lib nao coleta por padrao:

- headers;
- cookies;
- payload;
- corpo de resposta;
- query strings completas;
- geolocalizacao;
- IP.

O principal identificador tecnico e `normalizedRoute`.

Exemplo:

```txt
/api/users/123/orders?token=abc
```

vira:

```txt
/api/users/:id/orders
```

## Scripts

```bash
npm test
npm run build
```

## Escopo fora da POC

- XHR;
- health-check automatico;
- teste de download;
- PerformanceObserver;
- Server-Timing;
- navigator.connection;
- dashboard;
- envio de telemetria para backend.
