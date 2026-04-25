import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface ExchangeRateResponse {
  result: string;
  base_code: string;
  target_code: string;
  conversion_rate: number;
  time_last_update_utc: string;
}

export const currencyTool = createTool({
  id: 'get-exchange-rate',
  description: 'Get real-time exchange rate between two currencies',
  inputSchema: z.object({
    from: z.string().describe('Source currency code, e.g. USD, CNY, EUR'),
    to: z.string().describe('Target currency code, e.g. USD, CNY, EUR'),
  }),
  outputSchema: z.object({
    from: z.string(),
    to: z.string(),
    rate: z.number(),
    updatedAt: z.string(),
  }),
  execute: async ({ context }) => {
    const { from, to } = context;
    const url = `https://open.er-api.com/v6/latest/${from.toUpperCase()}`;
    const response = await fetch(url);
    const data = (await response.json()) as any;

    if (data.result !== 'success') {
      throw new Error(`Failed to fetch exchange rate for ${from}`);
    }

    const rate = data.rates[to.toUpperCase()];
    if (!rate) {
      throw new Error(`Currency '${to}' not found`);
    }

    return {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate,
      updatedAt: data.time_last_update_utc,
    };
  },
});
