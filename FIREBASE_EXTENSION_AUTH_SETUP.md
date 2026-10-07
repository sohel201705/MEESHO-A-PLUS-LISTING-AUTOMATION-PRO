# MEESHO A+ LISTING AUTOMATION PRO — Firebase/GitHub Setup

## Admin authorization

The signed-in Google account is authorized when its own Firestore document exists at `admins/{uid}` with `active: true`. The panel does not hard-code an Admin UID.

```text
active: true
name: "Sohel Enterprise"
role: "admin"
```

## GitHub Pages files

Upload these files to the repository root:

```text
index.html
admin.js
styles.css
firebase-config.js
extension-auth.html
extension-auth.js
firestore.rules
```

`index.html` is the Admin Panel entry point.

## Final Admin menu

```text
Dashboard
Users
Plans
Activation Keys
Memberships
Devices
Settings
```

There is no Payments menu and no Promo Codes menu in this final build.

## Final plan schema

Only these plan fields are used:

```text
name
price
offerPrice
durationDays
active
displayOrder
shippingEnabled
deviceLimit
```

All plans are expected to use:

```text
deviceLimit = 3
shippingEnabled = true
```

Lifetime uses:

```text
durationDays = 0
```

## Final settings schema

```text
appName
brandName
supportName
supportEmail
supportPhone
whatsapp
paymentMode
```

Default values:

```text
appName: MEESHO A+ LISTING AUTOMATION PRO
brandName: Sohel Enterprise
supportName: Sohel Rana
supportEmail: sohelenterpriseofficial@gmail.com
supportPhone: 9064827025
whatsapp: 919064827025
paymentMode: WHATSAPP_MANUAL
```

## Activation flow

```text
Admin searches or enters Gmail
        ↓
Admin selects plan
        ↓
Activation Key generated
        ↓
Copy / WhatsApp
        ↓
Customer logs in with same Google Gmail
        ↓
Customer enters one-time key
        ↓
Key is redeemed in the same atomic operation as membership creation
        ↓
Membership ACTIVE
        ↓
Autofill + Shipping + 3 devices
```

## Important

The separate Extension V6 package contains the original Meesho automation files plus the email-primary membership gateway and WhatsApp plan flow.
