# Fauxto Booth Session Log — User Flow Enhancements

## User Request (verbatim)
The UserPage isn't finding the cookie so it's connecting to the agent using "" and that won't work. I see the cookie is there, please make sure to use it

## What I Delivered
- Seeded `userId` state from `ensureUserIdCookie()` on load, re-seeding only if it’s missing, and disabled the `useAgent` hook until a valid id exists so `/me` always subscribes to `user-agent/{real-id}` instead of the empty string.

## User Request (verbatim)
Add the invite sms link to the Fauxto page and make the share just copy the link maybe use that standard copy icon.

## What I Delivered
- Added memoized `sms:?body=` links to the Fauxto page, introduced a dedicated “Copy link” action with a copy icon (plus fallback prompt), kept Web Share for supported devices, and added direct SMS + X buttons so guests can share instantly.

## User Request (verbatim)
On the booth page under the QR code add a link for people on their phones to "📸Add your selfie" that goes to the Selfie station.

## What I Delivered
- Dropped a “📸 Add your selfie” button under the desktop QR code that routes to `/booths/{slug}/phone`, giving phone users a one-tap jump into the Selfie Station without re-scanning the code.
