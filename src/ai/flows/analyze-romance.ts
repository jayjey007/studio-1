'use server';

/**
 * @fileOverview Genkit flow to analyze romantic sentiment between users based on chat history.
 * Performs data fetching on the server using Admin SDK for better performance and security.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeAdminApp } from '@/firebase/admin-app';

const decodeMessage = (text: string, shift: number = 1): string => {
  if (!text) return '';
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

/**
 * Server Action to calculate the romance score.
 * Fetches 500 messages directly on the server to avoid client-side overhead.
 */
export async function calculateOverallRomanceScore(): Promise<AnalyzeRomanceOutput> {
  const admin = await initializeAdminApp();
  if (!admin) throw new Error("Could not initialize server-side services.");

  // Fetch 500 most recent messages
  const snapshot = await admin.firestore
    .collection('messages')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();

  if (snapshot.empty) {
    throw new Error("No message history found. Start chatting to get a score!");
  }

  const messagesData = snapshot.docs
    .map(doc => {
      const data = doc.data();
      return {
        text: data.isEncoded ? decodeMessage(data.scrambledText) : data.scrambledText,
        sender: data.sender as string
      };
    })
    .filter(m => !!m.text && m.text.trim().length > 0)
    .reverse(); // Chronological order for better AI context

  if (messagesData.length < 5) {
    throw new Error("Not enough messages for a meaningful analysis. Keep chatting!");
  }

  return analyzeRomanceFlow({ messages: messagesData });
}

export async function analyzeRomance(input: AnalyzeRomanceInput): Promise<AnalyzeRomanceOutput> {
  return analyzeRomanceFlow(input);
}

const analyzeRomancePrompt = ai.definePrompt({
  name: 'analyzeRomancePrompt',
  input: { schema: AnalyzeRomanceInputSchema },
  output: { schema: AnalyzeRomanceOutputSchema },
  prompt: `You are a relationship expert specializing in analyzing romantic connections through digital communication.
  
  You will be provided with a list of messages from a private chat between two people. 
  
  Analyze the entire conversation for:
  - Affection and intimacy levels
  - Frequency of shared jokes or positive interactions
  - Emotional support and empathy
  - Overall tone (playful, serious, distant, passionate)
  
  Please provide:
  1. An overall relationship health score (0-100) representing the collective bond.
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
