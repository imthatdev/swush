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

import { NextResponse } from "next/server";
import {
  SwushError,
  type SwushErrorPayload,
  type SwushErrorOptions,
  toSwushError,
} from "@/lib/errors/swush-error";

export type SwushApiErrorBody = {
  error: string;
  errorInfo?: SwushErrorPayload;
  message: string;
  status: number;
  debug?: {
    message: string;
    details?: string;
  };
};

export function apiErrorPayload(error: SwushError) {
  const payload = error.toPayload();
  return {
    error: payload.message,
    errorInfo: payload,
    message: payload.message,
    status: error.status,
  } satisfies SwushApiErrorBody;
}

export function apiErrorResponse(err: unknown, fallback?: SwushErrorOptions) {
  const swush = toSwushError(err, fallback);
  const body = apiErrorPayload(swush);
  if (process.env.NODE_ENV !== "production") {
    console.error("API error", err);
    if (err instanceof Error) {
      body.errorInfo = {
        message: err.message,
        details: err.stack,
        code: swush.code,
      };
    }
  }
  return NextResponse.json(body, { status: swush.status });
}

export function withApiError<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return (async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      return apiErrorResponse(err);
    }
  }) as (...args: Args) => Promise<Response>;
}
