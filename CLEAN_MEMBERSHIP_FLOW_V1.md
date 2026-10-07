# Clean Membership Flow V1

1. User opens extension.
2. User signs in with Google.
3. If no active membership exists, extension shows published plans.
4. Clicking a plan opens the configured WhatsApp purchase message directly.
5. Admin creates a one-time Activation Key from the Admin Panel and selects the plan.
6. User pastes that key after signing in.
7. The first successful redemption binds the currently signed-in Gmail as the permanent Master Gmail.
8. The same Master Gmail can use up to exactly 3 active device slots.
9. A different Gmail cannot use the already redeemed key or access the Master Gmail membership.
10. Renewals with another unused key extend an active membership from its current expiry.
11. Admin can edit/delete plans, delete activation keys, suspend/revoke memberships, remove devices, and factory-reset product data.
12. Factory Reset never touches the `admins` collection; it rebuilds only the canonical product collections.

Admin Panel remains intact. The `admins` collection is never included in the factory-reset deletion list.
