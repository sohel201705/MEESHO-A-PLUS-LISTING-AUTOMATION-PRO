import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAGmhXJkhVjV_BGcNP8plBDvsWXj8yLezo",
  authDomain: "meesho-a-plus-listing.firebaseapp.com",
  projectId: "meesho-a-plus-listing",
  storageBucket: "meesho-a-plus-listing.firebasestorage.app",
  messagingSenderId: "369751542960",
  appId: "1:369751542960:web:1f8f42b122959d5577bf75",
  measurementId: "G-CTQWC3D58F"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
const statusEl = document.getElementById('status');

function sendToExtension(payload) {
  const parentOrigin = document.location.ancestorOrigins?.[0];
  if (!parentOrigin || !parentOrigin.startsWith('chrome-extension://')) return;
  window.parent.postMessage(payload, parentOrigin);
}

async function runAuth() {
  statusEl.textContent = 'Opening Google sign-in…';
  try {
    const credential = await signInWithPopup(auth, provider);
    const user = credential.user;
    const idToken = await user.getIdToken(true);
    sendToExtension({
      type: 'FIREBASE_AUTH_RESULT',
      result: {
        idToken,
        expiresIn: 3600,
        user: {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || ''
        }
      }
    });
    statusEl.textContent = 'Signed in. You can close this window.';
  } catch (error) {
    console.error('Firebase Google sign-in failed', error);
    sendToExtension({
      type: 'FIREBASE_AUTH_RESULT',
      error: error?.message || error?.code || 'Google sign-in failed.'
    });
    statusEl.textContent = error?.message || 'Google sign-in failed.';
  }
}

window.addEventListener('message', (event) => {
  const expectedParent = document.location.ancestorOrigins?.[0];
  if (expectedParent && event.origin !== expectedParent) return;
  if (event.data?.type === 'FIREBASE_AUTH_START') runAuth();
});
