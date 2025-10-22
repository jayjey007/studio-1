
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
        // This will automatically use GOOGLE_APPLICATION_CREDENTIALS in the App Hosting environment
        app = initializeApp();
    } catch(e) {
        // For local development, the projectId is sufficient.
        console.warn("Standard admin initialization failed, likely in a local environment. Falling back to explicit projectId.", e);
        try {
            app = initializeApp({
              projectId: firebaseConfig.projectId,
            });
        } catch (localError) {
            console.error("Firebase Admin SDK initialization failed completely.", localError);
            return null;
        }
    }


    return {
        app: app,
        auth: getAuth(app),
        firestore: getFirestore(app)
    };
}
