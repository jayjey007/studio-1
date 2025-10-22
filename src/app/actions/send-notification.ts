
'use server';

import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { initializeAdminApp } from '@/firebase/admin-app';

interface sendNotificationProps {
    message: string;
    sender: string;
    messageId: string;
}

interface NotificationResult {
    success: boolean;
    error?: string;
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

export async function sendNotification({ message, sender, messageId }: sendNotificationProps): Promise<NotificationResult> {
    const adminApp = await initializeAdminApp();
    if (!adminApp) {
        const errorMsg = "Firebase Admin SDK not initialized. Skipping notification.";
        console.warn(errorMsg);      
        return { success: false, error: errorMsg };
    }

    const { firestore, app } = adminApp;
    const messaging = getMessaging(app);

    const users = ['Cool', 'Crazy'];
    const recipient = users.find(user => user !== sender);

    if (!recipient) {
        const errorMsg = 'No recipient found to send notification.';
        console.log(errorMsg);
        return { success: false, error: errorMsg };
    }
    
    const tokensCollection = firestore.collection('fcmTokens');
    const querySnapshot = await tokensCollection
      .where('username', '==', recipient)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();


    if (querySnapshot.empty) {
        const errorMsg = `No FCM token document found for username: ${recipient}`;
        console.log(errorMsg);        
        return { success: false, error: errorMsg };
    }

    const tokenDoc = querySnapshot.docs[0];
    const fcmToken = tokenDoc.data()?.token;

    if (!fcmToken) {
        const errorMsg = `FCM token is empty for user: ${recipient}`;
        console.log(errorMsg);        
        return { success: false, error: errorMsg };
    }
    
    const randomFact = randomFacts[Math.floor(Math.random() * randomFacts.length)];

    const payload: MulticastMessage = {
        tokens: [fcmToken],
        notification: {
            title: 'Fun facts',
            body: randomFact,
        },
        webpush: {
            fcm_options: {
                link: `/chat#${messageId}`,
            },
        },
        apns: {
            headers: {
                'apns-priority': '10', 
            },
            payload: {
                aps: {
                    alert: {
                        title: 'Fun facts',
                        body: randomFact,
                    },
                    sound: 'default',
                    badge: 1,
                },
            },
        },
    };

    try {
        await messaging.sendEachForMulticast(payload);
        console.log(`Successfully sent notification to ${recipient}`);
        return { success: true };
    } catch (error: any) {
        const errorMsg = `Error sending notification to ${recipient}: ${error.message}`;
        console.error(errorMsg);        
        return { success: false, error: errorMsg };
    }
}
