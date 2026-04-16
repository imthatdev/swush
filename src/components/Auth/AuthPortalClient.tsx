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

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "motion/react";
import Link from "next/link";
import { toast } from "sonner";
import {
  IconBookmark,
  IconCloud,
  IconEye,
  IconEyeClosed,
  IconFileText,
  IconFolder,
  IconLink,
  IconPhoto,
  IconStar,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import SocialAuthButtons from "@/components/Auth/SocialAuthButtons";
import TurnstileWidget from "@/components/Common/TurnstileWidget";
import { LogoIcon } from "@/components/Common/Logo";
import { authClient } from "@/lib/auth-client";
import { checkInvitation, incrementInviteUsage } from "@/lib/client/invites";
import { apiV1 } from "@/lib/api-path";
import ExternalLayout from "../Common/ExternalLayout";

type AuthMode = "login" | "register";

type FloatingSeed = {
  id: number;
  iconIndex: number;
  x: number;
  y: number;
  drift: number;
  duration: number;
  delay: number;
  size: number;
  opacity: number;
  blur: number;
  rotate: number;
  spin: number;
  travel: number;
  scale: number;
  depth: number;
};

const floatingIconComponents = [
  IconLink,
  IconFileText,
  IconBookmark,
  IconFolder,
  IconCloud,
  IconPhoto,
  IconStar,
] as const;

const loginSchema = z.object({
  emailOrUsername: z
    .string()
    .trim()
    .min(3, { message: "Enter at least 3 characters" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

type LoginFormData = z.infer<typeof loginSchema>;

function isEmailNotVerifiedError(message: string) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("email not verified") ||
    normalized.includes("email is not verified")
  );
}

function resolvePostLoginPath(nextParam: string | null, fallback = "/vault") {
  if (!nextParam) return fallback;

  const value = nextParam.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const parsed = new URL(value, "http://localhost");
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (
      normalized === "/login" ||
      normalized.startsWith("/login?") ||
      normalized === "/register" ||
      normalized.startsWith("/register?")
    ) {
      return fallback;
    }
    return normalized;
  } catch {
    return fallback;
  }
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createFloatingSeeds(count: number, seed: number) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_, id) => {
    const depth = 0.75 + random() * 0.9;
    return {
      id,
      iconIndex: Math.floor(random() * floatingIconComponents.length),
      x: random() * 100,
      y: random() * 120 - 10,
      drift: (random() - 0.5) * 38,
      duration: 12 + random() * 18,
      delay: random() * 7,
      size: 14 + random() * 28,
      opacity: 0.05 + random() * 0.15,
      blur: random() * 2.4,
      rotate: random() * 360,
      spin: (random() - 0.5) * 90,
      travel: 120 + random() * 220,
      scale: 0.72 + random() * 0.78,
      depth,
    } satisfies FloatingSeed;
  });
}

export default function AuthPortalClient({
  initialMode = "login",
}: {
  initialMode?: AuthMode;
}) {
  const mode: AuthMode = initialMode;
  const { appName, supportEmail, turnstileSiteKey } = useAppConfig();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const authErrorShown = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postLoginPath = useMemo(
    () => resolvePostLoginPath(searchParams.get("next")),
    [searchParams],
  );
  const loginErrorCallbackURL = useMemo(
    () =>
      postLoginPath === "/vault"
        ? "/login"
        : `/login?next=${encodeURIComponent(postLoginPath)}`,
    [postLoginPath],
  );
  const authSwitchParams = useMemo(() => {
    const params = new URLSearchParams();
    if (postLoginPath !== "/vault") {
      params.set("next", postLoginPath);
    }
    if (inviteToken) {
      params.set("invite", inviteToken);
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [inviteToken, postLoginPath]);
  const registerHref = useMemo(
    () => `/register${authSwitchParams}`,
    [authSwitchParams],
  );
  const loginHref = useMemo(
    () => `/login${authSwitchParams}`,
    [authSwitchParams],
  );

  const [formFocused, setFormFocused] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [minLength, setMinLength] = useState(8);
  const [allowPublicRegistration, setAllowPublicRegistration] = useState<
    boolean | null
  >(null);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [invitation, setInvitation] = useState<{
    valid: boolean;
    reason?: string;
  }>();

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginCaptchaToken, setLoginCaptchaToken] = useState("");
  const [loginCaptchaVerifying, setLoginCaptchaVerifying] = useState(false);
  const [loginCaptchaKey, setLoginCaptchaKey] = useState(0);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerCaptchaToken, setRegisterCaptchaToken] = useState("");
  const [registerCaptchaVerifying, setRegisterCaptchaVerifying] =
    useState(false);
  const [registerCaptchaKey, setRegisterCaptchaKey] = useState(0);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFAMethod, setTwoFAMethod] = useState<"totp" | "otp" | "backup">(
    "totp",
  );
  const [trustDevice, setTrustDevice] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const registerSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(2, { message: "Name must be at least 2 characters." }),
        email: z.email(),
        username: z
          .string()
          .trim()
          .min(3, { message: "Username must be at least 3 characters." })
          .max(32, { message: "Username cannot exceed 32 characters." }),
        password: z.string().min(minLength, {
          message: `Password must be at least ${minLength} characters.`,
        }),
        termsAccepted: z.boolean().refine((value) => value, {
          message: "You must accept the Terms and Privacy Policy.",
        }),
      }),
    [minLength],
  );

  type RegisterFormData = z.infer<typeof registerSchema>;

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "",
      termsAccepted: false,
    },
  });

  const socialAuth = SocialAuthButtons({
    callbackURL: postLoginPath,
    errorCallbackURL: loginErrorCallbackURL,
    variant: "secondary",
  });

  const registrationBlocked =
    allowPublicRegistration === false && invitation?.valid !== true;
  const passkeySupported =
    typeof window !== "undefined" && "PublicKeyCredential" in window;

  const verifyCaptchaToken = useCallback(async (token: string) => {
    const res = await fetch(apiV1("/captcha/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
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
  }, []);

  const unlockAndNavigate = useCallback(
    (path: string) => {
      setUnlocking(true);
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = setTimeout(() => {
        router.push(path);
      }, 420);
    },
    [router],
  );

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    };
  }, []);

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
        "Registration is disabled. Sign in with email and link your provider in settings.",
      signup_disabled:
        "Registration is disabled. Sign in with email and link your provider in settings.",
      account_not_linked:
        "This provider is not linked to your account. Sign in with email and link it in settings.",
    };

    const normalizedError = error ? error.toLowerCase() : "";
    const message =
      description ||
      (normalizedError && errorMap[normalizedError]) ||
      "Authentication failed. Please try again.";

    if (isEmailNotVerifiedError(message)) {
      toast.error("Email not verified", {
        description: `If you didn't receive a verification email, contact support at ${supportEmail} using the same email address.`,
      });
      return;
    }

    toast.error(message);
  }, [searchParams, supportEmail]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(apiV1("/register/status"));
        if (!res.ok) throw new Error("Registration status unavailable");
        const data = await res.json();
        if (!active) return;
        setAllowPublicRegistration(data.allowPublicRegistration);
        setRequiresSetup(Boolean(data.requiresSetup));
        setMinLength(data.passwordPolicyMinLength || 8);
      } catch {
        if (!active) return;
        setAllowPublicRegistration(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!inviteToken) {
        setInvitation(undefined);
        return;
      }
      const result = await checkInvitation(inviteToken);
      if (active) setInvitation(result);
    })();

    return () => {
      active = false;
    };
  }, [inviteToken]);

  const onLoginSubmit = useCallback(
    async (data: LoginFormData) => {
      if (loginLoading) return;

      if (turnstileSiteKey) {
        if (!loginCaptchaToken) {
          toast.error("Please complete the captcha to continue.");
          return;
        }
        setLoginCaptchaVerifying(true);
        try {
          await verifyCaptchaToken(loginCaptchaToken);
          setLoginCaptchaToken("");
          setLoginCaptchaKey((prev) => prev + 1);
        } catch (err) {
          toast.error("Captcha verification failed", {
            description: err instanceof Error ? err.message : String(err),
          });
          return;
        } finally {
          setLoginCaptchaVerifying(false);
        }
      }

      setLoginLoading(true);
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
          if (context.data?.twoFactorRedirect) requiresTwoFactor = true;
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
          const message = error.message || "Login failed.";
          if (isEmailNotVerifiedError(message)) {
            toast.error("Email not verified", {
              description: `If you didn't receive a verification email, contact support at ${supportEmail} using the same email address.`,
            });
            return;
          }
          toast.error(message);
          return;
        }

        if (requiresTwoFactor) {
          setTwoFAOpen(true);
          return;
        }

        toast.success("Logged in successfully");
        unlockAndNavigate(postLoginPath);
      } catch (err) {
        toast.error(`Network error. Please try again: ${err}`);
      } finally {
        setLoginLoading(false);
      }
    },
    [
      loginLoading,
      loginCaptchaToken,
      supportEmail,
      turnstileSiteKey,
      unlockAndNavigate,
      verifyCaptchaToken,
      postLoginPath,
    ],
  );

  const onRegisterSubmit = useCallback(
    async (data: RegisterFormData) => {
      if (registerLoading || registrationBlocked) return;

      if (turnstileSiteKey) {
        if (!registerCaptchaToken) {
          toast.error("Please complete the captcha to continue.");
          return;
        }

        setRegisterCaptchaVerifying(true);
        try {
          await verifyCaptchaToken(registerCaptchaToken);
          setRegisterCaptchaToken("");
          setRegisterCaptchaKey((prev) => prev + 1);
        } catch (err) {
          toast.error("Captcha verification failed", {
            description: err instanceof Error ? err.message : String(err),
          });
          return;
        } finally {
          setRegisterCaptchaVerifying(false);
        }
      }

      setRegisterLoading(true);
      try {
        const normalizedName = data.name.trim();
        const normalizedUsername = data.username.trim().toLowerCase();
        const { data: signUpData, error } = await authClient.signUp.email({
          email: data.email.trim().toLowerCase(),
          password: data.password,
          username: normalizedUsername,
          name: normalizedName,
        });

        if (!signUpData?.user) {
          toast.error("Failed to register.", {
            description: error?.message,
          });
          return;
        }

        toast.success("Account created. Redirecting...");
        if (inviteToken) await incrementInviteUsage(inviteToken);
        unlockAndNavigate("/vault");
      } finally {
        setRegisterLoading(false);
      }
    },
    [
      inviteToken,
      registerCaptchaToken,
      registerLoading,
      registrationBlocked,
      turnstileSiteKey,
      unlockAndNavigate,
      verifyCaptchaToken,
    ],
  );

  const signInWithPasskey = useCallback(async () => {
    if (passkeyLoading || loginLoading) return;

    if (!passkeySupported) {
      toast.error("Passkeys are not supported on this device/browser.");
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error("Passkeys require HTTPS (or localhost in development).");
      return;
    }

    setPasskeyLoading(true);
    try {
      const { error } = await authClient.signIn.passkey({
        autoFill: false,
      });
      if (error) {
        toast.error(error.message || "Passkey sign-in failed");
        return;
      }
      toast.success("Logged in with passkey");
      unlockAndNavigate(postLoginPath);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Passkey sign-in failed",
      );
    } finally {
      setPasskeyLoading(false);
    }
  }, [
    loginLoading,
    passkeyLoading,
    passkeySupported,
    unlockAndNavigate,
    postLoginPath,
  ]);

  const sendOtp = useCallback(async () => {
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
  }, []);

  const verify2FA = useCallback(async () => {
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
      unlockAndNavigate(postLoginPath);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Verification failed";
      toast.error(message);
    } finally {
      setTwoFALoading(false);
    }
  }, [twoFACode, twoFAMethod, trustDevice, unlockAndNavigate, postLoginPath]);

  const handleFormFocus = useCallback(() => {
    setFormFocused(true);
  }, []);

  const handleFormBlur = useCallback((event: FocusEvent<HTMLFormElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFormFocused(false);
    }
  }, []);

  return (
    <ExternalLayout>
      <div className="row-start-2 w-full max-w-md justify-self-center rounded-2xl border border-border/40 bg-card/70 p-6 shadow-xl backdrop-blur-md">
        <div className="mb-6">
          <div className="mb-4 flex justify-center">
            <LogoIcon size={38} />
          </div>
          <h1 className="text-center text-3xl font-bold">
            {mode === "login" ? "Welcome back" : "Create an account"}
          </h1>
          <p className="max-w-sm text-center text-muted-foreground">
            {mode === "login"
              ? "Enter your credentials to swush"
              : "Join now and start swushing"}
          </p>
        </div>

        {mode === "login" ? (
          <form
            className="space-y-4"
            noValidate
            onFocusCapture={handleFormFocus}
            onBlurCapture={handleFormBlur}
            onSubmit={loginForm.handleSubmit(onLoginSubmit)}
          >
            {socialAuth.hasProviders ? (
              <div className="space-y-3">
                {socialAuth.content}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  Or
                  <span className="h-px flex-1 bg-border" />
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Input
                {...loginForm.register("emailOrUsername")}
                id="emailOrUsername"
                placeholder="Email or Username"
                type="text"
                autoComplete="username webauthn"
                aria-invalid={!!loginForm.formState.errors.emailOrUsername}
                aria-describedby={
                  loginForm.formState.errors.emailOrUsername
                    ? "emailOrUsername-error"
                    : undefined
                }
                disabled={loginLoading}
              />
              {loginForm.formState.errors.emailOrUsername ? (
                <p id="emailOrUsername-error" className="text-xs text-red-500">
                  {loginForm.formState.errors.emailOrUsername.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="relative">
                <Input
                  type={showLoginPassword ? "text" : "password"}
                  {...loginForm.register("password")}
                  id="password"
                  placeholder="Password"
                  autoComplete="current-password webauthn"
                  aria-invalid={!!loginForm.formState.errors.password}
                  aria-describedby={
                    loginForm.formState.errors.password
                      ? "password-error"
                      : undefined
                  }
                  disabled={loginLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={
                    showLoginPassword ? "Hide password" : "Show password"
                  }
                >
                  {showLoginPassword ? (
                    <IconEyeClosed size={16} />
                  ) : (
                    <IconEye size={16} />
                  )}
                </button>
              </div>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => router.push("/request-password")}
              >
                Forgot password?
              </button>
              {loginForm.formState.errors.password ? (
                <p id="password-error" className="text-xs text-red-500">
                  {loginForm.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            {turnstileSiteKey ? (
              <div className="space-y-2">
                <TurnstileWidget
                  key={`login-captcha-${loginCaptchaKey}`}
                  siteKey={turnstileSiteKey}
                  className="overflow-hidden rounded-2xl border border-border/40 bg-background/55"
                  onVerify={(token) => setLoginCaptchaToken(token)}
                  onExpire={() => setLoginCaptchaToken("")}
                  onError={() => setLoginCaptchaToken("")}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                disabled={loginLoading || loginCaptchaVerifying}
                aria-busy={loginLoading || loginCaptchaVerifying}
                className="w-full"
              >
                {loginLoading ? "Signing in..." : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={signInWithPasskey}
                disabled={loginLoading || passkeyLoading}
                aria-busy={passkeyLoading}
                className="w-full"
              >
                {passkeyLoading
                  ? "Launching passkey..."
                  : "Use Passkey Instead"}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href={registerHref}
                className="text-primary hover:underline"
              >
                Create one
              </Link>
            </div>
          </form>
        ) : (
          <form
            className="space-y-4"
            onFocusCapture={handleFormFocus}
            onBlurCapture={handleFormBlur}
            onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
          >
            {requiresSetup ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
                Setup required. Complete setup before registering new users.
                <div className="mt-1">
                  <Link href="/setup" className="underline">
                    Go to setup
                  </Link>
                </div>
              </div>
            ) : null}

            {allowPublicRegistration === false &&
            invitation?.valid !== true &&
            !requiresSetup ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm">
                Registration is currently closed. {invitation?.reason}
              </div>
            ) : null}

            {allowPublicRegistration === false && invitation?.valid === true ? (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm">
                Registration is closed, but your invitation allows access.
              </div>
            ) : null}

            {!registrationBlocked && socialAuth.hasProviders ? (
              <div className="space-y-3">
                {socialAuth.content}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  Or
                  <span className="h-px flex-1 bg-border" />
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                {...registerForm.register("name")}
                id="name"
                placeholder="Your name"
                disabled={registerLoading || registrationBlocked}
              />
              {registerForm.formState.errors.name ? (
                <p className="text-xs text-red-500">
                  {registerForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                {...registerForm.register("username")}
                id="username"
                placeholder="username"
                disabled={registerLoading || registrationBlocked}
              />
              {registerForm.formState.errors.username ? (
                <p className="text-xs text-red-500">
                  {registerForm.formState.errors.username.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                {...registerForm.register("email")}
                id="email"
                placeholder="you@example.com"
                type="email"
                disabled={registerLoading || registrationBlocked}
              />
              {registerForm.formState.errors.email ? (
                <p className="text-xs text-red-500">
                  {registerForm.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="register-password">Password</Label>
              <div className="relative">
                <Input
                  type={showRegisterPassword ? "text" : "password"}
                  {...registerForm.register("password")}
                  id="register-password"
                  placeholder={`At least ${minLength} characters`}
                  disabled={registerLoading || registrationBlocked}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={
                    showRegisterPassword ? "Hide password" : "Show password"
                  }
                >
                  {showRegisterPassword ? (
                    <IconEyeClosed size={16} />
                  ) : (
                    <IconEye size={16} />
                  )}
                </button>
              </div>
              {registerForm.formState.errors.password ? (
                <p className="text-xs text-red-500">
                  {registerForm.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <div className="flex items-start gap-2">
              <Controller
                control={registerForm.control}
                name="termsAccepted"
                defaultValue={false}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(value) => field.onChange(Boolean(value))}
                    disabled={registerLoading || registrationBlocked}
                    className="mt-0.5"
                  />
                )}
              />
              <Label className="flex flex-wrap gap-1 text-xs text-muted-foreground md:text-sm">
                <span>Accept</span>
                <Link href="/terms" target="_blank" className="underline">
                  Terms of Service
                </Link>
                <span>and</span>
                <Link href="/privacy" target="_blank" className="underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>
            {registerForm.formState.errors.termsAccepted ? (
              <p className="text-xs text-red-500">
                {registerForm.formState.errors.termsAccepted.message}
              </p>
            ) : null}

            {turnstileSiteKey && !registrationBlocked ? (
              <div className="space-y-2">
                <TurnstileWidget
                  key={`register-captcha-${registerCaptchaKey}`}
                  siteKey={turnstileSiteKey}
                  className="overflow-hidden rounded-2xl border border-border/40 bg-background/55"
                  onVerify={(token) => setRegisterCaptchaToken(token)}
                  onExpire={() => setRegisterCaptchaToken("")}
                  onError={() => setRegisterCaptchaToken("")}
                />
                {registerCaptchaVerifying ? (
                  <p className="text-xs text-muted-foreground">
                    Verifying captcha...
                  </p>
                ) : null}
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={
                registerLoading ||
                registrationBlocked ||
                registerCaptchaVerifying
              }
              className="w-full"
            >
              {registerLoading ? "Creating account..." : "Create Account"}
            </Button>

            <div className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href={loginHref} className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Need help?{" "}
          <Link href={`mailto:${supportEmail}`} className="underline">
            {supportEmail}
          </Link>
        </p>
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
            <DialogTitle>Two-Factor Authentication</DialogTitle>
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
              onChange={(value) =>
                setTwoFACode(value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void verify2FA();
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
              onChange={(event) => setTwoFACode(event.target.value)}
              placeholder="Enter backup code"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void verify2FA();
                }
              }}
            />
          )}

          {twoFAMethod === "otp" ? (
            <Button
              type="button"
              variant="outline"
              onClick={sendOtp}
              disabled={otpSending}
            >
              {otpSending ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
            </Button>
          ) : null}

          <div className="flex items-center gap-2">
            <Checkbox
              id="trust-device"
              checked={trustDevice}
              onCheckedChange={(checked) => setTrustDevice(Boolean(checked))}
            />
            <Label htmlFor="trust-device" className="text-xs">
              Trust this device for 30 days
            </Label>
          </div>

          <Button
            onClick={() => void verify2FA()}
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
    </ExternalLayout>
  );
}
