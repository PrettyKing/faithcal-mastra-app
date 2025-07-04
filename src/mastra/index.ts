
import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

import { weatherAgent } from './agents/weather';
import { codeReviewAgent } from './agents/code-review';


interface Env {
  [key: string]: any;
}

const ENVIRONMENT_VARIABLES = {}

addEventListener('fetch', (event) => {
  console.log('Event listener triggered:=>', event);
})


export const mastra = new Mastra({
  agents: { weatherAgent, codeReviewAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
  deployer: new CloudflareDeployer({
    scope: 'c501ded7917a10bae1f96f08a27c8af1',
    projectName: 'faithcal-mastra-app',
    auth: {
      apiToken: 'U49CGJ6ZtH5-KuNtjN07zFOmqTdDxtiPoFqCm52o',
      apiEmail: 'chaleeinhongkong@gamil.com',
    },
  }),
});
