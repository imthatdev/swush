# 📜 Changelog

All notable changes to **Swush** will be documented here.
This project follows [Semantic Versioning](https://iconical.dev/versioning).

---

## [Unreleased]

✨ Nothing here yet; stay tuned for upcoming features and tweaks.

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