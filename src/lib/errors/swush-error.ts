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

export type SwushErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "VALIDATION"
  | "PAYLOAD_TOO_LARGE"
  | "UNPROCESSABLE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL";

export type SwushErrorPayload = {
  code: SwushErrorCode;
  message: string;
  details?: unknown;
};

export type SwushErrorOptions = {
  code: SwushErrorCode;
  status: number;
  message: string;
  details?: unknown;
  expose?: boolean;
  cause?: unknown;
};

export class SwushError extends Error {
  readonly code: SwushErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(options: SwushErrorOptions) {
    super(options.message);
    this.name = "SwushError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.expose = options.expose ?? options.status < 500;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }

  toPayload(): SwushErrorPayload {
    return {
      code: this.code,
      message: this.expose ? this.message : "Something went wrong.",
      details: this.expose ? this.details : undefined,
    };
  }
}

export function isSwushError(err: unknown): err is SwushError {
  return err instanceof SwushError;
}

export function toSwushError(err: unknown, fallback?: SwushErrorOptions) {
  if (isSwushError(err)) return err;

  const fallbackMessage = fallback?.message || "Something went wrong.";
  const message =
    err instanceof Error && err.message ? err.message : fallbackMessage;

  return new SwushError({
    code: fallback?.code ?? "INTERNAL",
    status: fallback?.status ?? 500,
    message,
    details: fallback?.details,
    expose: fallback?.expose ?? false,
    cause: err,
  });
}

export const SwushErrors = {
  badRequest: (message: string, details?: unknown) =>
    new SwushError({
      code: "BAD_REQUEST",
      status: 400,
      message,
      details,
      expose: true,
    }),
  unauthorized: (message = "Unauthorized") =>
    new SwushError({
      code: "UNAUTHORIZED",
      status: 401,
      message,
      expose: true,
    }),
  forbidden: (message = "Forbidden") =>
    new SwushError({
      code: "FORBIDDEN",
      status: 403,
      message,
      expose: true,
    }),
  notFound: (message = "Not found") =>
    new SwushError({
      code: "NOT_FOUND",
      status: 404,
      message,
      expose: true,
    }),
  conflict: (message: string, details?: unknown) =>
    new SwushError({
      code: "CONFLICT",
      status: 409,
      message,
      details,
      expose: true,
    }),
  rateLimit: (message: string) =>
    new SwushError({
      code: "RATE_LIMIT",
      status: 429,
      message,
      expose: true,
    }),
  payloadTooLarge: (message: string) =>
    new SwushError({
      code: "PAYLOAD_TOO_LARGE",
      status: 413,
      message,
      expose: true,
    }),
  validation: (message: string, details?: unknown) =>
    new SwushError({
      code: "VALIDATION",
      status: 422,
      message,
      details,
      expose: true,
    }),
  unprocessable: (message: string, details?: unknown) =>
    new SwushError({
      code: "UNPROCESSABLE",
      status: 422,
      message,
      details,
      expose: true,
    }),
  serviceUnavailable: (message: string) =>
    new SwushError({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      message,
      expose: true,
    }),
  internal: (message = "Something went wrong.", details?: unknown) =>
    new SwushError({
      code: "INTERNAL",
      status: 500,
      message,
      details,
      expose: false,
    }),
};
