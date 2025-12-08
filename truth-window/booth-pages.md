# Fauxto Booth Session Log

## User Request (verbatim)
Let's break that App.tsx into pages components. Probably clearer right?

## What I Delivered
- Added a lightweight router-only `App.tsx` plus a shared `Navigate` type to keep navigation concerns isolated.
- Moved the landing experience, booth host dashboard, and phone capture view into `src/pages/` for cleaner ownership and easier future edits.
- Preserved the agent wiring and styling for each page while keeping links/QR flows working end-to-end.
