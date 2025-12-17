# Fauxto Booth Session Log

## User Request (verbatim)
I'd like to add a Fauxto front end page. It will have a corresponding agent fauxto-agent and the id is the fauxtoId. Can we have that at /fauxtos/<fauxtoId> and follow the useAgent pattern.

## What I Delivered
- Added a `/fauxtos/:fauxtoId` route handled by a new `FauxtoPage` component that subscribes to `fauxto-agent` instances via `useAgent`.
- Rendered the generated image (or a placeholder while pending), surfaced the guest roster, and included copy/share affordances plus a button back to the parent booth.
- Wired the router to recognize Fauxto routes so the page loads alongside the existing host/phone views.
- Linked the Booth and Phone galleries to the Fauxto page so hosts and guests can tap through from any thumbnail, and the Fauxto page links back to the originating booth.

## Additional User Request (verbatim)
Alright when I share the fauxto on social it is going to drop on the Fauxto page. There if the userId isn't already uploaded to the booth offer a link that says "Join in, add your selfie to <booth name>" Where booth name also links to the booth. Remember most likely on phone.

## What I Delivered (update)
- Added a `BoothAgent.hasUserUpload` callable so the Fauxto view can quickly determine whether the visiting `userId` already has an upload in that booth.
- The Fauxto page now reads the `userId` cookie, checks the booth once the parent info resolves, and when the visitor hasn't participated yet it displays a mobile-friendly CTA with two inline links: one to jump straight to the booth's phone upload screen and another on the booth name that opens its control room.
- Hid the CTA entirely when the booth info is missing, the user already uploaded, or the lookup is still pending so returning guests keep the existing streamlined layout.
