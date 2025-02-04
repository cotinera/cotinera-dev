import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { trips, participants, activities, checklist, documents, shareLinks, flights, accommodations, chatMessages } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { addDays } from "date-fns";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Get single trip
  app.get("/api/trips/:id", async (req, res) => {
    try {
      const tripId = parseInt(req.params.id);

      // First get the trip without relations to check if it exists
      const [trip] = await db
        .select()
        .from(trips)
        .where(eq(trips.id, tripId))
        .limit(1);

      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Then fetch all related data separately
      const [tripParticipants, tripActivities, tripFlights, tripAccommodations, tripChecklistItems] = await Promise.all([
        db.select().from(participants).where(eq(participants.tripId, tripId)),
        db.select().from(activities).where(eq(activities.tripId, tripId)),
        db.select().from(flights).where(eq(flights.tripId, tripId)),
        db.select().from(accommodations).where(eq(accommodations.tripId, tripId)),
        db.select().from(checklist).where(eq(checklist.tripId, tripId))
      ]);

      // Combine all data
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

  // Get trip with share token
  app.get("/api/share/:token", async (req, res) => {
    const [shareLink] = await db
      .select()
      .from(shareLinks)
      .where(
        and(
          eq(shareLinks.token, req.params.token),
          eq(shareLinks.isActive, true)
        )
      )
      .limit(1);

    if (!shareLink) {
      return res.status(404).send("Share link not found or expired");
    }

    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      await db
        .update(shareLinks)
        .set({ isActive: false })
        .where(eq(shareLinks.id, shareLink.id));
      return res.status(404).send("Share link expired");
    }

    const trip = await db.query.trips.findFirst({
      where: eq(trips.id, shareLink.tripId),
      with: {
        participants: true,
        activities: true,
        checklist: true,
      },
    });

    if (!trip) {
      return res.status(404).send("Trip not found");
    }

    res.json({ trip, accessLevel: shareLink.accessLevel });
  });

  // Get trips
  app.get("/api/trips", async (req, res) => {
    try {
      // Get trips where user is owner
      const ownedTrips = await db.query.trips.findMany({
        where: eq(trips.ownerId, req.user?.id || 1), // Fallback for development
        with: {
          participants: true,
          activities: true,
          flights: true,
          accommodations: true,
        },
      });

      // Get trips where user is a participant via participants table
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

      // Extract the trips from participant records
      const participatedTrips = participantTrips.map(p => p.trip);

      res.json([...ownedTrips, ...participatedTrips]);
    } catch (error) {
      console.error('Error fetching trips:', error);
      res.status(500).json({ error: 'Failed to fetch trips' });
    }
  });

  // Create trip
  app.post("/api/trips", async (req, res) => {
    try {
      const [newTrip] = await db.insert(trips).values({
        ...req.body,
        ownerId: req.user?.id || 1, // Fallback for development
      }).returning();

      res.json(newTrip);
    } catch (error) {
      console.error('Error creating trip:', error);
      res.status(500).json({ error: 'Failed to create trip' });
    }
  });


  // Flights
  app.get("/api/trips/:tripId/flights", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const flightsList = await db.query.flights.findMany({
        where: eq(flights.tripId, tripId),
      });
      res.json(flightsList);
    } catch (error) {
      console.error('Error fetching flights:', error);
      res.status(500).json({ error: 'Failed to fetch flights' });
    }
  });

  app.post("/api/trips/:tripId/flights", async (req, res) => {
    try {
      const [newFlight] = await db.insert(flights).values({
        ...req.body,
        tripId: parseInt(req.params.tripId),
      }).returning();

      res.json(newFlight);
    } catch (error) {
      console.error('Error creating flight:', error);
      res.status(500).json({ error: 'Failed to create flight' });
    }
  });

  app.patch("/api/trips/:tripId/flights/:flightId", async (req, res) => {
    try {
      const [flight] = await db
        .update(flights)
        .set(req.body)
        .where(
          and(
            eq(flights.id, parseInt(req.params.flightId)),
            eq(flights.tripId, parseInt(req.params.tripId))
          )
        )
        .returning();

      res.json(flight);
    } catch (error) {
      console.error('Error updating flight:', error);
      res.status(500).json({ error: 'Failed to update flight' });
    }
  });

  // Accommodations
  app.get("/api/trips/:tripId/accommodations", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const accommodationsList = await db.query.accommodations.findMany({
        where: eq(accommodations.tripId, tripId),
      });
      res.json(accommodationsList);
    } catch (error) {
      console.error('Error fetching accommodations:', error);
      res.status(500).json({ error: 'Failed to fetch accommodations' });
    }
  });

  app.post("/api/trips/:tripId/accommodations", async (req, res) => {
    try {
      const [newAccommodation] = await db.insert(accommodations).values({
        ...req.body,
        tripId: parseInt(req.params.tripId),
      }).returning();

      res.json(newAccommodation);
    } catch (error) {
      console.error('Error creating accommodation:', error);
      res.status(500).json({ error: 'Failed to create accommodation' });
    }
  });

  app.patch("/api/trips/:tripId/accommodations/:accommodationId", async (req, res) => {
    try {
      const [accommodation] = await db
        .update(accommodations)
        .set(req.body)
        .where(
          and(
            eq(accommodations.id, parseInt(req.params.accommodationId)),
            eq(accommodations.tripId, parseInt(req.params.tripId))
          )
        )
        .returning();

      res.json(accommodation);
    } catch (error) {
      console.error('Error updating accommodation:', error);
      res.status(500).json({ error: 'Failed to update accommodation' });
    }
  });

  // Activities
  app.post("/api/trips/:tripId/activities", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const newActivity = await db.insert(activities).values({
      ...req.body,
      tripId: parseInt(req.params.tripId),
    }).returning();

    res.json(newActivity[0]);
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
          user: true,
        },
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      });
      res.json(messages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  });

  app.post("/api/trips/:tripId/chat", async (req, res) => {
    // For development, allow without authentication
    const userId = req.user?.id || 1;

    try {
      const [message] = await db.insert(chatMessages).values({
        tripId: parseInt(req.params.tripId),
        userId: userId,
        message: req.body.message,
      }).returning();

      const messageWithUser = await db.query.chatMessages.findFirst({
        where: eq(chatMessages.id, message.id),
        with: {
          user: true,
        },
      });

      res.json(messageWithUser);
    } catch (error) {
      console.error('Error creating chat message:', error);
      res.status(500).json({ error: 'Failed to create chat message' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}