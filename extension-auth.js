import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const PARENT_FRAME = document.location.ancestorOrigins[0] || "*";

function send(payload){
  try { globalThis.parent.self.postMessage(payload, PARENT_FRAME); }
  catch (_) { globalThis.parent.self.postMessage(payload, "*"); }
}

window.addEventListener("message", async (event) => {
  if (event.data?.type !== "FIREBASE_AUTH_START") return;
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const idToken = await user.getIdToken(true);
    send({type:"FIREBASE_AUTH_RESULT", result:{
      idToken,
      expiresIn: 3600,
      user:{uid:user.uid,email:user.email||"",displayName:user.displayName||"",photoURL:user.photoURL||""}
    }});
  } catch (error) {
    send({type:"FIREBASE_AUTH_RESULT", error:error?.message||"Google sign-in failed."});
  }
});
