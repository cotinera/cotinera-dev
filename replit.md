# Personal Group Coordinator (PGC) - Replit.md

## Overview

Personal Group Coordinator (PGC) is a comprehensive group travel planning and management application that enables collaborative multi-destination trip experiences with advanced interactive mapping and location discovery capabilities. The application helps groups plan and coordinate travel together through interactive mapping, collaborative planning features, place discovery, activity scheduling, and real-time communication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a modern full-stack JavaScript/TypeScript architecture with clear separation between frontend and backend components:

- **Frontend**: React-based single-page application using modern React patterns with TypeScript
- **Backend**: Express.js server handling API requests, authentication, and business logic
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Real-time Communication**: Socket.IO for live updates and collaboration
- **External Services**: Google Maps API for mapping, SendGrid for email notifications

### Technology Stack

**Frontend:**
- React with TypeScript and Vite build tool
- TanStack Query for data fetching and state management
- Tailwind CSS for styling with Shadcn UI component library
- React Hook Form for form handling
- Wouter for client-side routing
- Google Maps API integration for interactive mapping

**Backend:**
- Express.js with TypeScript
- Passport.js for authentication (local and Google OAuth)
- Socket.IO for real-time features
- Multer for file upload handling
- Drizzle ORM with PostgreSQL database

## Key Components

### Frontend Architecture
The frontend consolidates UI/UX components in `client/src/frontend.ts`, separating interface concerns from backend functionality. Key component categories include:

- **UI Components**: Shadcn-based design system components
- **Map Components**: Interactive mapping with Google Maps integration
- **Trip Management**: Trip creation, editing, and collaboration features
- **Authentication**: Login/register forms and auth layouts
- **Calendar**: Scheduling and timeline views
- **Travel Features**: Preferences, recommendations, and booking management

### Backend Architecture
The backend provides RESTful API endpoints organized by functionality:

- **Trip Management**: CRUD operations for trips, destinations, and activities
- **User Authentication**: Local and OAuth-based authentication
- **Collaboration**: Real-time updates, chat, and sharing functionality
- **External Integrations**: Google Maps, flight data, and email services

### Database Schema
The PostgreSQL database includes comprehensive schemas for:

- **Core Entities**: Users, trips, destinations, activities
- **Collaboration**: Participants, chat messages, polls, sharing
- **Travel Data**: Accommodations, flights, expenses, pinned places
- **Customization**: Custom columns, user preferences, travel recommendations

## Data Flow

1. **Trip Creation**: Users create trips with destinations and invite participants
2. **Collaborative Planning**: Real-time updates through Socket.IO for shared planning
3. **Location Discovery**: Google Maps integration for place search and pinning
4. **Activity Scheduling**: Calendar-based event management with timezone support
5. **Expense Tracking**: Budget management and expense splitting among participants
6. **Communication**: Built-in chat with polls and file sharing capabilities

## External Dependencies

### Required APIs and Services
- **Google Maps API**: For interactive mapping, place search, and geocoding
- **SendGrid**: For email notifications and trip invitations
- **OpenAI API**: For travel recommendations and natural language processing

### Key Libraries
- **Authentication**: Passport.js with local and Google OAuth strategies
- **Database**: Drizzle ORM for type-safe PostgreSQL operations
- **Real-time**: Socket.IO for collaborative features
- **Frontend State**: TanStack Query for server state management
- **UI Framework**: Shadcn/UI with Radix UI primitives

## Deployment Strategy

The application is configured for Replit deployment with:

- **Development**: `npm run dev` using tsx for server and Vite for client
- **Build**: `npm run build` creating production bundles
- **Production**: `npm start` serving built application
- **Database**: Drizzle Kit for schema management and migrations

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: OAuth configuration
- `VITE_GOOGLE_MAPS_API_KEY`: Frontend Google Maps integration
- `SENDGRID_API_KEY`: Email service configuration
- `OPENAI_API_KEY`: AI recommendations (optional)

### File Structure
- `/client`: React frontend application
- `/server`: Express.js backend with API routes
- `/db`: Database schema and configuration
- `/migrations`: Database migration files
- Build outputs to `/dist` for production deployment

The application emphasizes collaborative travel planning with real-time features, comprehensive trip management, and intuitive user experience through modern web technologies.