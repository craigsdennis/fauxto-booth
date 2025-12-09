# Fauxto Booth Session Log

## User Request (verbatim)
On the BoothPage I've updated the state to be server side. backgroundImageStatus, will change between generating and ready. Can you change the current logic in there. I don't want to run multiple requests, so disable the refresh unless ready. The QR code generator should be client side and not use an external API please.

## What I Delivered
- Hooked the BoothPage into the new `backgroundImageStatus` field so the regenerate button disables while the server is rendering and only fires when the state returns to `ready`.
- Added local QR code rendering by pulling in the `qrcode` library, generating a data URL client-side, and showing loading/error fallbacks so no third-party QR service is hit.
