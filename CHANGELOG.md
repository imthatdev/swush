# 📜 Changelog

All notable changes to **Swush** will be documented here.
This project follows [Semantic Versioning](https://iconical.dev/versioning).

---

## [Unreleased]

✨ Nothing here yet; stay tuned for upcoming features and tweaks.

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

The **very first release** of Swush CE; my self-hosted file & media vault.
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