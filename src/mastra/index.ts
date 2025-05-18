
import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

import { weatherAgent } from './agents/weather';
import { codeReviewAgent } from './agents/code-review';

export const mastra = new Mastra({
  agents: { weatherAgent, codeReviewAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
  deployer: new CloudflareDeployer({
    scope: '3a7f6144f9dbd43a3d5d34b1b9c2c275',
    projectName: 'faithcal-mastra-app',
    auth: {
      apiToken: 'U49CGJ6ZtH5-KuNtjN07zFOmqTdDxtiPoFqCm52o',
      apiEmail: 'chaleeinhongkong@gamil.com',
    },
  }),
});
