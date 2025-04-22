import { initializeApp, getApps, getApp } from "firebase/app";
import  {getAuth} from 'firebase/auth'
import { getFirestore } from "firebase/firestore";

// const firebaseConfig = {
//   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
//   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
//   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
//   storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
//   messagingSenderId: process.env.NEXT_PUBLIC_MESSAGE_ID,
//   appId: process.env.NEXT_PUBLIC_APP_ID,
//   measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID
// };

const firebaseConfig = {
  apiKey: "AIzaSyAsOx_vpaUozQMskkxel2d5MCZnDZTv1kM",
  authDomain: "ai-prep-fa6e0.firebaseapp.com",
  projectId: "ai-prep-fa6e0",
  storageBucket: "ai-prep-fa6e0.firebasestorage.app",
  messagingSenderId: "969819268588",
  appId: "1:969819268588:web:ff1ad7af5433ad2afaccc9",
  measurementId: "G-DW8RY5K0K7"
};



const app = !getApps.length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);