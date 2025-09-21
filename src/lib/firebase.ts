
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  "projectId": "studio-9367397757-f04cc",
  "appId": "1:129385794267:web:bac743908597ea0c44dafe",
  "apiKey": "AIzaSyBqUs7aTQniRqK3LMBD0IJZWxhJbZCsoik",
  "authDomain": "studio-9367397757-f04cc.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "129385794267",
  "storageBucket": "studio-9367397757-f04cc.firebasestorage.app"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth };
