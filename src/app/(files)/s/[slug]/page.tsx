/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import { db } from "@/db/client";
import { shortLinks } from "@/db/schemas/core-schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getDefaultMetadata } from "@/lib/head";
import ExternalLayout from "@/components/Common/ExternalLayout";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import { verifyPasswordHash } from "@/lib/api/password";
import { handleShortLinkMaxViews } from "@/lib/server/max-views";
import { enforceAnonymousShareAge } from "@/lib/server/anonymous-share";
import {
  applyEmbedTemplates,
  applyEmbedSettings,
  getEmbedSettingsByUserId,
  getUsernameByUserId,
  resolveEmbedViewport,
} from "@/lib/server/embed-settings";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ anon?: string; password?: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const { anon } = await searchParams;
  const isAnonymous = ["1", "true", "yes"].includes((anon ?? "").toLowerCase());
  const { appName, appUrl } = await getPublicRuntimeSettings();
  const defaultMetadata = await getDefaultMetadata();

  const link = await db.query.shortLinks.findFirst({
    where: (t, { eq }) => eq(t.slug, slug),
  });

  const username = isAnonymous ? null : await getUsernameByUserId(link?.userId);
  const siteName = username ? `${username} on ${appName}` : undefined;
  const baseMetadata = {
    ...defaultMetadata,
    title: `${appName} • ${slug}`,
    description: `Redirects to something special for ${slug}`,
    openGraph: {
      ...(defaultMetadata.openGraph ?? {}),
      ...(siteName ? { siteName } : {}),
      title: `${appName} • ${slug}`,
      description: `Redirects to something special for ${slug}`,
      url: `${appUrl}/s/${slug}`,
    },
    twitter: {
      ...(defaultMetadata.twitter ?? {}),
      title: `${appName} • ${slug}`,
      description: `Redirects to something special for ${slug}`,
    },
  };

  if (!link?.isPublic || !link.userId || isAnonymous) return baseMetadata;

  const embedSettings = applyEmbedTemplates(
    await getEmbedSettingsByUserId(link.userId, true),
    {
      title: `${appName} • ${slug}`,
      slug,
      username: username ?? "",
      app: appName,
    },
  );
  return applyEmbedSettings(baseMetadata, embedSettings);
}

export async function generateViewport({
  params,
}: {
  params: Params;
}): Promise<Viewport> {
  const { slug } = await params;
  const link = await db.query.shortLinks.findFirst({
    where: (t, { eq }) => eq(t.slug, slug),
  });
  return resolveEmbedViewport(link?.userId);
}

export default async function ShortLinkPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { password, anon } = await searchParams;
  const isAnonymous = ["1", "true", "yes"].includes(
    String(anon ?? "").toLowerCase(),
  );

  const link = await db.query.shortLinks.findFirst({
    where: (t, { eq }) => eq(t.slug, slug),
  });

  if (!link || !link.originalUrl) {
    notFound();
  }

  if (!link.isPublic) {
    return (
      <ExternalLayout>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>🔒 Private Link</CardTitle>
            <CardDescription>This link is private.</CardDescription>
          </CardHeader>
        </Card>
      </ExternalLayout>
    );
  }

  if (link.expiresAt instanceof Date) {
    const now = new Date();
    if (link.expiresAt <= now) {
      return (
        <ExternalLayout>
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Link expired</CardTitle>
              <CardDescription>
                This short link is no longer available.
              </CardDescription>
            </CardHeader>
          </Card>
        </ExternalLayout>
      );
    }
  }

  if (isAnonymous) {
    const ageError = enforceAnonymousShareAge(link.createdAt ?? null);
    if (ageError) {
      return (
        <ExternalLayout>
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Anonymous link expired</CardTitle>
              <CardDescription>{ageError}</CardDescription>
            </CardHeader>
          </Card>
        </ExternalLayout>
      );
    }
  }

  if (
    typeof link.maxClicks === "number" &&
    typeof link.clickCount === "number"
  ) {
    if (link.maxClicks > 0 && link.clickCount >= link.maxClicks) {
      return (
        <ExternalLayout>
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Link unavailable</CardTitle>
              <CardDescription>
                This link reached its maximum number of clicks.
              </CardDescription>
            </CardHeader>
          </Card>
        </ExternalLayout>
      );
    }
  }

  const providedPassword = typeof password === "string" ? password : undefined;

  if (link.password) {
    const isValid =
      providedPassword !== undefined
        ? await verifyPasswordHash(providedPassword, link.password)
        : false;
    const wrongPassword = providedPassword !== undefined && !isValid;

    if (!providedPassword || !isValid) {
      return (
        <ExternalLayout>
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>🔒 Password required</CardTitle>
              <CardDescription>
                Enter the password to continue to the destination.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form method="GET" className="grid gap-3">
                {wrongPassword ? (
                  <p className="text-sm text-red-400">
                    Incorrect password. Please try again.
                  </p>
                ) : null}
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    autoComplete="off"
                  />
                </div>
                <input type="hidden" name="continue" value="1" />
                <Button type="submit" className="mt-2">
                  Continue
                </Button>
              </form>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Your password is only used to unlock this link.
              </p>
            </CardFooter>
          </Card>
        </ExternalLayout>
      );
    }
  }

  const [updated] = await db
    .update(shortLinks)
    .set({ clickCount: (link.clickCount || 0) + 1 })
    .where(eq(shortLinks.slug, slug))
    .returning();

  if (updated) {
    await handleShortLinkMaxViews(updated);
  }

  redirect(updated?.originalUrl ?? link.originalUrl);
}
