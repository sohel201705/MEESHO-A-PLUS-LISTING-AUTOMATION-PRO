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


## WhatsApp-only payment flow
Customers no longer submit UPI/QR/UTR/receipt inside the extension. A plan button opens WhatsApp directly. After payment is verified in WhatsApp, use Admin Panel → Memberships → Activate Membership to choose the customer and plan. Plans can be Monthly, Yearly, Lifetime / Unlimited, or any custom duration created under Plans.


### Final manual sales flow
1. Customer signs in with Google.
2. Customer sees active paid plans from Firestore only.
3. Customer clicks Buy via WhatsApp; WhatsApp opens directly with the selected plan and price.
4. Customer receives payment details in WhatsApp, pays, and sends screenshot/UTR in WhatsApp.
5. Admin opens Memberships → Approve & Activate Membership, selects the customer and the plan, optionally keeps Renewal checked, and activates access.
6. Monthly = 30 days, Yearly = 365 days, Lifetime / Unlimited = 0 days by default; all are editable from Plans.
