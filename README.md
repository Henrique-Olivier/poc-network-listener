# @henrique-olivier/network-listener

Biblioteca leve para observar requisicoes HTTP reais no front-end e gerar diagnosticos provaveis sobre lentidao, erro ou instabilidade.

Funciona sem React, sem hooks e sem acoplamento com framework. O foco e ser simples de instalar em projetos legados e seguro por padrao: a lib nao le payloads, headers sensiveis, cookies ou body de resposta.

## Compatibilidade

O pacote publicado foi configurado para:

- CommonJS;
- JavaScript ES5;
- declaracoes TypeScript;
- sem dependencia de React;
- sem dependencia obrigatoria de Axios;
- sem polyfills globais;
- sem leitura de body de request ou response.

## Instalacao

```bash
npm install @henrique-olivier/network-listener
```

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

// Quando nao precisar mais observar:
listener.stop();
unsubscribe();
```

## Opcoes

```ts
createNetworkListener({
  maxSamples: 20,
  slowRequestThresholdMs: 1500,
  minimumSamplesToDiagnose: 5,
  timeoutThresholdMs: 30000,
});
```

- `maxSamples`: tamanho da janela em memoria.
- `slowRequestThresholdMs`: tempo minimo para uma request ser considerada lenta.
- `minimumSamplesToDiagnose`: minimo de amostras antes de diagnosticar.
- `timeoutThresholdMs`: duracao usada para marcar uma request como timeout provavel.

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
    clientErrorRate: 0,
    serverErrorRate: 0,
    networkErrorRate: 0,
    timeoutRate: 0,
    abortedRate: 0,
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

## Endpoints afetados

Quando o diagnostico encontra lentidao ou erro concentrado em rotas especificas, o payload inclui `affectedEndpoints`.

Esse campo pode ser usado pela aplicacao para mostrar alertas, logs de debug ou uma mensagem amigavel ao usuario sem expor URL completa, query string, payload ou headers.

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
