# ConnectChain Backend Service

A secure, scalable, and high-performance **NestJS** and **TypeScript** backend service designed to power the ConnectChain ecosystem. The service handles user management, booking lifecycles, real-time live location tracking, hyperlocal search, notification updates, and multi-factor authentication, backed by **Supabase Auth** and **Supabase PostgreSQL**.

---

## 🌟 Core Architecture & Features

### 1. Robust Authentication & User Profiles
* **Supabase Integration**: Delegates core identity management to Supabase Auth while storing rich profiles (Households, Workers, Vendors) in local PostgreSQL tables.
* **Transactional Rollbacks**: Automatically deletes Auth accounts using admin operations if database profile insertion fails during registration, avoiding orphaned identities.
* **Dashboard Data**: Exposes dynamic, role-tailored dashboards (`GET /users/me/dashboard`) returning different payloads for Households, Workers, and Vendors.

### 2. Google Authenticator Multi-Factor Authentication (MFA)
* **TOTP / MFA Enrolling**: Allows users to enroll factors (`POST /auth/mfa/enroll`), providing a TOTP secret and setup URI compatible with Google Authenticator.
* **Assurance Level Guarding**: Upgrades authentication credentials from `aal1` (password-only) to `aal2` (MFA verified) after verifying TOTP codes.
* **Route Protection**: The custom `SupabaseAuthGuard` decodes JWT claims and enforces strict AAL2 requirements on standard endpoints once MFA is enabled.

### 3. Hyperlocal Services & Workers
* **Workers Directory**: Search, view, and query profiles of service providers (Plumbers, Electricians, Painters, Carpenters) and read customer ratings/reviews.
* **Haversine Geolocation Search**: Searches and filters worker profiles dynamically according to geographical distance, rates, skills, and ratings.
* **Database Seeder**: A seed endpoint to easily populate mock services, workers, and reviews for testing purposes.

### 4. Bookings Lifecycle & Notification Alerts
* **Lifecycle Transitions**: Supports complete booking workflows from creation (Pending), acceptance, completion, to cancellation.
* **Automated Notifications**: Automatically dispatches alerts to both parties upon booking updates.
* **Push Simulation**: Saves notifications to the DB (for in-app display) and logs mock push messages for devices.

### 5. Live Location Tracking (REST & WebSockets)
* **WebSockets Integration**: Implements a Socket.io gateway under `/tracking` namespace. Clients enter virtual rooms (`booking_<id>`) for secure, real-time tracking updates.
* **REST Fallbacks**: Exposes standard endpoints to post and retrieve location coordinates.

---

## 🛡️ Security Hardening (CIA Triad)

* **Confidentiality**: Enforced via JWT validation, role-based decorators (`@Roles()`), and strict user ID isolation in controller queries.
* **Integrity**: Strongly typed request validation (`class-validator` / `class-transformer` pipes) with whitelist sanitization, blocking injection and parameter tampering.
* **Availability**: Helmet headers (secure policies, frames, MIME sniff-prevention), rate limiting (REST endpoints throttled to 20 requests per minute per IP), and a stateless architecture that allows horizontal scaling.

---

## 🗺️ API Endpoints Directory

### Authentication & MFA
* `POST /auth/signup` - Register a Household, Worker, or Vendor.
* `POST /auth/login` - Authenticate users (returns session details or triggers MFA).
* `POST /auth/mfa/enroll` - Initiate MFA enrollment (requires authentication).
* `POST /auth/mfa/verify-enroll` - Complete MFA enrollment using TOTP code.
* `POST /auth/mfa/challenge` - Verify login MFA TOTP code using temporary token.
* `POST /auth/mfa/unenroll` - Disable MFA.

### User Profiles & Dashboards
* `GET /users/me` - Fetch authenticated profile details.
* `PATCH /users/me` - Update profile values (name, phone, businessName, skills).
* `PATCH /users/me/preferences` - Update application theme preferences (LIGHT / DARK).
* `GET /users/me/dashboard` - Retrieve dynamic dashboard overview.
* `DELETE /users/me` - Perform cascade account deletion.

### Catalog & Worker Search
* `GET /services` - List service catalog.
* `GET /services/search?q=...` - Search service catalog by text.
* `GET /workers/search` - Geolocated search for workers matching service category.
* `GET /workers/:id` - Fetch worker profile details and reviews.
* `POST /workers/seed` - Seed database with mock services, workers, and reviews.

### Bookings
* `POST /bookings` - Create a booking (Household only).
* `GET /bookings` - List bookings (supports filters `type=upcoming|completed|cancelled`).
* `PATCH /bookings/:id/accept` - Accept a booking (Worker only).
* `PATCH /bookings/:id/complete` - Complete a booking (Worker only).
* `PATCH /bookings/:id/cancel` - Cancel an active booking (Household/Worker).

### Tracking
* `POST /bookings/:id/location` - Update worker tracking coordinates (REST).
* `GET /bookings/:id/location` - Retrieve active tracking coordinates (REST).
* `WS Namespace: /tracking` - Real-time Socket.io gateway tracking broadcasts.

### Notifications
* `GET /notifications` - Fetch list of user notifications.
* `PATCH /notifications/:id/read` - Mark a notification as read.
* `POST /notifications/device-token` - Register a push token.

---

## 🛠️ Getting Started & Setup

### 1. Environment Config
Configure a `.env` file in the project root:
```env
PORT=3000
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_SECRET_KEY=your_supabase_service_role_key
SUPABASE_JWKS_URL=your_supabase_auth_jwks_url
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Seed Database
Start the application and invoke the seeder endpoint once to populate the database tables with mock data:
```bash
# Seed Command (via REST Client or Curl)
POST http://localhost:3000/workers/seed
```

### 4. Run Application
```bash
# Run in development mode
npm run start:dev

# Build for production
npm run build

# Run unit tests
npm run test
```

---

## 🧪 Testing HTTP Suites

The project includes test suite `.http` files inside the root directory, designed to work with REST Client extensions:
* **[auth-requests.http](file:///d:/ConnectChain_Back/nestjs-backend/auth-requests.http)**: Tests login, role-specific signups, and password policies.
* **[auth-mfa-requests.http](file:///d:/ConnectChain_Back/nestjs-backend/auth-mfa-requests.http)**: Handles the Google Authenticator MFA enrollment, challenge verification, and AAL enforcement flows.
* **[profile-requests.http](file:///d:/ConnectChain_Back/nestjs-backend/profile-requests.http)**: Validates theme preferences, updating profiles, and deleting accounts.
* **[dashboard-requests.http](file:///d:/ConnectChain_Back/nestjs-backend/dashboard-requests.http)**: Validates dashboards and catalog displays.
* **[bookings-lifecycle.http](file:///d:/ConnectChain_Back/nestjs-backend/bookings-lifecycle.http)**: Evaluates full booking workflows (creating, accepting, complete, cancel).
* **[search-requests.http](file:///d:/ConnectChain_Back/nestjs-backend/search-requests.http)**: Tests text-based service searching and geolocated worker matching.
* **[seed-and-profile.http](file:///d:/ConnectChain_Back/nestjs-backend/seed-and-profile.http)**: Exercises the seeding endpoint and fetches detailed worker profile metrics.
* **[tracking-requests.http](file:///d:/ConnectChain_Back/nestjs-backend/tracking-requests.http)**: Validates REST-based coordinates inputs and retrieves maps metadata.
* **[notifications-requests.http](file:///d:/ConnectChain_Back/nestjs-backend/notifications-requests.http)**: Exercises registering push tokens, listing user notification streams, and reading alerts.
