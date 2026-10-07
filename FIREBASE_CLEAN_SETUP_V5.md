# MEESHO A+ LISTING AUTOMATION PRO — Clean Email-Primary Firebase V5

## Final Firestore model

Only `admins` is preserved during the clean reset. The Admin Panel then recreates:

- `customers`
- `plans`
- `activationKeys`
- `settings`

Membership identity is the normalized customer email. Firebase UID is metadata only.
Devices are nested under `customers/{email}/devices/{slot}`.

## Removed

- `users`
- `memberships`
- top-level `devices`
- `payments`
- `promoCodes`
- UPI/payment fields
- legacy UID membership migration

## Clean reset

1. Open Firebase Console → Firestore → Data.
2. Keep `admins`.
3. Delete the old non-admin collections if they are still present.
4. Replace Firestore Rules with `firestore.rules` from this package and Publish.
5. Deploy the updated Admin Panel files to the GitHub Pages repository.
6. Sign in with the existing authorized Admin Google account.
7. Dashboard → **Initialize** once.
8. The required collections/documents are then created automatically by the Admin Panel.

The Dashboard also contains **Clean Legacy Data**. It is destructive and keeps `admins` untouched. Use it only when you intentionally want a full reset.

## Admin controls

- Plans: create/edit/delete Monthly, Yearly, Lifetime.
- Activation Keys: create, Gmail-bind, copy, delete.
- Customers: suspend/unsuspend and increase/decrease device limit from 1–20.
- Devices: view and remove individual device slots.
- Memberships: view and revoke/restore membership.
- Settings: app/support details only; no UPI/payment/promo system.

## Important

Do not create Firebase collections manually after this reset. The Admin Panel creates the required structure when initialized and creates customer/device documents automatically as users log in and activate.
