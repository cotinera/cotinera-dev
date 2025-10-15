# Personal Group Coordinator (PGC)

A comprehensive group travel planning and management application that enables collaborative multi-destination trip experiences with advanced interactive mapping, Google Calendar synchronization, and real-time collaboration.

## ✨ Features

### 🗺️ Interactive Mapping
- **3-Pane Layout** with search results, interactive map, and place details
- Google Maps integration with place search and discovery
- Category filtering and custom markers
- Real-time map viewport filtering
- Pin locations for trip planning

### 📅 Advanced Calendar System
- **Drag-to-create** events with intuitive rectangular selection
- **Two-way Google Calendar sync** with automatic synchronization
- Real-time updates across platforms
- Multiple timezone support with proper UTC handling
- Notion Calendar-like experience

### 🤝 Collaborative Planning
- Multi-user trip coordination
- Real-time chat and messaging
- Group polls and voting
- Shared activity scheduling
- Expense tracking and splitting

### ✈️ Trip Management
- Multi-destination trip planning
- Accommodations and transportation booking
- Activity timeline and coordination
- Budget management
- Travel recommendations with AI

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ installed
- PostgreSQL database
- Google OAuth credentials
- Google Maps API key

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd pgc
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Setup database**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   Navigate to `http://localhost:5000`

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
# 1. Setup environment
cp .env.docker.example .env.docker
# Edit .env.docker with your values

# 2. Build and run
docker-compose up -d

# 3. View logs
docker logs pgc-app
```

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for complete Docker guide.

### Using Dockerfile Directly

```bash
docker build -t pgc-app .
docker run -d \
  --env-file .env.docker \
  -p 5000:5000 \
  pgc-app
```

## ☁️ Cloud Deployment

### Google Cloud Run

```bash
# Build and deploy
gcloud run deploy pgc-app \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

See [gc-deployment-info.md](gc-deployment-info.md) for complete Cloud Run deployment guide.

### Other Platforms

The Docker image works on any container platform:
- AWS ECS / Fargate
- Azure Container Instances
- DigitalOcean App Platform
- Heroku Container Registry

## 🔧 Technology Stack

### Frontend
- **React** with TypeScript and Vite
- **TanStack Query** for data fetching and state management
- **Tailwind CSS** with Shadcn UI components
- **React Hook Form** for form handling
- **Wouter** for client-side routing
- **Google Maps API** for interactive mapping
- **Socket.IO** for real-time features

### Backend
- **Express.js** with TypeScript
- **Passport.js** for authentication (Local & Google OAuth)
- **Drizzle ORM** with PostgreSQL
- **Socket.IO** for real-time communication
- **Multer** for file uploads

### External Services
- **Google Maps API** - Mapping and place search
- **Google Calendar API** - Two-way calendar sync
- **SendGrid** - Email invitations (optional)
- **OpenAI** - AI recommendations (optional)

## 📁 Project Structure

```
pgc/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Route pages
│   │   ├── lib/         # Utilities
│   │   └── App.tsx      # Main app component
├── server/              # Express backend
│   ├── routes.ts        # API routes
│   ├── index.ts         # Server entry
│   └── utils/           # Backend utilities
├── db/                  # Database
│   ├── schema.ts        # Drizzle schema
│   └── index.ts         # Database connection
├── Dockerfile           # Docker image
├── docker-compose.yml   # Docker Compose config
└── package.json         # Dependencies
```

## 🔐 Environment Variables

### Required (6 variables)
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth secret
- `VITE_GOOGLE_CLIENT_ID` - Frontend OAuth client ID
- `VITE_GOOGLE_MAPS_API_KEY` - Frontend Maps API key

### Optional (Enhanced Features)
- `SENDGRID_API_KEY` - Email invitations
- `OPENAI_API_KEY` - AI event parsing & recommendations
- `AVIATION_STACK_API_KEY` - Flight information lookup

See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) for complete documentation.

## 📚 Key Documentation

- **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** - Complete Docker deployment guide
- **[gc-deployment-info.md](gc-deployment-info.md)** - Cloud Run deployment guide
- **[ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)** - Environment variable reference
- **[replit.md](replit.md)** - Architecture and technical details

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm start               # Run production build

# Database
npm run db:push         # Sync schema to database
npm run db:studio       # Open Drizzle Studio
npm run db:push --force # Force sync if issues

# Docker
docker-compose up -d    # Start containers
docker-compose down     # Stop containers
docker logs pgc-app     # View logs
```

## 🎯 Key Features Implementation

### Map View (3-Pane Layout)
- **Left Panel (380px)**: Search results with filters and category pills
- **Center Panel (flex)**: Interactive Google Map with markers
- **Right Panel (380px)**: Place details sidebar (conditional)
- Responsive grid with map viewport filtering toggle

### Calendar System
- Drag-to-create events with clean rectangular selection UI
- Two-way Google Calendar sync with automatic synchronization
- Real-time sync when events created/updated/deleted
- Multiple timezone support with proper UTC date handling

### Real-time Collaboration
- Socket.IO for live updates
- Shared trip planning
- Group chat and messaging
- Collaborative decision making with polls

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues, questions, or contributions, please:
- Open an issue on GitHub
- Check existing documentation
- Review deployment guides for platform-specific help

---

**Built with ❤️ for collaborative travel planning**
