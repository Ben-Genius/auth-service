# 🚀 Backend Codebase Guide for Frontend Developers
## Auth-as-a-Service Backend — Complete Breakdown

---

## 📌 TL;DR: What Is This Project?

This is an **Authentication-as-a-Service** platform. Think of it like Auth0, Firebase Auth, or Clerk.

**The Idea:**
- **You (Developer) sign up** on a web portal → creates a "Developer" account
- **You create projects** (e.g., "My SaaS App", "Mobile App") → each gets a unique API key
- **Your apps use our service** to handle user registration, login, and verification
- **End users register/login** through our API → they get a JWT token

**Real-world flow:**
```
Your Frontend App
       ↓
   (user clicks "Sign Up")
       ↓
Your Backend App
       ↓
   (calls our API with API key)
       ↓
Our Auth Service (this codebase)
       ↓
   (creates user in database)
       ↓
Returns JWT token to Your Backend
       ↓
Your Backend sends token to Your Frontend
       ↓
Frontend stores token (localStorage/cookie)
```

---

## 🏗️ Architecture Overview

### Two Completely Different Auth Systems

```
┌─────────────────────────────────────────────────────────────┐
│ OUR AUTH SERVICE (this project)                             │
│                                                             │
│  SYSTEM #1: PORTAL AUTH                                    │
│  ├─ What: You (developer) login to OUR website            │
│  ├─ Data: Developer account, email, password              │
│  ├─ Where: /api/portal/auth/* routes                      │
│  ├─ JWT Secret: PORTAL_JWT_SECRET                         │
│  └─ Example: portal.your-auth-service.com                 │
│                                                             │
│  SYSTEM #2: SERVICE AUTH                                  │
│  ├─ What: End-users of YOUR app authenticate             │
│  ├─ Data: ServiceUser account, email, password           │
│  ├─ Where: /api/v1/auth/* routes                         │
│  ├─ JWT Secret: SERVICE_JWT_SECRET (DIFFERENT!)         │
│  └─ Example: Called by your app backend                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why TWO separate JWT secrets?**
- Security isolation: A developer cannot forge a token for end-users
- If they shared a secret, a hacker who stole the PORTAL secret could create fake end-user tokens
- Separate secrets = complete firewall between the two systems

---

## 📊 Database Schema — Understanding the Data

### Model 1: `Developer`
**Who:** A person who signs up on YOUR portal

```typescript
Developer {
  id: string              // Unique identifier (CUID: like UUID but shorter)
  email: string           // Their email (must be unique)
  name: string | null     // Optional display name
  passwordHash: string    // Never store plain passwords! Hash them with bcrypt
  createdAt: Date         // When they signed up
  updatedAt: Date         // When they last changed something

  // Relation: One Developer → Many Projects
  projects: Project[]
}
```

**In plain English:**
- This is YOU when you sign up to create auth projects
- Your password is never stored; only its hash is stored
- You can own multiple projects (e.g., "WebApp", "MobileApp", "AdminPanel")

---

### Model 2: `Project`
**What:** A developer's application that wants to use our auth service

```typescript
Project {
  id: string              // Unique project ID
  name: string            // e.g., "My SaaS App", "Mobile Game"
  developerId: string     // WHO owns this project (FK → Developer)
  apiKey: string          // Unique key for this project (starts with "ak_")
  createdAt: Date
  updatedAt: Date

  // Relations
  developer: Developer    // Which developer owns this
  serviceUsers: ServiceUser[]  // All end-users in this project
  otps: Otp[]            // All OTP codes for this project
}
```

**In plain English:**
- Each project is like a "tenant" or "workspace"
- Projects are ISOLATED from each other (Developer A's users never see Developer B's users)
- The `apiKey` is how your app backend proves it's allowed to call our API
- Think of it like a "namespace" or "database" that keeps data separate

---

### Model 3: `ServiceUser`
**Who:** An end-user of an app built by a developer (NOT us)

```typescript
ServiceUser {
  id: string              // Unique user ID
  projectId: string       // Which project this user belongs to (FK → Project)
  email: string           // User's email
  name: string | null     // Optional display name
  passwordHash: string    // Their password hash
  emailVerified: bool     // Has this email been verified yet?
  createdAt: Date
  updatedAt: Date

  // Relations
  project: Project        // Which project they belong to
  otps: Otp[]            // All OTP codes they've generated

  // Important constraint: Email must be unique WITHIN a project
  // BUT the same email can exist in different projects!
  @@unique([projectId, email])
}
```

**In plain English:**
- This is Alice, Bob, Charlie — users of YOUR app
- Each user belongs to exactly ONE project (scoped isolation)
- Alice's email (alice@example.com) can exist in Project A, Project B, etc. — they're different users
- We track if their email is verified (so they can't use an unverified email to login)

---

### Model 4: `Otp`
**What:** One-Time-Password (verification codes)

```typescript
Otp {
  id: string              // Unique OTP ID
  projectId: string       // Which project (FK → Project)
  userId: string          // Which user (FK → ServiceUser)
  code: string            // The 6-digit code (hashed with bcrypt)
  purpose: string         // "VERIFY_EMAIL", "PASSWORD_RESET", etc.
  expiresAt: Date         // When this code expires (usually 10 minutes)
  used: boolean           // Has this code been used already?
  createdAt: Date

  // Relations
  project: Project
  serviceUser: ServiceUser
}
```

**In plain English:**
- When a user registers, we send them a code to verify their email
- The code is hashed (never stored in plain text)
- Each code expires after 10 minutes
- Once used, it's marked as `used: true` so it can't be reused

**Why hash the code?**
- If someone hacks the database, they can't see the actual codes
- They can only verify against the hash (like passwords)

---

## 🔑 Core Concepts

### 1. Password Hashing (bcryptjs)

**What:** Converting plain text passwords into a one-way hash

**Function:** `hashPassword(plainPassword: string) → string`

```
Plain:  "myPassword123"
         ↓ (bcrypt with 10 salt rounds)
Hash:   "$2b$10$R9h7cIPz0gi.URNNGINW2OPST9EBtFmXKmmLN0ZyMJQ8 6h4V.VsK"
```

**Key Facts:**
- Hashing is ONE-WAY (you can't reverse it)
- Hashing the same password 1000 times produces different hashes (random salt)
- To verify: hash the plain password again and compare
- Always use bcrypt, never invent your own hashing!

**Where used:**
```typescript
// When developer signs up
const hash = await hashPassword(plainPassword);
await db.developer.create({ passwordHash: hash });

// When developer logs in
const isValid = await verifyPassword(plainPassword, developer.passwordHash);
```

---

### 2. JWT Tokens (JSON Web Tokens)

**What:** A secure way to say "this person is authenticated"

**Analogy:** Like a concert ticket
- Ticket says: "This person (ID: Alice) paid for access"
- Ticket has a signature so it can't be forged
- Ticket expires after the concert ends

**Structure:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJkZXZlbG9wZXJJZCI6IjEyMyIsImVtYWlsIjoiYWxpY2VAZ21haWwuY29tIiwiaWF0IjoxNjk5OTk5OTk5LCJleHAiOjE3MDAwMDAwMDB9.
signature_here

↓ Decodes to:
{
  "developerId": "123",
  "email": "alice@gmail.com",
  "iat": 1699999999,      // issued at
  "exp": 1700000000       // expires at
}
```

**Two types in this codebase:**

**Portal JWT** (for developers)
```typescript
{
  developerId: "abc123",
  email: "you@company.com",
  expiresIn: "24h"
}
```

**Service JWT** (for end-users)
```typescript
{
  serviceUserId: "xyz789",
  projectId: "proj456",
  email: "user@app.com",
  expiresIn: "24h"
}
```

**Creating a token:**
```typescript
const token = await createPortalToken({
  developerId: developer.id,
  email: developer.email,
});
// Returns: eyJhbGc...
```

**Verifying a token:**
```typescript
const payload = await verifyPortalToken(token);
// Returns: { developerId: "abc123", email: "you@company.com" }
// Or null if token is expired/invalid
```

---

### 3. API Keys (API Authentication)

**What:** A way for server-to-server communication

**Analogy:** Like an office key card
- Shows which office building (project) you belong to
- Can be reissued if lost
- Different from a password (not meant to be secret in the same way)

**Format:**
```
ak_a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5
│
└─ Prefix "ak_" makes it identifiable as an API key
   + 32 random hex characters (very hard to guess)
```

**How it's used:**
```javascript
// From your app's backend, when registering a user:
fetch("https://our-auth-service.com/api/v1/auth/register", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ak_a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "alice@example.com",
    password: "securePassword123",
    name: "Alice"
  })
});
```

**On our backend:**
```typescript
// Extract the key from the header
const apiKey = extractApiKey(request);  // "ak_a3f8b2c1..."

// Look it up in the database
const project = await db.project.findUnique({ where: { apiKey } });
// Returns: { id: "proj456", name: "My App", developerId: "dev123", ... }

// Now we know: "This request is from project 'My App'"
// So we create the user in that project's namespace
```

**Two ways to pass it:**
```
1. Authorization: Bearer ak_xxxxx       (OAuth2 standard)
2. X-API-Key: ak_xxxxx                  (simpler, custom header)
```

---

### 4. Rate Limiting (Anti-Brute-Force)

**What:** Limiting how many requests you can make in a time period

**Why?** Without it, attackers could try millions of passwords per second

**Configuration:**
```typescript
{
  auth: { maxRequests: 5, windowSeconds: 60 }  // Max 5 login attempts per minute
  otp: { maxRequests: 3, windowSeconds: 60 }   // Max 3 OTP sends per minute
  general: { maxRequests: 30, windowSeconds: 60 }  // 30 general requests per minute
}
```

**How it works (simplified):**
```typescript
Map store = {
  "192.168.1.1": { count: 3, lastReset: 1699999999 },
  "10.0.0.1": { count: 1, lastReset: 1700000000 },
}

// When "192.168.1.1" makes a request:
1. Look up their entry in the store
2. Check if window expired (60 seconds?): if yes, reset count to 1
3. Check if count < maxRequests (5): if yes, increment and allow
4. If not, return HTTP 429 (Too Many Requests)
```

**Example:**
```
Time: 0s   → Request 1 ✓ (count=1/5)
Time: 5s   → Request 2 ✓ (count=2/5)
Time: 10s  → Request 3 ✓ (count=3/5)
Time: 15s  → Request 4 ✓ (count=4/5)
Time: 20s  → Request 5 ✓ (count=5/5)
Time: 25s  → Request 6 ✗ (429 Too Many Requests, retry after 35s)
Time: 60s  → Window resets, counter goes back to 0
Time: 61s  → Request 7 ✓ (count=1/5, fresh window)
```

**Limitations (current implementation):**
- In-memory only (lost on server restart)
- Only works on single server (not distributed)
- IP-based (can be bypassed with VPNs)
- For production, use Redis or a dedicated service

---

## 📂 File Structure Explained

```
src/
├── app/                         # Next.js app router (all routes here)
│   ├── layout.tsx              # Root layout (like HTML wrapper)
│   ├── page.tsx                # Home page
│   ├── globals.css             # Global styles
│   │
│   └── api/                    # All backend routes start here
│       ├── portal/             # ← Developer portal routes
│       │   └── auth/
│       │       ├── login/route.ts      # Developer login
│       │       ├── logout/route.ts     # Developer logout
│       │       ├── register/route.ts   # Developer signup
│       │       ├── me/route.ts         # Get logged-in developer info
│       │       └── projects/route.ts   # List developer's projects
│       │
│       └── v1/                 # ← Service API (for other apps)
│           └── auth/
│               ├── login/route.ts         # End-user login
│               ├── logout/route.ts        # End-user logout
│               ├── register/route.ts      # End-user signup
│               ├── me/route.ts            # Get logged-in user info
│               └── otp/
│                   ├── send/route.ts      # Send OTP code
│                   └── verify/route.ts    # Verify OTP code
│
├── lib/                        # Shared utilities
│   ├── auth.ts                # JWT creation, password hashing
│   ├── api-key.ts             # API key generation & extraction
│   ├── rate-limit.ts          # Rate limiting logic
│   └── db.ts                  # Database connection
│
├── components/                # React components (all the UI)
│   └── ui/                    # Pre-built shadcn UI components
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ... (20+ more UI components)
│
└── hooks/                     # React hooks
    ├── use-toast.ts          # Toast notifications
    └── use-mobile.ts         # Detect if mobile device
```

---

## 🔄 API Routes Deep Dive

### Portal Routes (For Developers)

#### **POST /api/portal/auth/register** — Developer signs up

```
REQUEST:
POST /api/portal/auth/register
Content-Type: application/json

{
  "email": "you@company.com",
  "password": "securePassword123",
  "name": "Your Name"
}

BACKEND PROCESSING:
1. Validate email format (must be valid email)
2. Check if email already exists (must be unique)
3. Hash password with bcrypt (NEVER store plain password)
4. Create Developer record in database
5. Create Portal JWT token
6. Set token in cookie

RESPONSE (200):
{
  "id": "dev_abc123",
  "email": "you@company.com",
  "name": "Your Name",
  "token": "eyJhbGc...",  // Portal JWT
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Key Points:**
- Email must be unique across ALL developers
- Password must be ≥ 8 characters
- Password is hashed immediately, never stored plain
- Token is returned AND set as a cookie

---

#### **POST /api/portal/auth/login** — Developer logs in

```
REQUEST:
POST /api/portal/auth/login
Content-Type: application/json

{
  "email": "you@company.com",
  "password": "securePassword123"
}

BACKEND PROCESSING:
1. Find developer by email
2. If not found → return error (user doesn't exist)
3. Hash the provided password and compare to stored hash
4. If doesn't match → return error (wrong password)
5. Create new Portal JWT
6. Set token in cookie

RESPONSE (200):
{
  "id": "dev_abc123",
  "email": "you@company.com",
  "token": "eyJhbGc...",
  "createdAt": "2024-01-15T10:30:00Z"
}

RESPONSE (401 if wrong credentials):
{
  "error": "Invalid email or password"
}
```

---

#### **POST /api/portal/auth/logout** — Developer logs out

```
REQUEST:
POST /api/portal/auth/logout
Authorization: Bearer eyJhbGc...

BACKEND PROCESSING:
1. Verify the Portal JWT (check signature & expiration)
2. Clear the cookie
3. Optional: log this event

RESPONSE (200):
{
  "message": "Logged out successfully"
}
```

---

#### **GET /api/portal/auth/me** — Get logged-in developer info

```
REQUEST:
GET /api/portal/auth/me
Authorization: Bearer eyJhbGc...  // Portal JWT

BACKEND PROCESSING:
1. Extract JWT from header
2. Verify JWT signature
3. Get developerId from JWT payload
4. Fetch developer from database
5. Return developer info

RESPONSE (200):
{
  "id": "dev_abc123",
  "email": "you@company.com",
  "name": "Your Name",
  "createdAt": "2024-01-15T10:30:00Z"
}

RESPONSE (401 if no/invalid token):
{
  "error": "Unauthorized"
}
```

---

#### **GET /api/portal/projects** — List developer's projects

```
REQUEST:
GET /api/portal/projects
Authorization: Bearer eyJhbGc...

BACKEND PROCESSING:
1. Verify Portal JWT
2. Get developerId from JWT
3. Query database for all projects where developerId = this developer
4. For each project, count how many ServiceUsers exist
5. Return list with user counts

RESPONSE (200):
{
  "projects": [
    {
      "id": "proj_001",
      "name": "My SaaS App",
      "apiKey": "ak_a3f8b2c1...",
      "userCount": 42,
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "proj_002",
      "name": "Mobile Game",
      "apiKey": "ak_xyz789...",
      "userCount": 156,
      "createdAt": "2024-01-10T15:45:00Z"
    }
  ]
}
```

---

### Service Routes (For End-Users)

#### **POST /api/v1/auth/register** — End-user signs up

```
REQUEST (from YOUR app's backend):
POST /api/v1/auth/register
Authorization: Bearer ak_a3f8b2c1...  // API Key
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "userPassword123",
  "name": "Alice"
}

BACKEND PROCESSING:
1. Extract API key from header
2. Look up project by API key
   - If invalid → return 401 Unauthorized
3. Rate limit check (max 5 registrations per 60s per IP)
   - If exceeded → return 429 Too Many Requests
4. Validate email format
5. Check if email already exists IN THIS PROJECT
   - Same email can exist in other projects, but not this one
6. Hash password
7. Create ServiceUser in database
   - Important: serviceUser.projectId = project.id (scoped to this project)
8. Create Service JWT token
9. Optionally send verification email

RESPONSE (201):
{
  "id": "user_xyz123",
  "email": "alice@example.com",
  "name": "Alice",
  "token": "eyJhbGc...",  // Service JWT (different from Portal JWT!)
  "createdAt": "2024-01-15T10:30:00Z"
}

RESPONSE (401 if invalid API key):
{
  "error": "Invalid API key"
}

RESPONSE (429 if rate limited):
{
  "error": "Too many requests",
  "resetIn": 35
}

RESPONSE (409 if email exists):
{
  "error": "A user with this email already exists in this project"
}
```

**Key Differences from Portal Register:**
- Uses API key auth (not session cookie)
- Creates ServiceUser (not Developer)
- Scoped to a project (not global)
- Service JWT (not Portal JWT)
- Returns token in body (not cookie) — backend app decides where to store it

---

#### **POST /api/v1/auth/login** — End-user logs in

```
REQUEST:
POST /api/v1/auth/login
Authorization: Bearer ak_a3f8b2c1...
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "userPassword123"
}

BACKEND PROCESSING:
1. Extract & validate API key
2. Rate limit check
3. Find ServiceUser where projectId = project.id AND email = provided email
4. Hash provided password, compare with stored hash
5. If match → create Service JWT
6. If no match → return 401

RESPONSE (200):
{
  "id": "user_xyz123",
  "email": "alice@example.com",
  "token": "eyJhbGc...",  // Service JWT
  "emailVerified": false
}

RESPONSE (401):
{
  "error": "Invalid email or password"
}
```

---

#### **POST /api/v1/auth/otp/send** — Send verification code

```
REQUEST:
POST /api/v1/auth/otp/send
Authorization: Bearer ak_a3f8b2c1...
Content-Type: application/json

{
  "email": "alice@example.com",
  "purpose": "VERIFY_EMAIL"  // or "PASSWORD_RESET"
}

BACKEND PROCESSING:
1. Validate API key
2. Rate limit check (max 3 OTP sends per 60s)
3. Find ServiceUser
4. Generate random 6-digit code: "123456"
5. Hash the code with bcrypt
6. Create OTP record:
   {
     projectId: "proj_001",
     userId: "user_xyz123",
     code: "$2b$10$hashOfCode...",
     purpose: "VERIFY_EMAIL",
     expiresAt: now + 10 minutes,
     used: false
   }
7. Send code via email (e.g., "Your verification code is 123456")

RESPONSE (200):
{
  "message": "OTP sent to alice@example.com"
}
```

---

#### **POST /api/v1/auth/otp/verify** — Verify code

```
REQUEST:
POST /api/v1/auth/otp/verify
Authorization: Bearer ak_a3f8b2c1...
Content-Type: application/json

{
  "email": "alice@example.com",
  "code": "123456",
  "purpose": "VERIFY_EMAIL"
}

BACKEND PROCESSING:
1. Validate API key
2. Find ServiceUser
3. Find OTP record where:
   - projectId = project.id
   - userId = user.id
   - code matches (via bcrypt compare)
   - expiresAt > now (not expired)
   - used = false (not already used)
4. If found:
   - Mark OTP as used: otp.used = true
   - If purpose = "VERIFY_EMAIL": Mark user as verified
   - Create new Service JWT
   - Return success
5. If not found → return 401 Invalid code

RESPONSE (200):
{
  "message": "Email verified successfully",
  "token": "eyJhbGc...",  // New Service JWT with verified status
  "emailVerified": true
}

RESPONSE (401):
{
  "error": "Invalid or expired OTP code"
}

RESPONSE (429):
{
  "error": "Too many attempts"
}
```

---

## 🛡️ Security Concepts

### 1. Hashing vs Encryption

**Hashing (what we use for passwords):**
- One-way (can't reverse)
- Deterministic input → you hash the same password 1000 times, get different hashes
- Comparison is by hashing again and comparing
```
password: "abc123" → hash: "$2b$10$xyz..."
password: "abc123" → hash: "$2b$10$xyz..." (different, but verifies the same)
```

**Encryption (what we DON'T use):**
- Two-way (can decrypt)
- Same input → same output
```
plaintext: "secret" →[encrypt]→ ciphertext: "k3J9$mL#"
ciphertext: "k3J9$mL#" →[decrypt]→ plaintext: "secret"
```

**Why hashing for passwords?**
- If database is hacked, hackers get hashes, not passwords
- Hackers can't reverse the hash to get the plain password
- If user used same password on other sites, they're still safe

---

### 2. Salting (built into bcrypt)

**What:** Adding random data to password before hashing

```
Password: "password123"
Salt: "$2b$10$random_salt_here"

Combined: "$2b$10$random_salt_here" + "password123"
Hashed: "$2b$10$random_salt_herej4JjC2J6CJjC2J6CJjC2J6C..."
```

**Why?**
- Prevents "rainbow table" attacks (pre-computed hash lookup tables)
- Without salt, same password always hashes to same value
- With salt, same password hashes differently each time
- bcrypt does this automatically!

---

### 3. JWT Security

**What's inside a JWT:**
```
HEADER.PAYLOAD.SIGNATURE

HEADER:
{
  "alg": "HS256",    // Algorithm used to sign
  "typ": "JWT"
}

PAYLOAD:
{
  "developerId": "123",
  "email": "alice@gmail.com",
  "iat": 1699999999,  // issued at (unix timestamp)
  "exp": 1700086399   // expires at (24h later)
}

SIGNATURE:
HMACSHA256(
  base64(header) + "." + base64(payload),
  secret_key
)
```

**Why can't attackers forge JWTs?**
- They don't know the secret key
- If they modify the payload, signature becomes invalid
- Token verification checks: signature is valid AND token not expired

**Verification process:**
```
1. Split token by "."
2. Decode header & payload (base64)
3. Recompute signature using secret key
4. Compare computed signature with provided signature
5. If match AND not expired → valid token
6. If mismatch OR expired → invalid token
```

---

### 4. API Key vs JWT

**API Key:**
- For server-to-server authentication
- Sent on every request (like username)
- Identifies WHICH app is calling
- Can be rotated (new key issued, old key disabled)
- Can be public-facing (long and random makes it secure)

**JWT:**
- For user authentication
- Short-lived (24h in our case)
- Identifies WHO the user is
- Can't be rotated (new token needed)
- Self-contained (no server lookup needed to verify)

**When to use what:**
```
API Key: Your backend app calling our API
JWT: End-user interacting with your app (stored in cookie/localStorage)
```

---

## 💾 Database Concepts

### Prisma ORM

**What:** An ORM (Object-Relational Mapper) — a middleman between code and database

```typescript
// Without Prisma (raw SQL):
const result = await db.query(
  'SELECT * FROM Developer WHERE email = ?',
  [email]
);
const developer = result.rows[0];

// With Prisma (much cleaner):
const developer = await db.developer.findUnique({
  where: { email }
});
```

**Benefits:**
- Write JavaScript instead of SQL
- Automatic query optimization
- Type-safe (TypeScript knows what fields exist)
- Easy to change database (switch from SQLite to PostgreSQL in one line)

---

### Relations in Prisma

**One-to-Many:**
```typescript
model Developer {
  id: string
  projects: Project[]  // One developer has many projects
}

model Project {
  id: string
  developerId: string
  developer: Developer  // Many projects have one developer
}
```

**Querying with relations:**
```typescript
// Get a developer with ALL their projects
const developer = await db.developer.findUnique({
  where: { id: "dev_123" },
  include: { projects: true }
});
// developer = { id, email, name, projects: [...] }

// Get a project with its developer
const project = await db.project.findUnique({
  where: { id: "proj_001" },
  include: { developer: true }
});
// project = { id, name, developerId, developer: {...} }
```

---

### Composite Unique Constraint

```typescript
model ServiceUser {
  projectId: string
  email: string

  @@unique([projectId, email])  // COMPOSITE unique
}
```

**What:** Email must be unique WITHIN a project, but can repeat across projects

```
Project A:
  └─ alice@example.com ✓

Project B:
  └─ alice@example.com ✓ (allowed, different project)

Project A:
  └─ alice@example.com ✗ (duplicate email in same project)
```

---

## 🚀 Request/Response Flow

### Complete Flow: User Signup

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND (React/Vue/etc)                                    │
│                                                                 │
│   User clicks "Sign Up", enters:                              │
│   - email: "alice@example.com"                                │
│   - password: "securePass123"                                 │
│   - name: "Alice"                                             │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. FRONTEND sends request to BACKEND (YOUR backend)           │
│                                                                 │
│   POST /api/users/register                                    │
│   {                                                           │
│     "email": "alice@example.com",                             │
│     "password": "securePass123",                              │
│     "name": "Alice"                                           │
│   }                                                           │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. YOUR BACKEND makes request to OUR BACKEND                  │
│                                                                 │
│   POST https://our-auth-service.com/api/v1/auth/register     │
│   Headers: {                                                  │
│     "Authorization": "Bearer ak_a3f8b2c1...",              │
│     "Content-Type": "application/json"                      │
│   }                                                           │
│   Body: {                                                     │
│     "email": "alice@example.com",                             │
│     "password": "securePass123",                              │
│     "name": "Alice"                                           │
│   }                                                           │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. OUR BACKEND PROCESSES REQUEST                              │
│                                                                 │
│   a) Extract API key: "ak_a3f8b2c1..."                        │
│   b) Look up project in database:                             │
│      const project = await db.project.findUnique({           │
│        where: { apiKey: "ak_a3f8b2c1..." }                   │
│      })                                                        │
│      → project = { id: "proj_001", ... }                     │
│                                                                 │
│   c) Rate limit check:                                        │
│      checkRateLimit("v1:register:proj_001:192.168.1.1", ...)│
│      → allowed: true                                          │
│                                                                 │
│   d) Validate input:                                          │
│      - Valid email? ✓                                         │
│      - Password ≥ 8 chars? ✓                                  │
│      - Email unique in project? ✓                             │
│                                                                 │
│   e) Hash password:                                           │
│      const hash = await hashPassword("securePass123")        │
│      → "$2b$10$R9h7cIPz0gi.URNNGINW2OPST9EBtFmXKmmLN0ZyMJQ8"│
│                                                                 │
│   f) Create ServiceUser in database:                          │
│      const user = await db.serviceUser.create({              │
│        data: {                                                │
│          projectId: "proj_001",                               │
│          email: "alice@example.com",                          │
│          passwordHash: "$2b$10$R9h7cIPz0gi...",             │
│          name: "Alice"                                        │
│        }                                                       │
│      })                                                        │
│      → user = { id: "user_xyz123", ... }                     │
│                                                                 │
│   g) Create Service JWT:                                      │
│      const token = await createServiceToken({                │
│        serviceUserId: "user_xyz123",                          │
│        projectId: "proj_001",                                 │
│        email: "alice@example.com"                             │
│      })                                                        │
│      → token = "eyJhbGc.eyJzZXJ2aWNlVXNlc0lkIjoieH...="      │
│                                                                 │
│   h) Optional: Send verification email with OTP code         │
│      - Generate OTP: "123456"                                 │
│      - Hash it: "$2b$10/sQdC1..."                            │
│      - Save to database                                       │
│      - Send email: "Your verification code is 123456"       │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. OUR BACKEND RETURNS RESPONSE TO YOUR BACKEND                │
│                                                                 │
│   HTTP 201 Created                                            │
│   {                                                           │
│     "id": "user_xyz123",                                      │
│     "email": "alice@example.com",                             │
│     "name": "Alice",                                          │
│     "token": "eyJhbGc.eyJzZXJ2aWNlVXNlc0lkIjoieHl6MTIzIn0...",│
│     "createdAt": "2024-01-15T10:30:00Z"                      │
│   }                                                           │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. YOUR BACKEND stores the token and sends to FRONTEND        │
│                                                                 │
│   HTTP 201 Created                                            │
│   {                                                           │
│     "id": "user_xyz123",                                      │
│     "email": "alice@example.com",                             │
│     "token": "eyJhbGc.eyJzZXJ2aWNlVXNlc0lkIjoieHl6MTIzIn0...",│
│   }                                                           │
│                                                                 │
│   (Backend decides: Set-Cookie header? Return in body? Both?) │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. FRONTEND receives token                                    │
│                                                                 │
│   localStorage.setItem("token", token)                       │
│   // or                                                       │
│   // Browser automatically stores cookie if Set-Cookie sent  │
│                                                                 │
│   Redirect user to dashboard                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Common Patterns

### Pattern 1: Authentication Middleware

**Purpose:** Verify JWT before processing request

```typescript
// On the FRONTEND calling our API
async function makeAuthenticatedRequest(endpoint: string) {
  const token = localStorage.getItem("token");  // Get JWT
  
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`  // Include JWT
    }
  });
  
  if (response.status === 401) {
    // Token expired or invalid, redirect to login
    window.location.href = "/login";
  }
  
  return response.json();
}

// On OUR BACKEND
export async function verifyToken(token: string) {
  const payload = await verifyServiceToken(token);
  if (!payload) {
    return null;  // Invalid token
  }
  return payload;  // { serviceUserId, projectId, email }
}
```

---

### Pattern 2: Scoped Queries

**Purpose:** Always include projectId to prevent data leaks

```typescript
// ❌ WRONG (could expose other projects' data)
const users = await db.serviceUser.findMany({
  where: { email: "alice@example.com" }
});
// Returns: [Alice from Project A, Alice from Project B]

// ✓ CORRECT (scoped to project)
const users = await db.serviceUser.findMany({
  where: {
    projectId: "proj_001",
    email: "alice@example.com"
  }
});
// Returns: [Alice from Project A only]
```

---

### Pattern 3: Cascading Deletes

```typescript
model Project {
  id: string
  developer: Developer @relation(fields: [developerId], references: [id], onDelete: Cascade)
  serviceUsers: ServiceUser[] @relation(onDelete: Cascade)
  otps: Otp[] @relation(onDelete: Cascade)
}
```

**What happens when a Developer is deleted:**
```
Delete Developer
    ↓
Delete all their Projects (cascade)
    ↓
Delete all ServiceUsers in those projects (cascade)
    ↓
Delete all OTPs for those users (cascade)
```

**Why?**
- Prevents orphaned data in database
- GDPR compliance (delete user = delete all their data)

---

## 🎯 Key Takeaways

### For Frontend Developers Transitioning to Backend:

1. **Databases are just organized data**
   - Tables = JavaScript objects
   - Rows = instances of those objects
   - Prisma = JavaScript syntax for database queries

2. **Authentication has two layers**
   - Server identifies server (API key)
   - User identifies user (JWT)

3. **Never store plain text passwords**
   - Always hash with bcrypt
   - Verification by hashing again and comparing

4. **JWTs are like tamper-proof tickets**
   - Claim: "This is Alice"
   - Signature: "I signed this with my secret key"
   - Verification: "Let me check the signature"

5. **Multi-tenancy means data isolation**
   - Always include project/tenant ID in queries
   - Same email can exist in different projects
   - Database enforces isolation with unique constraints

6. **Rate limiting protects against abuse**
   - Count requests per key/IP
   - Reset counter after time window
   - Return 429 when exceeded

7. **Errors should be helpful but secure**
   - ✓ "Email already exists in this project"
   - ✗ "alice@gmail.com is already registered globally"

8. **Testing involves simulating requests**
   - Use Postman, curl, or fetch in browser console
   - Include headers (Authorization, API Key, etc.)
   - Check response status codes

---

## 🛠️ Next Steps to Practice

1. **Open Prisma Studio** to see the database visually
   ```bash
   bun prisma studio
   ```

2. **Use Postman or REST Client** to test API routes
   - Create a Developer account
   - Create a Project
   - Copy the API key
   - Test end-user signup with that API key

3. **Read one route at a time**
   - Start with `/api/portal/auth/register`
   - Understand: input validation → database create → token generation → response
   - Move to next route

4. **Trace a request end-to-end**
   - Frontend form → Your backend → Our backend → Database → Response chain
   - Write pseudocode for each step

5. **Practice writing similar code**
   - Create a password reset flow
   - Create a project deletion endpoint
   - Create a user role system

---

**Remember:** Backend is just frontend that works with data instead of DOM! Same JavaScript, different responsibilities.

