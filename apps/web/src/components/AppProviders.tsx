"use client";

import { LocaleProvider, type Locale } from "@/lib/i18n";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { RealtimeBridge } from "@/lib/useRealtime";
import { UserContext, useUserState, type UserSession } from "@/lib/useUser";

function UserProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: UserSession | null;
}) {
  const value = useUserState(initialUser);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function AppProviders({
  children,
  initialLocale = "vi",
  initialUser = null,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
  initialUser?: UserSession | null;
}) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <UserProvider initialUser={initialUser}>
        <RealtimeBridge />
        {children}
        <SupportChatWidget />
      </UserProvider>
    </LocaleProvider>
  );
}
