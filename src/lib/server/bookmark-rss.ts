/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
 *   All rights reserved.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
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

import "server-only";

import { JSDOM } from "jsdom";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { bookmarkRssFeeds, bookmarks } from "@/db/schemas";
import { createBookmark } from "@/lib/api/bookmarks";
import {
  createBookmarkSnapshot,
  normalizeBookmarkSnapshotMode,
  type BookmarkSnapshotMode,
} from "@/lib/server/bookmark-snapshot";
import { isJobExecutionEnabled } from "@/lib/server/job-runner-role";
import { assertSafeExternalHttpUrl } from "@/lib/security/url";
import { normalizeTagName } from "@/lib/tag-names";

const FEED_INTERVAL_MINUTES_DEFAULT = 60;
const FEED_INTERVAL_MINUTES_MIN = 5;
const FEED_INTERVAL_MINUTES_MAX = 7 * 24 * 60;
const FEED_MAX_ITEMS_DEFAULT = 10;
const FEED_MAX_ITEMS_MIN = 1;
const FEED_MAX_ITEMS_MAX = 30;

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const FEED_FETCH_TIMEOUT_MS = parsePositiveInt(
  process.env.BOOKMARK_RSS_FETCH_TIMEOUT_MS,
  10_000,
);
const FEED_RUN_LIMIT_DEFAULT = parsePositiveInt(
  process.env.WORKER_BOOKMARK_RSS_TICK_LIMIT,
  2,
);
const FEED_RUN_LIMIT_MAX = 10;

type BookmarkRssFeedRow = typeof bookmarkRssFeeds.$inferSelect;

type ParsedFeedItem = {
  title: string;
  link: string;
  description: string | null;
};

type ParsedFeed = {
  feedTitle: string | null;
  items: ParsedFeedItem[];
};

export type CreateBookmarkRssFeedInput = {
  userId: string;
  feedUrl: string;
  feedTitle?: string | null;
  intervalMinutes?: number | null;
  maxItemsPerFetch?: number | null;
  defaultTags?: string[] | null;
  snapshotMode?: BookmarkSnapshotMode | null;
  isEnabled?: boolean;
};

export type UpdateBookmarkRssFeedInput = {
  feedUrl?: string;
  feedTitle?: string | null;
  intervalMinutes?: number | null;
  maxItemsPerFetch?: number | null;
  defaultTags?: string[] | null;
  snapshotMode?: BookmarkSnapshotMode | null;
  isEnabled?: boolean;
  runNow?: boolean;
};

export function normalizeBookmarkRssIntervalMinutes(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return FEED_INTERVAL_MINUTES_DEFAULT;
  return Math.min(
    FEED_INTERVAL_MINUTES_MAX,
    Math.max(FEED_INTERVAL_MINUTES_MIN, Math.floor(parsed)),
  );
}

export function normalizeBookmarkRssMaxItems(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return FEED_MAX_ITEMS_DEFAULT;
  return Math.min(
    FEED_MAX_ITEMS_MAX,
    Math.max(FEED_MAX_ITEMS_MIN, Math.floor(parsed)),
  );
}

export function normalizeBookmarkRssTags(value: unknown) {
  if (!Array.isArray(value)) return null;
  const normalized = Array.from(
    new Set(
      value
        .map((item) => normalizeTagName(typeof item === "string" ? item : ""))
        .filter(Boolean),
    ),
  );
  return normalized.length ? normalized : null;
}

export function normalizeBookmarkRssSnapshotMode(
  value: unknown,
): BookmarkSnapshotMode {
  if (value === "local") return "local";
  if (value === "internet_archive") return "internet_archive";
  if (value === "both") return "both";
  return "none";
}

function normalizeFeedTitle(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 400) : null;
}

function toErrorMessage(error: unknown, fallback: string) {
  const message = (error as Error)?.message || fallback;
  return message.slice(0, 1000);
}

function resolveRunLimit(requestedLimit?: number) {
  const requested =
    Number.isFinite(requestedLimit) && (requestedLimit as number) > 0
      ? Math.floor(requestedLimit as number)
      : FEED_RUN_LIMIT_DEFAULT;
  return Math.min(FEED_RUN_LIMIT_MAX, Math.max(1, requested));
}

function cleanText(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function toPlainDescription(value: string | null | undefined) {
  const cleaned = cleanText(value?.replace(/<[^>]+>/g, " "));
  if (!cleaned) return null;
  return cleaned.slice(0, 1400);
}

function resolveFeedItemUrl(
  rawUrl: string | null | undefined,
  baseUrl: string,
) {
  const value = cleanText(rawUrl);
  if (!value) return null;
  try {
    const resolved = new URL(value, baseUrl).toString();
    return assertSafeExternalHttpUrl(resolved);
  } catch {
    return null;
  }
}

function parseRssItems(doc: Document, feedUrl: string): ParsedFeedItem[] {
  const rssItems = Array.from(doc.querySelectorAll("rss > channel > item"));
  return rssItems
    .map((item) => {
      const rawLink = cleanText(item.querySelector("link")?.textContent || "");
      const link = resolveFeedItemUrl(rawLink, feedUrl);
      if (!link) return null;

      const title =
        cleanText(item.querySelector("title")?.textContent || "") || link;
      const description = toPlainDescription(
        item.querySelector("description")?.textContent ||
          item.querySelector("content\\:encoded")?.textContent ||
          null,
      );

      return {
        title: title.slice(0, 400),
        link,
        description,
      } satisfies ParsedFeedItem;
    })
    .filter((item): item is ParsedFeedItem => Boolean(item));
}

function parseAtomItems(doc: Document, feedUrl: string): ParsedFeedItem[] {
  const entries = Array.from(doc.querySelectorAll("feed > entry"));
  return entries
    .map((entry) => {
      const href =
        entry.querySelector("link[rel='alternate']")?.getAttribute("href") ||
        entry.querySelector("link")?.getAttribute("href") ||
        "";
      const link = resolveFeedItemUrl(href, feedUrl);
      if (!link) return null;

      const title =
        cleanText(entry.querySelector("title")?.textContent) || link;
      const description = toPlainDescription(
        entry.querySelector("summary")?.textContent ||
          entry.querySelector("content")?.textContent ||
          null,
      );

      return {
        title: title.slice(0, 400),
        link,
        description,
      } satisfies ParsedFeedItem;
    })
    .filter((item): item is ParsedFeedItem => Boolean(item));
}

function parseFeedXml(xml: string, feedUrl: string): ParsedFeed {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const doc = dom.window.document;
  if (doc.querySelector("parsererror")) {
    throw new Error("Feed XML could not be parsed");
  }

  const feedTitle = normalizeFeedTitle(
    doc.querySelector("rss > channel > title")?.textContent ||
      doc.querySelector("feed > title")?.textContent ||
      null,
  );

  const parsedItems = [
    ...parseRssItems(doc, feedUrl),
    ...parseAtomItems(doc, feedUrl),
  ];

  const seen = new Set<string>();
  const items: ParsedFeedItem[] = [];
  for (const item of parsedItems) {
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    items.push(item);
  }

  return { feedTitle, items };
}

async function fetchFeed(feedUrl: string) {
  const safeUrl = assertSafeExternalHttpUrl(feedUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(safeUrl, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "Swush/1.0 RSS Auto-Hoard",
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Feed request failed (${res.status})`);
    }

    const xml = await res.text();
    if (!xml.trim()) throw new Error("Feed returned an empty response");
    return parseFeedXml(xml, safeUrl);
  } finally {
    clearTimeout(timeout);
  }
}

async function processFeed(feed: BookmarkRssFeedRow) {
  const startedAt = new Date();

  try {
    const parsed = await fetchFeed(feed.feedUrl);
    const maxItems = normalizeBookmarkRssMaxItems(feed.maxItemsPerFetch);
    const candidates = parsed.items.slice(0, maxItems);

    const links = Array.from(new Set(candidates.map((item) => item.link)));
    const existingRows =
      links.length > 0
        ? await db
            .select({ url: bookmarks.url })
            .from(bookmarks)
            .where(
              and(
                eq(bookmarks.userId, feed.userId),
                inArray(bookmarks.url, links),
              ),
            )
        : [];

    const existing = new Set(existingRows.map((row) => row.url));
    let created = 0;
    const itemErrors: string[] = [];

    for (const item of candidates) {
      if (existing.has(item.link)) continue;

      try {
        const createdBookmark = await createBookmark({
          userId: feed.userId,
          url: item.link,
          title: item.title || item.link,
          description: item.description,
          imageUrl: null,
          isFavorite: false,
          isPublic: false,
          tags: feed.defaultTags ?? undefined,
          skipMetadataFetch: true,
        });
        created += 1;
        existing.add(item.link);

        const snapshotMode = normalizeBookmarkSnapshotMode(feed.snapshotMode);
        if (snapshotMode !== "none") {
          const snapshotResult = await createBookmarkSnapshot({
            url: createdBookmark.url,
            mode: snapshotMode,
          });
          if (snapshotResult?.local?.ok && snapshotResult.local.payload) {
            await db
              .update(bookmarks)
              .set(snapshotResult.local.payload)
              .where(
                and(
                  eq(bookmarks.id, createdBookmark.id),
                  eq(bookmarks.userId, feed.userId),
                ),
              );
          }
        }
      } catch (error) {
        itemErrors.push(toErrorMessage(error, "Failed to store one feed item"));
      }
    }

    await db
      .update(bookmarkRssFeeds)
      .set({
        feedTitle: parsed.feedTitle || feed.feedTitle,
        lastFetchedAt: startedAt,
        lastError: itemErrors[0] || null,
        updatedAt: new Date(),
      })
      .where(eq(bookmarkRssFeeds.id, feed.id));

    return { processed: 1, created, failed: itemErrors.length };
  } catch (error) {
    await db
      .update(bookmarkRssFeeds)
      .set({
        lastFetchedAt: startedAt,
        lastError: toErrorMessage(error, "Feed fetch failed"),
        updatedAt: new Date(),
      })
      .where(eq(bookmarkRssFeeds.id, feed.id));

    return { processed: 1, created: 0, failed: 1 };
  }
}

async function claimFeedById(feedId: string) {
  const [feed] = await db
    .select()
    .from(bookmarkRssFeeds)
    .where(
      and(
        eq(bookmarkRssFeeds.id, feedId),
        eq(bookmarkRssFeeds.isEnabled, true),
        lte(bookmarkRssFeeds.nextFetchAt, new Date()),
      ),
    )
    .limit(1);

  if (!feed) return null;

  const nextFetchAt = new Date(
    Date.now() +
      normalizeBookmarkRssIntervalMinutes(feed.intervalMinutes) * 60_000,
  );

  const [claimed] = await db
    .update(bookmarkRssFeeds)
    .set({
      nextFetchAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookmarkRssFeeds.id, feed.id),
        eq(bookmarkRssFeeds.isEnabled, true),
        lte(bookmarkRssFeeds.nextFetchAt, new Date()),
      ),
    )
    .returning();

  return claimed ?? null;
}

async function claimDueFeeds(limit: number) {
  const dueFeeds = await db
    .select()
    .from(bookmarkRssFeeds)
    .where(
      and(
        eq(bookmarkRssFeeds.isEnabled, true),
        lte(bookmarkRssFeeds.nextFetchAt, new Date()),
      ),
    )
    .orderBy(asc(bookmarkRssFeeds.nextFetchAt))
    .limit(limit);

  const claimed: BookmarkRssFeedRow[] = [];
  for (const feed of dueFeeds) {
    const row = await claimFeedById(feed.id);
    if (row) claimed.push(row);
  }

  return claimed;
}

export async function listBookmarkRssFeeds(userId: string) {
  return db
    .select()
    .from(bookmarkRssFeeds)
    .where(eq(bookmarkRssFeeds.userId, userId))
    .orderBy(desc(bookmarkRssFeeds.createdAt));
}

export async function getBookmarkRssFeedById(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(bookmarkRssFeeds)
    .where(
      and(eq(bookmarkRssFeeds.userId, userId), eq(bookmarkRssFeeds.id, id)),
    )
    .limit(1);
  return row ?? null;
}

export async function createBookmarkRssFeed(input: CreateBookmarkRssFeedInput) {
  const feedUrl = assertSafeExternalHttpUrl(input.feedUrl);
  const intervalMinutes = normalizeBookmarkRssIntervalMinutes(
    input.intervalMinutes,
  );
  const maxItemsPerFetch = normalizeBookmarkRssMaxItems(input.maxItemsPerFetch);
  const defaultTags = normalizeBookmarkRssTags(input.defaultTags);
  const snapshotMode = normalizeBookmarkRssSnapshotMode(input.snapshotMode);

  const [existing] = await db
    .select({ id: bookmarkRssFeeds.id })
    .from(bookmarkRssFeeds)
    .where(
      and(
        eq(bookmarkRssFeeds.userId, input.userId),
        eq(bookmarkRssFeeds.feedUrl, feedUrl),
      ),
    )
    .limit(1);

  if (existing) {
    throw new Error("Feed already exists");
  }

  const [created] = await db
    .insert(bookmarkRssFeeds)
    .values({
      userId: input.userId,
      feedUrl,
      feedTitle: normalizeFeedTitle(input.feedTitle),
      intervalMinutes,
      maxItemsPerFetch,
      defaultTags,
      snapshotMode,
      isEnabled: input.isEnabled !== false,
      lastFetchedAt: null,
      nextFetchAt: new Date(),
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

export async function updateBookmarkRssFeed(
  userId: string,
  id: string,
  patch: UpdateBookmarkRssFeedInput,
) {
  const existing = await getBookmarkRssFeedById(userId, id);
  if (!existing) return null;

  const next: Partial<typeof bookmarkRssFeeds.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (patch.feedUrl !== undefined) {
    const nextFeedUrl = assertSafeExternalHttpUrl(patch.feedUrl);
    if (nextFeedUrl !== existing.feedUrl) {
      const [duplicate] = await db
        .select({ id: bookmarkRssFeeds.id })
        .from(bookmarkRssFeeds)
        .where(
          and(
            eq(bookmarkRssFeeds.userId, userId),
            eq(bookmarkRssFeeds.feedUrl, nextFeedUrl),
          ),
        )
        .limit(1);
      if (duplicate) {
        throw new Error("Feed already exists");
      }
    }
    next.feedUrl = nextFeedUrl;
  }

  if (patch.feedTitle !== undefined) {
    next.feedTitle = normalizeFeedTitle(patch.feedTitle);
  }

  if (patch.intervalMinutes !== undefined) {
    next.intervalMinutes = normalizeBookmarkRssIntervalMinutes(
      patch.intervalMinutes,
    );
  }

  if (patch.maxItemsPerFetch !== undefined) {
    next.maxItemsPerFetch = normalizeBookmarkRssMaxItems(
      patch.maxItemsPerFetch,
    );
  }

  if (patch.defaultTags !== undefined) {
    next.defaultTags = normalizeBookmarkRssTags(patch.defaultTags);
  }

  if (patch.snapshotMode !== undefined) {
    next.snapshotMode = normalizeBookmarkRssSnapshotMode(patch.snapshotMode);
  }

  if (patch.isEnabled !== undefined) {
    next.isEnabled = Boolean(patch.isEnabled);
    if (next.isEnabled && !existing.isEnabled) {
      next.nextFetchAt = new Date();
    }
  }

  if (patch.runNow) {
    next.nextFetchAt = new Date();
    next.lastError = null;
  }

  const [updated] = await db
    .update(bookmarkRssFeeds)
    .set(next)
    .where(
      and(eq(bookmarkRssFeeds.userId, userId), eq(bookmarkRssFeeds.id, id)),
    )
    .returning();

  return updated ?? null;
}

export async function deleteBookmarkRssFeed(userId: string, id: string) {
  const [deleted] = await db
    .delete(bookmarkRssFeeds)
    .where(
      and(eq(bookmarkRssFeeds.userId, userId), eq(bookmarkRssFeeds.id, id)),
    )
    .returning({ id: bookmarkRssFeeds.id });
  return Boolean(deleted?.id);
}

export async function runBookmarkRssFeedById(feedId: string) {
  if (!isJobExecutionEnabled()) return { processed: 0, created: 0, failed: 0 };

  const claimed = await claimFeedById(feedId);
  if (!claimed) return { processed: 0, created: 0, failed: 0 };

  return processFeed(claimed);
}

export async function runBookmarkRssFeeds(limit = FEED_RUN_LIMIT_DEFAULT) {
  if (!isJobExecutionEnabled()) return { processed: 0, created: 0, failed: 0 };

  const claimLimit = resolveRunLimit(limit);
  const claimedFeeds = await claimDueFeeds(claimLimit);

  if (!claimedFeeds.length) {
    return { processed: 0, created: 0, failed: 0 };
  }

  let processed = 0;
  let created = 0;
  let failed = 0;

  for (const feed of claimedFeeds) {
    const result = await processFeed(feed);
    processed += result.processed;
    created += result.created;
    failed += result.failed;
  }

  return { processed, created, failed };
}

let bookmarkRssRunnerActive = false;
const pendingBookmarkRssFeedIds = new Set<string>();
let pendingBookmarkRssBatch = false;

export async function kickBookmarkRssRunner(params?: {
  limit?: number;
  feedId?: string | null;
}) {
  if (!isJobExecutionEnabled()) return { processed: 0, created: 0, failed: 0 };

  if (params?.feedId) {
    pendingBookmarkRssFeedIds.add(params.feedId);
  } else {
    pendingBookmarkRssBatch = true;
  }

  if (bookmarkRssRunnerActive) {
    return { processed: 0, created: 0, failed: 0 };
  }

  bookmarkRssRunnerActive = true;

  const run = async () => {
    let processed = 0;
    let created = 0;
    let failed = 0;

    while (pendingBookmarkRssFeedIds.size > 0) {
      const [feedId] = pendingBookmarkRssFeedIds;
      if (!feedId) break;
      pendingBookmarkRssFeedIds.delete(feedId);
      const result = await runBookmarkRssFeedById(feedId);
      processed += result.processed;
      created += result.created;
      failed += result.failed;
    }

    if (pendingBookmarkRssBatch) {
      pendingBookmarkRssBatch = false;
      const result = await runBookmarkRssFeeds(params?.limit);
      processed += result.processed;
      created += result.created;
      failed += result.failed;
    }

    if (pendingBookmarkRssFeedIds.size > 0 || pendingBookmarkRssBatch) {
      return run();
    }

    return { processed, created, failed };
  };

  try {
    return await run();
  } finally {
    bookmarkRssRunnerActive = false;
    if (pendingBookmarkRssFeedIds.size > 0 || pendingBookmarkRssBatch) {
      setImmediate(() => {
        void kickBookmarkRssRunner().catch(() => {});
      });
    }
  }
}

export function getBookmarkRssRunnerState() {
  return {
    active: bookmarkRssRunnerActive,
    pendingById: pendingBookmarkRssFeedIds.size,
    pendingBatch: pendingBookmarkRssBatch,
  };
}
