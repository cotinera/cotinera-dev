# Environment Variables Reference

## Required Environment Variables

### Database (REQUIRED)
```bash
DATABASE_URL=postgresql://user:password@host:5432/database
```
- **Purpose:** PostgreSQL database connection string
- **Used in:** `db/index.ts`, `drizzle.config.ts`
- **Format:** Standard PostgreSQL connection string
- **Example:** `postgresql://pgc_user:mypassword@localhost:5432/pgc_db`

### Session Management (REQUIRED)
```bash
SESSION_SECRET=your-random-secret-here
```
- **Purpose:** Session encryption and signing
- **Used in:** `server/auth.ts`
- **Generate:** `openssl rand -base64 32`
- **Fallback hierarchy:**
  1. `SESSION_SECRET` (recommended for all deployments)
  2. `REPL_ID` (auto-provided on Replit)
  3. Dev fallback (development only)
- **⚠️ IMPORTANT:** `SESSION_SECRET` is **REQUIRED** in production environments
- **Security:** Must be random, minimum 32 characters

### Google OAuth (REQUIRED)
```bash
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```
- **Purpose:** Google OAuth authentication for user login
- **Used in:** `server/auth.ts`, `server/google-calendar-sync.ts`
- **Get from:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

### Frontend Environment Variables (REQUIRED)
```bash
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```
- **Purpose:** Frontend Google OAuth and Maps integration
- **Used in:** 
  - `VITE_GOOGLE_CLIENT_ID`: `client/src/App.tsx`, `client/src/pages/trip-calendar.tsx`
  - `VITE_GOOGLE_MAPS_API_KEY`: Multiple map components
- **Note:** Must use `VITE_` prefix for Vite to expose to frontend
- **Get from:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

---

## Optional Environment Variables

### Email Notifications (OPTIONAL)
```bash
SENDGRID_API_KEY=your-sendgrid-api-key
```
- **Purpose:** Send trip invitation emails and reminders
- **Used in:** `server/utils/email.ts`, `server/routes.ts` (trip invitations)
- **Features enabled:** Email invitations to trip participants
- **Get from:** [SendGrid Dashboard](https://app.sendgrid.com/)
- **Note:** App works without this, but email invitations will be disabled

### AI Features (OPTIONAL)
```bash
OPENAI_API_KEY=your-openai-api-key
```
- **Purpose:** AI-powered event parsing and travel recommendations
- **Used in:** 
  - `server/routes/nlp.ts` (natural language event creation)
  - `server/routes/recommendations.ts` (travel recommendations)
  - `server/utils/openai.ts`
- **Features enabled:** 
  - Natural language event parsing ("Dinner tomorrow at 7pm" → calendar event)
  - AI travel recommendations based on preferences
- **Fallback:** Basic regex-based event parsing if not set
- **Get from:** [OpenAI Platform](https://platform.openai.com/api-keys)

### Flight Information (OPTIONAL)
```bash
AVIATION_STACK_API_KEY=your-aviationstack-api-key
```
- **Purpose:** Real-time flight information lookup
- **Used in:** `server/routes.ts` (`/api/flights/lookup`), `server/utils/flightApi.ts`
- **Features enabled:** Flight status, delays, and information lookup
- **Get from:** [AviationStack](https://aviationstack.com/)

### Application URL (RECOMMENDED)
```bash
BASE_URL=https://your-app-domain.com
```
- **Purpose:** OAuth callbacks, webhook URLs, and email links
- **Used in:** 
  - `server/google-calendar-sync.ts` (Google Calendar OAuth callbacks)
  - `server/routes.ts` (trip sharing links)
- **Fallback hierarchy:**
  1. `BASE_URL` (explicit, recommended)
  2. Replit auto-detection (`REPL_SLUG` + `REPLIT_CLUSTER`)
  3. `http://localhost:5000` (development only)
- **⚠️ HIGHLY RECOMMENDED:** Set explicitly for Cloud Run/Docker deployments
- **Example:** `https://pgc-app-xyz123-uc.a.run.app`
- **Why:** Ensures OAuth callbacks work correctly across all platforms

---

## Runtime Environment Variables

### Server Configuration
```bash
PORT=5000
NODE_ENV=production
```
- **PORT:** Auto-provided by Cloud Run, defaults to 5000
- **NODE_ENV:** Set by deployment environment (development/production)
- **Used in:** `server/index.ts`, `server/vite.ts`

### Replit-Specific (Auto-provided on Replit)
```bash
REPL_ID=auto-provided           # Fallback for SESSION_SECRET
REPL_SLUG=auto-provided         # Used for BASE_URL construction
REPLIT_CLUSTER=auto-provided    # Used for BASE_URL construction
```
- **Purpose:** Replit platform integration
- **Used in:** 
  - `REPL_ID`: Session secret fallback in `server/auth.ts`
  - `REPL_SLUG` + `REPLIT_CLUSTER`: BASE_URL fallback in `server/google-calendar-sync.ts`
- **Note:** Only available when running on Replit platform
- **⚠️ WARNING:** Not available in Docker/Cloud Run - set `SESSION_SECRET` and `BASE_URL` explicitly

---

## Environment Variable Summary by Feature

### Core Application (Must Have)
- ✅ `DATABASE_URL`
- ✅ `SESSION_SECRET` or `REPL_ID`
- ✅ `GOOGLE_CLIENT_ID`
- ✅ `GOOGLE_CLIENT_SECRET`
- ✅ `VITE_GOOGLE_CLIENT_ID`
- ✅ `VITE_GOOGLE_MAPS_API_KEY`

### Enhanced Features (Optional)
- 🔧 `SENDGRID_API_KEY` - Email invitations
- 🔧 `OPENAI_API_KEY` - AI event parsing & recommendations
- 🔧 `AVIATION_STACK_API_KEY` - Flight information

### Auto-Managed
- ⚙️ `PORT` - Server port (Cloud Run provides)
- ⚙️ `NODE_ENV` - Environment mode
- ⚙️ `BASE_URL` - App URL (auto-generated or manual)

---

## Setup Instructions

### Local Development (.env file)
```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/pgc_dev
SESSION_SECRET=your-local-session-secret
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_MAPS_API_KEY=your-maps-key

# Optional
SENDGRID_API_KEY=your-sendgrid-key
OPENAI_API_KEY=your-openai-key
AVIATION_STACK_API_KEY=your-aviation-key
```

### Cloud Run Deployment
Use Google Cloud Secret Manager:
```bash
# Create secrets
echo -n "value" | gcloud secrets create SECRET_NAME --data-file=-

# Deploy with secrets
gcloud run deploy SERVICE_NAME \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest,..." \
  --set-env-vars "VITE_GOOGLE_CLIENT_ID=value,VITE_GOOGLE_MAPS_API_KEY=value"
```

### Replit Deployment
Set in Replit Secrets panel:
- All non-VITE_ variables go in Secrets
- VITE_ variables can be in Secrets or .env (they're exposed to frontend anyway)

---

## Testing Without Optional Services

The application is designed to work with minimal configuration:

1. **Without SendGrid:** Trip invitations won't send emails, but in-app sharing still works
2. **Without OpenAI:** Event parsing uses fallback regex patterns, no AI recommendations
3. **Without AviationStack:** Flight lookup feature disabled

**Minimum viable setup:**
```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=random-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
```

This will give you:
- ✅ User authentication
- ✅ Trip creation and management
- ✅ Map integration with places
- ✅ Calendar with manual event creation
- ✅ Google Calendar sync
- ✅ Expense tracking
- ❌ Email invitations (in-app only)
- ❌ AI event parsing (manual entry only)
- ❌ Flight lookup
