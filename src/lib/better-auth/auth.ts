import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db as prisma } from "@/lib/db";
import {
  magicLink,
  phoneNumber,
  twoFactor,
  emailOTP,
  bearer,
  organization,
  admin,
  anonymous,
  username,
  multiSession,
} from "better-auth/plugins";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),

  appName: "Auth Service",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
    ...(process.env.TRUSTED_ORIGINS?.split(",") || []),
  ],

  // ── Email & Password ──────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url, token }) => {
      console.log(`\n🔐 [Password Reset] Send to ${user.email}`);
      console.log(`   📎 ${url}\n`);
    },
  },

  // ── Email Verification ────────────────────────────────────────────
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      console.log(`\n✅ [Email Verification] Send to ${user.email}`);
      console.log(`   📎 ${url}\n`);
    },
    expiresIn: 3600,
  },

  // ── Social OAuth Providers ────────────────────────────────────────
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      scope: ["read:user", "user:email"],
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      scope: ["identify", "email"],
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || "",
      clientSecret: process.env.APPLE_CLIENT_SECRET || "",
      scope: ["name", "email"],
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || "",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
      tenantId: process.env.MICROSOFT_TENANT_ID || "common",
      scope: ["openid", "email", "profile"],
    },
  },

  // ── Rate Limiting ─────────────────────────────────────────────────
  rateLimit: {
    window: 10,
    max: 100,
    customRules: [
      { path: "/sign-in/email", window: 60, max: 10 },
      { path: "/sign-up/email", window: 60, max: 5 },
      { path: "/otp", window: 60, max: 3 },
    ],
  },

  // ── Plugins ───────────────────────────────────────────────────────
  plugins: [
    // Magic Link — passwordless sign-in via email
    magicLink({
      sendMagicLink: async ({ email, url, token }) => {
        console.log(`\n🔗 [Magic Link] Send to ${email}`);
        console.log(`   📎 ${url}\n`);
      },
      expiresIn: 300,
      disableSignUp: false,
    }),

    // Phone Number — OTP-based phone auth
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        console.log(`[Phone OTP] Send to ${phoneNumber}: ${code}`);
      },
      otpLength: 6,
      expiresIn: 300,
      signUpOnVerification: true,
      allowedAttempts: 3,
      requireVerification: true,
    }),

    // Two-Factor Authentication — TOTP, OTP, backup codes
    twoFactor({
      issuer: "Auth Service",
      skipVerificationOnEnable: true,
      maxFailedAttempts: 5,
      durationSeconds: 300,
    }),

    // Email OTP — verify email or sign in with OTP
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        console.log(`\n📧 [Email OTP] Send to ${email}: ${otp} (type: ${type})\n`);
      },
      expiresIn: 300,
      otpLength: 6,
      sendVerificationOnSignUp: false,
      storeOTP: "plain",
    }),

    // Bearer — authenticate via Authorization: Bearer <token>
    bearer(),

    // Organization — multi-tenant organizations/projects
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
    }),

    // Admin — role-based admin access
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      roles: {
        user: {},
        admin: {},
      },
    }),

    // Anonymous — guest/temporary sessions
    anonymous({
      emailAsUserName: false,
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        console.log(`[Anonymous] Linking ${anonymousUser.id} → ${newUser.id}`);
      },
    }),

    // Username — extend email/password with username login
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),

    // Multi Session — allow multiple concurrent sessions
    multiSession({
      maximumSessions: 5,
    }),


  ],

  // ── Database Hooks ────────────────────────────────────────────────
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          console.log(`[User Created] ${user.id} — ${user.email}`);
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          console.log(`[Session Created] ${session.id} — user ${session.userId}`);
        },
      },
      delete: {
        before: async (session) => {
          console.log(`[Session Deleted] ${session.id}`);
          return true;
        },
      },
    },
  },

  // ── Advanced ──────────────────────────────────────────────────────
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
    generateId: false,
  },

  // ── Telemetry ─────────────────────────────────────────────────────
  telemetry: {
    disabled: true,
  },
});
