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

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const SECRET_ENV = "BETTER_AUTH_SECRET";

function getSecretKey() {
  const raw = process.env[SECRET_ENV]?.trim();
  if (!raw) {
    throw new Error(`${SECRET_ENV} is required to encrypt settings secrets.`);
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `${SECRET_ENV} must be 32 bytes (base64-encoded for AES-256-GCM).`,
    );
  }
  return buf;
}

export function encryptSettingsSecret(value: string) {
  const key = getSecretKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSettingsSecret(payload: {
  encrypted: string;
  iv: string;
  tag: string;
}) {
  const key = getSecretKey();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  if (tag.length !== 16) {
    throw new Error("Invalid authentication tag length");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, iv, {
    authTagLength: 16,
  });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encrypted, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
