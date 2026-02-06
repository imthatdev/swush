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

type ExtendedRequest = Request & {
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
};

export function getClientIp(req: ExtendedRequest) {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf && cf !== "::1") return cf;

  const tci = req.headers.get("true-client-ip");
  if (tci) return tci;

  const xf = req.headers.get("x-forwarded-for");
  const TRUST = (process.env.TRUSTED_PROXIES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (xf && TRUST.length) {
    for (const ip of xf.split(",").map((s) => s.trim())) {
      if (!TRUST.includes(ip)) return ip;
    }
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}
