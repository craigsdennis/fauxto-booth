# Fauxto Booth Session Log

## User Request (verbatim)
On the phone page, I want to allow that to take a selfie and do a multi-part photo upload to /agents/booth/<slug> I'll handle the server side. There is no need to show the background on the phone page. Just a take selfie button.

Update: Oh sorry it's actually /agents/booth-agent/<slug>

## What I Delivered
- Rebuilt the phone page to focus entirely on capturing or uploading selfies, including mobile camera access, live preview, and multipart submissions.
- Added progressive fallback handling for desktop Chrome (manual file picker) and clear status/error messaging so guests always know what is happening.
- Wired uploads to the corrected `/agents/booth-agent/{slug}` endpoint with slug/source metadata, ready for your server implementation.
