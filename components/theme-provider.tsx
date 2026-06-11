"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** next-themes のラッパー。class 属性でテーマを切り替え、システム設定に追従する。 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
