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
