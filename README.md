# Swush

Swush is a secure, self-hosted full‑stack file manager and personal dashboard built with Next.js, TypeScript, TailwindCSS, and Better Auth. It offers a unified platform to manage your files, short links, upload requests, watchlist (anime, movies, TV shows), and more; all with privacy and control in mind.

![GitHub Repo stars](https://img.shields.io/github/stars/imthatdev/swush?style=plastic)
![Static Badge](https://img.shields.io/badge/Self_Hosted-BADA55)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/imthatdev/swush/build-docker.yml)
![GitHub branch check runs](https://img.shields.io/github/check-runs/imthatdev/swush/main)
![GitHub Release](https://img.shields.io/github/v/release/imthatdev/swush)
![GitHub commits since latest release](https://img.shields.io/github/commits-since/imthatdev/swush/latest)
![Docker Pulls](https://img.shields.io/docker/pulls/iconical/swush)
![Docker Image Size](https://img.shields.io/docker/image-size/iconical/swush)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/22c34789c3484808ba2cbea469605c90)](https://app.codacy.com/gh/imthatdev/swush/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
![GitHub License](https://img.shields.io/github/license/imthatdev/swush)

## ✨ Features

### Authentication & Security
- Better Auth sessions with optional 2FA (TOTP).
- Robust session management and role-based access.
- Role-based access control with Owner, Admin, and User roles.
- Admin capabilities to promote/demote users and protect API endpoints.

### Content Management Modules
- Files, Short Links, Upload Requests.
- Pagination, bulk selection and deletion.
- Slug support for friendly URLs.

### Sharing & Growth
- Public profiles and share pages with optional passwords.
- QR sharing with presets and avatar overlays.
- UTM builder for short links.

### Watchlist
- Track movies, TV shows, and anime via TMDB & AniList integrations. (Integrations are solely per the session, no user data is saved, but the selected data is retained.)
- Season and episode progress tracking.
- Adding personal notes.
- Bulk actions (delete, change visibility).
- Public sharing via `/l/username` with optional privacy toggle for each show.
- Import data from AniList.

### UI/UX
- Responsive design powered by Tailwind CSS v4.
- Smooth animations and transitions.
- Image paste-to-upload functionality.

### Infrastructure & Integrations
- Minimal API routes abstracted into reusable `lib/` functions.
- Email notifications for password resets, new logins, and import summaries.
- Docker support for streamlined production deployment.


## 📦 Tech Stack
- **Frontend:** Next.js, React, TailwindCSS
- **Backend:** Next.js API routes, TypeScript, Better Auth (authentication)
- **Database:** PostgreSQL (Neon or self-hosted)
- **ORM:** Drizzle
- **External APIs:** TMDB, AniList, Steam, RAWG
- **Email:** SMTP (configurable)


## 🚀 Getting Started

### 1. Clone the repository
```bash
pnpm x degit imthatdev/swush
cd swush
```

### 2. Install dependencies
```bash
pnpm install
```

> **Note:** Swush uses [PNPM](https://pnpm.io/) and Node.js. You can use `npm` or `yarn` as alternatives if you prefer, but ensure the lockfile and workspace compatibility.

### 3. Setup environment variables
Copy `example.env` to `.env` and update the values:
```bash
cp example.env .env
```

### 4. Environment Variables Overview

#### Core
- Please consider checking the `.env` file for all available options. Commented variables have default values or optional.

### 5. Run database migrations
```bash
pnpm db:migrate
```

### 6. Start the development server
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.


## 🐳 Deployment with Docker

> **Note:** The Docker setup has been recently updated and optimized for smaller image size and faster builds.

### Build and run with remote database (Neon, Supabase, etc.)
```bash
docker compose up -d --build
```

### Run with self-hosted PostgreSQL
```bash
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up -d --build
```

- The app will be accessible at [http://localhost:3000](http://localhost:3000).
- PostgreSQL will be exposed on port `5432` (credentials configured in `.env`).

## ☁️ Cloudflare Cache Rules (HLS Only)

If you use Cloudflare Tunnels (cloudflared) and a **global “Bypass Cache”** rule,
you can still safely cache HLS streaming assets only. This improves playback
startup and reduces origin load while leaving everything else uncached.

**Recommended rule (Cache Everything only for HLS):**

**Expression**
```
(http.host eq "sub.example.domain" and starts_with(http.request.uri.path, "/hls/"))
```
**Settings**
- Cache: **Cache Everything**
- Origin Cache Control: **On** (respect origin headers)
- Edge Cache TTL: **Use Cache-Control header**

This keeps:
- `.m3u8` playlists short‑lived (origin sends short cache)
- `.ts/.m4s/.aac` segments long‑lived (origin sends immutable cache)

If you want to keep your global bypass rule, just add this HLS rule **above it**
so `/hls/*` is cached while all other routes stay bypassed.

## 🔧 Self‑Hosting Guide

1. **DNS & Reverse Proxy**
   - Point your domain to your server's IP.
   - Use a reverse proxy like Nginx, Traefik, or Caddy with HTTPS enabled (Let's Encrypt recommended).

2. **Environment Variables**
   - Set `APP_URL` to your domain with HTTPS.
   - Securely configure `BETTER_AUTH_SECRET` and database credentials.

3. **Database**
   - Choose Neon (managed) or self-hosted PostgreSQL.
   - Regularly back up your database.

4. **Email**
   - Configure SMTP settings for password resets and notifications.


## 📸 Screenshots

![Dashboard Screenshot](public/images/docs/dashboard.png)

![Watchlist Screenshot](public/images/docs/watchlist.png)

### Coming Soon: (Games Collection, Snippets, and more)

![Games Collection Screenshot](public/images/docs/games.png)

![Content Management Screenshot](public/images/docs/content.png)


## 🌐 Demo

Experience Swush live at [demo.swush.app](https://demo.swush.app).

You can sign up and test all features with your account, if the demo is online and if the registration is open. (You may contact me if it's closed.)

Feel free to explore the features and get a feel for the app before deploying your own instance.


## 🤝 Contributing

Contributions are welcome! To contribute:

- Fork the repository.
- Create a feature branch.
- Open a pull request.

Before committing, run linting and tests:

```bash
pnpm lint
```


## 📜 License

APACHE 2.0 © 2026 Iconical


## 💬 Support

- X: [x.com/imthatdevy](https://x.com/imthatdevy)
- Website: [iconical.dev](https://iconical.dev)
- Changelog: [iconical.dev/changelog/swush](https://iconical.dev/changelog/swush)
- Roadmap: [iconical.dev/roadmap/swush](https://iconical.dev/roadmap/swush)
- Feedback: [iconical.dev/feedback/swush](https://iconical.dev/feedback/swush)
- GitHub: [imthatdev](https://github.com/imthatdev)
- Email: him@iconical.dev

### 🙏 To Note Again

> Swush is fully free and open-source. There are no paid tiers or upgrade requirements to use it.
