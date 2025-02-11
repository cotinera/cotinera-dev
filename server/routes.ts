import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { crypto } from "./auth.js";
import express from "express";
import { setupAuth } from "./auth";
import { db } from "@db";
import { trips, participants, activities, checklist, documents, shareLinks, flights, accommodations, chatMessages, users, destinations } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
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

  // Get trip with share token
  app.get("/api/share/:token", async (req, res) => {
    try {
      const [shareLink] = await db.select().from(shareLinks).where(and(eq(shareLinks.token, req.params.token), eq(shareLinks.isActive, true))).limit(1);

      if (!shareLink) {
        return res.status(404).send("Share link not found or expired");
      }

      if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
        await db.update(shareLinks).set({ isActive: false }).where(eq(shareLinks.id, shareLink.id));
        return res.status(404).send("Share link expired");
      }

      if (req.isAuthenticated() && req.user) {
        const [existingParticipant] = await db.select().from(participants).where(and(eq(participants.tripId, shareLink.tripId), eq(participants.userId, req.user.id))).limit(1);

        if (!existingParticipant) {
          await db.insert(participants).values({
            tripId: shareLink.tripId,
            userId: req.user.id,
            status: shareLink.accessLevel === 'edit' ? 'collaborator' : 'viewer',
          });
        } else if (existingParticipant.status === 'viewer' && shareLink.accessLevel === 'edit') {
          await db.update(participants).set({ status: 'collaborator' }).where(eq(participants.id, existingParticipant.id));
        }
      }

      const trip = await db.query.trips.findFirst({
        where: eq(trips.id, shareLink.tripId),
        with: {
          participants: {
            with: {
              user: true,
            },
          },
          activities: true,
          checklist: true,
        },
      });

      if (!trip) {
        return res.status(404).send("Trip not found");
      }

      res.json({
        trip,
        accessLevel: shareLink.accessLevel,
        isParticipant: req.user ? trip.participants.some(p => p.userId === req.user.id) : false
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
      // For date-only fields, ensure they are stored at UTC midnight
      const startDate = `${req.body.startDate}T00:00:00.000Z`;
      const endDate = `${req.body.endDate}T00:00:00.000Z`;

      const [updatedTrip] = await db
        .update(trips)
        .set({
          title: req.body.title,
          location: req.body.location,
          startDate,
          endDate,
        })
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
        participants: req.body.participants || [],
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
              avatar: true
            }
          }
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

  // Share Links
  app.post("/api/trips/:tripId/share", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const { expiresInDays = 7, accessLevel = "view" } = req.body;

      let expiresAt = null;
      if (expiresInDays > 0) {
        expiresAt = addDays(new Date(), expiresInDays);
      }

      const [shareLink] = await db
        .insert(shareLinks)
        .values({
          tripId,
          accessLevel,
          expiresAt,
          isActive: true,
        })
        .returning();

      res.json(shareLink);
    } catch (error) {
      console.error('Error creating share link:', error);
      res.status(500).json({ error: 'Failed to create share link' });
    }
  });

  app.delete("/api/trips/:tripId/share/:linkId", async (req, res) => {
    try {
      const [revokedLink] = await db
        .update(shareLinks)
        .set({ isActive: false })
        .where(
          and(
            eq(shareLinks.id, parseInt(req.params.linkId)),
            eq(shareLinks.tripId, parseInt(req.params.tripId))
          )
        )
        .returning();

      if (!revokedLink) {
        return res.status(404).json({ error: 'Share link not found' });
      }

      res.json(revokedLink);
    } catch (error) {
      console.error('Error revoking share link:', error);
      res.status(500).json({ error: 'Failed to revoke share link' });
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

  // Add participant to trip
  app.post("/api/trips/:tripId/participants", async (req, res) => {
    try {
      console.log('Received participant creation request:', req.body);

      // Validate input
      const tripId = parseInt(req.params.tripId);
      const { name, email, passportNumber, arrivalDate, departureDate, flightNumber, airline, accommodation } = req.body;

      if (!name) {
        console.log('Validation failed: missing name');
        return res.status(400).json({ error: "Name is required" });
      }

      // Create participant entry without requiring user account
      console.log('Creating participant entry');
      try {
        const participantData = {
          tripId,
          name,
          status: 'pending', // Changed from 'confirmed' to 'pending'
          arrivalDate: arrivalDate ? new Date(arrivalDate) : null,
          departureDate: departureDate ? new Date(departureDate) : null,
          flightStatus: 'pending',
          hotelStatus: 'pending',
        };

        const [newParticipant] = await db.insert(participants).values(participantData).returning();
        console.log('Created participant:', newParticipant);

        // If flight details provided, create flight entry
        if (airline && flightNumber) {
          console.log('Creating flight entry');
          await db.insert(flights).values({
            tripId,
            airline,
            flightNumber,
            departureAirport: '', // These can be updated later
            arrivalAirport: '',
            departureDate: newParticipant.arrivalDate,
            departureTime: '12:00', // Default time, can be updated later
            arrivalDate: newParticipant.arrivalDate,
            arrivalTime: '14:00', // Default time, can be updated later
            bookingReference: flightNumber,
            bookingStatus: 'pending',
          });
        }

        // If accommodation details provided, create accommodation entry
        if (accommodation) {
          console.log('Creating accommodation entry');
          await db.insert(accommodations).values({
            tripId,
            name: accommodation,
            type: 'hotel', // Default type
            address: '', // Can be updated later
            checkInDate: newParticipant.arrivalDate || new Date(),
            checkOutDate: newParticipant.departureDate || new Date(),
            bookingReference: 'TBD',
            bookingStatus: 'pending',
          });
        }

        res.json(newParticipant);
      } catch (error) {
        console.error('Error creating participant:', error);
        return res.status(500).json({ error: "Failed to create participant entry" });
      }
    } catch (error) {
      console.error('Error creating participant:', error);
      res.status(500).json({ error: 'Failed to create participant: ' + (error instanceof Error ? error.message : 'Unknown error') });
    }
  });

  // Get participants for a trip
  app.get("/api/trips/:tripId/participants", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      console.log('Fetching participants for trip:', tripId);

      const tripParticipants = await db.select({
        id: participants.id,
        name: participants.name,
        tripId: participants.tripId,
        arrivalDate: participants.arrivalDate,
        departureDate: participants.departureDate,
        flightStatus: participants.flightStatus,
        hotelStatus: participants.hotelStatus,
      })
        .from(participants)
        .where(eq(participants.tripId, tripId));

      console.log('Found participants:', tripParticipants);

      // Fetch all flights and accommodations for the trip
      const [tripFlights, tripAccommodations] = await Promise.all([
        db.select().from(flights).where(eq(flights.tripId, tripId)),
        db.select().from(accommodations).where(eq(accommodations.tripId, tripId))
      ]);

      // Map the participants with their details
      const participantsWithDetails = tripParticipants.map((participant) => ({
        ...participant,
        flights: tripFlights,
        accommodation: tripAccommodations[0] // Using first accommodation for now
      }));

      console.log('Returning participants with details:', participantsWithDetails);
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
      if (!['yes', 'no', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const participantId = parseInt(req.params.participantId);

      const [updatedParticipant] = await db
        .update(participants)
        .set({ status })
        .where(eq(participants.id, participantId))
        .returning();

      if (!updatedParticipant) {
        return res.status(404).json({ error: 'Participant not found' });
      }

      res.json(updatedParticipant);
    } catch (error) {
      console.error('Error updating participant status:', error);
      res.status(500).json({ error: 'Failed to update participant status' });
    }
  });

  // Add this endpoint right after the other participant routes, before the destinations routes
  app.delete("/api/trips/:tripId/participants/:participantId", async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const participantId = parseInt(req.params.participantId);

      // Delete the participant first since it's the main entity
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

      // Get the current highest order for this trip's destinations
      const [maxOrder] = await db
        .select({ maxOrder: sql`MAX(${destinations.order})` })
        .from(destinations)
        .where(eq(destinations.tripId, tripId));

      const newOrder = (maxOrder?.maxOrder || 0) + 1;

      const [newDestination] = await db.insert(destinations).values({
        tripId,
        name: req.body.name,
        description: req.body.description,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
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
      const [updatedDestination] = await db
        .update(destinations)
        .set({
          name: req.body.name,
          startDate: new Date(req.body.startDate),
          endDate: new Date(req.body.endDate),
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

  const httpServer = createServer(app);
  return httpServer;
}