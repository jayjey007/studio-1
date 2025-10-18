
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported, Messaging } from "firebase/messaging";

const firebaseConfig = {
  "projectId": "studio-9367397757-f04cc",
  "appId": "1:129385794267:web:bac743908597ea0c44dafe",
  "apiKey": "AIzaSyBqUs7aTQniRqK3LMBD0IJZWxhJbZCsoik",
  "authDomain": "studio-9367397757-f04cc.firebaseapp.com",
  "measurementId": "G-5G9M5445Y9",
  "messagingSenderId": "129385794267",
  "storageBucket": "studio-9367397757-f04cc.appspot.com"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

const messaging: Promise<Messaging | null> = isSupported().then(supported => supported ? getMessaging(app) : null);


export { db, storage, auth, messaging };

    