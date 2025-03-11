"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, type Attribute } from "next-themes"

type ThemeProviderProps = {
  children: React.ReactNode;
  attribute?: Attribute | Attribute[];
  defaultTheme?: string;
  enableSystem?: boolean;
  storageKey?: string;
  forcedTheme?: string;
  disableTransitionOnChange?: boolean;
  themes?: string[];
};

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}