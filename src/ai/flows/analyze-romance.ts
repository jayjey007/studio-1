'use server';

/**
 * @fileOverview Genkit flow to analyze romantic sentiment between users based on chat history.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeRomanceInputSchema = z.object({
  messages: z.array(z.object({
    text: z.string(),
    sender: z.string(),
  })).describe('List of messages with sender information to analyze.'),
});

export type AnalyzeRomanceInput = z.infer<typeof AnalyzeRomanceInputSchema>;

const UserScoreSchema = z.object({
  username: z.string(),
  score: z.number().min(0).max(100),
  description: z.string().describe('A brief description of this user\'s romantic communication style.'),
});

const AnalyzeRomanceOutputSchema = z.object({
  overallScore: z.number().min(0).max(100).describe('The overall romance score from 0 to 100.'),
  userScores: z.array(UserScoreSchema).describe('Individual analysis for each participant.'),
  summary: z.string().describe('A brief summary of the romantic connection analyzed.'),
  vibe: z.string().describe('A one or two-word description of the relationship vibe.'),
  highlights: z.array(z.string()).describe('Key romantic elements found in the conversation.'),
});

export type AnalyzeRomanceOutput = z.infer<typeof AnalyzeRomanceOutputSchema>;

export async function analyzeRomance(input: AnalyzeRomanceInput): Promise<AnalyzeRomanceOutput> {
  return analyzeRomanceFlow(input);
}

const analyzeRomancePrompt = ai.definePrompt({
  name: 'analyzeRomancePrompt',
  input: { schema: AnalyzeRomanceInputSchema },
  output: { schema: AnalyzeRomanceOutputSchema },
  prompt: `You are a relationship expert specializing in analyzing romantic connections through digital communication.
  
  You will be provided with a list of messages from a private chat between two people. 
  
  Analyze the messages for:
  - Affection and intimacy levels
  - Frequency of shared jokes or positive interactions
  - Emotional support and empathy
  - Overall tone (playful, serious, distant, passionate)
  
  Please provide:
  1. An overall relationship score (0-100).
  2. Individual romantic sentiment scores for EACH sender based on how they express affection and engage in the relationship.
  3. A vibe description and a few highlights.

  Messages:
  {{#each messages}}
  - [{{{sender}}}] {{{text}}}
  {{/each}}`,
});

const analyzeRomanceFlow = ai.defineFlow(
  {
    name: 'analyzeRomanceFlow',
    inputSchema: AnalyzeRomanceInputSchema,
    outputSchema: AnalyzeRomanceOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeRomancePrompt(input);
    return output!;
  }
);
