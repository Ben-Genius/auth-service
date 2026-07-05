-- Paste this into Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to re-run: drops existing tables first, then recreates

-- ============================================================
-- BETTERAUTH CORE TABLES
-- ============================================================

DROP TABLE IF EXISTS "as_otp" CASCADE;
DROP TABLE IF EXISTS "as_service_user" CASCADE;
DROP TABLE IF EXISTS "as_project" CASCADE;
DROP TABLE IF EXISTS "as_invitation" CASCADE;
DROP TABLE IF EXISTS "as_member" CASCADE;
DROP TABLE IF EXISTS "as_organization" CASCADE;
DROP TABLE IF EXISTS "as_two_factor" CASCADE;
DROP TABLE IF EXISTS "as_verification" CASCADE;
DROP TABLE IF EXISTS "as_account" CASCADE;
DROP TABLE IF EXISTS "as_session" CASCADE;
DROP TABLE IF EXISTS "as_user" CASCADE;

CREATE TABLE "as_user" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "phoneNumber" TEXT,
    "phoneNumberVerified" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "role" TEXT DEFAULT 'user',
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "isAnonymous" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "as_user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "as_session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "as_session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "as_account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "as_account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "as_verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "as_verification_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- PLUGIN: Two-Factor Authentication
-- ============================================================
CREATE TABLE "as_two_factor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,
    "failedVerificationCount" INTEGER DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    CONSTRAINT "as_two_factor_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- PLUGIN: Organization
-- ============================================================
CREATE TABLE "as_organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    CONSTRAINT "as_organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "as_member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "as_member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "as_invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "teamId" TEXT,
    "inviterId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "as_invitation_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- SERVICE AUTH TABLES
-- ============================================================
CREATE TABLE "as_project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "as_project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "as_service_user" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "as_service_user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "as_otp" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "as_otp_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "as_user_email_key" ON "as_user"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "as_user_username_key" ON "as_user"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "as_session_token_key" ON "as_session"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "as_project_apiKey_key" ON "as_project"("apiKey");
CREATE UNIQUE INDEX IF NOT EXISTS "as_service_user_projectId_email_key" ON "as_service_user"("projectId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "as_organization_slug_key" ON "as_organization"("slug");

-- ============================================================
-- FOREIGN KEYS
-- ============================================================
ALTER TABLE IF EXISTS "as_session" ADD CONSTRAINT "as_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "as_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "as_account" ADD CONSTRAINT "as_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "as_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "as_two_factor" ADD CONSTRAINT "as_two_factor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "as_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "as_member" ADD CONSTRAINT "as_member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "as_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "as_member" ADD CONSTRAINT "as_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "as_user"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "as_invitation" ADD CONSTRAINT "as_invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "as_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "as_project" ADD CONSTRAINT "as_project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "as_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "as_service_user" ADD CONSTRAINT "as_service_user_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "as_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "as_otp" ADD CONSTRAINT "as_otp_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "as_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "as_otp" ADD CONSTRAINT "as_otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "as_service_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
