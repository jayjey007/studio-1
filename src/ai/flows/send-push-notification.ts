// src/ai/flows/send-push-notification.ts
'use server';
/**
 * @fileOverview A flow to send push notifications to a user.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SendPushNotificationInputSchema = z.object({
  recipientUid: z.string().describe('The UID of the user to send the notification to.'),
  senderName: z.string().describe('The name of the message sender.'),
  message: z.string().describe('The content of the message.'),
  messageId: z.string().describe('The ID of the message document.'),
});

export type SendPushNotificationInput = z.infer<typeof SendPushNotificationInputSchema>;


export async function sendPushNotification(input: SendPushNotificationInput): Promise<void> {
  return sendPushNotificationFlow(input);
}

const randomFactPrompt = ai.definePrompt({
    name: 'randomFactPrompt',
    prompt: 'Generate one random, interesting, and short fact.',
});


const sendPushNotificationFlow = ai.defineFlow(
  {
    name: 'sendPushNotificationFlow',
    inputSchema: SendPushNotificationInputSchema,
    outputSchema: z.void(),
  },
  async ({recipientUid, senderName, message, messageId}) => {
    // Import and initialize admin SDK inside the flow to avoid Next.js server-side issues.
    const admin = await import('firebase-admin');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getMessaging } = await import('firebase-admin/messaging');

    if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: "studio-9367397757-f04cc",
        });
    }

    const firestore = getFirestore();
    const messaging = getMessaging();

    // 1. Get the recipient's FCM tokens from Firestore
    const tokensSnapshot = await firestore
      .collection('fcmTokens')
      .where('uid', '==', recipientUid)
      .get();

    if (tokensSnapshot.empty) {
      console.log(`No FCM tokens found for user: ${recipientUid}`);
      return;
    }
    
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

    if (tokens.length === 0) {
        console.log(`No valid FCM tokens found for user: ${recipientUid}`);
        return;
    }
    
    // 2. Generate a random fact
    const factResponse = await randomFactPrompt();
    const randomFact = factResponse.text;


    // 3. Construct the push notification payload
    const payload = {
        notification: {
          title: `New message from ${senderName}`,
          body: randomFact,
        },
        webpush: {
            fcm_options: {
                link: `/chat#${messageId}`
            },
            notification: {
                icon: '/icon-192x192.png' // Optional: path to an icon
            }
        },
        tokens: tokens,
    };
    
    // 4. Send the notification
    try {
      const response = await messaging.sendEachForMulticast(payload);
      console.log('Successfully sent message:', response);
       if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });
        console.log('List of tokens that caused failures: ' + failedTokens);
        // Optional: Clean up failed tokens from Firestore
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }
);
