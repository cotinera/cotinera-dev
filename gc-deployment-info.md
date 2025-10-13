# Google Cloud Run Deployment Guide
## Personal Group Coordinator (PGC) - Monolithic Containerized Deployment

---

## Application Architecture Overview

**Stack:** Full-stack TypeScript/JavaScript monolithic application  
**Runtime:** Node.js 20+  
**Build System:** Vite (frontend) + esbuild (backend)  
**Database:** PostgreSQL (external Cloud SQL or managed service)  
**Real-time:** Socket.IO WebSockets  
**Frontend:** React 18.3.1 with Vite  
**Backend:** Express.js serving API and static files  

---

## File Structure

```
.
├── client/                    # React frontend source
│   ├── src/
│   │   ├── components/       # UI components (auth, calendar, map, trips, shared, ui)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utilities, API wrappers, queryClient
│   │   ├── pages/           # Route pages
│   │   ├── App.tsx          # Main app component with routes
│   │   ├── main.tsx         # React entry point
│   │   └── index.css        # Global styles
│   └── index.html           # HTML template
├── server/                   # Express backend
│   ├── routes/              # Additional route modules
│   ├── utils/               # Backend utilities (email, socket, OpenAI)
│   ├── migrations/          # SQL migrations
│   ├── uploads/             # User uploads (ephemeral in container)
│   ├── auth.ts              # Passport.js authentication
│   ├── routes.ts            # Main API routes
│   ├── index.ts             # Express server entry
│   └── vite.ts              # Vite dev/prod setup
├── db/                       # Database layer
│   ├── schema.ts            # Drizzle ORM schema
│   └── index.ts             # DB connection
├── dist/                     # Build output (created during build)
│   ├── public/              # Vite build output
│   └── index.js             # Bundled server
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration
├── drizzle.config.ts        # Database ORM config
└── tsconfig.json            # TypeScript config
```

---

## Build Process

### Production Build Command
```bash
npm run build
```

**Build Steps:**
1. **Frontend Build:** `vite build` → outputs to `dist/public/`
   - Bundles React app with all assets
   - Handles TypeScript compilation
   - Optimizes and minifies code
   
2. **Backend Build:** `esbuild server/index.ts` → outputs to `dist/index.js`
   - Bundles Express server
   - External packages (dependencies from node_modules)
   - ESM format output

### Production Start Command
```bash
npm start
```
- Runs: `NODE_ENV=production node dist/index.js`
- Serves static files from `dist/public/`
- Runs Express API on port 5000

---

## Dockerfile

Create this `Dockerfile` in the project root:

```dockerfile
# Use Node.js 20 LTS
FROM node:20-slim

# Install system dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code
COPY . .

# Install dev dependencies temporarily for build
RUN npm install --only=development

# Build application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Create uploads directory
RUN mkdir -p server/uploads

# Expose port (Cloud Run uses PORT env var)
EXPOSE 5000

# Set environment
ENV NODE_ENV=production

# Health check (optional but recommended)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "start"]
```

### Optimized Multi-Stage Dockerfile (Smaller Image)

```dockerfile
# Build stage
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
COPY --from=builder /app/server/uploads ./server/uploads

EXPOSE 5000
ENV NODE_ENV=production

CMD ["npm", "start"]
```

---

## Environment Variables

> **📋 For detailed environment variable documentation, see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)**

### Required Variables (Core Functionality)

```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Session Secret (REQUIRED - generate with: openssl rand -base64 32)
SESSION_SECRET=your-random-secret-here

# Google OAuth Authentication (REQUIRED)
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Frontend Google Integration (REQUIRED - must use VITE_ prefix)
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Optional Variables (Enhanced Features)

```bash
# Email Invitations (OPTIONAL - app works without it)
SENDGRID_API_KEY=your-sendgrid-api-key

# AI Event Parsing & Recommendations (OPTIONAL - has fallback)
OPENAI_API_KEY=your-openai-api-key

# Flight Information Lookup (OPTIONAL)
AVIATION_STACK_API_KEY=your-aviationstack-api-key

# Application URL (OPTIONAL - auto-detected from headers)
BASE_URL=https://your-app.run.app
```

### Cloud Run Auto-Managed Variables

```bash
# Port (Cloud Run provides this automatically)
PORT=5000

# Node Environment
NODE_ENV=production

# Cloud Run service account for Cloud SQL
INSTANCE_CONNECTION_NAME=project:region:instance
```

### What Works Without Optional Variables

**Minimum setup (6 required variables):**
- ✅ User authentication (Google OAuth)
- ✅ Trip creation and management
- ✅ Interactive maps with Google Places
- ✅ Calendar with manual event creation
- ✅ Google Calendar sync
- ✅ Expense tracking
- ✅ Real-time collaboration

**Without optional variables:**
- ❌ Email invitations (in-app sharing still works)
- ❌ AI event parsing (manual date/time entry required)
- ❌ AI travel recommendations
- ❌ Flight status lookup

---

## Cloud SQL PostgreSQL Setup

### 1. Create Cloud SQL Instance

```bash
gcloud sql instances create pgc-postgres \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1
```

### 2. Create Database

```bash
gcloud sql databases create pgc_db \
  --instance=pgc-postgres
```

### 3. Create User

```bash
gcloud sql users create pgc_user \
  --instance=pgc-postgres \
  --password=YOUR_SECURE_PASSWORD
```

### 4. Get Connection String

```bash
# For Cloud Run (using Unix socket)
DATABASE_URL=postgresql://pgc_user:password@/pgc_db?host=/cloudsql/PROJECT_ID:REGION:pgc-postgres

# For external access (with Cloud SQL Proxy)
DATABASE_URL=postgresql://pgc_user:password@INSTANCE_IP:5432/pgc_db
```

---

## Deployment Steps

### 1. Install Google Cloud SDK

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize and authenticate
gcloud init
gcloud auth login
```

### 2. Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com
```

### 3. Set Project Variables

```bash
export PROJECT_ID=your-project-id
export REGION=us-central1
export SERVICE_NAME=pgc-app

gcloud config set project $PROJECT_ID
```

### 4. Store Secrets in Secret Manager

```bash
# REQUIRED SECRETS (Core functionality)
echo -n "your-database-url" | gcloud secrets create DATABASE_URL --data-file=-
echo -n "your-session-secret" | gcloud secrets create SESSION_SECRET --data-file=-
echo -n "your-google-client-id" | gcloud secrets create GOOGLE_CLIENT_ID --data-file=-
echo -n "your-google-client-secret" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-

# OPTIONAL SECRETS (Enhanced features - can skip if not using)
echo -n "your-sendgrid-key" | gcloud secrets create SENDGRID_API_KEY --data-file=-
echo -n "your-openai-key" | gcloud secrets create OPENAI_API_KEY --data-file=-
echo -n "your-aviationstack-key" | gcloud secrets create AVIATION_STACK_API_KEY --data-file=-
```

**Note:** `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_MAPS_API_KEY` must be set as environment variables (not secrets) since they're exposed to the frontend.

### 5. Build Container Image

```bash
# Using Cloud Build (recommended)
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Or using Docker locally
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME .
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME
```

### 6. Deploy to Cloud Run

#### Minimum Deployment (Required Secrets Only)

```bash
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 5000 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "NODE_ENV=production,VITE_GOOGLE_CLIENT_ID=your-google-client-id,VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest"
```

#### Full Deployment (With Optional Features)

```bash
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 5000 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 1 \
  --set-env-vars "NODE_ENV=production,VITE_GOOGLE_CLIENT_ID=your-google-client-id,VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,SENDGRID_API_KEY=SENDGRID_API_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,AVIATION_STACK_API_KEY=AVIATION_STACK_API_KEY:latest"
```

#### With Cloud SQL Connection

```bash
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 5000 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 1 \
  --add-cloudsql-instances PROJECT_ID:REGION:pgc-postgres \
  --set-env-vars "NODE_ENV=production,VITE_GOOGLE_CLIENT_ID=your-google-client-id,VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,SENDGRID_API_KEY=SENDGRID_API_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,AVIATION_STACK_API_KEY=AVIATION_STACK_API_KEY:latest"
```

### 7. Run Database Migrations

```bash
# Connect to Cloud SQL and run migrations
gcloud sql connect pgc-postgres --user=pgc_user

# Or use npm script locally with Cloud SQL Proxy
npm run db:push
```

### 8. Verify Deployment

```bash
# Get service URL
gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'

# Test the deployment
curl https://your-service-url.run.app/api/health
```

---

## WebSocket (Socket.IO) Configuration

Cloud Run supports WebSockets with HTTP/2. Ensure:

1. **Timeout Configuration:** Set appropriate timeouts (300s recommended)
2. **Connection Upgrade:** Server handles WebSocket upgrade properly (already configured in `server/index.ts`)
3. **Client Configuration:** Socket.IO client uses polling fallback

**In `server/utils/socket.ts`:**
```typescript
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'], // Fallback to polling
  pingTimeout: 60000,
  pingInterval: 25000
});
```

---

## CI/CD with Cloud Build

Create `cloudbuild.yaml`:

```yaml
steps:
  # Build container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/pgc-app:$COMMIT_SHA', '.']
  
  # Push image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/pgc-app:$COMMIT_SHA']
  
  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'pgc-app'
      - '--image=gcr.io/$PROJECT_ID/pgc-app:$COMMIT_SHA'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'

images:
  - 'gcr.io/$PROJECT_ID/pgc-app:$COMMIT_SHA'
```

**Trigger on Git Push:**
```bash
gcloud builds triggers create github \
  --repo-name=your-repo \
  --repo-owner=your-username \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

---

## Resource Configuration

### Recommended Settings

| Resource | Development | Production |
|----------|-------------|------------|
| Memory | 512Mi | 1Gi - 2Gi |
| CPU | 1 | 1 - 2 |
| Min Instances | 0 | 1 |
| Max Instances | 10 | 100 |
| Request Timeout | 60s | 300s |
| Concurrency | 80 | 80 |

### Scaling Configuration

```bash
gcloud run services update $SERVICE_NAME \
  --min-instances=1 \
  --max-instances=50 \
  --concurrency=80 \
  --cpu-throttling \
  --region=$REGION
```

---

## Custom Domain Setup

### 1. Map Custom Domain

```bash
gcloud run domain-mappings create \
  --service $SERVICE_NAME \
  --domain your-domain.com \
  --region $REGION
```

### 2. Verify Domain Ownership

Follow Google's domain verification process.

### 3. Update DNS Records

Add the DNS records provided by Cloud Run to your domain registrar.

### 4. Update OAuth Redirects

Update Google OAuth authorized redirect URIs:
- `https://your-domain.com/api/auth/google/callback`

---

## Monitoring & Logging

### View Logs

```bash
# Real-time logs
gcloud run services logs tail $SERVICE_NAME --region=$REGION

# Filter logs
gcloud run services logs read $SERVICE_NAME \
  --region=$REGION \
  --filter="severity>=ERROR" \
  --limit=50
```

### Set Up Alerts

```bash
# CPU utilization alert
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High CPU Alert" \
  --condition-display-name="CPU > 80%" \
  --condition-threshold-value=0.8 \
  --condition-threshold-duration=300s
```

---

## File Upload Considerations

**Current Setup:** Uploads go to `server/uploads/` (ephemeral in container)

**Production Recommendations:**

1. **Use Cloud Storage:**
   - Install: `npm install @google-cloud/storage`
   - Configure bucket for persistent storage
   - Update upload handlers to use GCS

2. **Use Replit Object Storage:**
   - If keeping Replit as primary platform
   - Already configured in integrations

---

## Health Check Endpoint

Add to `server/routes.ts`:

```typescript
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});
```

---

## Troubleshooting

### Common Issues

1. **Database Connection Fails**
   - Check Cloud SQL instance is running
   - Verify connection string format
   - Ensure Cloud SQL instance is added to service

2. **Environment Variables Not Loading**
   - Verify secrets exist: `gcloud secrets list`
   - Check service account has Secret Manager access
   - Use `--set-secrets` not `--set-env-vars` for sensitive data

3. **WebSocket Connection Fails**
   - Increase timeout: `--timeout=300`
   - Check client transports include 'polling'
   - Verify CORS configuration

4. **Build Fails**
   - Check Dockerfile syntax
   - Verify all dependencies in package.json
   - Review build logs: `gcloud builds log --stream`

5. **High Memory Usage**
   - Increase memory: `--memory=2Gi`
   - Check for memory leaks in Socket.IO connections
   - Review query optimizations

---

## Production Checklist

### Pre-Deployment
- [ ] All required environment variables configured (DATABASE_URL, SESSION_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_MAPS_API_KEY)
- [ ] Optional secrets created if using features (SENDGRID_API_KEY, OPENAI_API_KEY, AVIATION_STACK_API_KEY)
- [ ] Cloud SQL instance created and accessible
- [ ] Database migrations run successfully (`npm run db:push`)

### OAuth Configuration
- [ ] Google OAuth redirect URIs updated in Google Cloud Console:
  - `https://your-app.run.app/api/auth/google/callback`
  - `https://your-custom-domain.com/api/auth/google/callback` (if using custom domain)
- [ ] Authorized JavaScript origins added:
  - `https://your-app.run.app`
  - `https://your-custom-domain.com` (if using custom domain)
- [ ] Test OAuth login flow after deployment

### Infrastructure
- [ ] Custom domain mapped and DNS configured (if applicable)
- [ ] Health check endpoint responding (`/api/health`)
- [ ] Monitoring and alerting configured
- [ ] Error logging and tracking set up
- [ ] File uploads configured for Cloud Storage (if needed for persistence)
- [ ] Min instances set to 1 for reduced cold starts
- [ ] HTTPS enforced (automatic with Cloud Run)
- [ ] Rate limiting configured (if needed)
- [ ] Backup strategy for database in place

### Post-Deployment Validation
- [ ] Verify all core features work (auth, maps, calendar, trips)
- [ ] Test WebSocket connections (real-time updates)
- [ ] Confirm email invitations work (if SendGrid configured)
- [ ] Validate AI features (if OpenAI configured)
- [ ] Check browser console for errors
- [ ] Monitor initial traffic and performance

---

## Quick Commands Reference

```bash
# Deploy new version
npm run build
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME
gcloud run deploy $SERVICE_NAME --image gcr.io/$PROJECT_ID/$SERVICE_NAME --region=$REGION

# View logs
gcloud run services logs tail $SERVICE_NAME --region=$REGION

# Update environment variable
gcloud run services update $SERVICE_NAME --set-env-vars KEY=VALUE --region=$REGION

# Update secret
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Scale service
gcloud run services update $SERVICE_NAME --min-instances=2 --max-instances=100 --region=$REGION

# Delete service
gcloud run services delete $SERVICE_NAME --region=$REGION
```

---

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Socket.IO on Cloud Run](https://cloud.google.com/run/docs/triggering/websockets)

---

**Last Updated:** October 2025  
**Version:** 1.0  
**Deployment Type:** Monolithic Container
