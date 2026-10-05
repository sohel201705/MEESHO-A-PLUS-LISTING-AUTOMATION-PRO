# MEESHO A+ LISTING AUTOMATION PRO — v2.1.0

## Final flow
1. Customer signs in with Google.
2. If no active membership exists, the pricing screen appears.
3. Customer chooses a plan and is sent to WhatsApp for payment.
4. Admin verifies payment in WhatsApp.
5. Admin Panel → Activation Keys → search existing Gmail or enter a new Gmail → choose plan → Generate Activation Key.
6. Admin copies/sends the code by WhatsApp.
7. Customer enters the one-time code in the extension while signed into the same Gmail.
8. The code is redeemed atomically and creates/updates one membership.
9. Autofill and Shipping Optimizer use the same membership state and expiry.
10. Device binding is checked after membership validation.

## Important
- Do not use old Payment/Promo pages for this final flow.
- Do not leave old extension versions loaded in Chrome.
- Publish the included firestore.rules before testing activation-key redemption.
- Plan prices are controlled only from Admin Panel → Plans. A zero price displays as Contact Admin rather than disappearing.
- Lifetime is durationDays=0 and expiryDate=null.
- Activation keys are intended to be generated after payment so the membership period starts immediately when the key is issued/redeemed.
