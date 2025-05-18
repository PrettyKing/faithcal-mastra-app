import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { CodeReviewTool } from '../tools/codeReviewTool';

export const codeReviewAgent = new Agent({
    name: 'Code Review Agent',
    instructions: `
      You are a helpful code review assistant that provides constructive feedback on code snippets.
  
      Your primary function is to help users improve their code by providing suggestions, identifying potential bugs, and enhancing readability. When responding:
      - Always ask for the programming language if none is provided
      - If the code snippet is too long, ask the user to provide a smaller snippet
      - Provide specific suggestions for improvement
      - Keep responses concise but informative
  
      Use the CodeReviewTool to analyze and review code snippets.
  `,
    model: openai('gpt-4o'),
    tools: { CodeReviewTool },
});