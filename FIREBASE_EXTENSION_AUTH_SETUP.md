# Firebase Extension Auth Bridge — V7.2 Customer Activation

## Activation model
1. Customer signs in with Google using the extension auth bridge.
2. The extension verifies membership only at `customers/{normalized Gmail}`.
3. Admin issues an activation key bound to the customer's exact Gmail.
4. Customer enters that key while signed in with the same Gmail.
5. The extension atomically redeems the key and creates or updates `customers/{email}`.
6. Firestore Rules independently verify the key, target email, plan values, expiry, device limit, shipping flag, and redemption identity.
7. The extension immediately re-checks entitlement and registers the device slot.
8. No manual admin approval is required after a valid key is issued.

## Firebase Console
1. Authentication → Sign-in method → Google must be enabled.
2. Authentication → Settings → Authorized domains must include `sohel201705.github.io`.
3. The extension auth bridge must remain deployed at the configured GitHub Pages URL.
4. Deploy the `firestore.rules` file from this package before production use.

## Admin responsibility
The activation workflow is key-driven. Admin does not need to manually activate a customer account: issuing a valid, email-bound activation key is sufficient. Customer activation is performed and verified atomically by the extension + Firestore Rules.

## Security notes
- Firebase UID is device/session metadata only; it is never the membership key.
- Activation keys are single-use and email-bound.
- Customer activation cannot change the shipping entitlement independently of the key.
- Customer activation updates are restricted to the membership fields used by the activation contract.
