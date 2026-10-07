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

const messageEl = document.getElementById("message");
const button = document.getElementById("googleLoginBtn");

const params = new URLSearchParams(location.search);
const redirectUrl = params.get("redirect");

function setMessage(text, type = "error") {
  messageEl.className = type;
  messageEl.textContent = text;
}

function buildCallbackUrl(result) {
  if (!redirectUrl) throw new Error("Missing extension callback URL.");

  const url = new URL(redirectUrl);
  const hash = new URLSearchParams({
    token: result.idToken,
    expiresIn: String(result.expiresIn || 3600),
    uid: result.user.uid || "",
    email: result.user.email || "",
    displayName: result.user.displayName || ""
  });

  url.hash = hash.toString();
  return url.toString();
}

async function login() {
  if (!redirectUrl) {
    setMessage("Invalid sign-in session. Please reopen the extension and try again.");
    return;
  }

  button.disabled = true;
  button.textContent = "Opening Google…";
  setMessage("Choose the Google account that will become the Master Gmail for this membership…", "success");

  try {
    const credential = await signInWithPopup(auth, provider);
    const user = credential.user;
    const idToken = await user.getIdToken(true);

    setMessage("Login successful. Returning to the extension…", "success");

    const target = buildCallbackUrl({
      idToken,
      expiresIn: 3600,
      user: {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || ""
      }
    });

    setTimeout(() => {
      location.replace(target);
    }, 250);
  } catch (error) {
    console.error("Firebase Google sign-in failed:", error);
    button.disabled = false;
    button.textContent = "Continue with Google";
    setMessage(error?.message || error?.code || "Google sign-in failed.");
  }
}

button.addEventListener("click", login);
