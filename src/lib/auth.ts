/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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

import "server-only";

import { db } from "@/db/client";
import { rateLimits, userInfo } from "@/db/schemas/core-schema";
import {
  beforeDeleteUser,
  sendDeleteAccountVerification,
} from "@/lib/auth/delete-user";
import {
  sendChangeEmailConfirmation,
  sendPasswordChangedNotice,
  sendResetPasswordEmail,
  sendVerificationEmailCallback,
  sendOTP,
} from "@/lib/auth/email-callbacks";
import { APIError, betterAuth, type RateLimit } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  anonymous,
  apiKey,
  openAPI,
  twoFactor,
  username,
} from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { nextCookies } from "better-auth/next-js";
import { getSocialLoginConfig } from "@/lib/auth/social-config";
import { buildSocialProviders } from "@/lib/auth/social-providers";
import { ensureUsernameOnCreate } from "@/lib/auth/username";
import { ensureFirstNonAnonymousUserIsOwner } from "@/lib/auth/first-owner";
import { ensureSocialSignupAllowed } from "@/lib/auth/registration";
import { eq } from "drizzle-orm";
import { avatarApiPath } from "@/lib/avatar";
import { user as userTable } from "@/db/schemas";

const socialConfig = await getSocialLoginConfig();
const socialProviders = socialConfig.enabled
  ? await buildSocialProviders(socialConfig.providers)
  : undefined;
const appName = process.env.APP_NAME || "Swush";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  advanced: {
    ipAddress: {
      ipAddressHeaders: [
        "cf-connecting-ip",
        "true-client-ip",
        "x-real-ip",
        "x-forwarded-for",
      ],
    },
  },
  appName,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: sendResetPasswordEmail,
    onPasswordReset: sendPasswordChangedNotice,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendVerificationEmail: sendVerificationEmailCallback,
  },
  account: socialConfig.enabled
    ? {
        accountLinking: {
          enabled: true,
          allowDifferentEmails: true,
          trustedProviders: socialConfig.providers,
        },
      }
    : undefined,
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation,
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification,
      beforeDelete: beforeDeleteUser,
    },
  },
  socialProviders: socialProviders,
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          await ensureSocialSignupAllowed(ctx);
          return ensureUsernameOnCreate(user);
        },
        after: async (createdUser) => {
          const isAnonymous =
            typeof createdUser.isAnonymous === "boolean"
              ? createdUser.isAnonymous
              : null;
          await ensureFirstNonAnonymousUserIsOwner({
            userId: createdUser.id,
            isAnonymous,
          });

          const hasImage =
            typeof createdUser.image === "string" && createdUser.image.trim();
          if (!hasImage) {
            try {
              await db
                .update(userTable)
                .set({ image: avatarApiPath(createdUser.id) })
                .where(eq(userTable.id, createdUser.id));
            } catch {
              throw new APIError("BAD_REQUEST", {
                message: "Failed to set default avatar.",
              });
            }
          }
        },
      },
    },
    session: {
      create: {
        async before(session) {
          const userData = await db
            .select()
            .from(userInfo)
            .where(eq(userInfo.userId, session.userId))
            .limit(1);

          const userIF = userData[0];

          if (userIF && userIF.banned) {
            throw new APIError("FORBIDDEN", {
              message: `You are banned due to ${userIF.banReason || "No reason provided."}`,
            });
          } else {
            return { data: session };
          }
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
    customRules: {
      "/open-api/*": false,
      "/sign-in/*": { window: 60, max: 5 },
      "/sign-up/*": { window: 60, max: 3 },
      "/request-password-reset": { window: 600, max: 3 },
      "/reset-password": { window: 600, max: 3 },
      "/verify-email": { window: 300, max: 6 },
      "/change-password": { window: 300, max: 3 },
      "/change-email": { window: 600, max: 3 },
      "/delete-user": { window: 600, max: 2 },
      "/revoke-session": { window: 60, max: 5 },
      "/revoke-sessions": { window: 60, max: 5 },
      "/revoke-other-sessions": { window: 60, max: 5 },
    },
    customStorage: {
      async get(key: string): Promise<RateLimit | undefined> {
        const row = await db.query.rateLimits.findFirst({
          where: eq(rateLimits.key, key),
        });
        if (!row) return undefined;

        return {
          key: row.key,
          count: row.hits,
          lastRequest:
            row.createdAt instanceof Date
              ? row.createdAt.getTime()
              : Date.now(),
        };
      },
      async set(key: string, value: RateLimit): Promise<void> {
        await db
          .insert(rateLimits)
          .values({
            key,
            hits: value.count,
            createdAt: new Date(value.lastRequest),
          })
          .onConflictDoUpdate({
            target: rateLimits.key,
            set: {
              hits: value.count,
              createdAt: new Date(value.lastRequest),
            },
          });
      },
    },
  },
  plugins: [
    username(),
    anonymous(),
    twoFactor({
      otpOptions: {
        sendOTP,
      },
    }),
    passkey(),
    apiKey(),
    openAPI(),
    nextCookies(),
  ],
});
