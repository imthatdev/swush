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

import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import AppLogo from "../../../public/images/logo.png";

export const Logo = ({
  size = 28,
  textClassName,
}: {
  size?: number;
  textClassName?: string;
}) => {
  return (
    <Link
      href="/vault"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal"
    >
      <Image
        src={AppLogo}
        alt="Logo"
        width={size}
        height={size}
        className="shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm animate-fade-in-up"
      />
      <span
        className={cn(
          "font-medium whitespace-pre animate-fade-in-up",
          textClassName,
        )}
      >
        Swush
      </span>
    </Link>
  );
};

export const LogoIcon = ({ size }: { size?: number }) => {
  return (
    <Image
      src="/images/logo.png"
      alt="Logo"
      width={size}
      height={size}
      className={cn(
        "shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm",
      )}
      style={{
        width: size,
        height: size,
      }}
    />
  );
};
