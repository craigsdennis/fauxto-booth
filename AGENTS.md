# Repository Guidelines

## Project Structure & Module Organization
Fauxto Booth joins a Vite/React kiosk UI with Cloudflare Workers that handle sharing and automation. UI source sits in `src/`, where `pages/` maps to each route, `partials/` hosts shared layout pieces, and `assets/` contains kiosk imagery. Entry wiring (`main.tsx`, `navigation.ts`) manages routing between `booths/:slug`, `booths/:slug/phone`, and `fauxtos/:id`. Static shells are in `public/`; `dist/` is generated output. Worker logic stays in `worker/` (`index.ts`, `workflows/`, `agents/`) and is configured via `wrangler.jsonc` plus `worker-configuration.d.ts`. Consult the matching `truth-window/` note before altering flows.

## Build, Test, and Development Commands
Use Node 20+ with npm. Install once with `npm install`, then run `npm run dev` for the Vite dev server. `npm run build` creates the production bundle and worker, while `npm run xbuild` adds a TypeScript project build step for stricter type safety. `npm run preview` serves the output locally. `npm run lint` runs ESLint with TypeScript + React Hooks rules and must succeed before opening a PR. Use `npm run deploy` to ship via `wrangler deploy`. Refresh Worker binding types with `npm run cf-typegen` whenever KV/Durable Object definitions change.

## Coding Style & Naming Conventions
Stick to two-space indentation, double quotes, and `const` by default. Components use PascalCase filenames (`BoothPhonePage.tsx`), hooks/utilities stay camelCase (`useNavigation.ts`). Route params should remain descriptive (`slug`, `fauxtoId`) to mirror `navigation.ts`. Tailwind classes belong inline or inside `src/index.css`; avoid bespoke CSS files unless global. ESLint (`eslint.config.js`) is the source of truth—do not suppress rules without team discussion.

## Testing Guidelines
Automated tests are not yet wired in, so linting plus manual smoke testing on booth, phone, and Fauxto routes is required before review. When you add coverage, reach for Vitest with React Testing Library (works with Vite), store specs alongside components (`HomePage.test.tsx` or `src/__tests__/`), and aim for >80% coverage on new modules. Exercise Worker logic with tests that stub Cloudflare bindings and attach kiosk/share screenshots to the PR.

## Commit & Pull Request Guidelines
History favors short, imperative commit subjects (“Add Fauxto share endpoint and footer”); keep that style and isolate commits per concern. PRs must describe the change, list the commands or routes tested, and link to any `truth-window/` doc that informed the work. Include screenshots or GIFs for UI tweaks. Call out environment changes and confirm `npm run cf-typegen` ran successfully whenever bindings move.
