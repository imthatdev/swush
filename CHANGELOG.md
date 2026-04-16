# 📜 Changelog

All notable changes to **Swush** will be documented here.
This project follows [Semantic Versioning](https://iconical.dev/versioning).

---

## [Unreleased]

✨ Nothing here yet; stay tuned for upcoming features and tweaks.

---

## v1.3.3 – Auth Experience & UI Polish ✨

Released: April 15, 2026

### 🔐 Auth Flow & Reliability
- Rebuilt login/register pages with a new design and floating ecosystem icon background.
- Added safe `?next=` redirect handling for password login, passkey login, 2FA completion, and social OAuth callback flows.
- Added auth back-button behavior to route directly to `/` from auth screens.
- Added Swush logo to auth card header and a theme button to auth corner controls.
- Switched auth hero media to `/auth-bg.mp4` and updated hero copy to Swush-specific messaging.

### 🌌 External Layout & Shared Visuals
- Added floating icon background visuals to external pages.

### ⚙️ Settings & Support UX
- Replaced the icons `Monkey` password toggles with `Eye` in account settings flows.
- Refreshed Sponsor banner design.

### ✅ Bulk Selection & Action Feedback
- Added in-progress/loading states for bulk actions across Bookmarks, Vault, Shortener, and Watchlist.
- Disabled conflicting bulk actions while operations are running to avoid double-submit/race behavior.
- Added `Shift + right-click` item selection support in bulk-select surfaces for faster range selection workflows.
- Prevented accidental text highlighting during bulk selection by applying `select-none` behavior in selection mode.
- Added themed global text-selection styling (`::selection`) to match active app color tokens.

### 🔐 Auth Portal Iteration
- Updated social auth button layout: primary provider spans full row with `Continue with "<Provider>"`, remaining providers use compact labeled buttons. (Gives more clarity to what these buttons do lol...)
- Added smoother fade/slide transitions for both form content and auth header copy during Login/Register tab changes.

### 🛡️ Two-Factor Setup UX
- Polished 2FA setup dialog with improved QR presentation.
- Added `otpauth://` setup URI visibility with copy and direct open actions.
- Added manual setup key extraction/display with copy support for authenticator fallback flows.
- Surfaced parsed account label from TOTP URI to make authenticator setup clearer.

---

## v1.3.2 – Auth Autofill & UX Fix 🔐

Released: April 15, 2026

### 🔑 Authentication
- Enabled autofill support for passkey sign-in.
- Adjusted button disable logic for smoother interaction.

---

## v1.3.1 – UI Refinement & Loading Experience Polish ✨

Released: April 15, 2026

### 🎨 Interface & Layout
- Refined layout styles for a cleaner and more consistent UI.
- Improved spacing and visual balance across components.

### ⏳ Loading Experience
- Added animated loading GIF for smoother and more engaging feedback during load states.

### 📦 Versioning
- Updated application version to 1.3.1

---

## v1.3.0 – Sharing Domain Guard, Analytics & Platform Polish 🩹

**Released: April 14, 2026**

### 🌐 Sharing Domain & Routing
- Introduced configurable sharing-domain fallback URL for invalid share routes.
- Hardened proxy behavior to enforce sharing domains as share-only surfaces while preserving valid paths.
- Unified proxy path matching logic for improved consistency and maintainability.
- Fixed public view tracking on sharing domains and ensured `/api/*` routes resolve correctly before fallback handling.
- Improved API origin handling to support same-origin and configured sharing domains.

### 📊 Analytics & Metrics
- Enhanced analytics system with improved tracking reliability and accuracy across domains.
- Fixed inconsistencies in view counting, especially for sharing-domain traffic.
- Improved internal metrics handling to better reflect real usage patterns.

### ⚙️ Settings & UX Improvements
- Refined Applications UI with clearer separation between PWA and Browser Extensions.
- Added branded Chrome and Firefox install actions.
- Improved homepage CTA layout with better hierarchy and spacing.

### 🔐 Passkey Reliability
- Separated conditional autofill from explicit passkey sign-in for improved UX.
- Relaxed registration constraints to improve cross-device compatibility.

### 🗄️ Admin & Data Model
- Added sharing-domain fallback URL to admin settings (UI, validation, persistence).
- Introduced database migration for new settings field.
- Added manual email verification with moderation context and audit logging.
- Improved admin user visibility with explicit email verification states.
- Hardened PATCH validation to prevent failures from partial updates.

### 🧭 Vault Layout & Scroll Fixes
- Fixed overflow issue causing unintended page scrolling in `/vault`.
- Properly contained scrolling within the Vault layout.
- Moved layout containment to dashboard shell for cleaner behavior.

### 📧 Auth & API Improvements
- Improved messaging for unverified accounts with clearer support guidance.
- Normalized API error handling to surface actionable validation feedback.
- Fixed async route param handling in admin APIs.

### 🐳 Build & Runtime
- Switched production builds to webpack mode for improved compatibility.
- Externalized `file-type` and improved MIME detection via dynamic imports.
- Updated Docker image to include required migration and schema assets.

---

v1.2.1 – API Key Ownership Fix 🔑

Released: April 13, 2026

### 🔐 Authentication & API Keys
- Fixed API key creation failures caused by a schema mismatch between Better Auth API key ownership fields and local database constraints.
- Updated API key ownership lookups/cleanup paths to use `reference_id` semantics consistently.
- Added a migration to relax the legacy `apikey.user_id` NOT NULL constraint for compatibility with current Better Auth API key inserts.

---

v1.2.0 – Runtime & Queue Intelligence ⚙️

Released: April 12, 2026

### ⚡ Performance & Observability
- Introduced runtime signals tracking for monitoring event loop lag and API latency.
- Implemented server settings caching to reduce repeated lookups and improve response times.
- Added Redis caching for API key lookups and settings retrieval to speed up critical paths.
- Added health check endpoints for API and job queue monitoring.

### 🔄 Jobs & Processing
- Enhanced Jobs handling with retry logic and dead-letter queue support.
- Improved storage cleanup jobs with execution validation and state awareness.
- Added new admin job for automated PWA subscription cleanup.

### 🔖 Bookmarks & RSS Auto-Hoard
- Added Auto-Hoard RSS feed management for Bookmarks with feed create/update/delete, run-now, and schedule controls.
- Added bookmark RSS API routes and worker runner integration so feeds are queued and processed in the background.
- Added a Bookmarks header tools menu with quick actions for Import/Export and Auto-Hoard RSS dialogs.
- Updated RSS management UX so Add RSS feed opens in a dedicated modal separate from the configured-feeds screen.
- Hardened RSS feed settings by normalizing `maxItemsPerFetch` to a clamped integer before persistence.
- Export and Import Bookmarks with ease using JSON and HTML files, making it simple to backup or transfer your bookmarks.

### 📦 Storage & Infrastructure
- Strengthened storage configuration with socket limits and acquisition timeouts.
- Improved storage handling with path traversal protection and safer socket management.
- Enhanced yt-dlp processing with better file naming and optimized threading.
- Docker runs swush app and swush worker as separate services for better scalability and reliability.

### 🧠 Internal & Types
- Introduced admin queue health types for monitoring job system metrics.
- Updated schema definitions for improved API key handling.

---

## v1.1.1 – URL Safety Patch 🔐

**Released: February 25, 2026**

### 🛡️ Security

- Fixed edge-case URL validation gaps so all external URLs are consistently sanitized before outbound requests.
- Added centralized safe HTTP wrappers for:
	- internal API routes,
	- same-origin browser fetches,
	- externally validated HTTP(S) requests.
- Updated multiple client/server request paths to use these safe wrappers for stronger static-analysis compliance.
- Hardened AES-GCM decryption paths by enforcing explicit auth tag length checks.
- Replaced dynamic regex and unsafe HTML assignment patterns in critical paths with safer parsing/DOM handling.

### 🗂️ Filesystem Safety

- Standardized traversal-safe path resolution and normalization across upload/export/preview/stream/storage flows.
- Added shared reusable path helper logic to remove duplicated path-guard implementations.

### 🧹 Maintainability

- Reduced duplicated logic in bulk update flows and metadata parsing helpers.
- Refactored language registration/detection internals to lower complexity and improve readability.
- Consolidated repeated security/path handling patterns into reusable utilities.


---

## v1.1.0 – URL Safety Hardening 🔐

**Released: February 24, 2026**

### 🛡️ Security

- Added centralized external URL validation to block unsafe/local/private-network targets before outbound HTTP requests.
- Hardened webhook URL handling (create/update/send) so only validated HTTP(S) destinations are allowed.
- Hardened remote upload URL intake and execution paths to reject unsafe URLs before download/fetch boundaries.
- Added additional URL safety checks around metadata fetch and downloader entrypoints to reduce SSRF risk.

### 🔌 API & Client Safety

- Hardened `apiV1()` path normalization to prevent protocol/protocol-relative input from becoming request targets.
- Added encoded path segment helper usage across component API calls to avoid direct dynamic URL interpolation.
- Refactored dynamic component API endpoints to safer path/query construction patterns for better static-analysis compliance.

### 🎬 Providers

- Strengthened TMDB request URL construction and ID validation with stricter endpoint building.

---

## v1.0.10 – Remote Upload Metadata Naming 🔌

**Released: February 23, 2026**

- Improved remote upload naming to prefer provider/source metadata (e.g., title/caption) when available.
- Added deterministic fallback order for remote uploads: source title → UI/API-provided name → generated `remote-xxxxxxxx`.
- Ensured detected file extension is appended when the chosen name does not include it.
- Fixed yt-dlp output file discovery for title-based output templates to avoid false "expected file" misses.

---

## v1.0.9 – Release Tagging Patch 🏷️

**Released: February 22, 2026**

- Updated Docker release tagging logic so `1.X.0` publishes with `stable` (for `X > 0`) while `1.0.X` continues publishing standard rolling tags.

---

## v1.0.8 – Theme Motion, Docs, and About Polish 🎬

**Released: February 22, 2026**

### 🎨 Theme & Appearance

- Added smooth circular theme/scheme reveal transitions (View Transitions API) with reduced-motion fallback.
- Tuned reveal speed/easing for a slower, smoother expansion and reduced text flashing during transitions.

### 🔌 API & Shortcuts

- Improved `/api/v1/remote-upload` payload compatibility by accepting single URL shapes (`url` and string `urls`) in addition to array payloads.

### 📚 Docs

- Rewrote the Apple Shortcuts guide into a concise 0→hero flow.
- Added clear BETA + coming-soon messaging for notes, bookmarks, snippets, recipes, and game list mentions.

### 🧭 About Page

- Added Product Hunt badge embed with light/dark theme variants.
- Fixed `FeatureChip` text contrast in light mode.
- Added a coming-soon note for **Profiles & meetings** in CE About.

---

## v1.0.7 – API Key Allowlist for Remote Uploads 🔐

**Released: February 22, 2026**

Check the docs for the new API key allowlist feature, which enables automation with Apple Shortcuts for remote uploads.

### 🛠️ API & Automation

- Added API key allowlist support for `POST/GET/DELETE /api/v1/remote-upload` to enable Apple Shortcuts and other automations without cookie sessions.
- Enforced `upload` API scope (or `all`) for `/api/v1/remote-upload` token-based access.

---

## v1.0.6 – Vault UX & Selection Improvements 🎯

**Released: February 22, 2026**

### 🛠️ Vault & Categorization Improvements

- Fixed file categorization folder clearing so removing folder text and saving now correctly unassigns the folder.
- Improved selected file card visibility and selection affordance during bulk-select mode.
- Updated Shift multi-select behavior to anchor range selection from the first selected item.
- Improved bulk selection action bar behavior in Vault so it sticks correctly within dashboard scroll/layout context.
- Prevented video preview playback while selection mode is active (grid + gallery), including pausing active previews.
- Fixed React effect/lint warning by removing synchronous state updates from the preview interaction-disable effect.

---

## v1.0.4 – Public View Route Fixes 🧩

**Released: February 22, 2026**

This patch fixes a regression where public files failed to open from the `/v/:slug` view route in some Docker/reverse-proxy setups.

### 🔎 Root Cause

- In `v1.0.3`, the `/v/:slug` page resolved file data via an internal server-side HTTP self-call to `/api/v1/files/:slug`.
- In Docker/port-mapped deployments (for example, opening the app at `localhost:3419`), that host/port can be valid for the browser but not reachable from inside the container runtime.
- When that self-call failed, `/v/:slug` incorrectly fell back to a missing/private state even for public files.
- `/x/:slug` still worked because it does not rely on that same internal HTTP roundtrip path.

### 🐛 Fixes

- Fixed public file viewing through `/v/:slug` by removing the fragile internal HTTP self-call and resolving file access in-process.
- Kept `/x/:slug` and `/v/:slug` behavior consistent for public file access checks.
- Normalized file payload typing for `createdAt` in the `/v` page flow to prevent runtime-shape/TypeScript mismatch.
- Fixed current blocking lint errors in dialog open-state reset flow and intersection observer fallback handling.
- Hardened anonymous file behavior so `/v` anonymity is enforced by stored file settings/server logic instead of `?anon=1` URL parameters.
- Added an `Anonymous share` toggle to file edit details and removed the legacy `Copy Anonymous URL` action.
- Fixed an intermittent `/v/:slug` image preview state where media could remain blurred after load due to missed cached-load events.
- Fixed the RemoteUploadDialog URLs input keeps overflowing when the URL is long.
- Resolved dependency security advisories (`minimatch`, `bn.js`, `esbuild`) by pinning patched transitive versions via `pnpm` overrides and refreshing the lockfile.

---

## v1.0.3 – CORS and Security Enhancements 🔐

**Released: February 8, 2026**

This patch addresses some minor issues and enhances the overall user experience.

### 🆕 Highlights

- Improved CORS handling in the proxy for better security and flexibility
- Added more specific error messages for CORS rejections
- Updated drizzle config to remove verbose and strict options for cleaner logs and more forgiving schema changes
- Updated the ignore file to exclude more unnecessary files and directories from version control, keeping the repo clean and focused on source code

---

## v1.0.2 – Minor Improvements and Fixes 🛠️

**Released: February 8, 2026**

### 🆕 Highlights

- Minimized Docker image size for faster builds and lighter deployments (standalone next.js)
- Refactored small parts of the code for better readability and maintainability
- Replaced `pg` with `postgres.js` for a modern and friendly database client

---

## v1.0.1 – Bug Fixes and Polish 🐞

**Released: February 6, 2026**

A quick follow-up to the initial release, addressing some minor bugs and improving overall polish.

### 🆕 Highlights

- Docker image built with github actions, and multi-arch support for AMD64 and ARM64.
- Rewrote some of the docker compose examples for better clarity and maintainability.

### 🐛 Fixes

- Fixed a bug where the owner role always fallback to admin, and now correctly retains the owner role.


---

## v1.0.0 – Initial Release of CE ✨

**Released: February 6, 2026**

The **very first release** of Swush; my self-hosted file & media vault.
Packed with essentials to make your hosting life easy and stylish. 🚀

### 🆕 Highlights

- 🧠 **Core logic** for reliability and maintainability
- 🔒 **Authentication system** (Better Auth) – more secure, flexible, and future-proof
- 🗂️ **Vault** experience
- 🏷️ **Folders** and **Tags** categorization
- 🔍 **Global Search**
- 🎞️ **Gallery view** for images/videos
- 🎵 **Mini audio player** and **Fullscreen player***
- 📤 Fast, and robust **file uploads**
- 📩 **Email support** and notifications
- 🔐 Advanced usage limits and admin controls
- 📝 More inline docs, tooltips, and help for admins
- 🐳 **Docker** and **multi-arch** support
- ⚡ Performance and stability improvements everywhere
- 🦄 Unicorn mode still doesn't exist (sorry!)
- ✅ Anonymous sharing with soft privacy**
- 🧰 Per‑user feature toggles + API/UI enforcement
- 🧭 Sharable links, QR upgrades, and public share polish
- ...and much more!

\*\* Anonymous sharing is not pure privacy, as it still exposes some metadata and can be altered from URL parameters.
