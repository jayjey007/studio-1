
'use server';

import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { initializeAdminApp } from '@/firebase/admin-app';

interface sendNotificationProps {
    message: string;
    sender: string;
    messageId: string;
}

const randomFacts = [
    "A single cloud can weigh more than 1 million pounds.",
    "A group of flamingos is called a 'flamboyance'.",
    "The inventor of the frisbee was turned into a frisbee after he died.",
    "Honey never spoils.",
    "There are more fake flamingos in the world than real ones.",
    "A shrimp's heart is in its head.",
    "It is impossible for most people to lick their own elbow.",
    "A crocodile cannot stick its tongue out.",
    "The national animal of Scotland is the unicorn.",
    "Sea otters hold hands when they sleep so they don't float away."
];

export async function sendNotification({ message, sender, messageId }: sendNotificationProps) {
    const adminApp = await initializeAdminApp();
    if (!adminApp) {
        // Admin SDK not initialized, so we can't send notifications.
        return;
    }

    const { firestore, app } = adminApp;
    const messaging = getMessaging(app);

    const users = ['Cool', 'Crazy'];
    const recipient = users.find(user => user !== sender);

    if (!recipient) {
        console.log('No recipient found to send notification.');
        return;
    }
    
    const tokenDoc = await firestore.collection('fcmTokens').doc(recipient).get();

    if (!tokenDoc.exists) {
        console.log(`No FCM token found for user: ${recipient}`);
        return;
    }

    const fcmToken = tokenDoc.data()?.token;

    if (!fcmToken) {
        console.log(`FCM token is empty for user: ${recipient}`);
        return;
    }
    
    const randomFact = randomFacts[Math.floor(Math.random() * randomFacts.length)];

    const payload = {
        notification: {
            title: 'Fun facts',
            body: randomFact,
        },
        webpush: {
            fcm_options: {
                link: `/chat#${messageId}`,
            },
        },
        token: fcmToken,
    };

    try {
        await messaging.send(payload);
        console.log(`Successfully sent notification to ${recipient}`);
    } catch (error) {
        console.error(`Error sending notification to ${recipient}:`, error);
    }
}
