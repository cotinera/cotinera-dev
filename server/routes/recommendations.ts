import { Router } from "express";
import { db } from "@/db";
import { users, travelRecommendations } from "@db/schema";
import { eq } from "drizzle-orm";
import { generateTravelRecommendations } from "../utils/openai";

const router = Router();

// Get recommendations for the current user
router.get("/api/recommendations", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { tripId, location, startDate, endDate } = req.query;

    const recommendations = await db.query.travelRecommendations.findMany({
      where: eq(travelRecommendations.userId, req.session.userId),
      orderBy: (recommendations, { desc }) => [desc(recommendations.createdAt)],
      limit: 10,
    });

    res.json(recommendations);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// Generate new recommendations
router.post("/api/recommendations/generate", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { tripId, location, startDate, endDate } = req.body;

    // Check if user has set their preferences
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId),
    });

    if (!user?.preferences?.travelPreferences) {
      return res.status(400).json({ 
        error: "Please set your travel preferences before generating recommendations" 
      });
    }

    const recommendations = await generateTravelRecommendations({
      userId: req.session.userId,
      context: {
        tripId,
        location,
        startDate,
        endDate,
      },
    });

    res.json(recommendations);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    res.status(500).json({ error: "Failed to generate recommendations", details: error.message });
  }
});

// Update user preferences
router.put("/api/user/preferences", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { preferences } = req.body;

    await db
      .update(users)
      .set({ preferences })
      .where(eq(users.id, req.session.userId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

export default router;