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

import { createHash, randomBytes } from "crypto";
import { getPublicRuntimeSettings } from "../server/runtime-settings";

const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const USER_CODE_LENGTH = 8;

export const DEVICE_FLOW_INTERVAL_SECONDS = 5;
export const DEVICE_FLOW_EXPIRES_IN_SECONDS = 10 * 60;

export const normalizeUserCode = (value: string) => {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length !== USER_CODE_LENGTH) return null;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
};

export const generateUserCode = () => {
  let result = "";
  for (let i = 0; i < USER_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * USER_CODE_ALPHABET.length);
    result += USER_CODE_ALPHABET[index];
  }
  return normalizeUserCode(result) ?? result;
};

export const generateDeviceCode = () => randomBytes(32).toString("base64url");

export const hashDeviceCode = (deviceCode: string) =>
  createHash("sha256").update(deviceCode).digest("hex");

export const getDeviceVerificationUrl = async () => {
  const { appUrl } = await getPublicRuntimeSettings();

  const base = appUrl || "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/device`;
};
