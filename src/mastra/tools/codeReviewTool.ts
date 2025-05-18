import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const CodeReviewTool = createTool({
    id: 'code-review',
    description: 'Analyze and review code snippets for potential improvements',
    inputSchema: z.object({
        code: z.string().describe('Code diff to review'),
    }),
    outputSchema: z.object({
        suggestions: z.string(),
        issues: z.string(),
    }),
    execute: async ({ context }) => {
        const { code } = context;
        if (!code) {
            throw new Error('No code provided for review');
        }
        // Simulate code review process
        // In a real scenario, this would involve analyzing the code for potential issues
        // and providing suggestions for improvement.
        const suggestions = `Consider using 'const' instead of 'let' for variables that are not reassigned.`;
        const issues = `No major issues found. However, consider improving code readability by adding comments.`;
        return {
            suggestions,
            issues,
        }; // Return the suggestions and issues
    }
});