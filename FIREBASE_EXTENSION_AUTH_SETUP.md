# MEESHO A+ LISTING AUTOMATION PRO — Firebase/GitHub Setup

## New Admin UID

```text
ANzaRtHgkJXlcPO8NmhzuAJ0b5C3
```

The corresponding Firestore admin document must be:

```text
admins/ANzaRtHgkJXlcPO8NmhzuAJ0b5C3
```

with:

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
email
phone
whatsapp
paymentMode
```

Default values:

```text
appName: MEESHO A+ LISTING AUTOMATION PRO
brandName: Sohel Enterprise
supportName: Sohel Rana
email: sohelenterpriseofficial@gmail.com
phone: 9064827025
whatsapp: 9064827025
paymentMode: WHATSAPP
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

This repository package updates the Admin Panel, Firebase rules, and Google-auth bridge.

It does **not** replace the original Meesho automation extension files (`manifest`, popup, background, content scripts, etc.). Those original feature files must be integrated with the new membership checks before the final extension ZIP is built, so existing autofill and listing automation are preserved.
