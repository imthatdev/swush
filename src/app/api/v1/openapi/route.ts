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

import { NextResponse } from "next/server";
import { withApiError } from "@/lib/server/api-error";

export const runtime = "nodejs";

export const GET = withApiError(async function GET() {
  const toTitleCase = (value: string) =>
    value
      .split(" ")
      .map((segment) =>
        segment ? `${segment[0].toUpperCase()}${segment.slice(1)}` : segment,
      )
      .join(" ");

  const removedModules = new Set([
    "notes",
    "bookmarks",
    "snippets",
    "recipes",
    "games",
    "gamelists",
  ]);

  const removedPathPattern =
    /^\/api\/v1\/(notes|bookmarks|snippets|recipes|games)(\/|$)/;

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Swush API (v1)",
      version: "1.0.0",
      description:
        "Public OpenAPI document for /api/v1 routes. Authentication is handled via Better Auth session cookies, bearer tokens, or API keys (x-api-key). Most endpoints return JSON and standard error payloads with a human-readable message, optional error code, and request ID. List endpoints may support pagination via limit/offset and filtering parameters where documented.",
    },
    servers: [{ url: "/" }],
    security: [{ bearerAuth: [] }, { apiKeyHeader: [] }, { sessionCookie: [] }],
    tags: [
      {
        name: "admin",
        description:
          "Admin-only operations for users, settings, and maintenance tasks.",
      },
      {
        name: "audit",
        description:
          "Audit log listing, proofs, verification, and reset actions.",
      },
      {
        name: "auth",
        description: "Authentication helpers including extension device flow.",
      },
      {
        name: "avatar",
        description: "User avatar upload and retrieval endpoints.",
      },
      {
        name: "bookmarks",
        description: "Create, update, delete, and share bookmarks.",
      },
      {
        name: "files",
        description:
          "File listing, metadata edits, public sharing, and favorites.",
      },
      {
        name: "folders",
        description: "Folder listing and management for uploaded files.",
      },
      {
        name: "games",
        description: "Games library management and Steam integration.",
      },
      {
        name: "notes",
        description: "Notes CRUD, publishing, and public access.",
      },
      {
        name: "notifications",
        description: "User notification feed and read-state actions.",
      },
      {
        name: "ping",
        description: "Health checks and connectivity probes.",
      },
      {
        name: "profile",
        description:
          "Profile summary, usage quotas, and storage limits for the user.",
      },
      {
        name: "recipes",
        description: "Recipes CRUD, publishing, and public access.",
      },
      {
        name: "register",
        description: "Registration status checks and availability.",
      },
      {
        name: "setup",
        description: "Initial instance setup and configuration.",
      },
      {
        name: "search",
        description: "Global search across supported resources.",
      },
      {
        name: "shorten",
        description: "Short link creation, updates, and public redirects.",
      },
      {
        name: "snippets",
        description: "Snippet CRUD, publishing, and public access.",
      },
      {
        name: "steam",
        description: "Steam OpenID linking and owned-games import.",
      },
      {
        name: "tags",
        description: "Tag creation, updates, and deletion flows.",
      },
      {
        name: "uploads",
        description:
          "Uploads including single-file and chunked upload sessions.",
      },
      {
        name: "watch",
        description: "Watch provider search and metadata lookup.",
      },
      {
        name: "watchlist",
        description: "Watchlist CRUD and episode progress updates.",
      },
      {
        name: "jobs",
        description: "Internal scheduled jobs and maintenance tasks.",
      },
      {
        name: "integrations",
        description: "Webhooks and outbound integration helpers.",
      },
      {
        name: "upload-requests",
        description: "Upload request links and approval queue.",
      },
      {
        name: "reference",
        description: "Interactive API reference UI.",
      },
    ],
    components: {
      schemas: {
        ApiError: {
          type: "object",
          properties: {
            error: { type: "string" },
            errorInfo: {
              type: "object",
              nullable: true,
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: {
                  type: "object",
                  additionalProperties: true,
                  nullable: true,
                },
              },
              required: ["code", "message"],
            },
            message: { type: "string" },
            status: { type: "number" },
          },
          required: ["error", "message", "status"],
        },
        ApiStatus: {
          type: "object",
          properties: {
            status: { type: "boolean" },
            message: { type: "string", nullable: true },
          },
          required: ["status"],
        },
        ServerSettings: {
          type: "object",
          properties: {
            allowPublicRegistration: { type: "boolean" },
            passwordPolicyMinLength: { type: "number" },
            maxUploadMb: { type: "number" },
            maxFilesPerUpload: { type: "number" },
            userMaxStorageMb: { type: "number" },
            adminMaxStorageMb: { type: "number" },
            userDailyQuotaMb: { type: "number" },
            adminDailyQuotaMb: { type: "number" },
            filesLimitUser: { type: "number", nullable: true },
            filesLimitAdmin: { type: "number", nullable: true },
            notesLimitUser: { type: "number", nullable: true },
            notesLimitAdmin: { type: "number", nullable: true },
            bookmarksLimitUser: { type: "number", nullable: true },
            bookmarksLimitAdmin: { type: "number", nullable: true },
            snippetsLimitUser: { type: "number", nullable: true },
            snippetsLimitAdmin: { type: "number", nullable: true },
            recipesLimitUser: { type: "number", nullable: true },
            recipesLimitAdmin: { type: "number", nullable: true },
            shortLinksLimitUser: { type: "number", nullable: true },
            shortLinksLimitAdmin: { type: "number", nullable: true },
            allowedMimePrefixes: {
              type: "array",
              items: { type: "string" },
              nullable: true,
            },
            disallowedExtensions: {
              type: "array",
              items: { type: "string" },
              nullable: true,
            },
            preservedUsernames: {
              type: "array",
              items: { type: "string" },
              nullable: true,
            },
            setupCompleted: { type: "boolean", nullable: true },
          },
          required: [
            "allowPublicRegistration",
            "passwordPolicyMinLength",
            "maxUploadMb",
            "maxFilesPerUpload",
            "userMaxStorageMb",
            "adminMaxStorageMb",
            "userDailyQuotaMb",
            "adminDailyQuotaMb",
          ],
        },
        ServerSettingsUpdate: {
          allOf: [{ $ref: "#/components/schemas/ServerSettings" }],
        },
        LimitEntry: {
          type: "object",
          properties: {
            used: { type: "number" },
            limit: { type: "number" },
            remaining: {
              oneOf: [
                { type: "number" },
                { type: "string", enum: ["Infinity"] },
              ],
            },
          },
          required: ["used", "limit", "remaining"],
        },
        ProfileSummary: {
          type: "object",
          properties: {
            resources: {
              type: "object",
              properties: {
                files: { $ref: "#/components/schemas/LimitEntry" },
                shortLink: { $ref: "#/components/schemas/LimitEntry" },
                recipe: { $ref: "#/components/schemas/LimitEntry" },
                note: { $ref: "#/components/schemas/LimitEntry" },
                snippet: { $ref: "#/components/schemas/LimitEntry" },
                bookmark: { $ref: "#/components/schemas/LimitEntry" },
              },
              required: [
                "files",
                "shortLink",
                "recipe",
                "note",
                "snippet",
                "bookmark",
              ],
            },
            storage: {
              type: "object",
              properties: {
                maxStorageMb: {
                  oneOf: [
                    { type: "number" },
                    { type: "string", enum: ["Infinity"] },
                  ],
                },
                usedStorageMb: { type: "number" },
                remainingStorageMb: {
                  oneOf: [
                    { type: "number" },
                    { type: "string", enum: ["Infinity"] },
                  ],
                },
              },
              required: ["maxStorageMb", "usedStorageMb", "remainingStorageMb"],
            },
            dailyQuota: {
              type: "object",
              properties: {
                dailyQuotaMb: {
                  oneOf: [
                    { type: "number" },
                    { type: "string", enum: ["Infinity"] },
                  ],
                },
                usedTodayMb: { type: "number" },
                remainingTodayMb: {
                  oneOf: [
                    { type: "number" },
                    { type: "string", enum: ["Infinity"] },
                  ],
                },
              },
              required: ["dailyQuotaMb", "usedTodayMb", "remainingTodayMb"],
            },
            perUpload: {
              type: "object",
              properties: {
                maxUploadMb: { type: "number" },
                maxFilesPerUpload: { type: "number" },
              },
              required: ["maxUploadMb", "maxFilesPerUpload"],
            },
          },
          required: ["resources", "storage", "dailyQuota", "perUpload"],
        },
        AdminMetricsDaily: {
          type: "object",
          properties: {
            date: { type: "string", format: "date" },
            users: { type: "number" },
            files: { type: "number" },
            storageBytes: { type: "number" },
            notes: { type: "number" },
            bookmarks: { type: "number" },
            snippets: { type: "number" },
            recipes: { type: "number" },
            shortLinks: { type: "number" },
          },
          required: [
            "date",
            "users",
            "files",
            "storageBytes",
            "notes",
            "bookmarks",
            "snippets",
            "recipes",
            "shortLinks",
          ],
        },
        AdminMetricsTotals: {
          type: "object",
          properties: {
            users: { type: "number" },
            verifiedUsers: { type: "number" },
            admins: { type: "number" },
            owners: { type: "number" },
            files: { type: "number" },
            notes: { type: "number" },
            bookmarks: { type: "number" },
            snippets: { type: "number" },
            recipes: { type: "number" },
            shortLinks: { type: "number" },
            tags: { type: "number" },
            folders: { type: "number" },
            watchlist: { type: "number" },
            games: { type: "number" },
          },
          required: [
            "users",
            "verifiedUsers",
            "admins",
            "owners",
            "files",
            "notes",
            "bookmarks",
            "snippets",
            "recipes",
            "shortLinks",
            "tags",
            "folders",
            "watchlist",
            "games",
          ],
        },
        AdminMetrics: {
          type: "object",
          properties: {
            totals: { $ref: "#/components/schemas/AdminMetricsTotals" },
            storageBytes: { type: "number" },
            daily: {
              type: "array",
              items: { $ref: "#/components/schemas/AdminMetricsDaily" },
            },
          },
          required: ["totals", "storageBytes", "daily"],
        },
        AdminJobRun: {
          type: "object",
          properties: {
            id: { type: "string" },
            actorUserId: { type: "string", nullable: true },
            job: { type: "string" },
            status: {
              type: "string",
              enum: ["running", "success", "failed"],
            },
            result: { type: "object", additionalProperties: true },
            error: { type: "string", nullable: true },
            startedAt: { type: "string", format: "date-time" },
            finishedAt: { type: "string", format: "date-time", nullable: true },
          },
          required: ["id", "job", "status", "startedAt"],
        },
        ImportRun: {
          type: "object",
          properties: {
            id: { type: "integer" },
            provider: { type: "string" },
            userId: { type: "string", nullable: true },
            itemsTotal: { type: "integer" },
            itemsOk: { type: "integer" },
            itemsFail: { type: "integer" },
            result: { type: "object", additionalProperties: true },
            createdAt: { type: "string", format: "date-time" },
          },
          required: [
            "id",
            "provider",
            "itemsTotal",
            "itemsOk",
            "itemsFail",
            "createdAt",
          ],
        },
        SteamGame: {
          type: "object",
          properties: {
            provider: { type: "string", enum: ["steam"] },
            providerId: { type: "string" },
            title: { type: "string" },
            cover: { type: "string", nullable: true },
            platform: { type: "string", nullable: true },
            playtime: { type: "number", nullable: true },
            isPublic: { type: "boolean", nullable: true },
            isNsfw: { type: "boolean", nullable: true },
          },
          required: ["provider", "providerId", "title"],
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Bearer token authentication.",
        },
        apiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "API key authentication via x-api-key header.",
        },
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "session",
          description:
            "Session cookie issued by Better Auth. Cookie name may vary by deployment.",
        },
      },
      responses: {
        BadRequest: {
          description: "Bad request.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        EmbedSettings: {
          type: "object",
          properties: {
            title: { type: "string", nullable: true },
            description: { type: "string", nullable: true },
            color: { type: "string", nullable: true },
            imageUrl: { type: "string", nullable: true },
          },
        },
        UserPreferences: {
          type: "object",
          properties: {
            revealSpoilers: { type: "boolean" },
            hidePreviews: { type: "boolean" },
            vaultView: { type: "string", enum: ["list", "grid"] },
            vaultSort: {
              type: "string",
              enum: [
                "newest",
                "oldest",
                "name-asc",
                "name-desc",
                "size-asc",
                "size-desc",
              ],
            },
            rememberLastFolder: { type: "boolean" },
            lastFolder: { type: "string", nullable: true },
            autoplayMedia: { type: "boolean" },
            openSharedInNewTab: { type: "boolean" },
            hidePublicShareConfirmations: { type: "boolean" },
            showSocialsOnShare: { type: "boolean" },
            socialInstagram: { type: "string", nullable: true },
            socialX: { type: "string", nullable: true },
            socialGithub: { type: "string", nullable: true },
            socialWebsite: { type: "string", nullable: true },
            socialOther: { type: "string", nullable: true },
            defaultUploadVisibility: {
              type: "string",
              enum: ["private", "public"],
            },
            defaultUploadFolder: { type: "string", nullable: true },
            defaultUploadTags: {
              type: "array",
              items: { type: "string" },
            },
            defaultBookmarkVisibility: {
              type: "string",
              enum: ["private", "public"],
            },
            defaultBookmarkTags: {
              type: "array",
              items: { type: "string" },
            },
            defaultNoteVisibility: {
              type: "string",
              enum: ["private", "public"],
            },
            defaultNoteTags: {
              type: "array",
              items: { type: "string" },
            },
            defaultSnippetVisibility: {
              type: "string",
              enum: ["private", "public"],
            },
            defaultSnippetTags: {
              type: "array",
              items: { type: "string" },
            },
            defaultSnippetLanguage: { type: "string" },
            defaultRecipeVisibility: {
              type: "string",
              enum: ["private", "public"],
            },
            defaultRecipeServings: { type: "number", nullable: true },
            defaultRecipeTags: {
              type: "array",
              items: { type: "string" },
            },
            defaultShortlinkVisibility: {
              type: "string",
              enum: ["private", "public"],
            },
            defaultShortlinkTags: {
              type: "array",
              items: { type: "string" },
            },
            defaultShortlinkMaxClicks: { type: "number", nullable: true },
            defaultShortlinkExpireDays: { type: "number", nullable: true },
            defaultShortlinkSlugPrefix: { type: "string" },
            rememberSettingsTab: { type: "boolean" },
            lastSettingsTab: {
              type: "string",
              enum: ["display", "behavior", "defaults"],
            },
            sizeFormat: {
              type: "string",
              enum: ["auto", "bytes", "metric"],
            },
          },
        },
        ExportJob: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            status: {
              type: "string",
              enum: ["queued", "processing", "ready", "failed"],
            },
            fileName: { type: "string", nullable: true },
            storedName: { type: "string", nullable: true },
            storageDriver: { type: "string", nullable: true },
            size: { type: "number", nullable: true },
            error: { type: "string", nullable: true },
            options: {
              $ref: "#/components/schemas/ExportOptions",
              nullable: true,
            },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
          required: ["id", "status"],
        },
        ExportOptions: {
          type: "object",
          properties: {
            includeFiles: { type: "boolean" },
            includeFileBinaries: { type: "boolean" },
            includeNotes: { type: "boolean" },
            includeBookmarks: { type: "boolean" },
            includeSnippets: { type: "boolean" },
            includeRecipes: { type: "boolean" },
            includeShortLinks: { type: "boolean" },
          },
        },
        ExportRequest: {
          type: "object",
          properties: {
            include: { $ref: "#/components/schemas/ExportOptions" },
          },
        },
        ExportList: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/ExportJob" },
            },
            total: { type: "number" },
          },
        },
        Unauthorized: {
          description: "Unauthorized.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        Forbidden: {
          description: "Forbidden.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        NotFound: {
          description: "Not found.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        Conflict: {
          description: "Conflict.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        RateLimited: {
          description: "Too many requests.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        ServerError: {
          description: "Internal server error.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
      },
    },
    paths: {
      "/api/v1/anilist/sync": {
        post: {
          tags: ["anilist"],
          summary: "Sync AniList for current user",
          description:
            "Syncs the authenticated user's AniList watching list and progress. Requires the user to have linked their AniList account.",
          responses: {
            "200": {
              description: "Sync completed",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      added: { type: "number" },
                      updated: { type: "number" },
                      episodesAdded: { type: "number" },
                      skippedExpired: { type: "number" },
                      message: { type: "string" },
                    },
                    required: [
                      "added",
                      "updated",
                      "episodesAdded",
                      "skippedExpired",
                      "message",
                    ],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/steam/sync-playtime": {
        post: {
          tags: ["steam"],
          summary: "Sync Steam playtime for current user",
          description:
            "Syncs the authenticated user's Steam game playtime from Steam and updates their game library. Requires the user to have linked their Steam account.",
          responses: {
            "200": {
              description: "Sync completed",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      updated: { type: "number" },
                      message: { type: "string" },
                    },
                    required: ["updated", "message"],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/avatar": {
        get: {
          tags: ["avatar"],
          summary: "Get current user's avatar",
          description:
            "Redirects to the current user's avatar endpoint (or the default avatar when unauthenticated).",
          responses: {
            "307": { description: "Redirect to avatar image" },
            "302": { description: "Redirect to avatar image" },
          },
        },
      },
      "/api/v1/avatar/upload": {
        post: {
          tags: ["avatar"],
          summary: "Upload avatar",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    file: { type: "string", format: "binary" },
                    avatar: { type: "string", format: "binary" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Avatar uploaded",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      url: { type: "string" },
                      defaultUrl: { type: "string" },
                    },
                    required: ["url", "defaultUrl"],
                  },
                },
              },
            },
            "400": { description: "Invalid file" },
            "401": { description: "Unauthorized" },
            "413": { description: "Avatar too large" },
            "429": { description: "Rate limited" },
          },
        },
        delete: {
          tags: ["avatar"],
          summary: "Reset avatar to default",
          responses: {
            "200": {
              description: "Avatar reset",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      url: { type: "string" },
                      defaultUrl: { type: "string" },
                    },
                    required: ["ok", "url", "defaultUrl"],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/avatar/{userId}": {
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["avatar"],
          summary: "Get current avatar for a user",
          description:
            "Returns the user's current avatar (or the default avatar) as `image/png`.",
          responses: {
            "200": {
              description: "Avatar image",
              content: {
                "image/png": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            "404": { description: "Missing default avatar" },
          },
        },
      },
      "/api/v1/avatar/{userId}/{file}": {
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "file",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["avatar"],
          summary: "Get a specific versioned avatar image",
          description:
            "Fetches a specific immutable avatar file for a user. Returns `404` if the file is not present yet.",
          responses: {
            "200": {
              description: "Avatar image",
              content: {
                "image/png": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            "304": { description: "Not modified" },
            "400": { description: "Invalid avatar file" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/auth/device/authorize": {
        post: {
          tags: ["auth"],
          summary: "Start device flow",
          description:
            "Creates a device code and user code for extension sign-in.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    extension_id: { type: "string" },
                  },
                  required: ["extension_id"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Device flow payload",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      device_code: { type: "string" },
                      user_code: { type: "string" },
                      verification_uri: { type: "string" },
                      verification_uri_complete: { type: "string" },
                      expires_in: { type: "number" },
                      interval: { type: "number" },
                    },
                    required: [
                      "device_code",
                      "user_code",
                      "verification_uri",
                      "verification_uri_complete",
                      "expires_in",
                      "interval",
                    ],
                  },
                },
              },
            },
            "400": { description: "Invalid payload" },
            "403": { description: "Extension not allowed" },
            "500": { description: "Server error" },
          },
        },
      },
      "/api/v1/auth/device/token": {
        post: {
          tags: ["auth"],
          summary: "Exchange device code for API key",
          description:
            "Polls the device flow to exchange an approved device code for an API key.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    device_code: { type: "string" },
                  },
                  required: ["device_code"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "API key issued",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token_type: { type: "string", enum: ["ApiKey"] },
                      api_key: { type: "string" },
                      expires_in: { type: "number" },
                      interval: { type: "number" },
                    },
                    required: [
                      "token_type",
                      "api_key",
                      "expires_in",
                      "interval",
                    ],
                  },
                },
              },
            },
            "400": { description: "Pending/invalid device code" },
            "500": { description: "Server error" },
          },
        },
      },
      "/api/v1/auth/device/verify": {
        post: {
          tags: ["auth"],
          summary: "Approve or deny device flow",
          description:
            "Approves or denies a device code after the user enters the user code.",
          security: [{ sessionCookie: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user_code: { type: "string" },
                    action: { type: "string", enum: ["approve", "deny"] },
                  },
                  required: ["user_code", "action"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Device flow updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: {
                        type: "string",
                        enum: ["approved", "denied"],
                      },
                    },
                    required: ["status"],
                  },
                },
              },
            },
            "400": { description: "Invalid payload" },
            "401": { description: "Unauthorized" },
            "404": { description: "Code not found" },
            "409": { description: "Code already used" },
            "410": { description: "Code expired" },
          },
        },
      },
      "/api/v1/admin/settings": {
        get: {
          tags: ["admin"],
          summary: "Get Server Settings",
          responses: {
            "200": {
              description: "Settings",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ServerSettings" },
                },
              },
            },
            "403": { description: "Forbidden" },
          },
        },
        put: {
          tags: ["admin"],
          summary: "Update Server Settings",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServerSettingsUpdate" },
              },
            },
          },
          responses: {
            "200": {
              description: "Settings updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ServerSettings" },
                },
              },
            },
            "400": { description: "Invalid payload" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/admin/metrics": {
        get: {
          tags: ["admin"],
          summary: "Fetch admin metrics",
          responses: {
            "200": {
              description: "Admin metrics summary",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AdminMetrics" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/admin/jobs": {
        get: {
          tags: ["admin", "jobs"],
          summary: "List admin job runs",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "offset", in: "query", schema: { type: "integer" } },
          ],
          responses: {
            "200": {
              description: "Recent job runs",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: { $ref: "#/components/schemas/AdminJobRun" },
                      },
                      total: { type: "number" },
                      limit: { type: "number" },
                      offset: { type: "number" },
                    },
                    required: ["items"],
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
        post: {
          tags: ["admin", "jobs"],
          summary: "Run an admin job",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    job: {
                      type: "string",
                      enum: [
                        "media-optimization",
                        "preview-generation",
                        "stream-generation",
                        "storage-cleanup",
                        "steam-playtime",
                        "anilist-watching",
                      ],
                    },
                    limit: { type: "integer", nullable: true },
                  },
                  required: ["job"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Job started",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "boolean" },
                      run: { $ref: "#/components/schemas/AdminJobRun" },
                    },
                    required: ["status"],
                  },
                },
              },
            },
            "400": { description: "Invalid payload" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
        delete: {
          tags: ["admin", "jobs"],
          summary: "Clear admin job runs",
          responses: {
            "200": {
              description: "Job runs cleared",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiStatus" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/admin/import-runs": {
        get: {
          tags: ["admin"],
          summary: "List import runs",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "offset", in: "query", schema: { type: "integer" } },
          ],
          responses: {
            "200": {
              description: "Recent import runs",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ImportRun" },
                      },
                      total: { type: "number" },
                      limit: { type: "number" },
                      offset: { type: "number" },
                    },
                    required: ["items"],
                  },
                },
              },
            },
            "403": { description: "Forbidden" },
          },
        },
        delete: {
          tags: ["admin"],
          summary: "Clear import runs",
          responses: {
            "200": {
              description: "Import runs cleared",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { status: { type: "boolean" } },
                    required: ["status"],
                  },
                },
              },
            },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/admin/users": {
        get: {
          tags: ["admin"],
          summary: "List Users",
          parameters: [
            {
              name: "searchValue",
              in: "query",
              schema: { type: "string" },
            },
            {
              name: "searchField",
              in: "query",
              schema: {
                type: "string",
                enum: ["name", "email", "username", "role", "all"],
              },
            },
            {
              name: "searchOperator",
              in: "query",
              schema: {
                type: "string",
                enum: ["contains", "starts_with", "ends_with"],
              },
            },
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "offset", in: "query", schema: { type: "integer" } },
            {
              name: "sortBy",
              in: "query",
              schema: {
                type: "string",
                enum: ["name", "createdAt", "lastLoginAt"],
              },
            },
            {
              name: "sortDirection",
              in: "query",
              schema: { type: "string", enum: ["asc", "desc"] },
            },
          ],
          responses: {
            "200": { description: "User list" },
            "403": { description: "Forbidden" },
          },
        },
        post: {
          tags: ["admin"],
          summary: "Create User",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          responses: {
            "200": { description: "User created" },
            "400": { description: "Invalid payload" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/admin/users/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["admin"],
          summary: "Get User",
          responses: {
            "200": { description: "User" },
            "404": { description: "Not found" },
            "403": { description: "Forbidden" },
          },
        },
        patch: {
          tags: ["admin"],
          summary: "Update User",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          responses: {
            "200": { description: "User updated" },
            "400": { description: "Invalid payload" },
            "403": { description: "Forbidden" },
          },
        },
        post: {
          tags: ["admin"],
          summary: "Clear User Data",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          responses: {
            "200": { description: "User data cleared" },
            "400": { description: "Invalid payload" },
            "403": { description: "Forbidden" },
          },
        },
        delete: {
          tags: ["admin"],
          summary: "Delete User",
          responses: {
            "200": { description: "User deleted" },
            "400": { description: "Invalid request" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/upload": {
        get: {
          tags: ["uploads"],
          summary: "List user uploads",
          parameters: [
            {
              name: "action",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["status"] },
            },
            {
              name: "uploadId",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "List of uploads" },
            "401": { description: "Unauthorized" },
            "410": { description: "Upload expired" },
            "429": { description: "Rate limited" },
          },
        },
        post: {
          tags: ["uploads"],
          summary: "Upload a file or manage chunked uploads",
          parameters: [
            {
              name: "action",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["init", "complete", "abort"] },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    file: { type: "string", format: "binary" },
                    name: { type: "string" },
                    description: { type: "string" },
                    isPublic: { type: "boolean" },
                    slug: { type: "string" },
                    folderId: { type: "string" },
                    folderName: { type: "string" },
                    tagIds: { type: "string" },
                    newTags: { type: "string" },
                    password: { type: "string" },
                  },
                  required: ["file"],
                },
              },
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    size: { type: "number" },
                    mimeType: { type: "string" },
                    description: { type: "string" },
                    isPublic: { type: "boolean" },
                    slug: { type: "string" },
                    folderId: { type: "string" },
                    folderName: { type: "string" },
                    tagIds: { type: "string" },
                    newTags: { type: "string" },
                    password: { type: "string" },
                    chunkSize: { type: "number" },
                    contentHash: { type: "string" },
                    uploadId: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Upload created" },
            "200": {
              description: "Chunked upload initialized or aborted",
              headers: {
                "Upload-Chunk-Size": {
                  description: "Server-selected chunk size in bytes",
                  schema: { type: "string" },
                },
                "Upload-Chunk-TTL": {
                  description: "Chunk session TTL in seconds",
                  schema: { type: "string" },
                },
                "Upload-Retry-Base": {
                  description: "Base retry delay in ms",
                  schema: { type: "string" },
                },
                "Upload-Retry-Max": {
                  description: "Max retry delay in ms",
                  schema: { type: "string" },
                },
                "Upload-Retry-MaxRetries": {
                  description: "Max retry attempts",
                  schema: { type: "string" },
                },
              },
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      uploadId: { type: "string" },
                      chunkSize: { type: "number" },
                      totalParts: { type: "number" },
                      ttlSeconds: { type: "number" },
                      retry: {
                        type: "object",
                        properties: {
                          baseMs: { type: "number" },
                          maxMs: { type: "number" },
                          jitter: { type: "boolean" },
                          maxRetries: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Bad request" },
            "401": { description: "Unauthorized" },
            "410": { description: "Upload expired" },
            "409": { description: "Slug conflict" },
            "429": { description: "Rate limited" },
            "500": { description: "Upload failed" },
          },
        },
        put: {
          tags: ["uploads"],
          summary: "Upload a chunk part",
          parameters: [
            {
              name: "action",
              in: "query",
              required: true,
              schema: { type: "string", enum: ["part"] },
            },
            {
              name: "uploadId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "part",
              in: "query",
              required: true,
              schema: { type: "integer", minimum: 0 },
            },
            {
              name: "x-chunk-sha256",
              in: "header",
              required: false,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/octet-stream": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          responses: {
            "200": { description: "Chunk received" },
            "400": { description: "Bad request" },
            "401": { description: "Unauthorized" },
            "410": { description: "Upload expired" },
            "409": { description: "Chunk conflict" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/v1/profile/summary": {
        get: {
          tags: ["profile"],
          summary: "Get current profile summary",
          responses: {
            "200": {
              description: "Profile summary",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ProfileSummary" },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/profile/embed": {
        get: {
          tags: ["profile"],
          summary: "Get embed settings for current user",
          responses: {
            "200": {
              description: "Embed settings",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      settings: { $ref: "#/components/schemas/EmbedSettings" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
        patch: {
          tags: ["profile"],
          summary: "Update embed settings for current user",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EmbedSettings" },
              },
            },
          },
          responses: {
            "200": { description: "Updated" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/profile/preferences": {
        get: {
          tags: ["profile"],
          summary: "Get preferences for current user",
          responses: {
            "200": {
              description: "Preferences",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      settings: {
                        $ref: "#/components/schemas/UserPreferences",
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
        patch: {
          tags: ["profile"],
          summary: "Update preferences for current user",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserPreferences" },
              },
            },
          },
          responses: {
            "200": { description: "Updated" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/profile/public/socials/{username}": {
        parameters: [
          {
            name: "username",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["profile"],
          summary: "Get public socials for a user",
          responses: {
            "200": {
              description: "Public socials",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      showSocials: { type: "boolean" },
                      socials: {
                        type: "object",
                        properties: {
                          instagram: { type: "string", nullable: true },
                          x: { type: "string", nullable: true },
                          github: { type: "string", nullable: true },
                          website: { type: "string", nullable: true },
                          other: { type: "string", nullable: true },
                        },
                      },
                    },
                    required: ["showSocials", "socials"],
                  },
                },
              },
            },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/profile/export": {
        get: {
          tags: ["profile"],
          summary: "List export jobs for current user",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "number" },
            },
            {
              name: "offset",
              in: "query",
              required: false,
              schema: { type: "number" },
            },
          ],
          responses: {
            "200": {
              description: "Export jobs",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ExportList",
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
        post: {
          tags: ["profile"],
          summary: "Start a new export job",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ExportRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Export started" },
            "401": { description: "Unauthorized" },
            "409": { description: "Export already in progress" },
          },
        },
        delete: {
          tags: ["profile"],
          summary: "Clear export jobs (failed by default)",
          parameters: [
            {
              name: "scope",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["failed", "all"] },
            },
          ],
          responses: {
            "200": { description: "Exports cleared" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/profile/export/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["profile"],
          summary: "Download export zip by job id",
          responses: {
            "200": {
              description: "Zip archive",
              content: {
                "application/zip": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
            "409": { description: "Export not ready" },
          },
        },
        delete: {
          tags: ["profile"],
          summary: "Delete export archive",
          responses: {
            "200": { description: "Deleted" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/profile/api-keys/{id}/secret": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["profile"],
          summary: "Reveal API key secret",
          responses: {
            "200": {
              description: "Decrypted API key",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { key: { type: "string" } },
                    required: ["key"],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
            "500": { description: "Failed to decrypt API key" },
          },
        },
      },
      "/api/v1/profile/push": {
        get: {
          tags: ["profile"],
          summary: "List push subscriptions",
          responses: {
            "200": {
              description: "Subscriptions",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      subscriptions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: { endpoint: { type: "string" } },
                          required: ["endpoint"],
                        },
                      },
                    },
                    required: ["subscriptions"],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
        post: {
          tags: ["profile"],
          summary: "Register push subscription",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    endpoint: { type: "string" },
                    keys: {
                      type: "object",
                      properties: {
                        p256dh: { type: "string" },
                        auth: { type: "string" },
                      },
                      required: ["p256dh", "auth"],
                    },
                  },
                  required: ["endpoint", "keys"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Subscription stored",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiStatus" },
                },
              },
            },
            "400": { description: "Invalid subscription" },
            "401": { description: "Unauthorized" },
          },
        },
        delete: {
          tags: ["profile"],
          summary: "Remove push subscription",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { endpoint: { type: "string" } },
                  required: ["endpoint"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Subscription removed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiStatus" },
                },
              },
            },
            "400": { description: "Missing endpoint" },
            "401": { description: "Unauthorized" },
          },
        },
        put: {
          tags: ["profile"],
          summary: "Send push test",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", nullable: true },
                    sound: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Push sent",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiStatus" },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "500": { description: "VAPID keys not configured" },
          },
        },
      },
      "/api/v1/profile/push/debug": {
        get: {
          tags: ["profile"],
          summary: "Check push configuration",
          responses: {
            "200": {
              description: "Push debug info",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      hasPublicKey: { type: "boolean" },
                      hasPrivateKey: { type: "boolean" },
                      publicKeySample: { type: "string", nullable: true },
                      privateKeySample: { type: "string", nullable: true },
                      subject: { type: "string", nullable: true },
                    },
                    required: ["hasPublicKey", "hasPrivateKey"],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/profile/upload-settings": {
        get: {
          tags: ["profile"],
          summary: "Get upload settings",
          responses: {
            "200": {
              description: "Upload settings",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      settings: { type: "object" },
                    },
                    required: ["settings"],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
        patch: {
          tags: ["profile"],
          summary: "Update upload settings",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    nameConvention: { type: "string", nullable: true },
                    slugConvention: { type: "string", nullable: true },
                    imageCompressionEnabled: {
                      type: "boolean",
                      nullable: true,
                    },
                    imageCompressionQuality: { type: "number", nullable: true },
                    mediaTranscodeEnabled: { type: "boolean", nullable: true },
                    mediaTranscodeQuality: { type: "number", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Upload settings updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "boolean" },
                      cleared: { type: "boolean" },
                      settings: { type: "object" },
                    },
                    required: ["status", "cleared", "settings"],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/register/status": {
        get: {
          tags: ["register"],
          summary: "Check registration status",
          responses: {
            "200": { description: "Registration status" },
          },
        },
      },
      "/api/v1/setup/status": {
        get: {
          tags: ["setup"],
          summary: "Check setup status and defaults",
          responses: {
            "200": {
              description: "Setup status",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/v1/setup/settings": {
        post: {
          tags: ["setup"],
          summary: "Update initial server settings",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    allowPublicRegistration: { type: "boolean" },
                    passwordPolicyMinLength: { type: "number" },
                    maxUploadMb: { type: "number" },
                    maxFilesPerUpload: { type: "number" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Settings updated" },
            "400": { $ref: "#/components/responses/BadRequest" },
            "409": { description: "Setup already completed" },
          },
        },
      },
      "/api/v1/setup/storage": {
        post: {
          tags: ["setup"],
          summary: "Storage is configured via environment variables",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {},
                },
              },
            },
          },
          responses: {
            "400": { description: "Storage is env-only" },
            "409": { description: "Setup already completed" },
          },
        },
      },
      "/api/v1/setup/complete": {
        post: {
          tags: ["setup"],
          summary: "Finalize setup and set owner",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    userId: { type: "string" },
                  },
                  required: ["userId"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Setup completed" },
            "400": { $ref: "#/components/responses/BadRequest" },
            "404": { description: "User not found" },
            "409": { description: "Setup already completed" },
          },
        },
      },
      "/api/v1/ping": {
        get: {
          tags: ["ping"],
          summary: "Ping server",
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["ping"],
          summary: "Ping server (POST)",
          responses: { "200": { description: "OK" } },
        },
      },
      "/api/v1/files": {
        get: {
          tags: ["files"],
          summary: "List files",
          responses: { "200": { description: "Files" } },
        },
      },
      "/api/v1/files/{slug}": {
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["files"],
          summary: "Get file",
          responses: {
            "200": { description: "File" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          tags: ["files"],
          summary: "Update file",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "File updated" },
            "400": { description: "Invalid payload" },
          },
        },
        delete: {
          tags: ["files"],
          summary: "Delete file",
          responses: {
            "200": { description: "File deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/files/{slug}/favorite": {
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        patch: {
          tags: ["files"],
          summary: "Toggle favorite",
          responses: { "200": { description: "Favorite updated" } },
        },
      },
      "/api/v1/files/{slug}/view": {
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        patch: {
          tags: ["files"],
          summary: "Increment file view count",
          description: "Increments the view count for a file by its slug.",
          responses: {
            "200": { description: "View count incremented" },
            "404": { description: "File not found" },
          },
        },
      },
      "/api/v1/remote-upload": {
        get: {
          tags: ["remote-upload"],
          summary: "List remote upload jobs",
          responses: { "200": { description: "Remote upload jobs" } },
        },
        post: {
          tags: ["remote-upload"],
          summary: "Create remote upload job",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          responses: {
            "200": { description: "Remote upload job created" },
            "400": { description: "Invalid payload" },
          },
        },
      },
      "/api/v1/folders": {
        get: {
          tags: ["folders"],
          summary: "List folders",
          responses: { "200": { description: "Folders" } },
        },
        post: {
          tags: ["folders"],
          summary: "Create folder",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Folder created" },
            "400": { description: "Invalid payload" },
          },
        },
        patch: {
          tags: ["folders"],
          summary: "Update folder",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Folder updated" },
            "400": { description: "Invalid payload" },
          },
        },
        delete: {
          tags: ["folders"],
          summary: "Delete folder",
          responses: {
            "200": { description: "Folder deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/folders/share": {
        patch: {
          tags: ["folders"],
          summary: "Update folder share settings",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    shareEnabled: { type: "boolean", nullable: true },
                    password: { type: "string", nullable: true },
                  },
                  required: ["id"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Share settings updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      shareEnabled: { type: "boolean" },
                      hasPassword: { type: "boolean" },
                      shareSlug: { type: "string", nullable: true },
                    },
                    required: ["shareEnabled", "hasPassword"],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { description: "Folder not found" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/v1/folders/shared/{slug}": {
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "p",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["folders"],
          summary: "Fetch shared folder contents",
          responses: {
            "200": {
              description: "Shared folder contents",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      folder: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          userId: { type: "string" },
                          name: { type: "string" },
                          shareSlug: { type: "string", nullable: true },
                          ownerUsername: { type: "string", nullable: true },
                          ownerDisplayName: { type: "string", nullable: true },
                          ownerImage: { type: "string", nullable: true },
                          hasPassword: { type: "boolean" },
                        },
                        required: ["id", "userId", "name", "hasPassword"],
                      },
                      files: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            slug: { type: "string" },
                            originalName: { type: "string" },
                            mimeType: { type: "string" },
                            size: { type: "number" },
                            isPublic: { type: "boolean" },
                            createdAt: { type: "string", nullable: true },
                            hasPassword: { type: "boolean" },
                          },
                          required: [
                            "id",
                            "slug",
                            "originalName",
                            "mimeType",
                            "size",
                            "isPublic",
                            "hasPassword",
                          ],
                        },
                      },
                    },
                    required: ["folder", "files"],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "403": { description: "Invalid or missing password" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/tags": {
        get: {
          tags: ["tags"],
          summary: "List tags",
          responses: { "200": { description: "Tags" } },
        },
        post: {
          tags: ["tags"],
          summary: "Create tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Tag created" },
            "400": { description: "Invalid payload" },
          },
        },
        patch: {
          tags: ["tags"],
          summary: "Update tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Tag updated" },
            "400": { description: "Invalid payload" },
          },
        },
        delete: {
          tags: ["tags"],
          summary: "Delete tag",
          responses: {
            "200": { description: "Tag deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/bookmark-tags": {
        get: {
          tags: ["bookmarks"],
          summary: "List bookmark tags",
          responses: { "200": { description: "Bookmark tags" } },
        },
        post: {
          tags: ["bookmarks"],
          summary: "Create bookmark tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "201": { description: "Bookmark tag created" },
            "400": { description: "Invalid payload" },
            "409": { description: "Tag already exists" },
          },
        },
        patch: {
          tags: ["bookmarks"],
          summary: "Update bookmark tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Bookmark tag updated" },
            "400": { description: "Invalid payload" },
            "404": { description: "Not found" },
            "409": { description: "Tag already exists" },
          },
        },
        delete: {
          tags: ["bookmarks"],
          summary: "Delete bookmark tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Bookmark tag deleted" },
            "400": { description: "Invalid payload" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/note-tags": {
        get: {
          tags: ["notes"],
          summary: "List note tags",
          responses: { "200": { description: "Note tags" } },
        },
        post: {
          tags: ["notes"],
          summary: "Create note tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "201": { description: "Note tag created" },
            "400": { description: "Invalid payload" },
            "409": { description: "Tag already exists" },
          },
        },
        patch: {
          tags: ["notes"],
          summary: "Update note tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Note tag updated" },
            "400": { description: "Invalid payload" },
            "404": { description: "Not found" },
            "409": { description: "Tag already exists" },
          },
        },
        delete: {
          tags: ["notes"],
          summary: "Delete note tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Note tag deleted" },
            "400": { description: "Invalid payload" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/recipe-tags": {
        get: {
          tags: ["recipes"],
          summary: "List recipe tags",
          responses: { "200": { description: "Recipe tags" } },
        },
        post: {
          tags: ["recipes"],
          summary: "Create recipe tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "201": { description: "Recipe tag created" },
            "400": { description: "Invalid payload" },
            "409": { description: "Tag already exists" },
          },
        },
        patch: {
          tags: ["recipes"],
          summary: "Update recipe tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Recipe tag updated" },
            "400": { description: "Invalid payload" },
            "404": { description: "Not found" },
            "409": { description: "Tag already exists" },
          },
        },
        delete: {
          tags: ["recipes"],
          summary: "Delete recipe tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Recipe tag deleted" },
            "400": { description: "Invalid payload" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/shortlink-tags": {
        get: {
          tags: ["shorten"],
          summary: "List short link tags",
          responses: { "200": { description: "Short link tags" } },
        },
        post: {
          tags: ["shorten"],
          summary: "Create short link tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "201": { description: "Short link tag created" },
            "400": { description: "Invalid payload" },
            "409": { description: "Tag already exists" },
          },
        },
        patch: {
          tags: ["shorten"],
          summary: "Update short link tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Short link tag updated" },
            "400": { description: "Invalid payload" },
            "404": { description: "Not found" },
            "409": { description: "Tag already exists" },
          },
        },
        delete: {
          tags: ["shorten"],
          summary: "Delete short link tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Short link tag deleted" },
            "400": { description: "Invalid payload" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/snippet-tags": {
        get: {
          tags: ["snippets"],
          summary: "List snippet tags",
          responses: { "200": { description: "Snippet tags" } },
        },
        post: {
          tags: ["snippets"],
          summary: "Create snippet tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "201": { description: "Snippet tag created" },
            "400": { description: "Invalid payload" },
            "409": { description: "Tag already exists" },
          },
        },
        patch: {
          tags: ["snippets"],
          summary: "Update snippet tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Snippet tag updated" },
            "400": { description: "Invalid payload" },
            "404": { description: "Not found" },
            "409": { description: "Tag already exists" },
          },
        },
        delete: {
          tags: ["snippets"],
          summary: "Delete snippet tag",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Snippet tag deleted" },
            "400": { description: "Invalid payload" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/search": {
        get: {
          tags: ["search"],
          summary: "Search",
          responses: { "200": { description: "Search results" } },
        },
      },
      "/api/v1/shorten": {
        get: {
          tags: ["shorten"],
          summary: "List short links",
          responses: { "200": { description: "Short links" } },
        },
        post: {
          tags: ["shorten"],
          summary: "Create short link",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Short link created" },
            "400": { description: "Invalid payload" },
          },
        },
      },
      "/api/v1/shorten/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["shorten"],
          summary: "Get short link",
          responses: {
            "200": { description: "Short link" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          tags: ["shorten"],
          summary: "Update short link",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Short link updated" },
            "400": { description: "Invalid payload" },
          },
        },
        delete: {
          tags: ["shorten"],
          summary: "Delete short link",
          responses: {
            "200": { description: "Short link deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/shorten/p/{slug}": {
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        post: {
          tags: ["shorten"],
          summary: "Access public short link",
          requestBody: {
            required: false,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Short link" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/shorten/p/tags/{username}/{tag}": {
        parameters: [
          {
            name: "username",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "tag",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["shorten"],
          summary: "Access public short links by tag",
          responses: {
            "200": { description: "Short links list" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/snippets": {
        get: {
          tags: ["snippets"],
          summary: "List snippets",
          responses: { "200": { description: "Snippets" } },
        },
        post: {
          tags: ["snippets"],
          summary: "Create snippet",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Snippet created" },
            "400": { description: "Invalid payload" },
          },
        },
      },
      "/api/v1/snippets/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["snippets"],
          summary: "Get snippet",
          responses: {
            "200": { description: "Snippet" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          tags: ["snippets"],
          summary: "Update snippet",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Snippet updated" },
            "400": { description: "Invalid payload" },
          },
        },
        delete: {
          tags: ["snippets"],
          summary: "Delete snippet",
          responses: {
            "200": { description: "Snippet deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/snippets/p/{slug}": {
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        post: {
          tags: ["snippets"],
          summary: "Access public snippet",
          requestBody: {
            required: false,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Snippet" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/snippets/p/tags/{username}/{tag}": {
        parameters: [
          {
            name: "username",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "tag",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["snippets"],
          summary: "Access public snippets by tag",
          responses: {
            "200": { description: "Snippets list" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/notes": {
        get: {
          tags: ["notes"],
          summary: "List notes",
          responses: { "200": { description: "Notes" } },
        },
        post: {
          tags: ["notes"],
          summary: "Create note",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Note created" },
            "400": { description: "Invalid payload" },
          },
        },
      },
      "/api/v1/notes/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["notes"],
          summary: "Get note",
          responses: {
            "200": { description: "Note" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          tags: ["notes"],
          summary: "Update note",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Note updated" },
            "400": { description: "Invalid payload" },
          },
        },
        delete: {
          tags: ["notes"],
          summary: "Delete note",
          responses: {
            "200": { description: "Note deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/notes/p/{slug}": {
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        post: {
          tags: ["notes"],
          summary: "Access public note",
          requestBody: {
            required: false,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Note" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/notes/p/tags/{username}/{tag}": {
        parameters: [
          {
            name: "username",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "tag",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["notes"],
          summary: "Access public notes by tag",
          responses: {
            "200": { description: "Notes list" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/bookmarks": {
        get: {
          tags: ["bookmarks"],
          summary: "List bookmarks",
          responses: { "200": { description: "Bookmarks" } },
        },
        post: {
          tags: ["bookmarks"],
          summary: "Create bookmark",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Bookmark created" },
            "400": { description: "Invalid payload" },
          },
        },
      },
      "/api/v1/bookmarks/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["bookmarks"],
          summary: "Get bookmark",
          responses: {
            "200": { description: "Bookmark" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          tags: ["bookmarks"],
          summary: "Update bookmark",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Bookmark updated" },
            "400": { description: "Invalid payload" },
          },
        },
        delete: {
          tags: ["bookmarks"],
          summary: "Delete bookmark",
          responses: {
            "200": { description: "Bookmark deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/bookmarks/p/{slug}": {
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        post: {
          tags: ["bookmarks"],
          summary: "Access public bookmark",
          requestBody: {
            required: false,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Bookmark" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/bookmarks/p/tags/{username}/{tag}": {
        parameters: [
          {
            name: "username",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "tag",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["bookmarks"],
          summary: "Access public bookmarks by tag",
          responses: {
            "200": { description: "Bookmarks list" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/recipes": {
        get: {
          tags: ["recipes"],
          summary: "List recipes",
          responses: { "200": { description: "Recipes" } },
        },
        post: {
          tags: ["recipes"],
          summary: "Create recipe",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Recipe created" },
            "400": { description: "Invalid payload" },
          },
        },
      },
      "/api/v1/recipes/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["recipes"],
          summary: "Get recipe",
          responses: {
            "200": { description: "Recipe" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          tags: ["recipes"],
          summary: "Update recipe",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Recipe updated" },
            "400": { description: "Invalid payload" },
          },
        },
        delete: {
          tags: ["recipes"],
          summary: "Delete recipe",
          responses: {
            "200": { description: "Recipe deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/recipes/p/{slug}": {
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        post: {
          tags: ["recipes"],
          summary: "Access public recipe",
          requestBody: {
            required: false,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Recipe" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/recipes/p/tags/{username}/{tag}": {
        parameters: [
          {
            name: "username",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "tag",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["recipes"],
          summary: "Access public recipes by tag",
          responses: {
            "200": { description: "Recipes list" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/games/search": {
        get: {
          tags: ["games"],
          summary: "Search games",
          responses: { "200": { description: "Games" } },
        },
      },
      "/api/v1/games/list": {
        get: {
          tags: ["games"],
          summary: "List games",
          responses: { "200": { description: "Games" } },
        },
        post: {
          tags: ["games"],
          summary: "Add game",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Game added" },
            "400": { description: "Invalid payload" },
          },
        },
      },
      "/api/v1/games/list/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        patch: {
          tags: ["games"],
          summary: "Update game",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Game updated" },
            "400": { description: "Invalid payload" },
          },
        },
        delete: {
          tags: ["games"],
          summary: "Delete game",
          responses: {
            "200": { description: "Game deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/games/list/p/{username}": {
        parameters: [
          {
            name: "username",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["games"],
          summary: "List public games by username",
          responses: { "200": { description: "Games" } },
        },
      },
      "/api/v1/games/import": {
        post: {
          tags: ["games"],
          summary: "Bulk import games (e.g., Steam)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/SteamGame" },
                    },
                  },
                  required: ["items"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Import result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      added: { type: "integer" },
                      conflicts: { type: "integer" },
                      failed: { type: "integer" },
                      runId: { type: "integer" },
                    },
                    required: ["ok"],
                  },
                },
              },
            },
            "400": { description: "Invalid payload" },
            "401": { description: "Unauthorized" },
            "429": { description: "Too many items in batch" },
          },
        },
      },
      "/api/v1/steam/start": {
        get: {
          tags: ["steam"],
          summary: "Start Steam OpenID flow",
          responses: { "200": { description: "Redirect" } },
        },
      },
      "/api/v1/steam/owned": {
        get: {
          tags: ["steam"],
          summary: "List owned Steam games",
          responses: { "200": { description: "Owned games" } },
        },
      },
      "/api/v1/steam/callback": {
        get: {
          tags: ["steam"],
          summary: "Steam OpenID callback",
          responses: { "200": { description: "Callback handled" } },
        },
      },
      "/api/v1/watch/search": {
        get: {
          tags: ["watch"],
          summary: "Search watch providers",
          responses: { "200": { description: "Results" } },
        },
      },
      "/api/v1/watch/tv/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["watch"],
          summary: "Get TV details",
          responses: {
            "200": { description: "Details" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/watch/tv/{id}/season/{season}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "season",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["watch"],
          summary: "Get season details",
          responses: {
            "200": { description: "Details" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/watch/import/anilist": {
        get: {
          tags: ["watch"],
          summary: "Import watchlist from AniList",
          responses: {
            "200": { description: "Imported" },
            "400": { description: "Invalid request" },
          },
        },
      },
      "/api/v1/watch/import/bulk": {
        post: {
          tags: ["watch"],
          summary: "Bulk import watchlist",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Imported" },
            "400": { description: "Invalid payload" },
          },
        },
      },
      "/api/v1/watchlist": {
        get: {
          tags: ["watchlist"],
          summary: "List watchlist",
          "/api/v1/watch/import/anilist/start": {
            get: {
              tags: ["watch"],
              summary: "Start AniList OAuth",
              responses: {
                "302": { description: "Redirect to AniList" },
                "401": { description: "Unauthorized" },
              },
            },
          },
          "/api/v1/watch/import/anilist/callback": {
            get: {
              tags: ["watch"],
              summary: "AniList OAuth callback",
              responses: {
                "302": { description: "Redirect back to app" },
              },
            },
          },
          responses: { "200": { description: "Watchlist" } },
        },
        post: {
          tags: ["watchlist"],
          summary: "Add to watchlist",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Added" },
            "400": { description: "Invalid payload" },
          },
        },
      },
      "/api/v1/watchlist/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        patch: {
          tags: ["watchlist"],
          summary: "Update watchlist item",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Updated" },
            "400": { description: "Invalid payload" },
          },
        },
        delete: {
          tags: ["watchlist"],
          summary: "Delete watchlist item",
          responses: {
            "200": { description: "Deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/watchlist/{id}/progress": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        post: {
          tags: ["watchlist"],
          summary: "Update episode progress",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            "200": { description: "Updated" },
            "400": { description: "Invalid payload" },
          },
        },
      },
      "/api/v1/watchlist/p/{username}": {
        parameters: [
          {
            name: "username",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["watchlist"],
          summary: "Public watchlist by username",
          responses: { "200": { description: "Watchlist" } },
        },
      },
      "/api/v1/audit": {
        get: {
          tags: ["audit"],
          summary: "List audit logs",
          responses: { "200": { description: "Audit logs" } },
        },
      },
      "/api/v1/audit/reset": {
        post: {
          tags: ["audit"],
          summary: "Reset audit logs",
          responses: {
            "200": { description: "Reset" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/audit/rotate": {
        post: {
          tags: ["audit"],
          summary: "Rotate audit chain",
          responses: {
            "200": { description: "Rotated" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/audit/verify": {
        get: {
          tags: ["audit"],
          summary: "Verify audit logs",
          responses: { "200": { description: "Verified" } },
        },
      },
      "/api/v1/audit/proof/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["audit"],
          summary: "Get audit proof",
          responses: {
            "200": { description: "Proof" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/notifications": {
        get: {
          tags: ["notifications"],
          summary: "List notifications",
          parameters: [
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 25 },
            },
          ],
          responses: {
            "200": { description: "Notification list" },
            "401": { description: "Unauthorized" },
          },
        },
        patch: {
          tags: ["notifications"],
          summary: "Mark notifications read",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ids: { type: "array", items: { type: "string" } },
                    markAll: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Notifications updated" },
            "401": { description: "Unauthorized" },
          },
        },
        delete: {
          tags: ["notifications"],
          summary: "Clear all notifications",
          responses: {
            "200": { description: "Notifications cleared" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/integrations/webhooks": {
        get: {
          tags: ["integrations"],
          summary: "List webhooks",
          responses: {
            "200": { description: "Webhook list" },
            "401": { description: "Unauthorized" },
          },
        },
        post: {
          tags: ["integrations"],
          summary: "Create webhook",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          responses: {
            "200": { description: "Webhook created" },
            "400": { description: "Invalid payload" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/integrations/webhooks/{id}": {
        patch: {
          tags: ["integrations"],
          summary: "Update webhook",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          responses: {
            "200": { description: "Webhook updated" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
        delete: {
          tags: ["integrations"],
          summary: "Delete webhook",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Webhook deleted" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/integrations/webhooks/{id}/test": {
        post: {
          tags: ["integrations"],
          summary: "Send webhook test",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Test sent" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/upload-requests": {
        get: {
          tags: ["upload-requests"],
          summary: "List upload requests",
          responses: {
            "200": { description: "Upload request list" },
            "401": { description: "Unauthorized" },
          },
        },
        post: {
          tags: ["upload-requests"],
          summary: "Create upload request",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          responses: {
            "200": { description: "Upload request created" },
            "400": { description: "Invalid payload" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/upload-requests/{id}": {
        patch: {
          tags: ["upload-requests"],
          summary: "Update upload request",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          responses: {
            "200": { description: "Upload request updated" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
        delete: {
          tags: ["upload-requests"],
          summary: "Delete upload request",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Upload request deleted" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/upload-requests/queue": {
        get: {
          tags: ["upload-requests"],
          summary: "List pending upload approvals",
          responses: {
            "200": { description: "Pending uploads" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/upload-requests/{id}/queue": {
        get: {
          tags: ["upload-requests"],
          summary: "List request queue items",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Queue items" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/upload-requests/{id}/queue/{itemId}": {
        patch: {
          tags: ["upload-requests"],
          summary: "Approve or reject an upload",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "itemId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    action: { type: "string", enum: ["approve", "reject"] },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Decision recorded" },
            "400": { description: "Invalid action" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/upload-requests/p/{slug}": {
        get: {
          tags: ["upload-requests"],
          summary: "Get public upload request details",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Upload request details" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/upload-requests/p/{slug}/files": {
        post: {
          tags: ["upload-requests"],
          summary: "Upload file to request",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: { type: "object" },
              },
            },
          },
          responses: {
            "201": { description: "File uploaded" },
            "400": { description: "Bad request" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "404": { description: "Not found" },
            "429": { description: "Rate limit reached" },
          },
        },
      },
      "/api/v1/jobs/steam-playtime": {
        post: {
          tags: ["jobs"],
          summary: "Refresh Steam playtime (scheduled job)",
          description:
            "Runs the Steam playtime refresh for linked accounts. Requires CRON_SECRET via x-cron-secret or Authorization bearer token.",
          responses: {
            "200": { description: "Job completed" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/jobs/media-optimization": {
        post: {
          tags: ["jobs"],
          summary: "Run media optimization jobs",
          description:
            "Processes queued media optimization jobs. Requires CRON_SECRET via x-cron-secret or Authorization bearer token.",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "number" },
            },
          ],
          responses: {
            "200": {
              description: "Job run result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "boolean" },
                      processed: { type: "number" },
                    },
                    required: ["status"],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/jobs/preview-generation": {
        post: {
          tags: ["jobs"],
          summary: "Process preview generation jobs",
          description:
            "Processes queued preview generation jobs. Requires CRON_SECRET via x-cron-secret or Authorization bearer token. Use mode=backfill to enqueue missing previews before processing.",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "number" },
            },
            {
              name: "mode",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["backfill"] },
            },
            {
              name: "scan",
              in: "query",
              required: false,
              schema: { type: "number" },
            },
          ],
          responses: {
            "200": {
              description: "Job run result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "boolean" },
                      enqueued: { type: "number" },
                      processed: { type: "number" },
                    },
                    required: ["status", "processed"],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/jobs/stream-generation": {
        post: {
          tags: ["jobs"],
          summary: "Process stream generation jobs",
          description:
            "Processes queued HLS stream generation jobs. Requires CRON_SECRET via x-cron-secret or Authorization bearer token. Use mode=backfill to enqueue missing streams before processing.",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "number" },
            },
            {
              name: "mode",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["backfill"] },
            },
            {
              name: "scan",
              in: "query",
              required: false,
              schema: { type: "number" },
            },
          ],
          responses: {
            "200": {
              description: "Job run result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "boolean" },
                      enqueued: { type: "number" },
                      processed: { type: "number" },
                    },
                    required: ["status", "processed"],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/jobs/storage-cleanup": {
        post: {
          tags: ["jobs"],
          summary: "Process storage cleanup jobs",
          description:
            "Processes queued storage cleanup jobs for failed deletes. Requires CRON_SECRET via x-cron-secret or Authorization bearer token.",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "number" },
            },
          ],
          responses: {
            "200": {
              description: "Job run result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "boolean" },
                      processed: { type: "number" },
                    },
                    required: ["status", "processed"],
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/jobs/anilist-watching": {
        post: {
          tags: ["jobs"],
          summary: "Refresh AniList watching list (scheduled job)",
          description:
            "Syncs AniList CURRENT (watching) list for linked accounts. Requires CRON_SECRET via x-cron-secret or Authorization bearer token.",
          responses: {
            "200": { description: "Job completed" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/reference": {
        get: {
          tags: ["reference"],
          summary: "API reference UI",
          description:
            "Serves the interactive API reference UI for the public OpenAPI document.",
          responses: {
            "200": { description: "Reference UI rendered" },
          },
        },
      },
    },
  } as const;

  const visibleTags = spec.tags.filter(
    (tag) => !removedModules.has(tag.name.toLowerCase()),
  );

  const tagMap: Map<string, string> = new Map(
    visibleTags.map((tag) => [tag.name, toTitleCase(tag.name)]),
  );

  const normalizedPaths = Object.entries(spec.paths).reduce<
    Record<string, unknown>
  >((acc, [pathKey, methods]) => {
    if (removedPathPattern.test(pathKey)) {
      return acc;
    }
    if (!methods || typeof methods !== "object") {
      acc[pathKey] = methods;
      return acc;
    }

    const normalizedMethods = Object.entries(methods).reduce<
      Record<string, unknown>
    >((methodAcc, [methodKey, operation]) => {
      if (!operation || typeof operation !== "object") {
        methodAcc[methodKey] = operation;
        return methodAcc;
      }

      const opTags = Array.isArray((operation as { tags?: string[] }).tags)
        ? ((operation as { tags: string[] }).tags ?? [])
        : [];

      if (opTags.some((tagName) => removedModules.has(tagName.toLowerCase()))) {
        return methodAcc;
      }

      if (!Array.isArray((operation as { tags?: string[] }).tags)) {
        methodAcc[methodKey] = operation;
        return methodAcc;
      }

      methodAcc[methodKey] = {
        ...operation,
        tags: opTags.map(
          (tagName: string) => tagMap.get(tagName) ?? toTitleCase(tagName),
        ),
      };
      return methodAcc;
    }, {});

    if (Object.keys(normalizedMethods).length > 0) {
      acc[pathKey] = normalizedMethods;
    }

    return acc;
  }, {});

  const normalizedSpec = {
    ...spec,
    tags: visibleTags.map((tag) => ({
      ...tag,
      name: toTitleCase(tag.name),
    })),
    paths: normalizedPaths,
  };

  return NextResponse.json(normalizedSpec);
});
