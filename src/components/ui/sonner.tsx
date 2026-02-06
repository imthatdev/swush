"use client";
import {
  IconBug,
  IconProgressCheck,
  IconInfoHexagon,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";
import { Spinner } from "./spinner";

export default function Toaster({ ...props }: ToasterProps) {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      position="top-center"
      toastOptions={{
        duration: 3000,
        classNames: {
          success:
            "bg-green-100 text-green-800 border-green-300/20 dark:bg-green-900 dark:text-green-100 dark:border-green-700",
          info: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/20 dark:text-cyan-100 dark:border-cyan-700",
          warning:
            "bg-yellow-100 text-yellow-800 border-yellow-300/20 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-700",
          error:
            "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/90 dark:text-red-100 dark:border-red-700",
          loading:
            "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700",
        },
      }}
      icons={{
        success: <IconProgressCheck className="h-5 w-5" />,
        info: <IconInfoHexagon className="h-5 w-5" />,
        warning: <IconAlertTriangle className="h-5 w-5" />,
        error: <IconBug className="h-5 w-5" />,
        loading: <Spinner className="h-5 w-5" />,
      }}
      {...props}
    />
  );
}
