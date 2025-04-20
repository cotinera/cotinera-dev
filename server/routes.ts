import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { crypto } from "./auth.js";
import express from "express";
import { setupAuth } from "./auth";
import { db } from "@db";
import { trips, participants, activities, checklist, documents, shareLinks, flights, accommodations, chatMessages, users, destinations, pinnedPlaces, polls, pollVotes, expenses, expenseSplits, tripIdeas, notifications } from "@db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { addDays } from "date-fns";

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only images are allowed'));
      return;
    }
    cb(null, true);
  }
});

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // TEST ONLY: Create test user endpoint
  app.all("/api/test/create-user", async (req, res) => {
    try {
      const { eq } = await import('drizzle-orm');

      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, "test@example.com")).limit(1);

      if (existingUser.length > 0) {
        return res.json(existingUser[0]);
      }

      const hashedPassword = await crypto.hash("password123");
      const [user] = await db.insert(users).values({
        email: "test@example.com",
        name: "Test User",
        password: hashedPassword
      }).returning();

      res.json(user);
    } catch (error) {
      console.error('Test user creation error:', error);
      res.status(500).json({ error: "Failed to create test user: " + error.message });
    }
  });

  // Get single trip
  app.get("/api/trips/:id", async (req, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);

      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const [tripParticipants, tripActivities, tripFlights, tripAccommodations, tripChecklistItems] = await Promise.all([
        db.select().from(participants).where(eq(participants.tripId, tripId)),
        db.select().from(activities).where(eq(activities.tripId, tripId)),
        db.select().from(flights).where(eq(flights.tripId, tripId)),
        db.select().from(accommodations).where(eq(accommodations.tripId, tripId)),
        db.select().from(checklist).where(eq(checklist.tripId, tripId))
      ]);

      const tripWithDetails = {
        ...trip,
        participants: tripParticipants,
        activities: tripActivities,
        flights: tripFlights,
        accommodations: tripAccommodations,
        checklist: tripChecklistItems
      };

      res.json(tripWithDetails);
    } catch (error) {
      console.error('Error fetching trip:', error);
      res.status(500).json({ error: 'Failed to fetch trip details' });
    }
  });

  // Flight API endpoints
  // Lookup flight information by flight number and date
  app.get("/api/flights/lookup", async (req, res) => {
    try {
      const { flightNumber, date } = req.query;
      
      console.log(`Flight lookup request received with params:`, { flightNumber, date });
      
      if (!flightNumber || !date) {
        console.warn('Missing required parameters for flight lookup');
        return res.status(400).json({ error: "Flight number and date are required" });
      }
      
      console.log(`Flight lookup requested for ${flightNumber} on ${date}`);
      
      // Import the flight API utility
      const { lookupFlightInfo } = await import('./utils/flightApi');
      
      // Get API key from environment variables - now using AviationStack API
      const apiKey = process.env.AVIATION_STACK_API_KEY;
      
      if (!apiKey) {
        console.warn('AviationStack API key is not set.');
        return res.status(503).json({ error: "Flight information service is unavailable. Please try again later." });
      } else {
        // Don't log the actual API key, just confirm it exists
        console.log('Using AviationStack API with provided API key');
      }
      
      // Lookup flight information
      console.log(`Calling lookupFlightInfo with flight number: ${flightNumber}, date: ${date}, apiKey: ${apiKey ? 'provided' : 'missing'}`);
      
      const flightInfo = await lookupFlightInfo(
        flightNumber as string, 
        date as string,
        apiKey
      );
      
      console.log('Flight info response received:', 'error' in flightInfo ? 'Error response' : 'Success response');
      
      // Check if there was an error message in the response
      if ('error' in flightInfo) {
        console.log('Flight lookup error (no data available):', flightInfo.error);
        return res.status(404).json(flightInfo);
      }
      
      // If we have flight data, return it
      if (flightInfo && 'flight' in flightInfo && flightInfo.flight) {
        console.log('Flight lookup successful:', flightInfo.flight.airline, flightInfo.flight.flightNumber);
        console.log('Flight details:', {
          airline: flightInfo.flight.airline,
          flightNumber: flightInfo.flight.flightNumber,
          departure: flightInfo.flight.departureAirport.code,
          arrival: flightInfo.flight.arrivalAirport.code,
          status: flightInfo.flight.status
        });
        return res.json(flightInfo);
      }
      
      // This should never happen with our current implementation
      console.error('Unexpected response format from flight lookup:', flightInfo);
      return res.status(500).json({ error: 'No flight data available' });
    } catch (error) {
      console.error('Error looking up flight information:', error);
      
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      // Return appropriate error message
      return res.status(503).json({ 
        error: 'Unable to connect to flight information service. Please try again later.' 
      });
    }
  });
  
  // Get all flights for a trip
  app.get("/api/trips/:tripId/flights", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      const flightsList = await db.select()
        .from(flights)
        .where(eq(flights.tripId, tripId));

      res.json(flightsList);
    } catch (error) {
      console.error('Error fetching flights:', error);
      res.status(500).json({ error: 'Failed to fetch flights' });
    }
  });

  // Create a new flight
  app.post("/api/trips/:tripId/flights", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Validate the trip exists
      const existingTrip = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
      if (existingTrip.length === 0) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      // Prepare data and handle empty dates
      const flightData = { ...req.body, tripId };
      
      // Handle empty strings for dates by setting defaults
      if (!flightData.departureDate || flightData.departureDate === '') {
        const today = new Date();
        flightData.departureDate = today.toISOString().split('T')[0];
      }
      
      if (!flightData.arrivalDate || flightData.arrivalDate === '') {
        const today = new Date();
        flightData.arrivalDate = today.toISOString().split('T')[0];
      }

      const [flight] = await db.insert(flights)
        .values(flightData)
        .returning();

      res.status(201).json(flight);
    } catch (error) {
      console.error('Error creating flight:', error);
      res.status(500).json({ error: 'Failed to create flight' });
    }
  });

  // Update a flight
  app.patch("/api/trips/:tripId/flights/:flightId", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const flightId = parseInt(req.params.flightId);
      
      if (isNaN(tripId) || isNaN(flightId)) {
        return res.status(400).json({ error: "Invalid ID" });
      }

      const [flight] = await db.update(flights)
        .set(req.body)
        .where(and(
          eq(flights.id, flightId),
          eq(flights.tripId, tripId)
        ))
        .returning();

      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }

      res.json(flight);
    } catch (error) {
      console.error('Error updating flight:', error);
      res.status(500).json({ error: 'Failed to update flight' });
    }
  });

  // Delete a flight
  app.delete("/api/trips/:tripId/flights/:flightId", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const flightId = parseInt(req.params.flightId);
      
      if (isNaN(tripId) || isNaN(flightId)) {
        return res.status(400).json({ error: "Invalid ID" });
      }

      const deletedCount = await db.delete(flights)
        .where(and(
          eq(flights.id, flightId),
          eq(flights.tripId, tripId)
        ));

      if (deletedCount === 0) {
        return res.status(404).json({ error: "Flight not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting flight:', error);
      res.status(500).json({ error: 'Failed to delete flight' });
    }
  });

  // Share Links
  app.post("/api/trips/:tripId/share", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Verify trip exists and user has access
      const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const { expiresInDays = 7, accessLevel = "view" } = req.body;

      let expiresAt = null;
      if (expiresInDays > 0) {
        expiresAt = addDays(new Date(), expiresInDays);
      }

      // Generate a unique token
      const token = crypto.randomUUID();

      // Create share link with the new token
      const [shareLink] = await db
        .insert(shareLinks)
        .values({
          tripId,
          token,
          accessLevel,
          expiresAt,
          isActive: true,
        })
        .returning();

      if (!shareLink) {
        throw new Error("Failed to create share link");
      }

      console.log('Created share link:', shareLink);
      res.json(shareLink);
    } catch (error) {
      console.error('Error creating share link:', error);
      res.status(500).json({ error: 'Failed to create share link' });
    }
  });

  // Get shared trip details
  app.get("/api/share/:token", async (req, res) => {
    try {
      console.log('Checking share link with token:', req.params.token);

      const [shareLink] = await db.select()
        .from(shareLinks)
        .where(
          and(
            eq(shareLinks.token, req.params.token),
            eq(shareLinks.isActive, true)
          )
        )
        .limit(1);

      console.log('Found share link:', shareLink);

      if (!shareLink) {
        return res.status(404).json({ error: "Share link not found or has been revoked" });
      }

      if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
        await db.update(shareLinks)
          .set({ isActive: false })
          .where(eq(shareLinks.id, shareLink.id));
        return res.status(404).json({ error: "Share link has expired" });
      }

      // If authenticated user, add them as participant
      if (req.isAuthenticated() && req.user) {
        const [existingParticipant] = await db.select()
          .from(participants)
          .where(
            and(
              eq(participants.tripId, shareLink.tripId),
              eq(participants.userId, req.user.id)
            )
          )
          .limit(1);

        if (!existingParticipant) {
          await db.insert(participants)
            .values({
              tripId: shareLink.tripId,
              userId: req.user.id,
              name: req.user.name,
              status: 'pending'
            });
        }
      }

      // First get the trip details
      const trip = await db.select().from(trips).where(eq(trips.id, shareLink.tripId)).limit(1);

      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Get participants
      const tripParticipants = await db.select({
        id: participants.id,
        name: participants.name,
        userId: participants.userId,
        status: participants.status
      })
        .from(participants)
        .where(eq(participants.tripId, shareLink.tripId));

      // Get activities and checklist
      const [tripActivities, tripChecklist] = await Promise.all([
        db.select().from(activities).where(eq(activities.tripId, shareLink.tripId)),
        db.select().from(checklist).where(eq(checklist.tripId, shareLink.tripId))
      ]);

      const tripDetails = {
        ...trip[0],
        participants: tripParticipants,
        activities: tripActivities,
        checklist: tripChecklist
      };

      res.json({
        trip: tripDetails,
        accessLevel: shareLink.accessLevel,
        isParticipant: req.user ? tripParticipants.some(p => p.userId === req.user.id) : false
      });

    } catch (error) {
      console.error('Error handling share link:', error);
      res.status(500).json({ error: 'Failed to process share link' });
    }
  });

  // Get trips
  app.get("/api/trips", async (req, res) => {
    try {
      const ownedTrips = await db.query.trips.findMany({
        where: eq(trips.ownerId, req.user?.id || 1),
        with: {
          participants: true,
          activities: true,
          flights: true,
          accommodations: true,
        },
      });

      const participantTrips = await db.query.participants.findMany({
        where: eq(participants.userId, req.user?.id || 1),
        with: {
          trip: {
            with: {
              participants: true,
              activities: true,
              flights: true,
              accommodations: true,
            }
          }
        }
      });

      const participatedTrips = participantTrips.map(p => p.trip);
      res.json([...ownedTrips, ...participatedTrips]);
    } catch (error) {
      console.error('Error fetching trips:', error);
      res.status(500).json({ error: 'Failed to fetch trips' });
    }
  });
  
  // Get my trips (requires authentication)
  app.get("/api/my-trips", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const userId = req.user?.id;
      
      // Get trips where user is owner
      const ownedTrips = await db.query.trips.findMany({
        where: eq(trips.ownerId, userId),
        with: {
          participants: true,
          activities: true,
          flights: true,
          accommodations: true,
        },
        orderBy: [desc(trips.startDate)]
      });

      // Get trips where user is a participant
      const participantTrips = await db.query.participants.findMany({
        where: eq(participants.userId, userId),
        with: {
          trip: {
            with: {
              participants: true,
              activities: true,
              flights: true,
              accommodations: true,
            }
          }
        }
      });

      const participatedTrips = participantTrips.map(p => p.trip);
      
      // Combine, deduplicate by ID, and sort by date
      const allTrips = [...ownedTrips];
      
      for (const trip of participatedTrips) {
        if (!allTrips.some(t => t.id === trip.id)) {
          allTrips.push(trip);
        }
      }
      
      // Sort by start date
      allTrips.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      
      res.json(allTrips);
    } catch (error) {
      console.error('Error fetching my trips:', error);
      res.status(500).json({ error: 'Failed to fetch my trips' });
    }
  });

  // Create trip
  app.post("/api/trips", async (req, res) => {
    try {
      const [newTrip] = await db.insert(trips).values({
        ...req.body,
        ownerId: req.user?.id || 1,
      }).returning();

      res.json(newTrip);
    } catch (error) {
      console.error('Error creating trip:', error);
      res.status(500).json({ error: 'Failed to create trip' });
    }
  });

  // Update trip
  app.patch("/api/trips/:id", async (req, res) => {
    try {
      // Fix timezone issue by directly using the string dates provided by the frontend
      // Instead of creating Date objects which can cause timezone shifts
      
      // CRITICAL FIX: Don't create new Date objects here as they can shift the date
      // when converted back to strings due to timezone differences
      
      // Create update object with only the fields that are provided
      const updateData: Record<string, any> = {};
      
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.location !== undefined) updateData.location = req.body.location;
      if (req.body.coordinates !== undefined) updateData.coordinates = req.body.coordinates;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      
      // Store dates directly as ISO strings with time at 12:00:00 UTC to prevent any timezone issues
      // This ensures the date stays exactly as the user selected it
      if (req.body.startDate) {
        updateData.startDate = `${req.body.startDate}T12:00:00.000Z`;
      }
      
      if (req.body.endDate) {
        updateData.endDate = `${req.body.endDate}T12:00:00.000Z`;
      }
      
      // If there are no fields to update, return early
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields provided for update" });
      }
      
      // Perform the update with only the fields that were provided
      const [updatedTrip] = await db
        .update(trips)
        .set(updateData)
        .where(eq(trips.id, parseInt(req.params.id)))
        .returning();

      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Format dates back to YYYY-MM-DD before sending to client
      const formattedTrip = {
        ...updatedTrip,
        startDate: updatedTrip.startDate.split('T')[0],
        endDate: updatedTrip.endDate.split('T')[0],
      };

      res.json(formattedTrip);
    } catch (error) {
      console.error('Error updating trip:', error);
      res.status(500).json({ error: 'Failed to update trip' });
    }
  });

  // Update trip view preferences
  app.put("/api/trips/:id/view-preferences", async (req, res) => {
    try {
      const tripId = parseInt(req.params.id);
      
      // Validate input
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: "Invalid view preferences data" });
      }
      
      // Create viewPreferences object with correct structure
      const viewPreferences = {
        showCalendar: req.body.showCalendar === true,
        showSpending: req.body.showSpending === true,
        showMap: req.body.showMap === true,
      };
      
      // Update the trip with the new view preferences
      const [updatedTrip] = await db
        .update(trips)
        .set({
          viewPreferences: viewPreferences
        })
        .where(eq(trips.id, tripId))
        .returning();

      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Format dates back to YYYY-MM-DD before sending to client
      const formattedTrip = {
        ...updatedTrip,
        startDate: updatedTrip.startDate.split('T')[0],
        endDate: updatedTrip.endDate.split('T')[0],
      };

      res.json(formattedTrip);
    } catch (error) {
      console.error('Error updating trip view preferences:', error);
      res.status(500).json({ error: 'Failed to update trip view preferences' });
    }
  });

  // Delete trip
  app.delete("/api/trips/:id", async (req, res) => {
    try {
      const tripId = parseInt(req.params.id);

      // Delete all related data in the correct order
      await db.transaction(async (tx) => {
        // Delete chat messages
        await tx.delete(chatMessages).where(eq(chatMessages.tripId, tripId));

        // Delete activities
        await tx.delete(activities).where(eq(activities.tripId, tripId));

        // Delete checklist items
        await tx.delete(checklist).where(eq(checklist.tripId, tripId));

        // Delete flights
        await tx.delete(flights).where(eq(flights.tripId, tripId));

        // Delete accommodations
        await tx.delete(accommodations).where(eq(accommodations.tripId, tripId));

        // Delete participants
        await tx.delete(participants).where(eq(participants.tripId, tripId));

        // Delete destinations
        await tx.delete(destinations).where(eq(destinations.tripId, tripId));

        // Delete share links
        await tx.delete(shareLinks).where(eq(shareLinks.tripId, tripId));

        // Delete pinned places
        await tx.delete(pinnedPlaces).where(eq(pinnedPlaces.tripId, tripId));

        // Delete polls
        await tx.delete(polls).where(eq(polls.tripId, tripId));

        // Finally, delete the trip
        const [deletedTrip] = await tx.delete(trips)
          .where(eq(trips.id, tripId))
          .returning();

        if (!deletedTrip) {
          throw new Error("Trip not found");
        }
      });

      res.json({ success: true, message: "Trip and all related data deleted successfully" });
    } catch (error) {
      console.error('Error deleting trip:', error);
      res.status(500).json({ error: 'Failed to delete trip' });
    }
  });

  // Get all activities for a trip
  app.get("/api/trips/:tripId/activities", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      console.log('Fetching activities for trip:', tripId);

      const tripActivities = await db.select().from(activities).where(eq(activities.tripId, tripId));

      console.log('Found activities:', tripActivities);
      res.json(tripActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      res.status(500).json({ error: 'Failed to fetch activities' });
    }
  });

  // Create a new activity
  app.post("/api/trips/:tripId/activities", async (req, res) => {
    try {
      console.log('Creating activity with data:', req.body);
      // For development, allow without authentication
      const userId = req.user?.id || 1;

      const [newActivity] = await db.insert(activities).values({
        tripId: parseInt(req.params.tripId),
        title: req.body.title,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
        description: req.body.description || null,
        location: req.body.location || null,
        coordinates: req.body.coordinates || null,
        participants: req.body.participants || [], //Restored participants field
      }).returning();

      if (!newActivity) {
        throw new Error("Failed to create activity");
      }

      console.log('Created new activity:', newActivity);
      res.json(newActivity);
    } catch (error) {
      console.error('Error creating activity:', error);
      res.status(500).json({ error: 'Failed to create activity: ' + error.message });
    }
  });

  // Update activity
  app.patch("/api/trips/:tripId/activities/:activityId", async (req, res) => {
    try {
      const [updatedActivity] = await db
        .update(activities)
        .set({
          title: req.body.title,
          description: req.body.description,
          location: req.body.location,
          startTime: new Date(req.body.startTime),
          endTime: new Date(req.body.endTime),
          participants: req.body.participants || [],
          coordinates: req.body.coordinates || null,
        })
        .where(
          and(
            eq(activities.id, parseInt(req.params.activityId)),
            eq(activities.tripId, parseInt(req.params.tripId))
          )
        )
        .returning();

      if (!updatedActivity) {
        return res.status(404).json({ error: "Activity not found" });
      }

      res.json(updatedActivity);
    } catch (error) {
      console.error('Error updating activity:', error);
      res.status(500).json({ error: 'Failed to update activity' });
    }
  });

  // Delete activity
  app.delete("/api/trips/:tripId/activities/:activityId", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const activityId = parseInt(req.params.activityId);

      const [deletedActivity] = await db
        .delete(activities)
        .where(
          and(
            eq(activities.id, activityId),
            eq(activities.tripId, tripId)
          )
        )
        .returning();

      if (!deletedActivity) {
        return res.status(404).json({ error: "Activity not found" });
      }

      console.log('Successfully deleted activity:', deletedActivity);
      res.json(deletedActivity);
    } catch (error) {
      console.error('Error deleting activity:', error);
      res.status(500).json({ error: 'Failed to delete activity' });
    }
  });

  // Checklist routes
  app.get("/api/trips/:tripId/checklist", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const checklistItems = await db.query.checklist.findMany({
        where: eq(checklist.tripId, tripId),
      });
      res.json(checklistItems);
    } catch (error) {
      console.error('Error fetching checklist:', error);
      res.status(500).json({ error: 'Failed to fetch checklist items' });
    }
  });

  app.post("/api/trips/:tripId/checklist", async (req, res) => {
    try {
      const [newItem] = await db.insert(checklist).values({
        tripId: parseInt(req.params.tripId),
        title: req.body.title,
        completed: false,
      }).returning();

      res.json(newItem);
    } catch (error) {
      console.error('Error creating checklist item:', error);
      res.status(500).json({ error: 'Failed to create checklist item' });
    }
  });

  app.patch("/api/trips/:tripId/checklist/:itemId", async (req, res) => {
    try {
      const [updatedItem] = await db
        .update(checklist)
        .set({
          ...(req.body.completed !== undefined && { completed: req.body.completed }),
          ...(req.body.title !== undefined && { title: req.body.title })
        })
        .where(
          and(
            eq(checklist.id, parseInt(req.params.itemId)),
            eq(checklist.tripId, parseInt(req.params.tripId))
          )
        )
        .returning();

      if (!updatedItem) {
        return res.status(404).json({ error: 'Checklist item not found' });
      }

      res.json(updatedItem);
    } catch (error) {
      console.error('Error updating checklist item:', error);
      res.status(500).json({ error: 'Failed to update checklist item' });
    }
  });

  // Delete checklist item
  app.delete("/api/trips/:tripId/checklist/:itemId", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const itemId = parseInt(req.params.itemId);

      const [deletedItem] = await db
        .delete(checklist)
        .where(
          and(
            eq(checklist.id, itemId),
            eq(checklist.tripId, tripId)
          )
        )
        .returning();

      if (!deletedItem) {
        return res.status(404).json({ error: "Checklist item not found" });
      }

      res.json(deletedItem);
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      res.status(500).json({ error: 'Failed to delete checklist item' });
    }
  });

  // Documents
  app.post("/api/trips/:tripId/documents", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const newDocument = await db.insert(documents).values({
      ...req.body,
      tripId: parseInt(req.params.tripId),
      userId: req.user.id,
    }).returning();

    res.json(newDocument[0]);
  });

  // Chat Messages
  app.get("/api/trips/:tripId/chat", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const messages = await db.query.chatMessages.findMany({
        where: eq(chatMessages.tripId, tripId),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      });
      res.json(messages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  });

  app.post("/api/trips/:tripId/chat", async (req, res) => {
    try {
      const userId = req.user?.id || 1;
      const tripId = parseInt(req.params.tripId);

      const [message] = await db.insert(chatMessages).values({
        tripId,
        userId,
        message: req.body.message,
      }).returning();

      const messageWithUser = await db.query.chatMessages.findFirst({
        where: eq(chatMessages.id, message.id),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true
            }
          }
        },
      });

      res.json(messageWithUser);
    } catch (error) {
      console.error('Error creating chat message:', error);
      res.status(500).json({ error: 'Failed to create chat message' });
    }
  });


  // Serve static files for uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Handle image upload for trips
  app.post("/api/trips/:tripId/image", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send("No image file uploaded");
      }

      const tripId = parseInt(req.params.tripId);
      const imageUrl = `/uploads/${req.file.filename}`;

      const [updatedTrip] = await db.update(trips).set({ thumbnail: imageUrl }).where(eq(trips.id, tripId)).returning();

      if (!updatedTrip) {
        return res.status(404).send("Trip not found");
      }

      res.json({ imageUrl });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  });

  // Create participant endpoint
  app.post("/api/trips/:tripId/participants", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const { name, email, arrivalDate, departureDate, flightNumber, airline, accommodation } = req.body;

      console.log('Creating participant with data:', {
        tripId,
        name,
        arrivalDate,
        departureDate,
        accommodation,
        flightNumber,
        airline
      });

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      if (!tripId || isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Validate dates if provided
      if (arrivalDate && !Date.parse(arrivalDate)) {
        return res.status(400).json({ error: "Invalid arrival date format" });
      }
      if (departureDate && !Date.parse(departureDate)) {
        return res.status(400).json({ error: "Invalid departure date format" });
      }

      // Start transaction
      const newParticipant = await db.transaction(async (tx) => {
        let accommodationId = null;

        // Create accommodation if provided
        if (accommodation?.name) {
          try {
            const [newAccommodation] = await tx
              .insert(accommodations)
              .values({
                tripId,
                name: accommodation.name,
                type: accommodation.type || 'hotel',
                address: accommodation.address || 'TBD',
                checkInDate: arrivalDate ? new Date(arrivalDate) : new Date(),
                checkOutDate: departureDate ? new Date(departureDate) : new Date(),
                checkInTime: accommodation.checkInTime || null,
                checkOutTime: accommodation.checkOutTime || null,
                bookingReference: accommodation.bookingReference || 'TBD',
                bookingStatus: accommodation.bookingStatus || 'pending',
                price: accommodation.price || null,
                currency: accommodation.currency || 'USD',
                roomType: accommodation.roomType || null
              })
              .returning();

            console.log('Created accommodation:', newAccommodation);
            accommodationId = newAccommodation.id;
          } catch (error) {
            console.error('Error creating accommodation:', error);
            throw new Error('Failed to create accommodation: ' + error.message);
          }
        }

        // Create participant
        let participant;
        try {
          [participant] = await tx
            .insert(participants)
            .values({
              tripId,
              name,
              status: 'pending',
              arrivalDate: arrivalDate ? new Date(arrivalDate) : null,
              departureDate: departureDate ? new Date(departureDate) : null,
              flightStatus: flightNumber ? 'pending' : 'pending',
              hotelStatus: accommodation ? 'pending' : 'pending',
              accommodationId,
              userId: req.user?.id
            })
            .returning();

          console.log('Created participant:', participant);
        } catch (error) {
          console.error('Error creating participant:', error);
          throw new Error('Failed to create participant record: ' + error.message);
        }

        // Create flight if needed
        if (flightNumber || airline) {
          try {
            const [flight] = await tx
              .insert(flights)
              .values({
                tripId,
                airline: airline || '',
                flightNumber: flightNumber || '',
                departureAirport: 'TBD',
                arrivalAirport: 'TBD',
                departureDate: arrivalDate ? new Date(arrivalDate) : new Date(),
                departureTime: '12:00',
                arrivalDate: arrivalDate ? new Date(arrivalDate) : new Date(),
                arrivalTime: '14:00',
                bookingReference: flightNumber || 'TBD',
                bookingStatus: 'pending',
                currency: 'USD',
                participantId: participant.id
              })
              .returning();

            console.log('Created flight:', flight);
          } catch (error) {
            console.error('Error creating flight:', error);
            throw new Error('Failed to create flight record: ' + error.message);
          }
        }

        return participant;
      });

      // Fetch complete participant data with relations
      const participantWithDetails = await db.query.participants.findFirst({
        where: eq(participants.id, newParticipant.id),
        with: {
          accommodation: true,
          flights: true
        }
      });

      if (!participantWithDetails) {
        throw new Error('Failed to fetch participant details after creation');
      }

      console.log('Returning participant with details:', participantWithDetails);
      res.json(participantWithDetails);
    } catch (error) {
      console.error('Error creating participant:', error);
      res.status(500).json({
        error: 'Failed to create participant',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get participants for a trip
  app.get("/api/trips/:tripId/participants", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      const tripParticipants = await db.select({
        id: participants.id,
        name: participants.name,
        tripId: participants.tripId,
        status: participants.status,
        role: participants.role,
        email: participants.email,
        joinedAt: participants.joinedAt,
        arrivalDate: participants.arrivalDate,
        departureDate: participants.departureDate,
        flightStatus: participants.flightStatus,
        hotelStatus: participants.hotelStatus,
        accommodationId: participants.accommodationId,
        userId: participants.userId
      })
        .from(participants)
        .where(eq(participants.tripId, tripId));

      if (!tripParticipants) {
        return res.status(404).json({ error: "No participants found" });
      }

      // Fetch all flights and accommodations for the trip
      const [tripFlights, tripAccommodations] = await Promise.all([
        db.select().from(flights).where(eq(flights.tripId, tripId)),
        db.select().from(accommodations).where(eq(accommodations.tripId, tripId))
      ]);

      // Map the participants with their details
      const participantsWithDetails = tripParticipants.map((participant) => ({
        ...participant,
        flights: tripFlights.filter(flight => flight.participantId === participant.id),
        accommodation: tripAccommodations.find(accommodation => accommodation.id === participant.accommodationId)
      }));

      res.json(participantsWithDetails);
    } catch (error) {
      console.error('Error fetching participants:', error);
      res.status(500).json({ error: 'Failed to fetch participants' });
    }
  });

  // Update participant status endpoint
  app.patch("/api/trips/:tripId/participants/:participantId/status", async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ['yes', 'no', 'pending'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be one of: yes, no, pending' });
      }

      const participantId = parseInt(req.params.participantId);
      const tripId = parseInt(req.params.tripId);

      console.log('Updating participant status:', { participantId, tripId, status });

      const [updatedParticipant] = await db
        .update(participants)
        .set({ status })
        .where(and(
          eq(participants.id, participantId),
          eq(participants.tripId, tripId)
        ))
        .returning();

      if (!updatedParticipant) {
        return res.status(404).json({ error: 'Participant not found' });
      }

      console.log('Updated participant:', updatedParticipant);
      res.json(updatedParticipant);
    } catch (error) {
      console.error('Error updating participant status:', error);
      res.status(500).json({ error: 'Failed to update participant status' });
    }
  });

  // Update participant endpoint
  app.patch("/api/trips/:tripId/participants/:participantId", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const participantId = parseInt(req.params.participantId);
      const {
        name,
        arrivalDate,
        departureDate,
        flightNumber,
        airline,
        accommodation
      } = req.body;

      console.log('Updating participant:', {
        participantId,
        tripId,
        name,
        arrivalDate,
        departureDate,
        accommodation
      });

      // Start a transaction to handle all updates
      const updatedParticipant = await db.transaction(async (tx)=> {
        // Get current participant
        const [currentParticipant] = await tx
          .select()
          .from(participants)
          .where(
            and(
              eq(participants.id, participantId),
              eq(participants.tripId, tripId            )
            )
          );

        if (!currentParticipant) {
          throw new Error("Participant not found");
        }

        let accommodationId = currentParticipant.accommodationId;

        // Handle accommodation update if provided
        if (accommodation) {
          const [newAccommodation] = await tx
            .insert(accommodations)
            .values({
              tripId,
              name: accommodation,
              type: 'hotel',
              address: '',
              checkInDate: arrivalDate ? new Date(arrivalDate) : new Date(),
              checkOutDate: departureDate ? new Date(departureDate) : new Date(),
              bookingReference: 'TBD',
              bookingStatus: 'pending',
              currency: 'USD',
              roomType: null
            })
            .returning();

          accommodationId = newAccommodation.id;
        } else if (accommodation === null) {
          // Explicitly remove accommodation
          accommodationId = null;
        }

        // Update participant
        const [participant] = await tx          .update(participants)
          .set({
            ...(name && { name }),
            ...(arrivalDate && { arrivalDate: new Date(arrivalDate) }),
            ...(departureDate && { departureDate: new Date(departureDate) }),
            hotelStatus: accommodation ? 'pending' : currentParticipant.hotelStatus,
            flightStatus: (flightNumber || airline) ? 'pending' : currentParticipant.flightStatus,
            accommodationId
          })
          .where(
            and(
              eq(participants.id, participantId),
              eq(participants.tripId, tripId)
            )
          )
          .returning();

        if (!participant) {
          throw new Error("Failed to update participant");
        }

        // Handle flight information if provided
        if (flightNumber || airline) {
          await tx
            .insert(flights)
            .values({
              tripId,
              airline: airline || '',
              flightNumber: flightNumber || '',
              departureAirport: '',
              arrivalAirport: '',
              departureDate: arrivalDate ? new Date(arrivalDate) : new Date(),
              departureTime: '12:00',
              arrivalDate: arrivalDate ? new Date(arrivalDate) : new Date(),
              arrivalTime: '14:00',
              bookingReference: flightNumber || 'TBD',
              bookingStatus: 'pending',
              currency: 'USD',
              participantId: participant.id
            });
        }

        return participant;
      });

      // Fetch updated participant with all details
      const participantWithDetails = await db.query.participants.findFirst({
        where: eq(participants.id, updatedParticipant.id),
        with: {
          accommodation: true,
          flights: true
        }
      });

      res.json(participantWithDetails);
    } catch (error) {      console.error('Error updating participant:', error);
      res.status(500).json({
        error: 'Failed to update participant',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Invite a user to a trip
  app.post("/api/trips/:tripId/invite", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tripId = parseInt(req.params.tripId);
      const { email, role } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      // Verify that the authenticated user is the owner of the trip or has admin rights
      const trip = await db.query.trips.findFirst({
        where: eq(trips.id, tripId)
      });
      
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      const isOwner = trip.ownerId === req.user?.id;
      
      if (!isOwner) {
        // Check if user is an admin for this trip
        const userParticipant = await db.query.participants.findFirst({
          where: and(
            eq(participants.tripId, tripId),
            eq(participants.userId, req.user?.id),
            eq(participants.role, "admin")
          )
        });
        
        if (!userParticipant) {
          return res.status(403).json({ error: "You don't have permission to invite users to this trip" });
        }
      }
      
      // Check if the user already exists by email
      let invitedUser = await db.query.users.findFirst({
        where: eq(users.email, email)
      });
      
      // Check if the participant already exists in the trip
      if (invitedUser) {
        const existingParticipant = await db.query.participants.findFirst({
          where: and(
            eq(participants.tripId, tripId),
            eq(participants.userId, invitedUser.id)
          )
        });
        
        if (existingParticipant) {
          return res.status(400).json({ error: "User is already a participant in this trip" });
        }
      }
      
      // Create the participant with pending status
      const [newParticipant] = await db.insert(participants).values({
        tripId,
        userId: invitedUser?.id || null,
        name: invitedUser?.name || email.split('@')[0],
        email: email,
        status: 'pending',
        role: role || 'viewer'
      }).returning();
      
      // Create an in-app notification for the invited user (if they exist)
      if (invitedUser) {
        await db.insert(notifications).values({
          userId: invitedUser.id,
          tripId,
          participantId: newParticipant.id,
          type: "invitation",
          title: "Trip Invitation",
          message: `You have been invited to join the trip "${trip.title}" as a ${role || 'viewer'}.`
        });
      }
      
      res.status(201).json({
        ...newParticipant,
        message: "Invitation sent successfully"
      });
    } catch (error) {
      console.error('Error inviting user:', error);
      res.status(500).json({ 
        error: 'Failed to invite user',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Update a participant's role
  app.patch("/api/trips/:tripId/participants/:participantId/role", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const tripId = parseInt(req.params.tripId);
      const participantId = parseInt(req.params.participantId);
      const { role } = req.body;
      
      if (!role) {
        return res.status(400).json({ error: "Role is required" });
      }
      
      // Verify allowed roles
      const allowedRoles = ["viewer", "editor", "admin"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: `Role must be one of: ${allowedRoles.join(', ')}` });
      }
      
      // Verify that the authenticated user is the owner of the trip or has admin rights
      const trip = await db.query.trips.findFirst({
        where: eq(trips.id, tripId)
      });
      
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      const isOwner = trip.ownerId === req.user?.id;
      
      if (!isOwner) {
        // Check if user is an admin for this trip
        const userParticipant = await db.query.participants.findFirst({
          where: and(
            eq(participants.tripId, tripId),
            eq(participants.userId, req.user?.id),
            eq(participants.role, "admin")
          )
        });
        
        if (!userParticipant) {
          return res.status(403).json({ error: "You don't have permission to update participant roles" });
        }
      }
      
      // Update the participant's role
      const [updatedParticipant] = await db.update(participants)
        .set({ role })
        .where(and(
          eq(participants.id, participantId),
          eq(participants.tripId, tripId)
        ))
        .returning();
      
      if (!updatedParticipant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      
      res.json(updatedParticipant);
    } catch (error) {
      console.error('Error updating participant role:', error);
      res.status(500).json({ error: 'Failed to update participant role' });
    }
  });
  
  // Resend invitation to a participant
  app.post("/api/trips/:tripId/participants/:participantId/resend-invite", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const tripId = parseInt(req.params.tripId);
      const participantId = parseInt(req.params.participantId);
      
      // Verify that the authenticated user is the owner of the trip or has admin rights
      const trip = await db.query.trips.findFirst({
        where: eq(trips.id, tripId)
      });
      
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      const isOwner = trip.ownerId === req.user?.id;
      
      if (!isOwner) {
        // Check if user is an admin for this trip
        const userParticipant = await db.query.participants.findFirst({
          where: and(
            eq(participants.tripId, tripId),
            eq(participants.userId, req.user?.id),
            eq(participants.role, "admin")
          )
        });
        
        if (!userParticipant) {
          return res.status(403).json({ error: "You don't have permission to resend invitations" });
        }
      }
      
      // Get the participant
      const participant = await db.query.participants.findFirst({
        where: and(
          eq(participants.id, participantId),
          eq(participants.tripId, tripId)
        )
      });
      
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      
      if (participant.status !== 'pending') {
        return res.status(400).json({ error: "Invitation can only be resent for pending participants" });
      }
      
      if (!participant.email) {
        return res.status(400).json({ error: "Participant does not have an email address" });
      }
      
      // Update the joinedAt time to reflect the new invitation
      const [updatedParticipant] = await db.update(participants)
        .set({ joinedAt: new Date() })
        .where(eq(participants.id, participantId))
        .returning();
        
      // Get the user ID from the participant's email
      if (participant.email) {
        const invitedUser = await db.query.users.findFirst({
          where: eq(users.email, participant.email)
        });
        
        if (invitedUser) {
          // Create an in-app notification
          await db.insert(notifications).values({
            userId: invitedUser.id,
            tripId,
            participantId: participantId,
            type: "invitation_reminder",
            title: "Trip Invitation Reminder",
            message: `You've been invited to join the trip "${trip.title}" as a ${participant.role}. Click here to respond.`
          });
        }
      }
      
      res.json({
        ...updatedParticipant,
        message: "Invitation resent successfully"
      });
    } catch (error) {
      console.error('Error resending invitation:', error);
      res.status(500).json({ error: 'Failed to resend invitation' });
    }
  });

  // Delete participant endpoint
  app.delete("/api/trips/:tripId/participants/:participantId", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const participantId = parseInt(req.params.participantId);

      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Verify that the authenticated user is the owner of the trip or has admin rights
      const trip = await db.query.trips.findFirst({
        where: eq(trips.id, tripId)
      });
      
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      const isOwner = trip.ownerId === req.user?.id;
      
      if (!isOwner) {
        // Check if user is an admin for this trip
        const userParticipant = await db.query.participants.findFirst({
          where: and(
            eq(participants.tripId, tripId),
            eq(participants.userId, req.user?.id),
            eq(participants.role, "admin")
          )
        });
        
        if (!userParticipant) {
          return res.status(403).json({ error: "You don't have permission to remove participants" });
        }
      }

      // Delete the participant
      const [deletedParticipant] = await db.delete(participants)
        .where(and(eq(participants.id, participantId), eq(participants.tripId, tripId)))
        .returning();

      if (!deletedParticipant) {
        return res.status(404).json({ error: "Participant not found" });
      }

      res.json(deletedParticipant);
    } catch (error) {
      console.error('Error deleting participant:', error);
      res.status(500).json({ error: 'Failed to delete participant' });
    }
  });

  // Get destinations for a trip
  app.get("/api/trips/:tripId/destinations", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const tripDestinations = await db.select().from(destinations).where(eq(destinations.tripId, tripId));
      res.json(tripDestinations);
    } catch (error) {
      console.error('Error fetching destinations:', error);
      res.status(500).json({ error: 'Failed to fetch destinations' });
    }
  });

  // Add a new destination to a trip
  app.post("/api/trips/:tripId/destinations", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);

      // Get current max order
      const [result] = await db
        .select({ maxOrder: sql`MAX(${destinations.order})` })
        .from(destinations)
        .where(eq(destinations.tripId, tripId));

      const newOrder = (result?.maxOrder || 0) + 1;

      // Use the same date handling approach as in trip updates
      // Store dates with fixed time at noon UTC to avoid any timezone issues
      const startDateISO = `${req.body.startDate}T12:00:00.000Z`;
      const endDateISO = `${req.body.endDate}T12:00:00.000Z`;
      
      const [newDestination] = await db.insert(destinations).values({
        tripId,
        name: req.body.name,
        description: req.body.description,
        startDate: startDateISO,
        endDate: endDateISO,
        coordinates: req.body.coordinates,
        order: newOrder,
      }).returning();

      res.json(newDestination);
    } catch (error) {
      console.error('Error creating destination:', error);
      res.status(500).json({ error: 'Failed to create destination' });
    }
  });

  // Update destination endpoint - add after the existing destination routes
  app.patch("/api/trips/:tripId/destinations/:destinationId", async (req, res) => {
    try {
      // Use the same date handling approach as in other routes
      // Store dates with fixed time at noon UTC to avoid any timezone issues
      const startDateISO = `${req.body.startDate}T12:00:00.000Z`;
      const endDateISO = `${req.body.endDate}T12:00:00.000Z`;
      
      const [updatedDestination] = await db
        .update(destinations)
        .set({
          name: req.body.name,
          startDate: startDateISO,
          endDate: endDateISO,
          coordinates: req.body.coordinates,
        })
        .where(
          and(
            eq(destinations.id, parseInt(req.params.destinationId)),
            eq(destinations.tripId, parseInt(req.params.tripId))
          )
        )
        .returning();

      if (!updatedDestination) {
        return res.status(404).json({ error: "Destination not found" });
      }

      res.json(updatedDestination);
    } catch (error) {
      console.error('Error updating destination:', error);
      res.status(500).json({ error: 'Failed to update destination' });
    }
  });

  // Delete destination route
  app.delete("/api/trips/:tripId/destinations/:destinationId", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const destinationId = parseInt(req.params.destinationId);

      // Verify destination exists and belongs to trip
      const [destination] = await db
        .select()
        .from(destinations)
        .where(
          and(
            eq(destinations.id, destinationId),
            eq(destinations.tripId, tripId)
          )
        )
        .limit(1);

      if (!destination) {
        return res.status(404).json({ error: "Destination not found" });
      }

      console.log(`Attempting to delete destination with ID ${destinationId} from trip ${tripId}`);
      
      // Delete the destination
      const deleted = await db
        .delete(destinations)
        .where(
          and(
            eq(destinations.id, destinationId),
            eq(destinations.tripId, tripId)
          )
        )
        .returning();

      console.log(`Deletion result:`, deleted);
      
      // Check if anything was actually deleted
      if (!deleted || deleted.length === 0) {
        console.warn(`No destination found with ID ${destinationId} in trip ${tripId}`);
        return res.status(404).json({ 
          success: false,
          error: "Destination not found or already deleted"
        });
      }
      
      // Return the deleted destination in the response
      const [deletedDestination] = deleted;
      
      // Log success
      console.log(`Successfully deleted destination ${destinationId} from trip ${tripId}`);
      
      res.json({ 
        success: true, 
        message: "Destination deleted successfully",
        destination: deletedDestination
      });
    } catch (error) {
      console.error('Error deleting destination:', error);
      res.status(500).json({ error: 'Failed to delete destination' });
    }
  });

  // Update destination order
  app.patch("/api/trips/:tripId/destinations/reorder", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const { destinationIds } = req.body; // Array of destination IDs in new order

      // Update order for each destination
      await Promise.all(
        destinationIds.map((id: number, index: number) =>
          db.update(destinations)
            .set({ order: index + 1 })
            .where(and(
              eq(destinations.id, id),
              eq(destinations.tripId, tripId)
            ))
        )
      );

      const updatedDestinations = await db
        .select()
        .from(destinations)
        .where(eq(destinations.tripId, tripId))
        .orderBy(destinations.order);

      res.json(updatedDestinations);
    } catch (error) {
      console.error('Error reordering destinations:', error);
      res.status(500).json({ error: 'Failed to reorder destinations' });
    }
  });

  // Get pinned places
  app.get("/api/trips/:tripId/pinned-places", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const destinationId = req.query.destinationId ? parseInt(req.query.destinationId as string) : undefined;

      // First get the trip's location coordinates
      const [trip] = await db.select({
        location: trips.location,
        coordinates: destinations.coordinates,
      })
        .from(trips)
        .leftJoin(destinations, and(
          eq(destinations.tripId, trips.id),
          eq(destinations.order, 1)
        ))
        .where(eq(trips.id, tripId))
        .limit(1);

      // Then get the pinned places
      const places = await db.select()
        .from(pinnedPlaces)
        .where(
          destinationId
            ? and(eq(pinnedPlaces.tripId, tripId), eq(pinnedPlaces.destinationId, destinationId))
            : eq(pinnedPlaces.tripId, tripId)
        );

      // Return both trip coordinates and pinned places
      res.json({
        tripLocation: trip?.coordinates || null,
        places
      });
    } catch (error) {
      console.error('Error fetching pinned places:', error);
      res.status(500).json({ error: 'Failed to fetch pinned places' });
    }
  });

  // Create pinned place
  app.post("/api/trips/:tripId/pinned-places", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const { name, address, notes, coordinates, destinationId, category } = req.body;

      const [newPlace] = await db.insert(pinnedPlaces).values({
        tripId,
        name,
        address,
        notes,
        coordinates,
        destinationId: destinationId || null,
        category: category || 'tourist',
        addedToChecklist: false,
      }).returning();

      res.json(newPlace);
    } catch (error) {
      console.error('Error creating pinned place:', error);
      res.status(500).json({ error: 'Failed to create pinned place' });
    }
  });

  // Add pinned place to checklist
  app.post("/api/trips/:tripId/pinned-places/:placeId/checklist", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const placeId = parseInt(req.params.placeId);

      // Start a transaction to ensure both operations succeed or fail together
      await db.transaction(async (tx) => {
        // Get the place details
        const [place] = await tx
          .select()
          .from(pinnedPlaces)
          .where(and(eq(pinnedPlaces.id, placeId), eq(pinnedPlaces.tripId, tripId)))
          .limit(1);

        if (!place) {
          throw new Error("Pinned place not found");
        }

        // Create checklist item
        const [checklistItem] = await tx.insert(checklist).values({
          tripId,
          title: `Visit ${place.name}`,
          completed: false,
        }).returning();

        // Update pinned place
        await tx
          .update(pinnedPlaces)
          .set({ addedToChecklist: true })
          .where(eq(pinnedPlaces.id, placeId));

        res.json(checklistItem);
      });
    } catch (error) {
      console.error('Error adding to checklist:', error);
      res.status(500).json({ error: 'Failed to add to checklist' });
    }
  });

  // Existing pinned places routes remain unchanged
  // Add new routes for editing and deleting pinned places

  // Update pinned place
  app.patch("/api/trips/:tripId/pinned-places/:placeId", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const placeId = parseInt(req.params.placeId);
      const { notes, category, name, coordinates } = req.body;

      const [updatedPlace] = await db
        .update(pinnedPlaces)
        .set({
          notes: notes || null,
          category: category || 'tourist',
          name: name || undefined,
          coordinates: coordinates || undefined,
        })
        .where(
          and(
            eq(pinnedPlaces.id, placeId),
            eq(pinnedPlaces.tripId, tripId)
          )
        )
        .returning();

      if (!updatedPlace) {
        return res.status(404).json({ error: "Pinned place not found" });
      }

      res.json(updatedPlace);
    } catch (error) {
      console.error('Error updating pinned place:', error);
      res.status(500).json({ error: 'Failed to update pinned place' });
    }
  });

  // Delete pinned place
  app.delete("/api/trips/:tripId/pinned-places/:placeId", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const placeId = parseInt(req.params.placeId);

      const [deletedPlace] = await db
        .delete(pinnedPlaces)
        .where(
          and(
            eq(pinnedPlaces.id, placeId),
            eq(pinnedPlaces.tripId, tripId)
          )
        )
        .returning();

      if (!deletedPlace) {
        return res.status(404).json({ error: "Pinned place not found" });
      }

      res.json(deletedPlace);
    } catch (error) {
      console.error('Error deleting pinned place:', error);
      res.status(500).json({ error: 'Failed to delete pinned place' });
    }
  });

  // Add this route after the other pinned places routes
  app.patch("/api/trips/:tripId/pinned-places/:placeId/update", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const placeId = parseInt(req.params.placeId);
      const { notes, category } = req.body;

      const [updatedPlace] = await db
        .update(pinnedPlaces)
        .set({
          notes: notes || null,
          category: category || 'tourist',
        })
        .where(
          and(
            eq(pinnedPlaces.id, placeId),
            eq(pinnedPlaces.tripId, tripId)
          )
        )
        .returning();

      if (!updatedPlace) {
        return res.status(404).json({ error: "Pinned place not found" });
      }

      res.json(updatedPlace);
    } catch (error) {
      console.error('Error updating pinned place:', error);
      res.status(500).json({ error: 'Failed to update pinned place' });
    }
  });

  // Add these new routes after the existing chat message routes

  // Create poll with proper schema validation
  app.post("/api/trips/:tripId/polls", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const userId = req.user?.id || 1;
      const { question, options, endTime } = req.body;

      console.log('Creating poll with data:', {
        tripId,
        userId,
        question,
        options,
        endTime
      });

      // Validate input
      if (!question?.trim()) {
        return res.status(400).json({ error: 'Question is required' });
      }

      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ error: 'At least 2 options are required' });
      }

      const filteredOptions = options.filter(opt => opt.trim());
      if (filteredOptions.length < 2) {
        return res.status(400).json({ error: 'At least 2 non-empty options are required' });
      }

      // Start transaction for both poll and chat message creation
      const result = await db.transaction(async (tx) => {
        // Create poll with exact schema match
        const [newPoll] = await tx.insert(polls).values({
          tripId,
          userId,
          question,
          options: filteredOptions,
          endTime: endTime ? new Date(endTime) : null,
          isClosed: false,
        }).returning();

        console.log('Created poll:', newPoll);

        if (!newPoll?.id) {
          throw new Error('Failed to create poll - no ID returned');
        }

        // Create chat message for the poll
        const [newMessage] = await tx.insert(chatMessages).values({
          tripId,
          userId,
          message: JSON.stringify({
            type: 'poll',
            pollId: newPoll.id,
            question: newPoll.question,
            options: newPoll.options
          })
        }).returning();

        console.log('Created chat message:', newMessage);

        // Get full message with user details
        const messageWithUser = await tx.query.chatMessages.findFirst({
          where: eq(chatMessages.id, newMessage.id),
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });

        return {
          poll: newPoll,
          message: messageWithUser
        };
      });

      res.json(result);
    } catch (error) {
      console.error('Error creating poll:', error);
      res.status(500).json({
        error: 'Failed to create poll',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/trips/:tripId/polls/:pollId", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const pollId = parseInt(req.params.pollId);

      const [poll] = await db.select().from(polls)
        .where(and(
          eq(polls.id, pollId),
          eq(polls.tripId, tripId)
        ));

      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      const votes = await db.select().from(pollVotes)
        .where(eq(pollVotes.pollId, pollId));

      res.json({ ...poll, votes });
    } catch (error) {
      console.error('Error fetching poll:', error);
      res.status(500).json({ error: 'Failed to fetch poll' });
    }
  });

  app.post("/api/trips/:tripId/polls/:pollId/vote", async (req, res) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const { optionIndex } = req.body;
      const userId = req.user?.id || 1;

      if (typeof optionIndex !== 'number') {
        return res.status(400).json({ error: 'Invalid option index' });
      }

      // Check if user has already voted
      const existingVote = await db.select().from(pollVotes)
        .where(and(
          eq(pollVotes.pollId, pollId),
          eq(pollVotes.userId, userId)
        ))
        .limit(1);

      if (existingVote.length > 0) {
        // Update existing vote
        const [vote] = await db.update(pollVotes)
          .set({ optionIndex })
          .where(eq(pollVotes.id, existingVote[0].id))
          .returning();
        return res.json(vote);
      }

      // Create new vote
      const [vote] = await db.insert(pollVotes).values({
        pollId,
        userId,
        optionIndex
      }).returning();

      res.json(vote);
    } catch (error) {
      console.error('Error submitting vote:', error);
      res.status(500).json({ error: 'Failed to submit vote' });
    }
  });

  // Create a new poll
  //This route is already removed in the edited section, so we skip it.

  // Get poll details with votes
  app.get("/api/trips/:tripId/polls/:pollId", async (req, res) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const poll = await db.query.polls.findFirst({
        where: eq(polls.id, pollId),
        with: {
          votes: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          user: {
            columns: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      res.json(poll);
    } catch (error) {
      console.error('Error fetching poll:', error);
      res.status(500).json({ error: 'Failed to fetch poll' });
    }
  });

  // Get polls for a trip
  app.get("/api/trips/:tripId/polls", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const tripPolls = await db.query.polls.findMany({
        where: eq(polls.tripId, tripId),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true
            }
          },
          votes: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        },
      });
      res.json(tripPolls);
    } catch (error) {
      console.error('Error fetching polls:', error);
      res.status(500).json({ error: 'Failed to fetch polls' });
    }
  });

  // Vote on a poll
  app.post("/api/trips/:tripId/polls/:pollId/vote", async (req, res) => {
    try {
      const userId = req.user?.id || 1;
      const pollId = parseInt(req.params.pollId);
      const { optionIndex } = req.body;

      // Check if user has already voted
      const existingVote = await db.query.pollVotes.findFirst({
        where: and(
          eq(pollVotes.pollId, pollId),
          eq(pollVotes.userId, userId)
        ),
      });

      if (existingVote) {
        // Update existing vote
        const [updatedVote] = await db
          .update(pollVotes)
          .set({ optionIndex })
          .where(eq(pollVotes.id, existingVote.id))
          .returning();
        res.json(updatedVote);
      } else {
        // Create new vote
        const [newVote] = await db.insert(pollVotes).values({
          pollId,
          userId,
          optionIndex,
        }).returning();
        res.json(newVote);
      }
    } catch (error) {
      console.error('Error voting on poll:', error);
      res.status(500).json({ error: 'Failed to vote on poll' });
    }
  });

  // Close a poll
  app.patch("/api/trips/:tripId/polls/:pollId", async (req, res) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const [updatedPoll] = await db
        .update(polls)
        .set({ isClosed: true })
        .where(eq(polls.id, pollId))
        .returning();
      res.json(updatedPoll);
    } catch (error) {
      console.error('Error closing poll:', error);
      res.status(500).json({ error: 'Failed to close poll' });
    }
  });

  // ===== EXPENSE MANAGEMENT ROUTES =====
  
  // Get all expenses for a trip
  app.get("/api/trips/:tripId/expenses", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      
      // Fetch expenses with user information
      const allExpenses = await db.select().from(expenses)
        .where(eq(expenses.tripId, tripId))
        .orderBy(sql`${expenses.date} DESC`);
      
      // For each expense, get the paid by user info
      const expensesWithUsers = await Promise.all(
        allExpenses.map(async (expense) => {
          const [user] = await db.select({
            id: users.id,
            name: users.name,
            email: users.email
            // avatar column may not exist in the users table
          })
          .from(users)
          .where(eq(users.id, expense.paidBy))
          .limit(1);
          
          // Add avatar field to user to prevent frontend errors
          const userWithAvatar = user ? { 
            ...user, 
            avatar: null // Provide a default null value
          } : null;
          
          const splits = await db.select().from(expenseSplits)
            .where(eq(expenseSplits.expenseId, expense.id));
            
          const splitsWithUsers = await Promise.all(
            splits.map(async (split) => {
              const [splitUser] = await db.select({
                id: users.id,
                name: users.name,
                email: users.email
                // avatar column may not exist in the users table
              })
              .from(users)
              .where(eq(users.id, split.userId))
              .limit(1);
              
              // Add avatar field to prevent frontend errors
              const splitUserWithAvatar = splitUser ? {
                ...splitUser,
                avatar: null // Provide a default null value
              } : null;
              
              return {
                ...split,
                user: splitUserWithAvatar
              };
            })
          );
          
          return {
            ...expense,
            user: userWithAvatar, // Use the variable with the avatar field
            splits: splitsWithUsers
          };
        })
      );
      
      res.json(expensesWithUsers);
    } catch (error) {
      console.error('Error fetching trip expenses:', error);
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  });
  
  // Create a new expense
  app.post("/api/trips/:tripId/expenses", async (req, res) => {
    try {
      const tripIdStr = req.params.tripId;
      
      if (!tripIdStr || isNaN(parseInt(tripIdStr))) {
        return res.status(400).json({ 
          error: 'Invalid trip ID',
          details: 'Trip ID must be a valid number'
        });
      }
      
      const tripId = parseInt(tripIdStr);
      const userId = req.user?.id || 1; // Default to user 1 for testing
      const { title, amount, currency, category, date, splits } = req.body;
      
      // Basic validation
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      
      let amountValue;
      try {
        amountValue = parseFloat(amount?.toString() || '0');
        if (isNaN(amountValue) || amountValue <= 0) {
          return res.status(400).json({ error: 'Valid positive amount is required' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid amount format' });
      }
      
      // Start a transaction to ensure both expense and splits are created
      const result = await db.transaction(async (tx) => {
        // Format the date properly, default to today if invalid
        let formattedDate;
        try {
          formattedDate = date ? new Date(date) : new Date();
          // Validate date is valid
          if (isNaN(formattedDate.getTime())) {
            formattedDate = new Date();
          }
        } catch (e) {
          formattedDate = new Date();
        }
        
        // Create the expense
        const [newExpense] = await tx.insert(expenses).values({
          tripId,
          paidBy: userId,
          title,
          amount: amountValue.toString(), // Store as string to avoid float precision issues
          currency: currency || 'USD',
          category: category || 'other',
          date: formattedDate,
        }).returning();
        
        if (!newExpense?.id) {
          throw new Error('Failed to create expense');
        }
        
        // Create the expense splits if provided
        let expenseSplitsData = [];
        if (Array.isArray(splits) && splits.length > 0) {
          // Filter out invalid user IDs (null or NaN)
          const validSplits = splits.filter(split => 
            split.userId && !isNaN(parseInt(split.userId.toString()))
          );
          
          if (validSplits.length > 0) {
            // Create splits based on provided data
            const splitsToInsert = validSplits.map(split => {
              const splitAmount = parseFloat(split.amount?.toString() || '0');
              return {
                expenseId: newExpense.id,
                userId: parseInt(split.userId.toString()),
                amount: (isNaN(splitAmount) ? 0 : splitAmount).toString(), // Store as string
                status: 'pending'
              };
            });
            
            expenseSplitsData = await tx.insert(expenseSplits)
              .values(splitsToInsert)
              .returning();
          } else {
            // Fall back to default split if all provided splits were invalid
            const defaultSplit = {
              expenseId: newExpense.id,
              userId: userId,
              amount: amountValue.toString(),
              status: 'paid'
            };
            
            expenseSplitsData = await tx.insert(expenseSplits)
              .values(defaultSplit)
              .returning();
          }
        } else {
          // Default: split equally among all trip participants that have a valid userId
          const tripParticipants = await tx.select().from(participants)
            .where(eq(participants.tripId, tripId));
          
          // Filter participants to only include those with valid userId
          const validParticipants = tripParticipants.filter(participant => 
            participant.userId !== null && !isNaN(parseInt(participant.userId.toString()))
          );
          
          if (validParticipants.length > 0) {
            const equalAmount = amountValue / validParticipants.length;
            
            const splitsToInsert = validParticipants.map(participant => ({
              expenseId: newExpense.id,
              userId: parseInt(participant.userId.toString()),
              amount: equalAmount.toString(), // Store as string
              status: participant.userId === userId ? 'paid' : 'pending'
            }));
            
            expenseSplitsData = await tx.insert(expenseSplits)
              .values(splitsToInsert)
              .returning();
          } else {
            // If no valid participants, create a split for the expense creator
            const defaultSplit = {
              expenseId: newExpense.id,
              userId: userId,
              amount: amountValue.toString(),
              status: 'paid'
            };
            
            expenseSplitsData = await tx.insert(expenseSplits)
              .values(defaultSplit)
              .returning();
          }
        }
        
        return {
          expense: newExpense,
          splits: expenseSplitsData
        };
      });
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Error creating expense:', error);
      res.status(500).json({ 
        error: 'Failed to create expense',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get expense summary/breakdown by category for a trip
  app.get("/api/trips/:tripId/expenses/summary", async (req, res) => {
    try {
      const tripIdStr = req.params.tripId;
      
      if (!tripIdStr || isNaN(parseInt(tripIdStr))) {
        return res.status(400).json({ 
          error: 'Invalid trip ID',
          details: 'Trip ID must be a valid number'
        });
      }
      
      const tripId = parseInt(tripIdStr);
      
      // Get all expenses for the trip
      const tripExpenses = await db.select().from(expenses)
        .where(eq(expenses.tripId, tripId));
      
      if (tripExpenses.length === 0) {
        return res.json({
          totalExpenses: 0,
          currency: 'USD',
          categoryBreakdown: [],
          dateBreakdown: []
        });
      }
      
      // Calculate total expenses with safety checks
      const total = tripExpenses.reduce((sum, expense) => {
        // Ensure amount is a valid number before adding
        const amountStr = expense.amount?.toString() || '0';
        const amount = parseFloat(amountStr);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
      // Group by category with safety checks
      const byCategory: Record<string, number> = {};
      tripExpenses.forEach(expense => {
        const category = expense.category || 'other';
        if (!byCategory[category]) {
          byCategory[category] = 0;
        }
        
        // Ensure amount is a valid number before adding
        const amountStr = expense.amount?.toString() || '0';
        const amount = parseFloat(amountStr);
        byCategory[category] += isNaN(amount) ? 0 : amount;
      });
      
      // Convert to percentage and array format for charts
      const categoryBreakdown = Object.entries(byCategory).map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? ((amount as number) / total * 100).toFixed(1) : '0'
      }));
      
      // Get expenses by date (for timeline/trends) with safety checks
      const byDate: Record<string, number> = {};
      tripExpenses.forEach(expense => {
        // Handle date safely
        let dateStr = '';
        try {
          if (typeof expense.date === 'string') {
            dateStr = new Date(expense.date).toISOString().split('T')[0];
          } else if (expense.date instanceof Date) {
            dateStr = expense.date.toISOString().split('T')[0];
          } else {
            dateStr = new Date().toISOString().split('T')[0]; // Fallback to today
          }
        } catch (e) {
          dateStr = new Date().toISOString().split('T')[0]; // Fallback to today
        }
        
        if (!byDate[dateStr]) {
          byDate[dateStr] = 0;
        }
        
        // Ensure amount is a valid number before adding
        const amountStr = expense.amount?.toString() || '0';
        const amount = parseFloat(amountStr);
        byDate[dateStr] += isNaN(amount) ? 0 : amount;
      });
      
      // Convert to array format for charts
      const dateBreakdown = Object.entries(byDate)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      res.json({
        totalExpenses: total,
        currency: tripExpenses[0]?.currency || 'USD',
        categoryBreakdown,
        dateBreakdown
      });
    } catch (error) {
      console.error('Error generating expense summary:', error);
      res.status(500).json({ error: 'Failed to generate expense summary' });
    }
  });

  // Get expense details
  app.get("/api/trips/:tripId/expenses/:expenseId", async (req, res) => {
    try {
      const expenseIdStr = req.params.expenseId;
      
      if (!expenseIdStr || isNaN(parseInt(expenseIdStr))) {
        return res.status(400).json({ 
          error: 'Invalid expense ID',
          details: 'Expense ID must be a valid number'
        });
      }
      
      const expenseId = parseInt(expenseIdStr);
      
      const expense = await db.select().from(expenses)
        .where(eq(expenses.id, expenseId))
        .limit(1);
        
      if (expense.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      const [paidByUser] = await db.select({
        id: users.id,
        name: users.name,
        email: users.email
        // avatar column may not exist in the users table
      })
      .from(users)
      .where(eq(users.id, expense[0].paidBy))
      .limit(1);
      
      // Add avatar field to user to prevent frontend errors
      const paidByUserWithAvatar = paidByUser ? { 
        ...paidByUser, 
        avatar: null // Provide a default null value
      } : null;
      
      const splits = await db.select().from(expenseSplits)
        .where(eq(expenseSplits.expenseId, expenseId));
        
      const splitsWithUsers = await Promise.all(
        splits.map(async (split) => {
          const [splitUser] = await db.select({
            id: users.id,
            name: users.name,
            email: users.email
            // avatar column may not exist in the users table
          })
          .from(users)
          .where(eq(users.id, split.userId))
          .limit(1);
          
          // Add avatar field to prevent frontend errors
          const splitUserWithAvatar = splitUser ? {
            ...splitUser,
            avatar: null // Provide a default null value
          } : null;
          
          return {
            ...split,
            user: splitUserWithAvatar
          };
        })
      );
      
      res.json({
        ...expense[0],
        user: paidByUserWithAvatar,  // Use the variable with the avatar field
        splits: splitsWithUsers
      });
    } catch (error) {
      console.error('Error fetching expense details:', error);
      res.status(500).json({ error: 'Failed to fetch expense details' });
    }
  });
  
  // Update an expense
  app.patch("/api/trips/:tripId/expenses/:expenseId", async (req, res) => {
    try {
      const tripIdStr = req.params.tripId;
      const expenseIdStr = req.params.expenseId;
      
      if (!tripIdStr || isNaN(parseInt(tripIdStr))) {
        return res.status(400).json({ 
          error: 'Invalid trip ID',
          details: 'Trip ID must be a valid number'
        });
      }
      
      if (!expenseIdStr || isNaN(parseInt(expenseIdStr))) {
        return res.status(400).json({ 
          error: 'Invalid expense ID',
          details: 'Expense ID must be a valid number'
        });
      }
      
      const tripId = parseInt(tripIdStr);
      const expenseId = parseInt(expenseIdStr);
      const userId = req.user?.id || 1;
      const { title, amount, currency, category, date, splits } = req.body;
      
      // Verify the expense exists and belongs to the trip
      const [expense] = await db.select().from(expenses)
        .where(and(
          eq(expenses.id, expenseId),
          eq(expenses.tripId, tripId)
        ))
        .limit(1);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      // Verify the user is the one who paid (or implement other permission logic)
      if (expense.paidBy !== userId) {
        return res.status(403).json({ error: 'You can only update expenses you paid for' });
      }
      
      // Start a transaction for updating expense and splits
      const result = await db.transaction(async (tx) => {
        // Convert amount safely
        let amountValue;
        try {
          amountValue = amount ? parseFloat(amount.toString()) : expense.amount;
          if (isNaN(amountValue)) {
            amountValue = expense.amount;
          }
        } catch (e) {
          amountValue = expense.amount;
        }
        
        // Format the date properly
        let formattedDate;
        try {
          formattedDate = date ? new Date(date) : expense.date;
          // Validate date is valid
          if (isNaN(formattedDate.getTime())) {
            formattedDate = expense.date;
          }
        } catch (e) {
          formattedDate = expense.date;
        }
        
        // Update the expense
        const [updatedExpense] = await tx.update(expenses)
          .set({
            title: title || expense.title,
            amount: amountValue.toString(), // Store as string
            currency: currency || expense.currency,
            category: category || expense.category,
            date: formattedDate,
          })
          .where(eq(expenses.id, expenseId))
          .returning();
        
        // If splits were provided, update them
        if (Array.isArray(splits) && splits.length > 0) {
          // Filter out invalid user IDs (null or NaN)
          const validSplits = splits.filter(split => 
            split.userId && !isNaN(parseInt(split.userId.toString()))
          );
          
          if (validSplits.length > 0) {
            // First delete existing splits
            await tx.delete(expenseSplits)
              .where(eq(expenseSplits.expenseId, expenseId));
            
            // Then insert new splits
            const splitsToInsert = validSplits.map(split => {
              const splitAmount = parseFloat(split.amount?.toString() || '0');
              return {
                expenseId,
                userId: parseInt(split.userId.toString()),
                amount: (isNaN(splitAmount) ? 0 : splitAmount).toString(), // Store as string
                status: split.status || 'pending'
              };
            });
            
            const newSplits = await tx.insert(expenseSplits)
              .values(splitsToInsert)
              .returning();
            
            return {
              expense: updatedExpense,
              splits: newSplits
            };
          }
        }
        
        // Otherwise just return the updated expense with existing splits
        const existingSplits = await tx.select().from(expenseSplits)
          .where(eq(expenseSplits.expenseId, expenseId));
        
        return {
          expense: updatedExpense,
          splits: existingSplits
        };
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error updating expense:', error);
      res.status(500).json({ error: 'Failed to update expense' });
    }
  });
  
  // Delete an expense
  app.delete("/api/trips/:tripId/expenses/:expenseId", async (req, res) => {
    try {
      const tripIdStr = req.params.tripId;
      const expenseIdStr = req.params.expenseId;
      
      if (!tripIdStr || isNaN(parseInt(tripIdStr))) {
        return res.status(400).json({ 
          error: 'Invalid trip ID',
          details: 'Trip ID must be a valid number'
        });
      }
      
      if (!expenseIdStr || isNaN(parseInt(expenseIdStr))) {
        return res.status(400).json({ 
          error: 'Invalid expense ID',
          details: 'Expense ID must be a valid number'
        });
      }
      
      const tripId = parseInt(tripIdStr);
      const expenseId = parseInt(expenseIdStr);
      const userId = req.user?.id || 1;
      
      // Verify the expense exists and belongs to the trip
      const [expense] = await db.select().from(expenses)
        .where(and(
          eq(expenses.id, expenseId),
          eq(expenses.tripId, tripId)
        ))
        .limit(1);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      // We're allowing any trip participant to delete expenses now
      // Check if user is a participant in this trip
      const [participant] = await db.select().from(participants)
        .where(and(
          eq(participants.tripId, tripId),
          eq(participants.userId, userId)
        ))
        .limit(1);
      
      if (!participant) {
        return res.status(403).json({ error: 'You must be a participant in this trip to delete expenses' });
      }
      
      // Delete the expense and related splits in a transaction
      await db.transaction(async (tx) => {
        // First delete the splits
        const splitResult = await tx.delete(expenseSplits)
          .where(eq(expenseSplits.expenseId, expenseId))
          .returning();
        
        console.log(`Deleted ${splitResult.length} expense splits for expense ${expenseId}`);
        
        // Then delete the expense
        const expenseResult = await tx.delete(expenses)
          .where(eq(expenses.id, expenseId))
          .returning();
        
        console.log(`Deleted expense result:`, expenseResult);
        
        if (expenseResult.length === 0) {
          throw new Error(`Failed to delete expense with ID ${expenseId}`);
        }
      });
      
      res.json({ success: true, message: 'Expense deleted successfully' });
    } catch (error) {
      console.error('Error deleting expense:', error);
      res.status(500).json({ error: 'Failed to delete expense' });
    }
  });
  
  // Trip Ideas Endpoints
  // GET all trip ideas
  app.get("/api/trips/:tripId/ideas", async (req, res) => {
    try {
      const tripIdStr = req.params.tripId;
      if (!tripIdStr || isNaN(parseInt(tripIdStr))) {
        return res.status(400).json({ error: 'Invalid trip ID' });
      }
      
      const tripId = parseInt(tripIdStr);
      
      // Get trip ideas with owner details
      const ideas = await db
        .select({
          id: tripIdeas.id,
          tripId: tripIdeas.tripId,
          title: tripIdeas.title,
          description: tripIdeas.description,
          status: tripIdeas.status,
          ownerId: tripIdeas.ownerId,
          location: tripIdeas.location,
          votes: tripIdeas.votes,
          createdAt: tripIdeas.createdAt,
          updatedAt: tripIdeas.updatedAt,
          ownerName: users.name,
          // Don't select avatar in case it doesn't exist in the database yet
        })
        .from(tripIdeas)
        .leftJoin(users, eq(tripIdeas.ownerId, users.id))
        .where(eq(tripIdeas.tripId, tripId))
        .orderBy(desc(tripIdeas.votes), desc(tripIdeas.createdAt));
        
      res.json(ideas);
    } catch (error) {
      console.error("Error fetching trip ideas:", error);
      res.status(500).json({ error: "Failed to fetch trip ideas" });
    }
  });

  // POST new trip idea
  app.post("/api/trips/:tripId/ideas", async (req, res) => {
    try {
      const tripIdStr = req.params.tripId;
      if (!tripIdStr || isNaN(parseInt(tripIdStr))) {
        return res.status(400).json({ error: 'Invalid trip ID' });
      }
      
      const tripId = parseInt(tripIdStr);
      const userId = req.user?.id || 1;
      
      const { title, description, status, location, plannedDate, plannedEndDate } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      
      // Ensure valid status
      const validStatuses = ["pending", "booked", "unsure"];
      const ideaStatus = status && validStatuses.includes(status) ? status : "pending";
      
      // Insert new idea
      const [idea] = await db.insert(tripIdeas)
        .values({
          tripId,
          title,
          description,
          status: ideaStatus,
          ownerId: userId,
          location,
          votes: 0,
          plannedDate: plannedDate ? new Date(plannedDate) : null,
          plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        })
        .returning();
        
      // Get owner details
      const [owner] = await db.select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId));
      
      // Return idea with owner details
      res.status(201).json({
        ...idea,
        ownerName: owner?.name,
      });
    } catch (error) {
      console.error("Error creating trip idea:", error);
      res.status(500).json({ error: "Failed to create trip idea" });
    }
  });

  // UPDATE trip idea
  app.patch("/api/trips/:tripId/ideas/:ideaId", async (req, res) => {
    try {
      const tripIdStr = req.params.tripId;
      const ideaIdStr = req.params.ideaId;
      
      if (!tripIdStr || isNaN(parseInt(tripIdStr)) || !ideaIdStr || isNaN(parseInt(ideaIdStr))) {
        return res.status(400).json({ error: 'Invalid ID parameters' });
      }
      
      const tripId = parseInt(tripIdStr);
      const ideaId = parseInt(ideaIdStr);
      const userId = req.user?.id || 1;
      
      // Find the idea first
      const [existingIdea] = await db.select()
        .from(tripIdeas)
        .where(and(
          eq(tripIdeas.id, ideaId),
          eq(tripIdeas.tripId, tripId)
        ));
        
      if (!existingIdea) {
        return res.status(404).json({ error: "Trip idea not found" });
      }
      
      // Check if user is a participant of this trip
      const [participant] = await db.select()
        .from(participants)
        .where(and(
          eq(participants.tripId, tripId),
          eq(participants.userId, userId)
        ));
        
      if (!participant) {
        return res.status(403).json({ error: "You must be a participant in this trip to update ideas" });
      }
      
      const { title, description, status, location, ownerId, plannedDate, plannedEndDate } = req.body;
      
      // Validate status if provided
      const validStatuses = ["pending", "booked", "unsure"];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be 'pending', 'booked', or 'unsure'" });
      }
      
      // Update idea
      const [updatedIdea] = await db.update(tripIdeas)
        .set({
          title: title || existingIdea.title,
          description: description !== undefined ? description : existingIdea.description,
          status: status || existingIdea.status,
          location: location !== undefined ? location : existingIdea.location,
          ownerId: ownerId || existingIdea.ownerId,
          plannedDate: plannedDate !== undefined ? (plannedDate ? new Date(plannedDate) : null) : existingIdea.plannedDate,
          plannedEndDate: plannedEndDate !== undefined ? (plannedEndDate ? new Date(plannedEndDate) : null) : existingIdea.plannedEndDate,
          updatedAt: new Date()
        })
        .where(eq(tripIdeas.id, ideaId))
        .returning();
        
      // Get owner details
      const ownerId2 = updatedIdea.ownerId;
      const [owner] = ownerId2 ? await db.select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, ownerId2)) : [null];
      
      // Return updated idea with owner details
      res.json({
        ...updatedIdea,
        ownerName: owner?.name,
      });
    } catch (error) {
      console.error("Error updating trip idea:", error);
      res.status(500).json({ error: "Failed to update trip idea" });
    }
  });

  // DELETE trip idea
  app.delete("/api/trips/:tripId/ideas/:ideaId", async (req, res) => {
    try {
      const tripIdStr = req.params.tripId;
      const ideaIdStr = req.params.ideaId;
      
      if (!tripIdStr || isNaN(parseInt(tripIdStr)) || !ideaIdStr || isNaN(parseInt(ideaIdStr))) {
        return res.status(400).json({ error: 'Invalid ID parameters' });
      }
      
      const tripId = parseInt(tripIdStr);
      const ideaId = parseInt(ideaIdStr);
      const userId = req.user?.id || 1;
      
      // Find the idea first
      const [existingIdea] = await db.select()
        .from(tripIdeas)
        .where(and(
          eq(tripIdeas.id, ideaId),
          eq(tripIdeas.tripId, tripId)
        ));
        
      if (!existingIdea) {
        return res.status(404).json({ error: "Trip idea not found" });
      }
      
      // Check if user is a participant of this trip
      const [participant] = await db.select()
        .from(participants)
        .where(and(
          eq(participants.tripId, tripId),
          eq(participants.userId, userId)
        ));
        
      if (!participant) {
        return res.status(403).json({ error: "You must be a participant in this trip to delete ideas" });
      }
      
      // Delete the idea
      await db.delete(tripIdeas)
        .where(eq(tripIdeas.id, ideaId));
        
      res.json({ success: true, message: "Trip idea deleted successfully" });
    } catch (error) {
      console.error("Error deleting trip idea:", error);
      res.status(500).json({ error: "Failed to delete trip idea" });
    }
  });

  // Vote on trip idea
  app.post("/api/trips/:tripId/ideas/:ideaId/vote", async (req, res) => {
    try {
      const tripIdStr = req.params.tripId;
      const ideaIdStr = req.params.ideaId;
      
      if (!tripIdStr || isNaN(parseInt(tripIdStr)) || !ideaIdStr || isNaN(parseInt(ideaIdStr))) {
        return res.status(400).json({ error: 'Invalid ID parameters' });
      }
      
      const tripId = parseInt(tripIdStr);
      const ideaId = parseInt(ideaIdStr);
      const userId = req.user?.id || 1;
      
      // Check if user is a participant of this trip
      const [participant] = await db.select()
        .from(participants)
        .where(and(
          eq(participants.tripId, tripId),
          eq(participants.userId, userId)
        ));
        
      if (!participant) {
        return res.status(403).json({ error: "You must be a participant in this trip to vote on ideas" });
      }
      
      // Find the idea
      const [existingIdea] = await db.select()
        .from(tripIdeas)
        .where(and(
          eq(tripIdeas.id, ideaId),
          eq(tripIdeas.tripId, tripId)
        ));
        
      if (!existingIdea) {
        return res.status(404).json({ error: "Trip idea not found" });
      }
      
      // Increment vote count
      const [updatedIdea] = await db.update(tripIdeas)
        .set({
          votes: existingIdea.votes + 1,
          updatedAt: new Date()
        })
        .where(eq(tripIdeas.id, ideaId))
        .returning();
        
      res.json(updatedIdea);
    } catch (error) {
      console.error("Error voting on trip idea:", error);
      res.status(500).json({ error: "Failed to vote on trip idea" });
    }
  });

  // Update expense split status (mark as paid)
  app.patch("/api/trips/:tripId/expenses/:expenseId/splits/:splitId", async (req, res) => {
    try {
      const splitIdStr = req.params.splitId;
      
      if (!splitIdStr || isNaN(parseInt(splitIdStr))) {
        return res.status(400).json({ 
          error: 'Invalid split ID',
          details: 'Split ID must be a valid number'
        });
      }
      
      const splitId = parseInt(splitIdStr);
      const { status } = req.body;
      
      if (!status || !['pending', 'paid'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      
      const [updatedSplit] = await db.update(expenseSplits)
        .set({ status })
        .where(eq(expenseSplits.id, splitId))
        .returning();
      
      if (!updatedSplit) {
        return res.status(404).json({ error: 'Split not found' });
      }
      
      res.json(updatedSplit);
    } catch (error) {
      console.error('Error updating expense split:', error);
      res.status(500).json({ error: 'Failed to update expense split' });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}