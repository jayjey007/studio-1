
'use server';

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging, Message } from 'firebase-admin/messaging';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';
import { vonageConfig } from '@/config/vonage';
import { Vonage } from '@vonage/server-sdk';

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
    "A cockroach can live for a week without its head.",
    "The Great Wall of China is not visible from the moon with the naked eye.",
    "A bolt of lightning is five times hotter than the sun.",
    "The state of Florida is larger than England.",
    "An apple, potato, and onion all taste the same if you eat them with your nose plugged.",
    "The oldest 'your mom' joke was discovered on a 3,500-year-old Babylonian tablet.",
    "There are more public libraries in the US than McDonald's restaurants.",
    "A cat's purr may be a form of self-healing, as it can be a sign of nervousness as well as contentment.",
    "The sound of a whip cracking is actually a small sonic boom.",
    "A baby puffin is called a 'puffling'.",
    "The voices of Mickey and Minnie Mouse were married in real life.",
    "The term 'robot' comes from a Czech word, 'robota', meaning 'forced labor'.",
    "A day on Earth is not 24 hours but 23 hours, 56 minutes, and 4 seconds.",
    "The human brain takes in 11 million bits of information every second but is aware of only 40.",
    "The sentence 'The quick brown fox jumps over the lazy dog' uses every letter in the English alphabet.",
    "In Switzerland, it is illegal to own just one guinea pig.",
    "The world's largest desert is Antarctica.",
    "The name for the fear of long words is 'hippopotomonstrosesquippedaliophobia'.",
    "A 'lethologica' is the state of not being able to remember the word you want.",
    "The dot over the letter 'i' is called a 'tittle'.",
    "There's a species of snail that can sleep for three years.",
    "The fingerprints of a koala are so indistinguishable from humans that they have on occasion been confused at a crime scene.",
    "The first-ever VCR was the size of a piano.",
    "A ‘jiffy’ is an actual unit of time for 1/100th of a second.",
    "A group of porcupines is called a prickle.",
    "It physically isn’t possible for a pig to look up at the sky.",
    "The ‘M’s’ in M&Ms stand for ‘Mars’ and ‘Murrie’.",
    "Most of the dust in your home is actually dead skin.",
    "The longest English word is 189,819 letters long.",
    "The strongest muscle in the body is the tongue.",
    "A cockroach can live for nine days without its head before it starves to death.",
    "It's illegal to own just one guinea pig in Switzerland.",
    "The ancient Romans used to drop a piece of toast into their wine for good health.",
    "Your ears and nose never stop growing.",
    "There is a city in Michigan called 'Hell'.",
    "The King of Hearts is the only king without a mustache.",
    "A ball of glass will bounce higher than a ball of rubber.",
    "Caterpillars have 12 eyes.",
    "It is impossible to sneeze with your eyes open.",
    "A ‘moment’ is a medieval unit of time equal to 90 seconds.",
    "The human heart beats over 100,000 times a day.",
    "A shark is the only known fish that can blink with both eyes.",
    "On average, a person will spend about five years of their life waiting in lines.",
    "The 20th of March is 'Snowman Burning Day' in Switzerland.",
    "It would take 1,200,000 mosquitoes, each sucking once, to completely drain the average human of blood.",
    "A snail can sleep for three years.",
    "The hashtag symbol is technically called an octothorpe.",
    "A ‘gal’ is a unit of acceleration equal to 1 centimeter per second squared.",
    "The longest recorded flight of a chicken is 13 seconds.",
    "The sound a cat makes is called a 'caterwaul'.",
    "The first movie to ever be rated PG-13 was 'Red Dawn' in 1984.",
    "The state of Kentucky has more bourbon barrels than people.",
    "A ‘gale’ is a very strong wind, but not as strong as a hurricane.",
    "The word 'nerd' was first coined by Dr. Seuss in 'If I Ran the Zoo'.",
    "The name of the city 'Rome' has the same spelling in all languages.",
    "The word 'muscle' comes from a Latin term meaning 'little mouse'.",
    "A ‘butt’ is a medieval unit of wine equal to about 126 gallons.",
    "The human nose can remember 50,000 different scents.",
    "The 'sixth sick sheik's sixth sheep's sick' is believed to be the toughest tongue twister in the English language.",
    "The word 'checkmate' in chess comes from the Persian phrase 'Shah Mat,' which means 'the king is dead'.",
    "The oldest piece of chewing gum is 9,000 years old."
];


const NOTIFICATION_COOLDOWN_MINUTES = 3;

async function getFunFact(firestore: any, userId: string): Promise<{ fact: string, newUsedIndices: number[] }> {
    const userDocRef = firestore.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    let usedIndices: number[] = userDoc.exists ? userDoc.data()?.usedFunFactIndices || [] : [];
    
    if (usedIndices.length >= FUN_FACTS.length) {
        usedIndices = []; // Reset if all facts have been used
    }
    
    let factIndex;
    do {
        factIndex = Math.floor(Math.random() * FUN_FACTS.length);
    } while (usedIndices.includes(factIndex));
    
    const newUsedIndices = [...usedIndices, factIndex];
    
    return { fact: FUN_FACTS[factIndex], newUsedIndices };
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

    const userDocRef = firestore.collection('users').doc(recipient.uid);

    try {
        const userDoc = await userDocRef.get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const now = Timestamp.now();
            const lastActive = userData?.lastActive as Timestamp | undefined;
            const lastNotificationSentAt = userData?.lastNotificationSentAt as Timestamp | undefined;

            if (lastActive) {
                const diffSeconds = now.seconds - lastActive.seconds;
                if (diffSeconds < 10) {
                    console.log(`Recipient ${recipient.username} is active. Skipping notification.`);
                    return { success: true, skipped: true };
                }
            }

            if (lastNotificationSentAt && lastActive && lastNotificationSentAt.seconds > lastActive.seconds) {
                console.log(`A notification has already been sent to ${recipient.username} since their last activity. Skipping.`);
                return { success: true, skipped: true };
            }

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
    }
    
    try {
        const fcmDoc = await firestore.collection('fcmTokens').doc(recipient.username).get();    
        const fcmToken = fcmDoc.exists ? fcmDoc.data()!.token : null;

        if (fcmToken) {
            const { fact, newUsedIndices } = await getFunFact(firestore, recipient.uid);
            const payload: Message = {
                token: fcmToken,            
                notification: {
                    title: 'Fun Fact',
                    body: fact,
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
            await userDocRef.set({ 
                lastNotificationSentAt: Timestamp.now(),
                usedFunFactIndices: newUsedIndices 
            }, { merge: true });

            return { success: true };
        } else {
            console.log(`No FCM token found for ${recipient.username}. Attempting to send SMS.`);
            
            const vonageApiKey = vonageConfig.apiKey;
            const vonageApiSecret = vonageConfig.apiSecret;
            const vonagePhoneNumber = vonageConfig.phoneNumber;

            if (vonageApiKey && vonageApiSecret && vonagePhoneNumber && recipient.phoneNumber) {
                try {
                    const vonage = new Vonage({
                        apiKey: vonageApiKey,
                        apiSecret: vonageApiSecret
                    });

                    const from = vonagePhoneNumber;
                    const to = recipient.phoneNumber;
                    const { fact, newUsedIndices } = await getFunFact(firestore, recipient.uid);
                    const text = fact;

                    await vonage.sms.send({ to, from, text });
                    console.log(`Successfully sent SMS to ${recipient.username} at ${to}`);
                    
                    await userDocRef.set({ 
                        lastNotificationSentAt: Timestamp.now(),
                        usedFunFactIndices: newUsedIndices
                    }, { merge: true });
                    
                    return { success: true };
                } catch (smsError: any) {
                    console.error(`Error sending SMS to ${recipient.username}: ${smsError.message}`);
                    return { success: false, error: smsError.message };
                }
            } else {
                let reason = "Vonage credentials or recipient phone number not set. Skipping SMS.";
                if (!vonageApiKey) reason += " VONAGE_API_KEY is not set.";
                if (!vonageApiSecret) reason += " VONAGE_API_SECRET is not set.";
                if (!vonagePhoneNumber) reason += " VONAGE_PHONE_NUMBER is not set.";
                if (!recipient.phoneNumber) reason += " Recipient phone number is not set.";
                console.log(reason);
                return { success: false, error: reason };
            }
        }
    } catch (error: any) {
        const errorMsg = `Error sending notification to ${recipient.username}: ${error.message}`;
        console.error(errorMsg);        
        return { success: false, error: errorMsg };
    }
}

    