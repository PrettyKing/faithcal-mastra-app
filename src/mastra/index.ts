
import dotenv from 'dotenv';
import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

import { weatherAgent } from './agents/weather';
import { codeReviewAgent } from './agents/code-review';
import { ragAgent } from './agents/ragAgent';

import { LibSQLStore } from '@mastra/libsql';
// import { setGlobalDispatcher, ProxyAgent } from 'undici';

// const proxyAgent = new ProxyAgent('http://127.0.0.1:7890');
// setGlobalDispatcher(proxyAgent);

dotenv.config({
  path: '../../.env',
  debug: true,
});

export const mastra = new Mastra({
  agents: { weatherAgent, codeReviewAgent, ragAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }) as any,
  deployer: new CloudflareDeployer({
    scope: 'c501ded7917a10bae1f96f08a27c8af1',
    projectName: 'faithcal-mastra-app',
    auth: {
      apiToken: 'U49CGJ6ZtH5-KuNtjN07zFOmqTdDxtiPoFqCm52o',
      apiEmail: 'chaleeinhongkong@gamil.com',
    },
  })as any,
});
