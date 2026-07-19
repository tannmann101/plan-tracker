import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from "firebase/firestore";

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true";

// Safe to commit: these are public client identifiers, not secrets.
// Access is controlled by Firestore security rules + Google sign-in, not by hiding this config.
// Replace with your own project's values from Firebase Console -> Project settings -> Your apps.
const firebaseConfig = useEmulator
  ? { apiKey: "demo-key", authDomain: "localhost", projectId: "demo-plan-tracker" }
  : {
      apiKey: "AIzaSyBtYX2TUx3NrvOI26wj9NPcMcvGZX_RZL8",
      authDomain: "plan-tracker-eb0c3.firebaseapp.com",
      projectId: "plan-tracker-eb0c3",
      storageBucket: "plan-tracker-eb0c3.firebasestorage.app",
      messagingSenderId: "886472751358",
      appId: "1:886472751358:web:2073f9694edb367c388daf",
    };

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// .env.local sets VITE_USE_FIREBASE_EMULATOR=true so local development never touches the real project.
if (useEmulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
