# Personal Group Coordinator (PGC)

A comprehensive group travel planning and management application that enables collaborative multi-destination trip experiences with advanced interactive mapping and location discovery capabilities.

## Overview

This application helps groups plan and coordinate travel together by providing:

- Interactive mapping with Google Maps API integration
- Multiple destination management
- Collaborative trip planning features
- Place discovery and information
- Activity scheduling and coordination
- Real-time communication between trip members

## Project Structure

### Frontend Components

All UI/UX related components are consolidated in `client/src/frontend.ts`. This file exports components that are focused on the user interface and experience aspects of the application, separating them from backend functionality.

Key component categories:
- UI Components (Shadcn components)
- Map-related UI (Map views, location search)
- Trip management UI
- Authentication UI
- Theme and display components
- Calendar and scheduling
- Travel features (Preferences, recommendations)
- Booking and reservations
- Collaboration features

### Backend Structure

The backend is built with Express and provides API endpoints for:
- Trip management
- User authentication
- Place data retrieval and storage
- Trip sharing and collaboration
- Travel recommendations

### Database Schema

The database schema is documented in `db/mongodb-schemas.json` and includes collections for:
- Users
- Trips
- Destinations
- Activities
- Accommodations
- Transportation
- Pinned Places
- Checklists
- Travel Guides
- Expenses
- Messages
- Polls
- Travel Preferences
- Notifications

## Key Features

### Interactive Mapping
- Location search with Google Places API
- Place details display (photos, reviews, ratings, hours, contact)
- Category and specific place filtering
- Custom markers for different types of places
- Side panel for detailed place information

### Trip Planning
- Multi-destination trip creation
- Timeline view of activities
- Accommodations and transportation booking management
- Expense tracking and splitting
- Collaborative checklists

### User Collaboration
- Trip sharing with multiple participants
- Real-time messaging
- Polls for group decisions
- Activity coordination

## Technical Stack

- Frontend: React with TypeScript
- Backend: Node.js/Express
- Database: MongoDB
- Map Integration: Google Maps API
- State Management: React Query
- Real-time Communication: WebSockets