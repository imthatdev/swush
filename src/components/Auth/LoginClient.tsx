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

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Image from "next/image";
import bgImage from "../../../public/images/bg.png";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import ThemeButton from "../Common/ThemeButton";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import SocialAuthButtons from "@/components/Auth/SocialAuthButtons";
import TurnstileWidget from "@/components/Common/TurnstileWidget";
import { apiV1 } from "@/lib/api-path";

const schema = z.object({
  emailOrUsername: z
    .string()
    .trim()
    .min(3, { message: "Enter at least 3 characters" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

type FormData = z.infer<typeof schema>;

export default function LoginClient() {
  const { appName, supportEmail, turnstileSiteKey } = useAppConfig();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authErrorShown = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const [loading, setLoading] = useState(false);
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFAMethod, setTwoFAMethod] = useState<"totp" | "otp" | "backup">(
    "totp",
  );
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaVerifying, setCaptchaVerifying] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);

  useEffect(() => {
    if (authErrorShown.current) return;
    const error = searchParams.get("error");
    const description =
      searchParams.get("error_description") ||
      searchParams.get("error_message");
    if (!error && !description) return;
    authErrorShown.current = true;

    const errorMap: Record<string, string> = {
      registration_closed:
        "Registration is disabled. If you already have an account, sign in with email and link your provider in Settings.",
      signup_disabled:
        "Registration is disabled. If you already have an account, sign in with email and link your provider in Settings.",
      account_not_linked:
        "This provider is not linked to your account. Sign in with email and link it in Settings.",
    };
    const normalizedError = error ? error.toLowerCase() : "";
    const message =
      description ||
      (normalizedError && errorMap[normalizedError]) ||
      "Authentication failed. Please try again.";
    toast.error(message);
  }, [searchParams]);
  const [trustDevice, setTrustDevice] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const passkeySupported =
    typeof window !== "undefined" && "PublicKeyCredential" in window;

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (loading) return;
      if (turnstileSiteKey) {
        if (!captchaToken) {
          toast.error("Please complete the captcha to continue.");
          return;
        }
        setCaptchaVerifying(true);
        try {
          const res = await fetch(apiV1("/captcha/verify"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: captchaToken }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json?.ok) {
            const codes = Array.isArray(json?.errorCodes)
              ? json.errorCodes.join(", ")
              : "";
            throw new Error(
              codes
                ? `Captcha verification failed: ${codes}`
                : "Captcha verification failed",
            );
          }
          setCaptchaToken("");
          setCaptchaKey((k) => k + 1);
        } catch (err) {
          toast.error("Captcha verification failed", {
            description: err instanceof Error ? err.message : String(err),
          });
          return;
        } finally {
          setCaptchaVerifying(false);
        }
      }
      setLoading(true);
      setTwoFAOpen(false);
      setTwoFACode("");
      setTwoFAMethod("totp");
      setOtpSent(false);

      try {
        const identifier = data.emailOrUsername.trim().toLowerCase();
        const isEmail = identifier.includes("@");
        let requiresTwoFactor = false;

        const onSuccess = async (context: {
          data?: { twoFactorRedirect?: boolean };
        }) => {
          if (context.data?.twoFactorRedirect) {
            requiresTwoFactor = true;
          }
        };

        const { error } = isEmail
          ? await authClient.signIn.email(
              { email: identifier, password: data.password },
              { onSuccess },
            )
          : await authClient.signIn.username(
              { username: identifier, password: data.password },
              { onSuccess },
            );

        if (error) {
          toast.error(error.message || "Login failed.");
          return;
        }

        if (requiresTwoFactor) {
          setTwoFAOpen(true);
          return;
        }

        toast.success("Logged in successfully");
        router.push("/vault");
      } catch (err) {
        toast.error(`Network error. Please try again: ${err}`);
      } finally {
        setLoading(false);
      }
    },
    [router, loading, captchaToken, turnstileSiteKey],
  );

  const sendOtp = async () => {
    setOtpSending(true);
    try {
      const { error } = await authClient.twoFactor.sendOtp({});
      if (error) {
        toast.error(error.message || "Failed to send OTP");
        return;
      }
      setOtpSent(true);
      toast.success("OTP sent");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const verify2FA = async () => {
    setTwoFALoading(true);
    try {
      const code = twoFACode.trim();
      if (!code) return;

      if (twoFAMethod === "totp") {
        const { error } = await authClient.twoFactor.verifyTotp({
          code,
          trustDevice,
        });
        if (error) throw new Error(error.message || "Failed to verify TOTP");
      } else if (twoFAMethod === "otp") {
        const { error } = await authClient.twoFactor.verifyOtp({
          code,
          trustDevice,
        });
        if (error) throw new Error(error.message || "Failed to verify OTP");
      } else {
        const { error } = await authClient.twoFactor.verifyBackupCode({
          code,
          trustDevice,
        });
        if (error)
          throw new Error(error.message || "Failed to verify backup code");
      }

      toast.success("2FA verified");
      setTwoFAOpen(false);
      router.push("/vault");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Verification failed";
      toast.error(message);
    } finally {
      setTwoFALoading(false);
    }
  };

  const signInWithPasskey = async () => {
    if (passkeyLoading || loading) return;
    setPasskeyLoading(true);
    try {
      const { error } = await authClient.signIn.passkey({
        autoFill: true,
      });
      if (error) {
        toast.error(error.message || "Passkey sign-in failed");
        return;
      }
      toast.success("Logged in with passkey");
      router.push("/vault");
    } catch (err) {
      toast.error(`Network error. Please try again: ${err}`);
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-background text-foreground">
      <div className="flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold flex justify-between items-center">
              Login
              <ThemeButton />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              {(() => {
                const social = SocialAuthButtons({
                  callbackURL: "/vault",
                  errorCallbackURL: "/login",
                });
                if (!social.hasProviders) return null;
                return (
                  <div className="space-y-3">
                    {social.content}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      Or
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  </div>
                );
              })()}
              <div>
                <Input
                  {...register("emailOrUsername")}
                  id="emailOrUsername"
                  name="emailOrUsername"
                  placeholder="Email or Username"
                  autoComplete="username email webauthn"
                  aria-invalid={!!errors.emailOrUsername}
                  aria-describedby={
                    errors.emailOrUsername ? "emailOrUsername-error" : undefined
                  }
                  disabled={loading}
                />
                {errors.emailOrUsername && (
                  <p
                    id="emailOrUsername-error"
                    className="text-red-500 text-xs mt-1"
                  >
                    {errors.emailOrUsername.message}
                  </p>
                )}
              </div>

              <div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    id="password"
                    name="password"
                    placeholder="Password"
                    autoComplete="current-password webauthn"
                    className="pr-10"
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xl select-none bg-transparent border-none p-0 m-0 cursor-pointer"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    disabled={loading}
                  >
                    {showPassword ? "🙈" : "🐵"}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-red-500 text-xs mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {turnstileSiteKey && (
                <div className="space-y-2">
                  <TurnstileWidget
                    key={`login-captcha-${captchaKey}`}
                    siteKey={turnstileSiteKey}
                    onVerify={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken("")}
                    onError={() => setCaptchaToken("")}
                  />
                </div>
              )}

              <Button
                className="w-full"
                type="submit"
                disabled={loading || captchaVerifying}
                aria-busy={loading || captchaVerifying}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              <Button
                className="w-full"
                type="button"
                variant="outline"
                onClick={signInWithPasskey}
                disabled={!passkeySupported || loading || passkeyLoading}
                aria-busy={passkeyLoading}
              >
                {passkeyLoading ? "Signing in..." : "Sign in with Passkey"}
              </Button>

              <div className="flex justify-between items-center">
                <Button
                  variant="link"
                  className="p-1"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push("/request-password");
                  }}
                  disabled={loading}
                >
                  Forgot password?
                </Button>
                <Button
                  variant="link"
                  className="p-1"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push("/register");
                  }}
                  disabled={loading}
                >
                  Don&apos;t have an account?
                </Button>
              </div>

              <Dialog
                open={twoFAOpen}
                onOpenChange={(open) => {
                  setTwoFAOpen(open);
                  if (!open) {
                    setTwoFACode("");
                    setTwoFAMethod("totp");
                    setOtpSent(false);
                  }
                }}
              >
                <DialogContent className="bg-zinc-900 text-white">
                  <DialogHeader>
                    <DialogTitle>Enter 2FA Code</DialogTitle>
                  </DialogHeader>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={twoFAMethod === "totp" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTwoFAMethod("totp")}
                    >
                      Authenticator
                    </Button>
                    <Button
                      type="button"
                      variant={twoFAMethod === "otp" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTwoFAMethod("otp")}
                    >
                      Email OTP
                    </Button>
                    <Button
                      type="button"
                      variant={twoFAMethod === "backup" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTwoFAMethod("backup")}
                    >
                      Backup Code
                    </Button>
                  </div>

                  {twoFAMethod !== "backup" ? (
                    <InputOTP
                      maxLength={6}
                      value={twoFACode}
                      onChange={(value) => {
                        setTwoFACode(value.replace(/\D/g, "").slice(0, 6));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          verify2FA();
                        }
                      }}
                      placeholder="6-digit code"
                      aria-label="6-digit code"
                      aria-invalid={twoFACode.length > 0}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  ) : (
                    <Input
                      value={twoFACode}
                      onChange={(e) => setTwoFACode(e.target.value)}
                      placeholder="Enter backup code"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          verify2FA();
                        }
                      }}
                    />
                  )}

                  {twoFAMethod === "otp" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={sendOtp}
                      disabled={otpSending}
                    >
                      {otpSending
                        ? "Sending..."
                        : otpSent
                          ? "Resend OTP"
                          : "Send OTP"}
                    </Button>
                  )}

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="trust-device"
                      checked={trustDevice}
                      onCheckedChange={(checked) =>
                        setTrustDevice(Boolean(checked))
                      }
                    />
                    <Label htmlFor="trust-device" className="text-xs">
                      Trust this device for 30 days
                    </Label>
                  </div>

                  <Button
                    onClick={verify2FA}
                    disabled={
                      (twoFAMethod !== "backup" && twoFACode.length !== 6) ||
                      (twoFAMethod === "backup" && !twoFACode.trim()) ||
                      twoFALoading
                    }
                    aria-busy={twoFALoading}
                  >
                    {twoFALoading ? "Verifying..." : "Verify"}
                  </Button>
                </DialogContent>
              </Dialog>
            </form>
          </CardContent>
        </Card>
      </div>
      <div className="hidden md:flex items-center justify-center relative overflow-hidden">
        <Image
          src={bgImage}
          alt="Auth Background"
          fill
          priority
          placeholder="blur"
          sizes="(min-width: 768px) 50vw, 100vw"
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
        <div className="absolute inset-0 bg-linear-to-l from-transparent to-background" />
        <div className="flex flex-col items-center justify-center relative bg-secondary/40 backdrop-blur-md p-4 rounded-lg">
          <h1 className="flex items-center justify-center text-3xl font-bold">
            Welcome back to {appName}
          </h1>
          <span className="text-center text-muted-foreground">
            Please enter your credentials to access your account.
          </span>
          <span className="text-center text-muted-foreground">
            If you don&apos;t have an account, please register.
          </span>

          <span className="text-center text-muted-foreground">
            If you are facing any issues, please contact support{" "}
            <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link>.
          </span>
        </div>
      </div>
    </div>
  );
}
