# Fauxto Booth Session Log

## User Request (verbatim)
Let's break that App.tsx into pages components. Probably clearer right?

## What I Delivered
- Added a lightweight router-only `App.tsx` plus a shared `Navigate` type to keep navigation concerns isolated.
- Moved the landing experience, booth host dashboard, and phone capture view into `src/pages/` for cleaner ownership and easier future edits.
- Preserved the agent wiring and styling for each page while keeping links/QR flows working end-to-end.

## Additional User Request (verbatim)
Okay let's fix this layout on the booth page first. I want to get rid of extraneous stuff. Let's have title at the top, background image, description. Let's get uploadedCount and the fauxtos generated. I want the QR code in the top right corner but no text needed I'll explain.

## What I Delivered (update)
- Simplified the Booth host page to a single-column hero with the title, stat counters, and QR in the top right, followed by the background preview/action tray and streamlined description.
- Surfaced both `uploadedCount` and the running Fauxto total in the hero plus a new "Live Fauxtos" gallery so every generated composite renders for the host immediately.
- Kept background regeneration + snap controls intact while removing the previous guest-link sections, matching the requested minimal layout.

## Additional User Request (verbatim)
On the main booth page is there any way to make a slideshow about 5 seconds on each photo after it is done to loop through each photo

## What I Delivered (update)
- Added client-side slideshow state that advances through the Fauxtos array automatically every five seconds when at least two renders exist.
- Featured the active Fauxto in a prominent carousel block above the gallery with progress text so hosts can rely on the automatic loop for signage or displays.

## Additional User Request (verbatim)
Okay we had a bit of a restructure. Instead of fauxtos being on the state object only the latestFauxtos will be there. You can still loop through them on a slideshow. There is also a fauxtoCount on the state which will be the total for the booth. ... On the booth agent there is now a displayStatus I'd like to show so people can see what is happening.

## What I Delivered (update)
- Pointed the host UI at `state.latestFauxtos` for both the slideshow and gallery, while keeping the counters wired to the new `fauxtoCount` total and showing how many renders exist overall.
- Added a status line under the booth stats that surfaces the agent's `displayStatus` so hosts can relay what's happening at a glance.

## Additional User Request (verbatim)
And when the photo booth is created let's have the user set idealMemberSize. Let's show that on the booth and add a + and - button ...

## What I Delivered (update)
- Added a “people per Fauxto” input to the booth-creation form so hosts choose the desired crowd size upfront.
- Exposed the current ideal member size on the Booth page with +/- controls that persist through the booth agent while optimistically updating the local state.

## Additional User Request (verbatim)
Let's get all the state setting off the state object in the onStateUpdate. Do not break it out into setBoothState. Set properties on the page from the agent state in the onStateUpdate method only.

## What I Delivered (update)
- Replaced the single `boothState` blob with targeted React state slices (background info, counts, latest Fauxtos, etc.) and now update each from `onStateUpdate`, matching the new guidance.
- Removed lingering dependencies on the raw state object so future data shape tweaks don't ripple through the UI logic.
