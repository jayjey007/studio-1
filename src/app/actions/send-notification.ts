
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
    skipped?: boolean;
}

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

const FUN_FACTS = [
    "A single cloud can weigh more than 1 million pounds.",
    "A human could swim through the veins of a blue whale.",
    "The unicorn is the national animal of Scotland.",
    "Bananas are berries, but strawberries aren't.",
    "It can rain diamonds on other planets.",
    "The Eiffel Tower can be 15 cm taller during the summer.",
    "A flock of crows is known as a murder.",
    "Octopuses have three hearts.",
    "There are more trees on Earth than stars in the Milky Way.",
    "Honey never spoils."
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
    
    const recipient = ALL_USERS.find(user => user.username !== sender);

    if (!recipient) {
        const errorMsg = 'No recipient found to send notification.';
        console.log(errorMsg);
        return { success: false, error: errorMsg };
    }

    // Check recipient's activity status
    try {
        const userDoc = await firestore.collection('users').doc(recipient.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const lastActive = userData?.lastActive as Timestamp | undefined;
            if (lastActive) {
                const now = Timestamp.now();
                const diffSeconds = now.seconds - lastActive.seconds;
                // If user was active in the last 10 seconds, don't send a notification
                if (diffSeconds < 10) {
                    console.log(`Recipient ${recipient.username} is active. Skipping notification.`);
                    return { success: true, skipped: true };
                }
            }
        }
    } catch(error: any) {
        console.error("Error checking user activity:", error.message);
        // Proceed with sending notification even if activity check fails
    }
    
    const tokensCollection = firestore.collection('fcmTokens');
    const querySnapshot = await tokensCollection
      .where('username', '==', recipient.username)
      .get();


    if (querySnapshot.empty) {
        const errorMsg = `No FCM token document found for username: ${recipient.username}`;
        console.log(errorMsg);        
        return { success: false, error: errorMsg };
    }

    // Sort documents by createdAt timestamp in descending order to find the latest token.
    const tokens = querySnapshot.docs.map(doc => doc.data());
    tokens.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    const latestToken = tokens[0];

    const fcmToken = latestToken?.token;

    if (!fcmToken) {
        const errorMsg = `FCM token is empty for user: ${recipient.username}`;
        console.log(errorMsg);        
        return { success: false, error: errorMsg };
    }
    
    const randomFact = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];

    const payload: MulticastMessage = {
        tokens: [fcmToken],
        notification: {
            title: 'Fun Facts',
            body: randomFact,
        },
        webpush: {
            fcmOptions: {
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
                        title: 'Fun Facts',
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
        console.log(`Successfully sent notification to ${recipient.username}`);
        return { success: true };
    } catch (error: any) {
        const errorMsg = `Error sending notification to ${recipient.username}: ${error.message}`;
        console.error(errorMsg);        
        return { success: false, error: errorMsg };
    }
}
