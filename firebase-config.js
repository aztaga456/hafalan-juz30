// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDWd05cOa9cGaKDA2A9TpV5nhoKEVu2rIU",
  authDomain: "hafalanjuz30-1fd14.firebaseapp.com",
  projectId: "hafalanjuz30-1fd14",
  storageBucket: "hafalanjuz30-1fd14.firebasestorage.app",
  messagingSenderId: "949623165765",
  appId: "1:949623165765:web:ae25824e84f51873b1e42c",
  measurementId: "G-GRB9FRH3HB"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // Analytics might not be supported in some environments (e.g. localhost or ad blockers)
}

export { sendPasswordResetEmail };
