// firebase-init.js
// ✅ Firebase modular SDK v11.0.1 (single source of truth for the whole app)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBH0euIL0ijvI_3oIGg8Xg4qWxqCzlqm3k",
  authDomain: "planfitnessapp.firebaseapp.com",
  projectId: "planfitnessapp",
  storageBucket: "planfitnessapp.appspot.com", // revisa que coincida con la consola
  messagingSenderId: "524553558424",
  appId: "1:524553558424:web:d76a8d143e45b0e8d433ed",
  measurementId: "G-ZMB64R3769"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Re-export helpers so every page imports from this file (avoids version mismatch errors)
export {
  onAuthStateChanged,
  signOut,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
};
