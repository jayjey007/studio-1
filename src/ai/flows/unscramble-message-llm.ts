'use server';
/**
 * @fileOverview Message unscrambling flow using an LLM.
 *
 * - unscrambleMessage - A function that unscrambles a message using an LLM.
 * - UnscrambleMessageInput - The input type for the unscrambleMessage function.
 * - UnscrambleMessageOutput - The return type for the unscrambleMessage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const UnscrambleMessageInputSchema = z.object({
  scrambledMessage: z.string().describe('The message to be unscrambled.'),
  method: z
    .string()
    .describe(
      'The method that was used for scrambling the message. Examples: letter substitution, reverse, or incorporate emoticons.'
    ),
});
export type UnscrambleMessageInput = z.infer<
  typeof UnscrambleMessageInputSchema
>;

const UnscrambleMessageOutputSchema = z.object({
  unscrambledMessage: z.string().describe('The unscrambled message.'),
});
export type UnscrambleMessageOutput = z.infer<
  typeof UnscrambleMessageOutputSchema
>;

export async function unscrambleMessage(
  input: UnscrambleMessageInput
): Promise<UnscrambleMessageOutput> {
  return unscrambleMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'unscrambleMessagePrompt',
  input: {schema: UnscrambleMessageInputSchema},
  output: {schema: UnscrambleMessageOutputSchema},
  prompt: `You are a message unscrambling expert. You will take a scrambled message and unscramble it according to the method that was used to scramble it.

Scrambled Message: {{{scrambledMessage}}}
Method Used: {{{method}}}`,
});

const unscrambleMessageFlow = ai.defineFlow(
  {
    name: 'unscrambleMessageFlow',
    inputSchema: UnscrambleMessageInputSchema,
    outputSchema: UnscrambleMessageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
