
'use server';

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging, Message, MulticastMessage } from 'firebase-admin/messaging';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';
import { Vonage } from '@vonage/server-sdk';
import { vonageConfig } from '@/config/vonage';

// This function should be defined within the file or imported from a non-'use server' module.
// For simplicity, we define it here to avoid cross-module issues with 'use server'.
function getAdminApp(): App | null {
    if (getApps().some(app => app.name === 'admin')) {
        return getApps().find(app => app.name === 'admin')!;
    }
    try {
        return initializeApp({ projectId: firebaseConfig.projectId }, 'admin');
    } catch (e: any) {
        console.warn(
            "Admin initialization failed. This may be expected in local development.",
            e.message
        );
        return null;
    }
}


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
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2', phoneNumber: '+12065105393' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22', phoneNumber: '+447868232024' }
];

const FUN_FACTS = [
    "A group of flamingos is called a 'flamboyance'.",
    "The unicorn is the national animal of Scotland.",
    "A single strand of spaghetti is called a 'spaghetto'.",
    "The plural of 'octopus' is 'octopuses', not 'octopi'.",
    "Honey never spoils.",
    "Bananas are berries, but strawberries aren't.",
    "A crocodile cannot stick its tongue out.",
    "The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.",
    "A shrimp's heart is in its head.",
    "It is impossible for most people to lick their own elbow.",
    "Slugs have four noses.",
    "An ostrich's eye is bigger than its brain.",
    "A sneeze travels at about 100 miles per hour.",
    "Octopuses have three hearts.",
    "The heart of a blue whale is so big, a human can swim through its arteries.",
    "Wombat poop is cube-shaped.",
    "A day on Venus is longer than a year on Venus.",
    "The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion.",
    "The Spanish national anthem has no words.",
    "Goats have rectangular pupils.",
    "The blob of toothpaste on a toothbrush has a name: a 'nurdle'.",
    "There are more fake flamingos in the world than real ones.",
    "A 'jiffy' is an actual unit of time: 1/100th of a second.",
    "A group of owls is called a 'parliament'.",
    "The inventor of the Pringles can is now buried in one.",
    "There are more possible iterations of a game of chess than there are atoms in the known universe.",
    "Cleopatra lived closer in time to the first moon landing than to the building of the Great Pyramid of Giza.",
    "A group of jellyfish is called a 'smack'.",
    "The Hawaiian alphabet has only 12 letters.",
    "A group of rhinos is called a 'crash'.",
    "There is a town in Norway called 'Hell'.",
    "There are more stars in the universe than grains of sand on all the beaches on Earth.",
    "The longest word in English without a vowel is 'rhythms'.",
    "There are over 8,000 different varieties of apples.",
    "The can opener was invented 48 years after the can.",
    "Cows have best friends and get stressed when they are separated.",
    "The 'M's in M&M's stand for 'Mars' and 'Murrie'.",
    "Humans share 60% of their DNA with bananas.",
    "A group of porcupines is called a 'prickle'.",
    "It rains diamonds on Saturn and Jupiter.",
    "You can't hum while holding your nose.",
    "A single cloud can weigh more than 1 million pounds.",
    "A cat has 32 muscles in each ear.",
    "The first orange wasn't orange.",
    "A group of crows is called a 'murder'.",
    "There is a species of jellyfish that is immortal.",
    "The national animal of Australia is the kangaroo, which can't walk backward.",
    "The average person walks the equivalent of three times around the world in a lifetime.",
    "Sea otters hold hands when they sleep so they don't float away from each other.",
    "The tongue is the only muscle in the human body that is attached at only one end.",
    "A cockroach can live for a week without its head."
];

const NOTIFICATION_COOLDOWN_MINUTES = 3;

function getRandomFunFact(): string {
    return FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
}


export async function sendNotification({ message, sender, messageId }: sendNotificationProps): Promise<NotificationResult> {
    const adminApp = getAdminApp();
    if (!adminApp) {
        const errorMsg = "Firebase Admin SDK not initialized. Skipping notification.";
        console.warn(errorMsg);
        return { success: false, error: errorMsg };
    }

    const firestore = getFirestore(adminApp);
    const messaging = getMessaging(adminApp);
    
    const recipient = ALL_USERS.find(user => user.username !== sender);

    if (!recipient) {
        const errorMsg = 'No recipient found to send notification.';
        console.log(errorMsg);
        return { success: false, error: errorMsg };
    }

    // Check recipient's activity status and notification cooldown
    try {
        const userDocRef = firestore.collection('users').doc(recipient.uid);
        const userDoc = await userDocRef.get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const now = Timestamp.now();
            const lastActive = userData?.lastActive as Timestamp | undefined;
            const lastNotificationSentAt = userData?.lastNotificationSentAt as Timestamp | undefined;

            // 1. Check if user is active
            if (lastActive) {
                const diffSeconds = now.seconds - lastActive.seconds;
                // If user was active in the last 10 seconds, don't send a notification
                if (diffSeconds < 10) {
                    console.log(`Recipient ${recipient.username} is active. Skipping notification.`);
                    return { success: true, skipped: true };
                }
            }

            // 2. Check if a notification was already sent since the user was last active
            if (lastNotificationSentAt && lastActive && lastNotificationSentAt.seconds > lastActive.seconds) {
                console.log(`A notification has already been sent to ${recipient.username} since their last activity. Skipping.`);
                return { success: true, skipped: true };
            }

            // 3. Check notification cooldown
            if (lastNotificationSentAt) {
                const diffMinutes = (now.seconds - lastNotificationSentAt.seconds) / 60;
                if (diffMinutes < NOTIFICATION_COOLDOWN_MINUTES) {
                    console.log(`Notification cooldown for ${recipient.username} is active. Skipping notification.`);
                    return { success: true, skipped: true };
                }
            }
        }
    } catch(error: any) {
        console.error("Error checking user activity/cooldown:", error.message);
        // Proceed with sending notification even if activity check fails
    }
    
    try
    {
        const fcmDoc = await firestore.collection('fcmTokens').doc(recipient.username).get();    
   
        if (!fcmDoc.exists) {
            const errorMsg = `No FCM token document found for username: ${recipient.username}`;
            console.log(errorMsg);        
            return { success: true, error: errorMsg };
        }

        const fcmToken = fcmDoc.exists ? fcmDoc.data()!.token : null;

        if (!fcmToken) {
            const errorMsg = `FCM token is empty for user: ${recipient.username}`;
            console.log(errorMsg);        
            return { success: false, error: errorMsg };
        }

        const funFact = getRandomFunFact();

        const payload: Message = {
            token: fcmToken,            
                notification: {
                    title: 'Fun Fact',
                    body: funFact,
                },                           
            apns: {               
                payload: {
                    aps: {                       
                        sound: 'default',
                        badge: 1,
                    },
                    'messageId': messageId,
                },
            },
        };  
    
        await messaging.send(payload);
        console.log(`Successfully sent push notification to ${recipient.username}`);

        const vonageApiKey = vonageConfig.apiKey;
        const vonageApiSecret = vonageConfig.apiSecret;
        const vonagePhoneNumber = vonageConfig.phoneNumber;

        // Send SMS via Vonage
        if (vonageApiKey && vonageApiSecret && vonagePhoneNumber && recipient.phoneNumber) {
            try {
                const vonage = new Vonage({
                    apiKey: vonageApiKey,
                    apiSecret: vonageApiSecret
                });

                const from = vonagePhoneNumber;
                const to = recipient.phoneNumber;
                const text = funFact;

                await vonage.sms.send({ to, from, text });
                console.log(`Successfully sent SMS to ${recipient.username} at ${to}`);
            } catch (smsError: any) {
                console.error(`Error sending SMS to ${recipient.username}: ${smsError.message}`);
                // We don't return an error here, as the push notification might have succeeded.
            }
        } else {
            console.log("Vonage credentials or recipient phone number not set. Skipping SMS.");
            if (!vonageApiKey) console.log("VONAGE_API_KEY is not set.");
            if (!vonageApiSecret) console.log("VONAGE_API_SECRET is not set.");
            if (!vonagePhoneNumber) console.log("VONAGE_PHONE_NUMBER is not set.");
            if (!recipient.phoneNumber) console.log("Recipient phone number is not set.");
        }
        
        // Update the last notification timestamp
        const userDocRef = firestore.collection('users').doc(recipient.uid);
        await userDocRef.set({ lastNotificationSentAt: Timestamp.now() }, { merge: true });

        return { success: true };
    } catch (error: any) {
        const errorMsg = `Error sending notification to ${recipient.username}: ${error.message}`;
        console.error(errorMsg);        
        return { success: false, error: errorMsg };
    }
}

    