import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { crypto } from "./auth.js";
import express from "express";
import { setupAuth } from "./auth";
import { db } from "@db";
import { trips, participants, activities, checklist, documents, shareLinks, flights, accommodations, chatMessages, users, destinations, pinnedPlaces, polls, pollVotes } from "@db/schema";
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
      const updatedParticipant = await db.transaction(async (tx) => {
        // Get current participant
        const [currentParticipant] = await tx
          .select()
          .from(participants)
          .where(
            and(
              eq(participants.id, participantId),
              eq(participants.tripId, tripId)
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

  // Delete participant endpoint
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

      // Get current max order
      const [result] = await db
        .select({ maxOrder: sql`MAX(${destinations.order})` })
        .from(destinations)
        .where(eq(destinations.tripId, tripId));

      const newOrder = (result?.maxOrder || 0) + 1;

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

  const httpServer = createServer(app);
  return httpServer;
}