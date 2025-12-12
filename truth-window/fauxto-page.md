# Fauxto Booth Session Log

## User Request (verbatim)
I'd like to add a Fauxto front end page. It will have a corresponding agent fauxto-agent and the id is the fauxtoId. Can we have that at /fauxtos/<fauxtoId> and follow the useAgent pattern.

## What I Delivered
- Added a `/fauxtos/:fauxtoId` route handled by a new `FauxtoPage` component that subscribes to `fauxto-agent` instances via `useAgent`.
- Rendered the generated image (or a placeholder while pending), surfaced the guest roster, and included copy/share affordances plus a button back to the parent booth.
- Wired the router to recognize Fauxto routes so the page loads alongside the existing host/phone views.
- Linked the Booth and Phone galleries to the Fauxto page so hosts and guests can tap through from any thumbnail, and the Fauxto page links back to the originating booth.
