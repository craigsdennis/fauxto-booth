# Fauxto Booth Session Log

## User Request (verbatim)
There is fauxto sharing but I would like to add booth sharing following the similar path

## Additional User Request (verbatim)
Maybe we should put the share stuff together. When we do can we make it so it doesn't write the url on page.

## Additional User Request (verbatim)
Any way we could merge this with the fauxto share too. Make it look similar?

## Additional User Request (verbatim)
Any chance to break that out into a component that they both use?

## Additional User Request (verbatim)
Alright can you add a truth-window about sharing.md please

## Additional User Request (verbatim)
Remember to format it like the others. What I asked for verbatim please

## Additional User Request (verbatim)
(include what I asked for during this session in that doc please)

## What I Delivered
- Added a shared `SharePanel` partial so booths and Fauxto pages use the same share UI instead of bespoke button stacks.
- Updated the booth host page to use the panel with QR + “Add your selfie” CTA alongside copy/share/text/X actions, removing the raw URL text.
- Updated the Fauxto page to use the panel (no QR) for consistent sharing controls.
- Documented the share flows: `/share/booths/:slug` redirects to `/booths/:slug` with OG/Twitter metadata, mirroring the existing `/share/fauxtos/:id` redirect to `/fauxtos/:id`.
