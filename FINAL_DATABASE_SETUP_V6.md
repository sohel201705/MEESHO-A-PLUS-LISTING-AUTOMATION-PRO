# MEESHO A+ LISTING AUTOMATION PRO — Admin V6

## Membership identity
- Primary key: normalized Gmail/email.
- `customers/{email}` is the membership record.
- Firebase UID is never used to select membership.
- UID may be stored as login/device metadata only.

## Admin security
The admin panel checks `admins/{loggedInUid}.active == true`.
The `admins` collection is never deleted by Factory Reset.

## Database controls
### Integrate / Rebuild
Creates/repairs:
- customers/_meta
- plans/_meta
- activationKeys/_meta
- settings/general
- monthly / yearly / lifetime plans if missing

### Factory Reset
Deletes all managed product/legacy collections and preserves `admins`.
After deletion it automatically runs Integrate / Rebuild.

The reset list is in `admin.js` as `MANAGED_COLLECTIONS`.
