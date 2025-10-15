# GitHub Actions CI/CD Setup Guide

This guide will help you configure GitHub Actions to automatically deploy your application to Google Cloud Run.

## Prerequisites

- Google Cloud Project: `core-guard-449421-v8`
- Cloud Run service in `us-west1` region
- Cloud SQL PostgreSQL instance connected
- Service account with appropriate permissions

## Required GitHub Secrets

You need to configure the following secrets in your GitHub repository:

### 1. Google Cloud Service Account Key

**Secret Name:** `GCP_SA_KEY`

**How to create:**
```bash
# Create a service account key
gcloud iam service-accounts keys create key.json \
  --iam-account=cotinera-dev-sa@core-guard-449421-v8.iam.gserviceaccount.com

# Copy the entire content of key.json
cat key.json
```

**Add to GitHub:**
1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `GCP_SA_KEY`
4. Value: Paste the entire JSON content from key.json
5. Click "Add secret"

**⚠️ Important:** Delete `key.json` after adding to GitHub:
```bash
rm key.json
```

### 2. Database URL

**Secret Name:** `DATABASE_URL` (in Google Secret Manager)

**Value:**
```
postgresql://postgres:cotineraofficialaccdev@/appdb?host=/cloudsql/core-guard-449421-v8:us-west1:cotinera-db-us-west-1
```

**Create in Secret Manager:**
```bash
echo -n "postgresql://postgres:cotineraofficialaccdev@/appdb?host=/cloudsql/core-guard-449421-v8:us-west1:cotinera-db-us-west-1" | \
  gcloud secrets create DATABASE_URL --data-file=-
```

### 3. Session Secret

**Secret Name:** `SESSION_SECRET` (in Google Secret Manager)

**Generate and create:**
```bash
# Generate random secret
SESSION_SECRET=$(openssl rand -base64 32)

# Create secret
echo -n "$SESSION_SECRET" | gcloud secrets create SESSION_SECRET --data-file=-
```

### 4. Google OAuth Credentials

**Secret Names (in Google Secret Manager):**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `VITE_GOOGLE_CLIENT_ID` (same as GOOGLE_CLIENT_ID)

**Create secrets:**
```bash
# Replace with your actual values
echo -n "YOUR_GOOGLE_CLIENT_ID" | gcloud secrets create GOOGLE_CLIENT_ID --data-file=-
echo -n "YOUR_GOOGLE_CLIENT_SECRET" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-
echo -n "YOUR_GOOGLE_CLIENT_ID" | gcloud secrets create VITE_GOOGLE_CLIENT_ID --data-file=-
```

### 5. Google Maps API Key

**Secret Name:** `VITE_GOOGLE_MAPS_API_KEY` (in Google Secret Manager)

```bash
echo -n "YOUR_GOOGLE_MAPS_API_KEY" | gcloud secrets create VITE_GOOGLE_MAPS_API_KEY --data-file=-
```

### 6. Base URL (GitHub Secret)

**Secret Name:** `BASE_URL`

**Value:** Your Cloud Run service URL (after first deployment):
```
https://pgc-app-xxxxx-uw.a.run.app
```

**Add to GitHub:**
1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `BASE_URL`
4. Value: Your Cloud Run URL
5. Click "Add secret"

### 7. Optional Secrets (in Google Secret Manager)

**SendGrid (Email Invitations):**
```bash
echo -n "YOUR_SENDGRID_API_KEY" | gcloud secrets create SENDGRID_API_KEY --data-file=-
```

**OpenAI (AI Features):**
```bash
echo -n "YOUR_OPENAI_API_KEY" | gcloud secrets create OPENAI_API_KEY --data-file=-
```

## Service Account Permissions

Ensure `cotinera-dev-sa@core-guard-449421-v8.iam.gserviceaccount.com` has these IAM roles:

```bash
# Cloud Run Admin
gcloud projects add-iam-policy-binding core-guard-449421-v8 \
  --member="serviceAccount:cotinera-dev-sa@core-guard-449421-v8.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Storage Admin (for Container Registry)
gcloud projects add-iam-policy-binding core-guard-449421-v8 \
  --member="serviceAccount:cotinera-dev-sa@core-guard-449421-v8.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Cloud SQL Client
gcloud projects add-iam-policy-binding core-guard-449421-v8 \
  --member="serviceAccount:cotinera-dev-sa@core-guard-449421-v8.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Secret Manager Accessor
gcloud projects add-iam-policy-binding core-guard-449421-v8 \
  --member="serviceAccount:cotinera-dev-sa@core-guard-449421-v8.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Service Account User (to deploy as the service account)
gcloud projects add-iam-policy-binding core-guard-449421-v8 \
  --member="serviceAccount:cotinera-dev-sa@core-guard-449421-v8.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

## Grant Secret Access to Cloud Run Service Account

The Cloud Run service needs to access the secrets:

```bash
# For each secret, grant access
for SECRET in DATABASE_URL SESSION_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET VITE_GOOGLE_CLIENT_ID VITE_GOOGLE_MAPS_API_KEY SENDGRID_API_KEY OPENAI_API_KEY; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:cotinera-dev-sa@core-guard-449421-v8.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" 2>/dev/null || echo "Secret $SECRET may not exist yet"
done
```

## OAuth Configuration

After first deployment, update Google OAuth settings:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Add Authorized Redirect URIs:
   ```
   https://YOUR_CLOUD_RUN_URL/api/auth/google/callback
   https://YOUR_CLOUD_RUN_URL/api/google/calendar/callback
   ```
4. Add Authorized JavaScript Origins:
   ```
   https://YOUR_CLOUD_RUN_URL
   ```

## Workflow Triggers

The workflow runs automatically on:
- Push to `main` branch
- Push to `production` branch
- Manual trigger (workflow_dispatch)

**Manual trigger:**
1. Go to Actions tab in GitHub
2. Select "Deploy to Google Cloud Run"
3. Click "Run workflow"
4. Select branch and click "Run workflow"

## First Deployment

For the first deployment, you may need to:

1. **Create secrets in Secret Manager first** (see commands above)

2. **Initial Cloud Run service deployment:**
   ```bash
   gcloud run deploy pgc-app \
     --image gcr.io/core-guard-449421-v8/pgc-app:latest \
     --region us-west1 \
     --platform managed \
     --allow-unauthenticated
   ```

3. **Get the service URL and add it to GitHub as `BASE_URL` secret**

4. **Update OAuth redirect URIs** with the Cloud Run URL

5. **Push to main branch to trigger automated deployment**

## Monitoring

### View Deployment Logs

1. Go to your repository → Actions tab
2. Click on the latest workflow run
3. Expand each step to see detailed logs

### View Cloud Run Logs

```bash
# Stream logs
gcloud run services logs tail pgc-app --region us-west1

# View recent logs
gcloud run services logs read pgc-app --region us-west1 --limit 50
```

### Check Service Status

```bash
# Get service details
gcloud run services describe pgc-app --region us-west1

# Get service URL
gcloud run services describe pgc-app --region us-west1 --format 'value(status.url)'
```

## Troubleshooting

### Build Fails

**Check Docker build:**
```bash
docker build -t test .
```

### Deployment Fails

**Check service account permissions:**
```bash
gcloud projects get-iam-policy core-guard-449421-v8 \
  --flatten="bindings[].members" \
  --filter="bindings.members:cotinera-dev-sa@core-guard-449421-v8.iam.gserviceaccount.com"
```

### Migration Fails

**Run migrations manually:**
```bash
# Start Cloud SQL Proxy
cloud-sql-proxy core-guard-449421-v8:us-west1:cotinera-db-us-west-1 --port 5432 &

# Set DATABASE_URL
export DATABASE_URL="postgresql://postgres:cotineraofficialaccdev@localhost:5432/appdb"

# Run migrations
npm run db:push
```

### Health Check Fails

**Test health endpoint:**
```bash
SERVICE_URL=$(gcloud run services describe pgc-app --region us-west1 --format 'value(status.url)')
curl -v $SERVICE_URL/api/health
```

## Security Best Practices

1. **Never commit secrets to Git**
   - Use Secret Manager for sensitive data
   - Use GitHub secrets for CI/CD credentials

2. **Rotate secrets regularly**
   ```bash
   # Update a secret
   echo -n "NEW_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=-
   ```

3. **Monitor access**
   ```bash
   # View secret access logs
   gcloud logging read "resource.type=secretmanager_secret"
   ```

4. **Use least privilege**
   - Service account has only necessary permissions
   - Secrets accessible only to authorized services

## Checklist

Before running the workflow:

- [ ] GCP_SA_KEY added to GitHub secrets
- [ ] All secrets created in Google Secret Manager
- [ ] BASE_URL added to GitHub secrets (after first deploy)
- [ ] Service account has all required IAM roles
- [ ] Service account has access to all secrets
- [ ] Cloud SQL instance is running
- [ ] OAuth redirect URIs configured
- [ ] Workflow file committed to repository

## Support

For issues:
1. Check GitHub Actions logs
2. Check Cloud Run logs: `gcloud run services logs tail pgc-app --region us-west1`
3. Verify secrets: `gcloud secrets list`
4. Check service health: `curl SERVICE_URL/api/health`
