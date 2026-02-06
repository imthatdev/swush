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

import { SwushError, type SwushErrorPayload } from "@/lib/errors/swush-error";

type ApiErrorShape = {
  error?: SwushErrorPayload | string;
  errorInfo?: SwushErrorPayload;
  message?: string;
  status?: number;
};

export async function readApiError(res: Response, fallback: string) {
  let data: ApiErrorShape | null = null;
  try {
    data = (await res.json()) as ApiErrorShape;
  } catch {
    data = null;
  }

  const errorPayload =
    data?.errorInfo ??
    (data?.error && typeof data.error === "object" ? data.error : null);
  const message =
    (errorPayload?.message ||
      data?.message ||
      (typeof data?.error === "string" ? data.error : "") ||
      fallback) ??
    fallback;

  return new SwushError({
    code: errorPayload?.code ?? "INTERNAL",
    status: data?.status ?? res.status ?? 500,
    message,
    details: errorPayload?.details,
    expose: true,
  });
}

export function getApiErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const value = data as {
    error?: SwushErrorPayload | string;
    errorInfo?: SwushErrorPayload;
    message?: string;
  };
  if (value.errorInfo?.message) return value.errorInfo.message;
  if (typeof value.error === "object" && value.error?.message) {
    return value.error.message;
  }
  if (typeof value.error === "string" && value.error.trim()) return value.error;
  if (typeof value.message === "string" && value.message.trim())
    return value.message;
  return fallback;
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong") {
  if (err instanceof SwushError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}
