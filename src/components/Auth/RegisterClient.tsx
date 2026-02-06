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
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import bgImage from "../../../public/images/bg.png";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import ThemeButton from "../Common/ThemeButton";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { apiV1 } from "@/lib/api-path";
import SocialAuthButtons from "@/components/Auth/SocialAuthButtons";
import { checkInvitation, incrementInviteUsage } from "@/lib/client/invites";
import TurnstileWidget from "@/components/Common/TurnstileWidget";

export default function RegisterClient() {
  const { appName, supportEmail, turnstileSiteKey } = useAppConfig();
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get("invite");

  const [minLength, setMinLength] = useState<number>(8);

  const schema = useMemo(
    () =>
      z
        .object({
          email: z.email().transform((val) => val.toLowerCase()),
          username: z
            .string()
            .min(3)
            .max(32)
            .transform((val) => val.toLowerCase()),
          password: z.string().min(minLength),
          repeatPassword: z.string().min(minLength),
          termsAccepted: z.boolean(),
        })
        .refine((data) => data.password === data.repeatPassword, {
          message: "Passwords do not match",
          path: ["repeatPassword"],
        })
        .refine((data) => data.termsAccepted === true, {
          message: "You must accept the Terms and Privacy Policy.",
          path: ["termsAccepted"],
        }),
    [minLength],
  );

  type FormData = z.infer<typeof schema>;

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaVerifying, setCaptchaVerifying] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);

  const [allowPublicRegistration, setAllowPublicRegistration] = useState<
    boolean | null
  >(null);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [isInvited, setIsInvited] = useState<{
    valid: boolean;
    reason?: string;
  }>();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(apiV1("/register/status"));
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setAllowPublicRegistration(data.allowPublicRegistration);
            setMinLength(data.passwordPolicyMinLength);
            setRequiresSetup(Boolean(data.requiresSetup));
          }
        } else {
          if (active) setAllowPublicRegistration(true);
        }
      } catch {
        if (active) setAllowPublicRegistration(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (data: FormData) => {
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

    const { data: signUpData, error } = await authClient.signUp.email({
      email: data.email.toLowerCase(),
      password: data.password,
      username: data.username.toLowerCase(),
      name: data.username.toLowerCase(),
    });

    if (signUpData?.user) {
      toast.success("Registration successful! Redirecting...");
      if (inviteToken) await incrementInviteUsage(inviteToken);
      router.push("/vault");
    } else {
      toast.error("Failed to register.", {
        description: error?.message,
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      if (!inviteToken) return;
      const result = await checkInvitation(inviteToken);

      setIsInvited(result);
    })();
  }, [inviteToken]);

  const registrationBlocked =
    allowPublicRegistration === false && isInvited?.valid !== true;

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-background text-foreground">
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
        <div className="absolute inset-0 bg-linear-to-r from-transparent to-background" />
        <div className="flex flex-col items-center justify-center relative bg-secondary/40 backdrop-blur-md p-4 rounded-lg">
          <h1 className="relative text-3xl font-bold tracking-tight text-center px-6">
            Welcome to {appName}
          </h1>
          <span className="text-center text-muted-foreground">
            Please enter your credentials to create your account.
          </span>
          <span className="text-center text-muted-foreground">
            If you have have an account, please login.
          </span>

          <span className="text-center text-muted-foreground">
            If you are facing any issues, please contact support{" "}
            <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link>.
          </span>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold flex justify-between items-center">
              Register an Account
              <ThemeButton />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allowPublicRegistration === false &&
              isInvited?.valid !== true &&
              !requiresSetup && (
                <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  Registration is currently closed. {isInvited?.reason}
                </div>
              )}
            {requiresSetup && (
              <div className="mb-4 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
                Setup required. Please complete the setup wizard before
                registering new accounts.
                <div className="mt-2">
                  <Link href="/setup" className="underline">
                    Go to setup
                  </Link>
                </div>
              </div>
            )}
            {allowPublicRegistration === false && isInvited?.valid === true && (
              <div className="mb-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm">
                Registration is closed. However, you can register because of
                your invitation.
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {!registrationBlocked && (
                <>
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
                </>
              )}
              <div>
                <Input
                  {...register("email")}
                  placeholder="Email"
                  disabled={loading || registrationBlocked}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs">{errors.email.message}</p>
                )}
              </div>
              <div>
                <Input
                  {...register("username")}
                  placeholder="Username"
                  disabled={loading || registrationBlocked}
                />
                {errors.username && (
                  <p className="text-red-500 text-xs">
                    {errors.username.message}
                  </p>
                )}
              </div>
              <div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder="Password"
                    disabled={loading || registrationBlocked}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xl select-none"
                    tabIndex={-1}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "🙈" : "🐵"}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div>
                <div className="relative">
                  <Input
                    type={showRepeatPassword ? "text" : "password"}
                    {...register("repeatPassword")}
                    placeholder="Repeat Password"
                    disabled={loading || registrationBlocked}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xl select-none"
                    tabIndex={-1}
                    aria-label={
                      showRepeatPassword
                        ? "Hide repeat password"
                        : "Show repeat password"
                    }
                  >
                    {showRepeatPassword ? "🙈" : "🐵"}
                  </button>
                </div>
                {errors.repeatPassword && (
                  <p className="text-red-500 text-xs">
                    {errors.repeatPassword.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Controller
                    control={control}
                    name="termsAccepted"
                    defaultValue={false}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(val) => field.onChange(Boolean(val))}
                        disabled={loading || registrationBlocked}
                        className="mt-0.5"
                      />
                    )}
                  />
                  <Label className="flex flex-wrap text-sm font-normal leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="underline">
                      Privacy Policy
                    </Link>
                    .
                  </Label>
                </div>
                {errors.termsAccepted && (
                  <p className="text-red-500 text-xs">
                    {errors.termsAccepted.message}
                  </p>
                )}
              </div>

              {turnstileSiteKey && !registrationBlocked && (
                <div className="space-y-2">
                  <TurnstileWidget
                    key={`register-captcha-${captchaKey}`}
                    siteKey={turnstileSiteKey}
                    onVerify={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken("")}
                    onError={() => setCaptchaToken("")}
                  />
                  {captchaVerifying && (
                    <p className="text-xs text-muted-foreground">
                      Verifying captcha…
                    </p>
                  )}
                </div>
              )}
              <Button
                className="w-full"
                type="submit"
                disabled={loading || registrationBlocked || captchaVerifying}
              >
                {loading ? "Creating account..." : "Create account"}
              </Button>

              <Link
                href="/login"
                className="block text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Already have an account?
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
