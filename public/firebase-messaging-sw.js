// Scripts for firebase and firebase messaging
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const firebaseConfig = {
    apiKey: "AIzaSyBqUs7aTQniRqK3LMBD0IJZWxhJbZCsoik",
    authDomain: "studio-9367397757-f04cc.firebaseapp.com",
    projectId: "studio-9367397757-f04cc",
    storageBucket: "studio-9367397757-f04cc.appspot.com",
    messagingSenderId: "129385794267",
    appId: "1:129385794267:web:bac743908597ea0c44dafe",
    measurementId: "G-5G9M5445Y9"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icon-192x192.png", // A default icon
    data: {
        url: payload.data.url // Pass the URL to open
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data.url;
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus().then(c => c.navigate(urlToOpen));
            }
            return clients.openWindow(urlToOpen);
        })
    );
});

    