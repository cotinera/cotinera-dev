import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { trips, participants, activities, checklist, documents, shareLinks, flights, accommodations } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { addDays } from "date-fns";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

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

  // Create share link
  app.post("/api/trips/:tripId/share", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const tripId = parseInt(req.params.tripId);
    const { expiresInDays = 7, accessLevel = "view" } = req.body;

    // Verify trip ownership
    const [trip] = await db
      .select()
      .from(trips)
      .where(
        and(
          eq(trips.id, tripId),
          eq(trips.ownerId, req.user.id)
        )
      )
      .limit(1);

    if (!trip) {
      return res.status(404).send("Trip not found or unauthorized");
    }

    const expiresAt = expiresInDays ? addDays(new Date(), expiresInDays) : null;

    const [shareLink] = await db
      .insert(shareLinks)
      .values({
        tripId,
        expiresAt,
        accessLevel,
      })
      .returning();

    res.json(shareLink);
  });

  // Revoke share link
  app.delete("/api/trips/:tripId/share/:linkId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const tripId = parseInt(req.params.tripId);
    const linkId = parseInt(req.params.linkId);

    // Verify trip ownership
    const [trip] = await db
      .select()
      .from(trips)
      .where(
        and(
          eq(trips.id, tripId),
          eq(trips.ownerId, req.user.id)
        )
      )
      .limit(1);

    if (!trip) {
      return res.status(404).send("Trip not found or unauthorized");
    }

    await db
      .update(shareLinks)
      .set({ isActive: false })
      .where(
        and(
          eq(shareLinks.id, linkId),
          eq(shareLinks.tripId, tripId)
        )
      );

    res.json({ message: "Share link revoked" });
  });

  // Trips
  app.get("/api/trips", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const userTrips = await db.query.trips.findMany({
      where: eq(trips.ownerId, req.user.id),
      with: {
        participants: true,
        activities: true,
        flights: true,
        accommodations: true,
      },
    });

    const participatingTrips = await db.query.trips.findMany({
      where: eq(participants.userId, req.user.id),
      with: {
        participants: true,
        activities: true,
        flights: true,
        accommodations: true,
      },
    });

    res.json([...userTrips, ...participatingTrips]);
  });

  app.post("/api/trips", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const newTrip = await db.insert(trips).values({
      ...req.body,
      ownerId: req.user.id,
    }).returning();

    res.json(newTrip[0]);
  });

  // Flights
  app.post("/api/trips/:tripId/flights", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const newFlight = await db.insert(flights).values({
      ...req.body,
      tripId: parseInt(req.params.tripId),
    }).returning();

    res.json(newFlight[0]);
  });

  app.patch("/api/trips/:tripId/flights/:flightId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

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
  });

  // Accommodations
  app.post("/api/trips/:tripId/accommodations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const newAccommodation = await db.insert(accommodations).values({
      ...req.body,
      tripId: parseInt(req.params.tripId),
    }).returning();

    res.json(newAccommodation[0]);
  });

  app.patch("/api/trips/:tripId/accommodations/:accommodationId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

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

  // Checklist
  app.post("/api/trips/:tripId/checklist", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const newItem = await db.insert(checklist).values({
      ...req.body,
      tripId: parseInt(req.params.tripId),
    }).returning();

    res.json(newItem[0]);
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

  const httpServer = createServer(app);
  return httpServer;
}