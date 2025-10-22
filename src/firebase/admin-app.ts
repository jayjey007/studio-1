
'use server'

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

let app: App;

export async function initializeAdminApp() {
    if (getApps().length > 0) {
        app = getApps()[0];
        return {
            app: app,
            auth: getAuth(app),
            firestore: getFirestore(app)
        }
    }

    try {
        // This will automatically use GOOGLE_APPLICATION_CREDENTIALS in the App Hosting environment,
        // and for local development, the projectId is sufficient.
        app = initializeApp({
          projectId: firebaseConfig.projectId,
        });
    } catch(e) {
        console.error("Firebase Admin SDK initialization failed", e);
        return null;
    }


    return {
        app: app,
        auth: getAuth(app),
        firestore: getFirestore(app)
    };
}
