import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const statusEl = document.getElementById("status");

function getParentOrigin() {
  const origins = document.location.ancestorOrigins;
  const origin = origins && origins.length ? origins[origins.length - 1] : "";
  return origin.startsWith("chrome-extension://") ? origin : "";
}

function sendToExtension(payload) {
  const parentOrigin = getParentOrigin();
  if (!parentOrigin || window.parent === window) return;
  window.parent.postMessage(payload, parentOrigin);
}

async function runAuth() {
  statusEl.textContent = "Opening Google sign-in…";

  try {
    const credential = await signInWithPopup(auth, provider);
    const user = credential.user;
    const idToken = await user.getIdToken(true);

    sendToExtension({
      type: "FIREBASE_AUTH_RESULT",
      result: {
        idToken,
        expiresIn: 3600,
        user: {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          photoURL: user.photoURL || ""
        }
      }
    });

    statusEl.textContent = "Signed in successfully.";
  } catch (error) {
    console.error("Firebase Google sign-in failed", error);

    sendToExtension({
      type: "FIREBASE_AUTH_RESULT",
      error: error?.message || error?.code || "Google sign-in failed."
    });

    statusEl.textContent = error?.message || "Google sign-in failed.";
  }
}

window.addEventListener("message", event => {
  const expectedParent = getParentOrigin();

  if (!expectedParent) return;
  if (event.origin !== expectedParent) return;
  if (event.source !== window.parent) return;

  if (event.data?.type === "FIREBASE_AUTH_START") {
    runAuth();
  }
});
