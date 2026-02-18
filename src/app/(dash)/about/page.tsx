/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
 *   All rights reserved.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   You may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import {
  IconBook2,
  IconBrandChrome,
  IconClock,
  IconFile,
  IconBrandGithub,
  IconBolt,
  IconLock,
  IconPlayerPlay,
  IconSearch,
  IconDatabase,
  IconShare3,
  IconBrandX,
  IconWorld,
  IconQrcode,
  IconLink,
  IconUpload,
  IconCalendarEvent,
  IconCoffee,
  IconCode,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getDefaultMetadata } from "@/lib/head";
import { Logo } from "@/components/Common/Logo";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export async function generateMetadata(): Promise<Metadata> {
  const defaultMetadata = await getDefaultMetadata();
  return {
    ...defaultMetadata,
    title: "About",
    description: "What Swush is, how it works, and the love behind it.",
  };
}

export default function AboutPage() {
  return (
    <div className="relative">
      <section className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <Tabs defaultValue="about" className="w-full">
          <header className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <Logo size={64} textClassName="text-6xl" />
              <h1 className="text-xl sm:text-4xl md:text-3xl font-semibold tracking-tight">
                your personal vault, share hub, and short‑link studio
              </h1>
              <div className="flex flex-wrap max-w-3xl items-center justify-center gap-2">
                <Badge className="gap-1">
                  <IconFile size={16} /> Files
                </Badge>
                <Badge className="gap-1">
                  <IconLink size={16} /> Short links
                </Badge>
                <Badge className="gap-1">
                  <IconQrcode size={16} /> QR Share
                </Badge>
                <Badge className="gap-1">
                  <IconUpload size={16} /> Upload Requests
                </Badge>
                <Badge className="gap-1">
                  <IconCalendarEvent size={16} /> Meetings
                </Badge>
                <Badge className="gap-1">
                  <IconSearch size={16} /> Fast Search
                </Badge>
                <Badge className="gap-1">
                  <IconShare3 size={16} /> Public Links
                </Badge>
              </div>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                A secure dashboard for files, links, and watchlists, and more.
                Create, search, share (public or password‑protected), and ship
                beautiful public pages with QR + UTM baked in.
              </p>
            </div>

            <TabsList className="mx-auto w-full max-w-3xl grid grid-cols-3 gap-2 mb-4">
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="how-to">How‑to</TabsTrigger>
              <TabsTrigger value="credits">Credits</TabsTrigger>
            </TabsList>
          </header>

          <TabsContent value="about">
            <AboutSection />
          </TabsContent>

          <TabsContent value="how-to">
            <HowToSection />
          </TabsContent>

          <TabsContent value="credits">
            <CreditsSection />
          </TabsContent>
        </Tabs>

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Made with <span className="text-primary">♥</span> by Iconical ꕀ 2026
        </footer>
      </section>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconBook2 size={18} /> Capture
            </CardTitle>
            <CardDescription>
              Add your content once ꕀ Swush keeps it tidy and instantly
              searchable.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Files and links stay organized and searchable.</li>
              <li>
                Fast upload flows with clear metadata and sharing controls.
              </li>
              <li>Funny slugs auto‑generated for pretty URLs.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconSearch size={18} /> Find
            </CardTitle>
            <CardDescription>
              Type to filter ꕀ results update as you write.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Live search across titles, descriptions & body.</li>
              <li>Tags and filters for quick narrowing.</li>
              <li>Lightweight API + DB queries with indexes in mind.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-4 text-lg">
              <IconShare3 size={18} /> Share
            </CardTitle>
            <CardDescription>
              Public pages with optional passwords, QR, and tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>One‑click copy share links + QR presets.</li>
              <li>UTM builder for campaigns and tracking.</li>
              <li>Clean, responsive, theme‑aware public pages.</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconUpload size={18} /> Upload requests
            </CardTitle>
            <CardDescription>
              Branded request pages, approvals, and rate limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Share upload links with custom branding.</li>
              <li>Queue + rate limit controls per requester.</li>
              <li>Approve or reject incoming items.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconCalendarEvent size={18} /> Profiles & meetings
            </CardTitle>
            <CardDescription>
              Public profiles, socials, and booking links.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Public profiles with verified badges.</li>
              <li>Share socials on public pages.</li>
              <li>Accept meeting requests when enabled.</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconPlayerPlay size={18} /> Playback controls
            </CardTitle>
            <CardDescription>
              Local client‑side controls with practical defaults.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <p>
              Media playback is designed for quick controls. You can start,
              pause, reset, and adjust behavior on the fly with no account
              required for public pages.
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <FeatureChip
                icon={<IconClock size={14} />}
                label="Auto‑parsed durations"
              />
              <FeatureChip
                icon={<IconBolt size={14} />}
                label="Fallbacks when time is missing"
              />
              <FeatureChip
                icon={<IconPlayerPlay size={14} />}
                label="Per‑step control"
              />
              <FeatureChip
                icon={<IconShare3 size={14} />}
                label="Works on public links"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconLock size={18} /> Privacy by Design
            </CardTitle>
            <CardDescription>
              Share when you want; keep private when you don’t.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <p>
              Items default to private. Public pages expose only what’s needed
              and never include secrets. Optional passwords use hashed
              verification on the server side.
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <FeatureChip
                icon={<IconLock size={14} />}
                label="Optional passwords"
              />
              <FeatureChip
                icon={<IconDatabase size={14} />}
                label="Lean server queries"
              />
              <FeatureChip
                icon={<IconCode size={14} />}
                label="Type‑safe API"
              />
              <FeatureChip icon={<IconBolt size={14} />} label="No bloat" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StackCard
          title="Next.js & App Router"
          desc="Modern routing, server components where it matters, client where it shines."
        />
        <StackCard
          title="TypeScript + Drizzle"
          desc="Typed queries, clear schema ꕀ no `any`, no surprises."
        />
        <StackCard
          title="Tailwind + shadcn/ui"
          desc="Design‑system clarity with fast iteration and theme awareness."
        />
      </section>
    </div>
  );
}

function HowToSection() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconFile size={18} /> Upload files
            </CardTitle>
            <CardDescription>
              Drag & drop or click “Upload” in your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Go to <span className="font-medium">Vault → Files</span>.
              </li>
              <li>
                Drag files in or click{" "}
                <span className="font-medium">Upload</span>.
              </li>
              <li>
                Optionally set <span className="font-medium">Public</span> and
                add a password.
              </li>
              <li>Copy the share link or open the public page.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconLink size={18} /> Shorten links
            </CardTitle>
            <CardDescription>
              Turn long URLs into neat slugs and share them anywhere.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Open <span className="font-medium">Short Links</span>.
              </li>
              <li>Paste your URL and add title/description.</li>
              <li>
                Toggle <span className="font-medium">Public</span> if you want a
                shareable page.
              </li>
              <li>Use the generated short link anywhere.</li>
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconUpload size={18} /> Upload links & requests
            </CardTitle>
            <CardDescription>
              Collect uploads from guests with branded request pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Create and share request links.</li>
              <li>Review uploads and approve what you need.</li>
              <li>Keep everything inside your own vault.</li>
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconWorld size={18} /> Browser Extension
            </CardTitle>
            <CardDescription>
              “Swush Companion” for quick uploads.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Install the extension and open{" "}
                <span className="font-medium">Options</span>.
              </li>
              <li>
                Enter your instance URL and API token from{" "}
                <span className="font-medium">Settings → API</span>.
              </li>
              <li>Use hotkeys: Alt+U (upload).</li>
              <li>
                Right‑click context menu to send the current page to Swush.
              </li>
            </ol>
            <div className="pt-2">
              <Button asChild className="gap-1">
                <a
                  href="https://chromewebstore.google.com/detail/jgipkeccibhgdfhoknfggljdmdodkjop?utm_source=item-share-cb"
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="Install Swush Companion for Chrome"
                >
                  <IconBrandChrome size={18} /> Install on Chrome
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconPlayerPlay size={18} /> Watchlists & Imports
            </CardTitle>
            <CardDescription>
              Track your media and pull playtime where available.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Open <span className="font-medium">Watchlist</span>.
              </li>
              <li>
                Add entries manually or via{" "}
                <span className="font-medium">Import</span>
              </li>
              <li>Fetch playtime where enabled.</li>
              <li>Mark favorites and toggle public/private visibility.</li>
            </ol>
          </CardContent>
        </Card>
      </section>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <IconSearch size={18} /> Search & Privacy
          </CardTitle>
          <CardDescription>
            Fast filters with sensible defaults; private first.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            <li>Instant, debounced client filters + indexed server queries.</li>
            <li>
              Everything is private by default. Public pages expose only
              necessary fields.
            </li>
            <li>
              Password gates use server‑side hashed verification when enabled.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function CreditsSection() {
  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Crafted by Iconical (Laith)</CardTitle>
          <CardDescription>
            Design, code, and a tiny bit of chaos.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            Swush is built for speed, clarity, and sharing. If you enjoy it,
            stars and feedback mean the world.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="gap-1">
              <a
                href="https://github.com/imthatdev"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Iconical on GitHub"
              >
                <IconBrandGithub size={18} /> github.com/imthatdev
              </a>
            </Button>
            <Button asChild className="gap-1">
              <a
                href="https://x.com/imthatdevy"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Iconical on X"
              >
                <IconBrandX size={18} /> @imthatdevy
              </a>
            </Button>
            <Button asChild className="gap-1">
              <a
                href="https://iconical.dev"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Iconical website"
              >
                <IconWorld size={18} /> iconical.dev
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <IconBolt size={18} /> Sponsor Swush
          </CardTitle>
          <CardDescription>
            Support development and keep the roadmap moving.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p>
            Sponsorship helps fund hosting, design polish, and the next wave of
            features. Thank you for keeping Swush alive.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="gap-1">
              <a
                href="https://iconical.dev/sponsor"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Sponsor Swush"
              >
                <IconBolt size={18} /> Sponsor Swush
              </a>
            </Button>
            <Button asChild variant="secondary" className="gap-1">
              <a
                href="https://www.buymeacoffee.com/iconical"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Buy me a coffee"
              >
                <IconCoffee size={18} /> Buy me a coffee
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Open‑source stack</CardTitle>
            <CardDescription>
              Big love to the tools making this possible.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Next.js (App Router)</li>
              <li>TypeScript</li>
              <li>Drizzle ORM + PostgreSQL</li>
              <li>Tailwind CSS</li>
              <li>shadcn/ui + Radix primitives</li>
              <li>Tabler Icons</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Community & credits</CardTitle>
            <CardDescription>Ideas, feedback, and good vibes.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              Thanks to friends and testers for trying every edge case and
              making Swush sharper.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function FeatureChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5",
        "border-primary/20 bg-primary/5 text-purple-100 dark:text-purple-200",
      )}
    >
      <span className="opacity-90">{icon}</span>
      <span className="text-[11px] font-medium tracking-wide">{label}</span>
    </div>
  );
}

function StackCard({ title, desc }: { title: string; desc: string }) {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
    </Card>
  );
}
