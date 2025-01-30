import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { trips, participants, activities, checklist, documents } from "@db/schema";
import { eq, and } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

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
      },
    });

    const participatingTrips = await db.query.trips.findMany({
      where: eq(participants.userId, req.user.id),
      with: {
        participants: true,
        activities: true,
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
