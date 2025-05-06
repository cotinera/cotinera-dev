# Architecture Overview

## 1. Overview

The Personal Group Coordinator (PGC) is a comprehensive group travel planning and management application that enables collaborative multi-destination trip experiences with advanced interactive mapping and location discovery capabilities.

The application follows a modern full-stack JavaScript/TypeScript architecture with a clear separation between frontend and backend components. It uses React for the frontend UI, Express.js for the backend API server, and PostgreSQL for data persistence via Drizzle ORM.

Key features include:
- Interactive mapping with Google Maps API integration
- Multiple destination management
- Collaborative trip planning
- Place discovery and information
- Activity scheduling and coordination
- Real-time communication between trip members
- Budget tracking and expense management

## 2. System Architecture

### High-Level Architecture

The application follows a client-server architecture with the following components:

1. **Frontend**: React-based single-page application (SPA) using modern React patterns and libraries
2. **Backend**: Express.js server handling API requests, authentication, and business logic
3. **Database**: PostgreSQL database with Drizzle ORM for data persistence
4. **External Services**: Integration with Google Maps, SendGrid (email), and potentially OpenAI for recommendations
5. **WebSocket**: Real-time communication using Socket.IO

### Technology Stack

- **Frontend**:
  - React (with TypeScript)
  - TanStack Query (for data fetching and state management)
  - Tailwind CSS (for styling)
  - Shadcn UI components
  - React Hook Form (for form handling)
  - Wouter (for routing)

- **Backend**:
  - Express.js (Node.js framework)
  - Passport.js (for authentication)
  - Socket.IO (for real-time communication)
  - Multer (for file uploads)

- **Database**:
  - PostgreSQL
  - Drizzle ORM (for database access)

- **External Services**:
  - Google Maps API (for mapping and location services)
  - SendGrid (for email notifications)
  - OpenAI API (for travel recommendations)

## 3. Key Components

### Frontend Components

The frontend is organized around a feature-based structure, with components consolidated in `client/src/frontend.ts`. 

Key component categories include:

1. **UI Components**: Basic UI elements like buttons, inputs, cards, etc.
2. **Map Components**: 
   - `MapView`: Main map display component
   - `MapPicker`: Interactive map for location selection
   - `MapRouteView`: Displays routes between destinations
   - `LocationSearchBar`: Autocomplete location search

3. **Trip Components**:
   - `TripCard`: Display trip summary
   - `TripHeaderEdit`: Edit trip details
   - `TripDestinations`: Manage destinations for a trip
   - `TripTimeline`: Visual timeline of trip events

4. **Authentication Components**:
   - `LoginForm`
   - `RegisterForm`
   - `AuthLayout`

5. **Calendar and Scheduling**:
   - `CalendarView`: Trip calendar view

6. **Budget and Expenses**:
   - `BudgetTracker`: Track and manage trip expenses

7. **Communication**:
   - `ChatMessages`: Real-time messaging between trip members

8. **Accommodation and Travel**:
   - `AccommodationBookings`: Manage accommodation reservations
   - `FlightBookings`: Manage flight bookings

### Backend Components

The backend is structured as a RESTful API with the following key components:

1. **Authentication System** (`server/auth.ts`):
   - Local authentication strategy
   - Google OAuth integration
   - Session management

2. **API Routes** (`server/routes.ts`):
   - Trip management endpoints
   - User management endpoints
   - Destinations and activities endpoints
   - File upload handling

3. **WebSocket Server** (`server/utils/socket.ts`):
   - Real-time communication
   - Trip updates notification

4. **External Service Integrations**:
   - Email service (`server/utils/email.ts`)
   - Flight API integration (`server/utils/flightApi.ts`)
   - OpenAI integration for recommendations (`server/utils/openai.ts`)

### Database Schema

The database schema is implemented using Drizzle ORM with the following key entities:

1. **Users**: User accounts and preferences
2. **Trips**: Travel trip information
3. **Participants**: Trip members and their roles
4. **Destinations**: Locations within a trip
5. **Activities**: Scheduled activities during the trip
6. **Accommodations**: Lodging information
7. **Flights**: Flight booking information
8. **ChatMessages**: Trip communication
9. **Expenses**: Trip expenses with splitting capabilities
10. **CustomColumns**: User-defined data fields for trips
11. **PinnedPlaces**: Saved points of interest

## 4. Data Flow

### Authentication Flow

1. User submits credentials via login/register form
2. Backend validates credentials using Passport.js
3. On successful authentication, a session is created
4. Frontend stores user context and redirects to dashboard

### Trip Management Flow

1. User creates a trip with basic details
2. Trip is saved to the database with the user as owner
3. User can add destinations, activities, and invite other users
4. Real-time updates are pushed to all participants via WebSockets
5. Changes are persisted to the database

### Map Integration Flow

1. User searches for a location using `LocationSearchBar`
2. Google Places API provides autocomplete suggestions
3. Selected location is displayed on the map using Google Maps API
4. User can save locations as destinations or pinned places

### Collaborative Features Flow

1. Trip owner invites participants via email
2. Participants join the trip via email link
3. All participants can view and edit trip details based on permissions
4. Real-time updates are broadcast to all participants via WebSockets
5. Chat messages and polls enable group decision-making

## 5. External Dependencies

### Google Maps Integration

The application heavily integrates with Google Maps API for:
- Interactive maps (`@react-google-maps/api`)
- Place search and autocomplete
- Geocoding services
- Direction and route calculations

This integration enables the core mapping functionality, location discovery, and navigation planning.

### Email Notifications

SendGrid is used for sending email notifications such as:
- Trip invitations
- Updates and reminders
- Account notifications

### AI-Powered Recommendations

OpenAI integration provides personalized travel recommendations based on:
- User preferences
- Trip context
- Historical data

## 6. Deployment Strategy

The application is configured for deployment on platforms like Replit with the following strategy:

1. **Build Process**:
   - Frontend: Vite builds static assets
   - Backend: esbuild bundles server code

2. **Environment Configuration**:
   - Environment variables for sensitive data
   - Different configurations for development and production

3. **Database Management**:
   - Drizzle ORM for schema management
   - Schema migrations handled via `drizzle-kit`

4. **Runtime Environment**:
   - Node.js server running Express
   - Static assets served from the `dist/public` directory

The deployment configuration is defined in `.replit` with deployment targets and build/run commands for a cloud environment.

## 7. Security Considerations

1. **Authentication Security**:
   - Password hashing using scrypt with salt
   - CSRF protection
   - Session-based authentication

2. **API Security**:
   - Input validation
   - Authentication and authorization checks
   - Proper error handling

3. **Data Privacy**:
   - User data isolation
   - Permission-based access control
   - Share links with expiration dates