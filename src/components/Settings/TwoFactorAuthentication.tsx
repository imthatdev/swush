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
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { authClient } from "@/lib/auth-client";
import { Input } from "../ui/input";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import QRCode from "react-qr-code";
import { getCurrentUser } from "@/lib/client/user";
import { Spinner } from "../ui/spinner";
import { Label } from "../ui/label";
import { CardHeader, CardTitle, CardDescription } from "../ui/card";
import CopyButton from "@/components/Common/CopyButton";

async function fetch2FAStatus(
  setIsTwoFactorEnabled: React.Dispatch<React.SetStateAction<boolean>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
) {
  try {
    const user = await getCurrentUser();
    if (user?.twoFactorEnabled) {
      setIsTwoFactorEnabled(user.twoFactorEnabled);
    }
  } catch {
    toast.error("Failed to load 2FA status");
  } finally {
    setLoading(false);
  }
}

export default function TwoFactorAuthentication() {
  const { appName } = useAppConfig();
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [step, setStep] = useState<"confirm" | "setup">("confirm");

  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [totpURI, setTotpURI] = useState<string | null>(null);

  const [otp, setOtp] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [backupLoading, setBackupLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  const [otpLoading, setOtpLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const resetDialogState = () => {
    setOtp("");
    setCurrentPassword("");
    setStep("confirm");
    setTotpURI(null);
  };

  const normalizeBackupCodes = (data: unknown): string[] => {
    if (Array.isArray(data)) return data.filter(Boolean) as string[];
    if (data && typeof data === "object") {
      const maybe =
        (data as { backupCodes?: string[]; codes?: string[] }) ?? {};
      if (Array.isArray(maybe.backupCodes)) return maybe.backupCodes;
      if (Array.isArray(maybe.codes)) return maybe.codes;
    }
    return [];
  };

  const enable2FAFlow = async () => {
    try {
      const { data, error } = await authClient.twoFactor.enable({
        password: currentPassword,
        issuer: appName,
      });

      if (error) {
        toast.error(error.message || "Failed to enable 2FA");
        return;
      }

      const codes = normalizeBackupCodes(data?.backupCodes ?? data);
      if (codes.length) setBackupCodes(codes);

      if (data?.totpURI) {
        setTotpURI(data.totpURI);
      } else {
        await refreshTotpUri();
      }
      setStep("setup");
    } catch {
      toast.error("Failed to fetch QR code");
    }
  };

  const refreshTotpUri = async () => {
    if (!currentPassword.trim()) return;
    setQrLoading(true);
    try {
      const { data, error } = await authClient.twoFactor.getTotpUri({
        password: currentPassword,
      });
      if (error) {
        toast.error(error.message || "Failed to load TOTP URI");
        return;
      }
      setTotpURI(data?.totpURI ?? null);
    } catch {
      toast.error("Failed to load TOTP URI");
    } finally {
      setQrLoading(false);
    }
  };

  const verify2FAFlow = async () => {
    setOtpLoading(true);
    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: otp,
        trustDevice: true,
      });

      if (error) {
        toast.error("Failed to verify, " + (error.message || "Unknown error"));
        return;
      }

      toast.success("2FA enabled successfully");
      setIsTwoFactorEnabled(true);
      setShowOtpDialog(false);
    } catch {
      toast.error("Failed to verify 2FA code");
    } finally {
      setOtpLoading(false);
    }
  };

  const disable2FAFlow = async () => {
    try {
      const { error } = await authClient.twoFactor.disable({
        password: currentPassword,
      });

      if (error) {
        toast.error("Failed to disable 2FA, ", {
          description: error.message || "Please try again.",
        });
      } else {
        toast.success("2FA disabled successfully");
        setIsTwoFactorEnabled(false);
      }
    } catch {
      toast.error("Failed to disable 2FA");
    }
  };

  const start2FASetup = async () => {
    if (currentPassword.length === 0) return;
    await enable2FAFlow();
  };

  const verify2FA = async () => {
    await verify2FAFlow();
  };

  const disable2FA = async () => {
    await disable2FAFlow();
  };

  const generateBackupCodes = async () => {
    if (!backupPassword.trim()) {
      toast.error("Enter your password to generate backup codes");
      return;
    }
    setBackupLoading(true);
    try {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({
        password: backupPassword,
      });
      if (error) {
        toast.error(error.message || "Failed to generate backup codes");
        return;
      }
      const codes = normalizeBackupCodes(data ?? null);
      setBackupCodes(codes);
      toast.success("Backup codes generated");
    } catch {
      toast.error("Failed to generate backup codes");
    } finally {
      setBackupLoading(false);
    }
  };

  useEffect(() => {
    fetch2FAStatus(setIsTwoFactorEnabled, setLoading);
  }, []);

  return (
    <div className="space-y-4">
      <CardHeader className="px-0">
        <CardTitle className="text-xl">Two-factor authentication</CardTitle>
        <CardDescription>
          Add a second step to protect your account with authenticator codes.
        </CardDescription>
      </CardHeader>
      {isTwoFactorEnabled ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={() => setConfirmDisableOpen(true)}
            >
              Disable 2FA
            </Button>
            <Button variant="secondary" onClick={() => setBackupOpen(true)}>
              Backup codes
            </Button>
          </div>

          <AlertDialog
            open={confirmDisableOpen}
            onOpenChange={setConfirmDisableOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Disable two‑factor authentication?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  You will no longer be required to enter a one‑time code when
                  signing in. You can re‑enable 2FA at any time from settings.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="Enter your current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-10"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    await disable2FA();
                    setConfirmDisableOpen(false);
                  }}
                >
                  Disable
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog
            open={backupOpen}
            onOpenChange={(open) => {
              setBackupOpen(open);
              if (!open) {
                setBackupPassword("");
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Backup codes</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="backup-password">Confirm password</Label>
                  <Input
                    id="backup-password"
                    type="password"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>
                {backupCodes.length > 0 && (
                  <div className="grid gap-2 rounded-md border p-3 text-sm">
                    <div className="text-xs text-muted-foreground">
                      Store these codes in a safe place. Each code can be used
                      once.
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((code) => (
                        <span key={code} className="font-mono text-xs">
                          {code}
                        </span>
                      ))}
                    </div>
                    <CopyButton
                      variant="outline"
                      successMessage="Backup codes copied"
                      getText={() => backupCodes.join("\n")}
                    >
                      Copy codes
                    </CopyButton>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={generateBackupCodes} disabled={backupLoading}>
                  {backupLoading ? "Generating..." : "Generate new codes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Dialog
          open={showOtpDialog}
          onOpenChange={(open) => {
            setShowOtpDialog(open);
            if (!open) {
              resetDialogState();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              variant="secondary"
              onClick={() => {
                setShowOtpDialog(true);
                setStep("confirm");
              }}
              disabled={loading}
            >
              {loading ? <Spinner /> : "Enable 2FA with Authenticator"}
            </Button>
          </DialogTrigger>
          <DialogContent className=" items-center justify-center">
            {step === "confirm" && (
              <div className="grid gap-4 w-full max-w-sm">
                <h3 className="text-lg font-semibold text-foreground">
                  Confirm your password
                </h3>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={currentPassword}
                    className="pr-10"
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-xl cursor-pointer bg-transparent border-0 outline-none"
                    style={{ background: "none", border: "none" }}
                    aria-label={
                      showCurrentPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showCurrentPassword ? "🙈" : "🐵"}
                  </button>
                </div>
                <Button
                  onClick={start2FASetup}
                  disabled={currentPassword.length === 0}
                >
                  Continue
                </Button>
              </div>
            )}
            {step === "setup" && totpURI && (
              <>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-white text-sm">
                    Scan this QR in your Authenticator App:
                  </p>
                  <QRCode value={totpURI} />
                  <p className="text-muted-foreground text-sm">
                    Then enter the 6‑digit code below:
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshTotpUri}
                    disabled={qrLoading}
                  >
                    {qrLoading ? "Refreshing..." : "Refresh QR"}
                  </Button>
                </div>
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {Array(6)
                      .fill(0)
                      .map((_, idx) => (
                        <InputOTPSlot key={idx} index={idx} />
                      ))}
                  </InputOTPGroup>
                </InputOTP>
                <Button
                  onClick={verify2FA}
                  disabled={otp.length !== 6 || otpLoading}
                >
                  {otpLoading ? "Verifying..." : "Verify & Enable 2FA"}
                </Button>
                {backupCodes.length > 0 && (
                  <div className="w-full rounded-md border p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Backup codes</p>
                    <p className="mb-2">
                      Save these codes now. Each code can be used once.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((code) => (
                        <span key={code} className="font-mono">
                          {code}
                        </span>
                      ))}
                    </div>
                    <CopyButton
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      successMessage="Backup codes copied"
                      getText={() => backupCodes.join("\n")}
                    >
                      Copy codes
                    </CopyButton>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
