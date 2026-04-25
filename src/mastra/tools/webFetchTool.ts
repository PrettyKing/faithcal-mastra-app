import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const webFetchTool = createTool({
  id: 'fetch-webpage',
  description: 'Fetch the text content of a webpage URL for summarization',
  inputSchema: z.object({
    url: z.string().url().describe('The URL of the webpage to fetch'),
  }),
  outputSchema: z.object({
    url: z.string(),
    content: z.string(),
    truncated: z.boolean(),
  }),
  execute: async ({ context }) => {
    const response = await fetch(context.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SummarizerBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Strip HTML tags and clean up whitespace
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    const MAX_CHARS = 8000;
    const truncated = text.length > MAX_CHARS;

    return {
      url: context.url,
      content: truncated ? text.slice(0, MAX_CHARS) + '...' : text,
      truncated,
    };
  },
});
