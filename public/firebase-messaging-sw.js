
// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker with the same config
const firebaseConfig = {
  apiKey: "AIzaSyBqUs7aTQniRqK3LMBD0IJZWxhJbZCsoik",
  authDomain: "studio-9367397757-f04cc.firebaseapp.com",
  projectId: "studio-9367397757-f04cc",
  storageBucket: "studio-9367397757-f04cc.firebasestorage.app",
  messagingSenderId: "129385794267",
  appId: "1:129385794267:web:bac743908597ea0c44dafe",
  measurementId: ""
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  
  // Customize the notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png', // Optional: you can add an icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
