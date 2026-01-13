//TODO: make it like firebaseLogs.module (with async init and retry logic)

// firebase_auth_module.js
// Import the functions you need from the SDKs you need
// https://firebase.google.com/docs/web/setup#available-libraries

//  import { initializeApp } from "https://www.gstatic.com/firebasejs/{{{ FIREBASE_SDK_VERSION }}}/firebase-app.js";
//  import { getAnalytics } from "https://www.gstatic.com/firebasejs/{{{ FIREBASE_SDK_VERSION }}}/firebase-analytics.js";
//  import { getFirestore  } from "https://www.gstatic.com/firebasejs/{{{ FIREBASE_SDK_VERSION }}}/firebase-firestore.js";
//  import { getStorage  } from "https://www.gstatic.com/firebasejs/{{{ FIREBASE_SDK_VERSION }}}/firebase-storage.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/{{{ FIREBASE_SDK_VERSION }}}/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/{{{ FIREBASE_SDK_VERSION }}}/firebase-auth.js";

let _app = null;
let _auth = null;
let _initialized = false;
let _initPromise = null;

/**
 * Initialize Firebase Auth.
 * If called multiple times, returns the in-flight or completed promise.
 * @param {object} [config] - Firebase config; defaults to hardcoded dev config.
 * @returns {Promise<{ok:true}|{ok:false,error:Error}>}
 */
export function firebaseInit(config) {
  if (_initialized) return Promise.resolve({ ok: true });
  if (_initPromise) return _initPromise;

  /* Your web app's Firebase configuration */
  /* For Firebase JS SDK v7.20.0 and later, measurementId is optional */
  // Replace with your Firebase Auth configuration
  const firebaseConfig = config || {
    apiKey: "YOUR_FIREBASE_AUTH_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
  };

  _initPromise = (async () => {
    try {
      _app = initializeApp(firebaseConfig);
      _auth = getAuth(_app);

      const AuthAPI = {
        auth: _auth,
        signInAnonymously,
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        GoogleAuthProvider,
        signInWithPopup,
        signInWithRedirect,
        signOut,
        setPersistence,
        onAuthStateChanged,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
        getPersistenceType,
      };

      window.FirebaseAuthAPI = AuthAPI;
      _initialized = true;
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  })();

  return _initPromise;
}

function getPersistenceType(persistenceType) {
  switch (persistenceType) {
    case 0:
      return window.FirebaseAuthAPI.browserLocalPersistence; // LOCAL persistence
    case 1:
      return window.FirebaseAuthAPI.browserSessionPersistence; // SESSION persistence
    case 2:
      return window.FirebaseAuthAPI.inMemoryPersistence; // NONE (in-memory) persistence
    default:
      return window.FirebaseAuthAPI.browserLocalPersistence; // Default to LOCAL persistence
  }
}