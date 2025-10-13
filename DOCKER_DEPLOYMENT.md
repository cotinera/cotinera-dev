# Docker Deployment Guide

## Quick Start

### Prerequisites
- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose installed (included with Docker Desktop)
- PostgreSQL database accessible from Docker (local or remote)

### 1. Setup Environment Variables

Copy the example environment file:
```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker` with your values:
```bash
# Required
DATABASE_URL=postgresql://user:password@host:5432/database
SESSION_SECRET=$(openssl rand -base64 32)  # Generate random secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Optional (uncomment to enable)
# SENDGRID_API_KEY=your-sendgrid-api-key
# OPENAI_API_KEY=your-openai-api-key
# AVIATION_STACK_API_KEY=your-aviationstack-api-key
```

**Also update `docker-compose.yml`** with your frontend env vars:
```yaml
environment:
  - VITE_GOOGLE_CLIENT_ID=your-actual-client-id
  - VITE_GOOGLE_MAPS_API_KEY=your-actual-maps-key
```

### 2. Build and Run

**Using Docker Compose (Recommended):**
```bash
docker-compose up -d
```

**Using Docker directly:**
```bash
# Build image
docker build -t pgc-app:latest .

# Run container
docker run -d \
  --name pgc-app \
  --env-file .env.docker \
  -e VITE_GOOGLE_CLIENT_ID=your-client-id \
  -e VITE_GOOGLE_MAPS_API_KEY=your-maps-key \
  -p 5000:5000 \
  pgc-app:latest
```

### 3. Verify Deployment

```bash
# Check container status
docker ps

# View logs
docker logs pgc-app

# Test health endpoint
curl http://localhost:5000/api/health
```

Access the app at: **http://localhost:5000**

---

## Database Setup

### Option 1: Local PostgreSQL in Docker

Add to `docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:15
    container_name: pgc-postgres
    environment:
      POSTGRES_USER: pgc_user
      POSTGRES_PASSWORD: pgc_password
      POSTGRES_DB: pgc_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - pgc-network

  app:
    depends_on:
      - postgres
    environment:
      - DATABASE_URL=postgresql://pgc_user:pgc_password@postgres:5432/pgc_db
    # ... rest of app config

volumes:
  postgres_data:
```

### Option 2: External Database

Use your existing PostgreSQL (Cloud SQL, RDS, etc.):
```bash
DATABASE_URL=postgresql://user:pass@your-db-host:5432/database
```

### Run Migrations

After container is running:
```bash
# Using docker exec
docker exec -it pgc-app npm run db:push

# Or from host (if you have npm)
npm run db:push
```

---

## Management Commands

### View Logs
```bash
# Real-time logs
docker logs -f pgc-app

# Last 100 lines
docker logs --tail 100 pgc-app
```

### Restart Container
```bash
docker restart pgc-app

# Or with compose
docker-compose restart
```

### Stop Container
```bash
docker stop pgc-app

# Or with compose
docker-compose down
```

### Rebuild After Code Changes
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Access Container Shell
```bash
docker exec -it pgc-app sh
```

---

## Environment Variables Reference

### Required (6 variables)
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth secret
- `VITE_GOOGLE_CLIENT_ID` - Frontend OAuth client ID
- `VITE_GOOGLE_MAPS_API_KEY` - Frontend Maps API key

### Optional (Enhanced Features)
- `SENDGRID_API_KEY` - Email invitations
- `OPENAI_API_KEY` - AI event parsing
- `AVIATION_STACK_API_KEY` - Flight lookup
- `BASE_URL` - App URL (auto-detected if not set)

**See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) for full documentation.**

---

## Production Deployment

### Build for Production
```bash
# Build with version tag
docker build -t pgc-app:1.0.0 .
docker tag pgc-app:1.0.0 pgc-app:latest
```

### Push to Registry
```bash
# Docker Hub
docker tag pgc-app:latest username/pgc-app:latest
docker push username/pgc-app:latest

# Google Container Registry
docker tag pgc-app:latest gcr.io/PROJECT_ID/pgc-app:latest
docker push gcr.io/PROJECT_ID/pgc-app:latest
```

### Deploy to Cloud Run
See [gc-deployment-info.md](gc-deployment-info.md) for Cloud Run deployment using this Dockerfile.

---

## Troubleshooting

### Container Won't Start
```bash
# Check logs for errors
docker logs pgc-app

# Verify environment variables
docker exec pgc-app env | grep -E 'DATABASE_URL|GOOGLE'
```

### Database Connection Fails
```bash
# Test database connectivity from container
docker exec pgc-app sh -c "node -e \"require('pg').Client({connectionString: process.env.DATABASE_URL}).connect().then(() => console.log('OK')).catch(e => console.error(e))\""
```

### Port Already in Use
```bash
# Use different port
docker run -p 8080:5000 pgc-app:latest
```

### Build Fails
```bash
# Clean build with no cache
docker build --no-cache -t pgc-app:latest .

# Check disk space
docker system df
docker system prune
```

---

## Security Best Practices

1. **Never commit `.env.docker`** - Add to `.gitignore`
2. **Use Docker secrets** for production:
   ```bash
   echo "my-secret" | docker secret create db_password -
   ```
3. **Run as non-root** - Already configured in Dockerfile
4. **Keep images updated**:
   ```bash
   docker pull node:20-slim
   docker-compose build --pull
   ```
5. **Scan for vulnerabilities**:
   ```bash
   docker scan pgc-app:latest
   ```

---

## Performance Optimization

### Multi-stage Build Benefits
- **Smaller image:** ~200MB vs ~800MB
- **Faster deploys:** Less data to transfer
- **More secure:** No dev dependencies in production

### Resource Limits
```yaml
# In docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

---

## Next Steps

1. ✅ Environment variables configured
2. ✅ Container built and running
3. ✅ Database migrations applied
4. 🔄 OAuth callbacks updated
5. 🔄 Deploy to production (Cloud Run)

**For Cloud Run deployment, see [gc-deployment-info.md](gc-deployment-info.md)**
