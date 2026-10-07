# Firebase Extension Auth Bridge

This GitHub Pages package now includes `extension-auth.html` and `extension-auth.js`.
The Chrome extension loads this page inside its MV3 offscreen document to complete Google sign-in with Firebase.

## Firebase Console
1. Authentication → Sign-in method → Google must be enabled.
2. Authentication → Settings → Authorized domains must include `sohel201705.github.io`.
3. After loading the unpacked extension, copy its Extension ID from `chrome://extensions` and add the extension URI/domain required by Firebase's Chrome-extension authentication guide.
4. Firestore Rules must be updated with the secure rules supplied inside the extension package.

## Payment approval
The updated Admin Panel approval flow now creates/updates `memberships/{uid}` using the selected plan's duration, then marks the payment approved and updates the user record.
