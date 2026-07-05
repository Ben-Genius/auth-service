import { createAuthClient } from "better-auth/react";
import {
  magicLinkClient,
  phoneNumberClient,
  twoFactorClient,
  emailOTPClient,
  organizationClient,
  adminClient,
  anonymousClient,
  multiSessionClient,
  usernameClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
  basePath: "/api/auth",
  plugins: [
    magicLinkClient(),
    phoneNumberClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = "/two-factor";
      },
    }),
    emailOTPClient(),
    organizationClient(),
    adminClient(),
    anonymousClient(),
    multiSessionClient(),
    usernameClient(),
  ],
});

export type AuthClient = typeof authClient;
export type Session = typeof authClient.$InferSession;
export type User = typeof authClient.$InferUser;
