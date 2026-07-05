// =============================================================================
// AUTH UTILITIES — Dual-purpose: Portal Auth + Service Auth
// =============================================================================
// This service has TWO different auth contexts:
//
// 1. PORTAL AUTH — Developers logging into THIS portal to manage projects
//    JWT contains: { developerId, email }
//
// 2. SERVICE AUTH — End-users of apps that USE our service
//    JWT contains: { serviceUserId, projectId, email }
//
// WHY TWO SEPARATE SECRETS?
// A portal JWT must NEVER work as a service JWT (and vice versa).
// If they shared a secret, a developer could forge service tokens.
// Separate secrets = complete isolation between the two auth systems.
// =============================================================================

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";

// -----------------------------------------------------------------------------
// SECRETS — One for portal, one for service
// -----------------------------------------------------------------------------
const PORTAL_JWT_SECRET = new TextEncoder().encode(
  process.env.PORTAL_JWT_SECRET || "portal-secret-change-in-production"
);
const SERVICE_JWT_SECRET = new TextEncoder().encode(
  process.env.SERVICE_JWT_SECRET || "service-secret-change-in-production"
);

const JWT_EXPIRY = "24h";
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const BCRYPT_ROUNDS = 10;

// -----------------------------------------------------------------------------
// PASSWORD OPERATIONS
// -----------------------------------------------------------------------------

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// -----------------------------------------------------------------------------
// PORTAL JWT — For developer portal authentication
// -----------------------------------------------------------------------------

export interface PortalJwtPayload {
  developerId: string;
  email: string;
}

export async function createPortalToken(payload: PortalJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(PORTAL_JWT_SECRET);
}

export async function verifyPortalToken(
  token: string
): Promise<PortalJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, PORTAL_JWT_SECRET);
    return {
      developerId: payload.developerId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// SERVICE JWT — For the auth-as-a-service API
// -----------------------------------------------------------------------------
// This JWT is returned to OTHER apps when their users authenticate.
// Those apps store it and send it back to verify the user's identity.
//
// The "projectId" in the token ensures a token from App A
// can never be used to access App B's data.
// -----------------------------------------------------------------------------

export interface ServiceJwtPayload {
  serviceUserId: string;
  projectId: string;
  email: string;
}

export async function createServiceToken(payload: ServiceJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(SERVICE_JWT_SECRET);
}

export async function verifyServiceToken(
  token: string
): Promise<ServiceJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SERVICE_JWT_SECRET);
    return {
      serviceUserId: payload.serviceUserId as string,
      projectId: payload.projectId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// OTP OPERATIONS
// -----------------------------------------------------------------------------

export function generateOtpCode(): string {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  return crypto.randomInt(min, max + 1).toString();
}

export function getOtpExpiry(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS);
}

export async function verifyOtp(
  plainCode: string,
  hashedCode: string
): Promise<boolean> {
  return bcrypt.compare(plainCode, hashedCode);
}