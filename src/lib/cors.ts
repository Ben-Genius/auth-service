// =============================================================================
// CORS UTILITIES — Allow cross-origin requests from frontend apps
// =============================================================================
// CORS = Cross-Origin Resource Sharing
// 
// When frontend on localhost:3001 calls backend on localhost:3000:
// Browser blocks it by default (security feature).
// We tell browser "these origins are allowed" via CORS headers.
//
// WHY?
// In production:
// - Frontend: app.example.com
// - Backend: api.example.com
// Browser sees different domains, blocks request by default.
// CORS headers tell browser "api.example.com allows requests from app.example.com"
//
// ALLOWED ORIGINS:
// - Development: localhost:3000, localhost:3001, localhost:3002
// - Production: Add your frontend domain
// =============================================================================

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",  // Our backend (self)
  "http://localhost:3001",  // Frontend
  "http://localhost:3002",  // Alternative frontend
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
];

/**
 * Add CORS headers to a response.
 * 
 * This allows frontend apps on different domains to call our API.
 * 
 * @param response - The response to add headers to
 * @param request - The incoming request (to check origin)
 * @returns The response with CORS headers added
 */
export function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");

  // Only add CORS headers if origin is in allowed list
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
    response.headers.set("Access-Control-Max-Age", "86400"); // Cache preflight for 24 hours
  }

  return response;
}

/**
 * Handle OPTIONS preflight requests.
 * 
 * When browser makes a cross-origin request, it first sends an OPTIONS request.
 * We respond with CORS headers to tell browser the actual request is allowed.
 * 
 * @param request - The OPTIONS request
 * @returns A 200 response with CORS headers
 */
export function handleCorsPreFlight(request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response, request);
}
