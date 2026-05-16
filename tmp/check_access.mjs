import { collection, getDocs, getFirestore } from 'firebase/firestore/lite';
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: "AIzaSy..." , // Replace with actual values from .env.local if I can read it
  projectId: "conect3-ff1df",
  // ...
};

// I'll read .env.local first
