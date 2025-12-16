# Fauxto Booth Session Log

## User Request (verbatim)
Now I'd like the /admin page to also allow deletion of booths. It will delete all the child fauxtos, the uploads in r2, and the background photo in r2. Then it should do a destroy. Just like what happens in the FauxtoAgent

## What I Delivered
- Added a `BoothAgent.delete()` callable that iterates through every booth Fauxto so they reuse the existing `FauxtoAgent.delete()` cleanup, then removes uploads/background assets from R2 before destroying the booth agent itself.
- Exposed a `deleteBooth` helper on the `HubAgent` so the Admin UI can trigger the full teardown and prune the slug from hub storage/state.
- Updated `/admin` to show Delete buttons beside each booth slug, including error and pending states, and to refresh the booth/Fauxto listings as soon as a deletion succeeds.
