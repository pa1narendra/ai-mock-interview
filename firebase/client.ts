// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import  {getAuth} from 'firebase/auth'
import { getFirestore } from "firebase/firestore";

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