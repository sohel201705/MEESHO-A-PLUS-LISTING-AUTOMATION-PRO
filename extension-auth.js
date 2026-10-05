import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
const statusEl = document.getElementById("status");

function parentOrigin() {
  const a = document.location.ancestorOrigins;
  const origin = a && a.length ? a[a.length - 1] : "";
  return origin.startsWith("chrome-extension://") ? origin : "";
}

function send(payload) {
  const origin = parentOrigin();
  if (!origin || window.parent === window) return;
  window.parent.postMessage(payload, origin);
}

async function login() {
  statusEl.textContent = "Opening Google sign-in…";
  try {
    const credential = await signInWithPopup(auth, provider);
    const user = credential.user;
    const idToken = await user.getIdToken(true);
    send({ type:"FIREBASE_AUTH_RESULT", result:{
      idToken, expiresIn:3600,
      user:{uid:user.uid,email:user.email||"",displayName:user.displayName||"",photoURL:user.photoURL||""}
    }});
    statusEl.textContent = "Signed in successfully.";
  } catch (error) {
    console.error(error);
    send({type:"FIREBASE_AUTH_RESULT",error:error?.message||error?.code||"Google sign-in failed."});
    statusEl.textContent = error?.message || "Google sign-in failed.";
  }
}

window.addEventListener("message", event => {
  const origin = parentOrigin();
  if (!origin || event.origin !== origin || event.source !== window.parent) return;
  if (event.data?.type === "FIREBASE_AUTH_START") login();
});
