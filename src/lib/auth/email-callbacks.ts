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

import {
  sendChangeEmailConfirmationEmail,
  sendOtpEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/email";

export async function sendResetPasswordEmail(params: {
  user: { email: string };
  url: string;
}) {
  void sendPasswordResetEmail(params.user.email, params.url);
}

export async function sendPasswordChangedNotice(params: {
  user: { email: string };
}) {
  void sendPasswordChangedEmail(params.user.email);
}

export async function sendVerificationEmailCallback(params: {
  user: { email: string };
  url: string;
}) {
  void sendVerificationEmail(params.user.email, params.url);
}

export async function sendChangeEmailConfirmation(params: {
  user: { email: string };
  newEmail: string;
  url: string;
}) {
  void sendChangeEmailConfirmationEmail({
    to: params.user.email,
    newEmail: params.newEmail,
    approveLink: params.url,
  });
}

export async function sendOTP(params: {
  user: { email: string };
  otp: string;
}) {
  void sendOtpEmail(params.user.email, params.otp);
}
