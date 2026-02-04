
'use server';

/**
 * @fileOverview Genkit flow to analyze romantic sentiment between users based on chat history.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Shared decoding logic to match the chat application
const decodeMessage = (text: string, shift: number = 1): string => {
  return text
    .split('')
    .map(char => {
      const charCode = char.charCodeAt(0);
       if (charCode >= 32 + shift && charCode <= 126 + shift) {
        return String.fromCharCode(charCode - shift);
      }
      return char;
    })
    .join('');
};

const AnalyzeRomanceInputSchema = z.object({
  scrambledMessages: z.array(z.string()).describe('List of scrambled messages to analyze.'),
});

export type AnalyzeRomanceInput = z.infer<typeof AnalyzeRomanceInputSchema>;

const AnalyzeRomanceOutputSchema = z.object({
  score: z.number().min(0).max(100).describe('The overall romance score from 0 to 100.'),
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
  
  You will be provided with a list of messages from a private chat between two people. These messages were previously "scrambled" for privacy but have been passed to you as a list of strings.
  
  Analyze the decoded versions of these messages for:
  - Affection and intimacy levels
  - Frequency of shared jokes or positive interactions
  - Emotional support and empathy
  - Future planning or shared goals
  - Overall tone (playful, serious, distant, passionate)
  
  Provide a romance score between 0 and 100. 
  - 0-30: Distant or strictly functional
  - 31-60: Friendly with potential or early stage
  - 61-85: Strong romantic connection
  - 86-100: Deeply passionate and committed
  
  Messages:
  {{#each scrambledMessages}}
  - {{{this}}}
  {{/each}}`,
});

const analyzeRomanceFlow = ai.defineFlow(
  {
    name: 'analyzeRomanceFlow',
    inputSchema: AnalyzeRomanceInputSchema,
    outputSchema: AnalyzeRomanceOutputSchema,
  },
  async (input) => {
    // Decode the messages before sending to prompt to ensure AI sees clear text
    const decodedMessages = input.scrambledMessages.map(m => decodeMessage(m));
    
    const { output } = await analyzeRomancePrompt({
      scrambledMessages: decodedMessages // Re-using the schema key but with decoded text
    });
    
    return output!;
  }
);
