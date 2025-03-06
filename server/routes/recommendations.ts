import { Router } from "express";
import { db } from "@db";
import { users, travelRecommendations } from "@db/schema";
import { eq } from "drizzle-orm";
import { generateTravelRecommendations } from "../utils/openai";

const router = Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Get recommendations for the current user
router.get("/api/recommendations", requireAuth, async (req, res) => {
  try {
    const recommendations = await db.query.travelRecommendations.findMany({
      where: eq(travelRecommendations.userId, req.user.id),
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
router.post("/api/recommendations/generate", requireAuth, async (req, res) => {
  try {
    const { tripId, location, startDate, endDate } = req.body;

    // Check if user has set their preferences
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
    });

    if (!user?.preferences?.travelPreferences) {
      return res.status(400).json({ 
        error: "Please set your travel preferences before generating recommendations" 
      });
    }

    const recommendations = await generateTravelRecommendations({
      userId: req.user.id,
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
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
});

// Update user preferences
router.put("/api/user/preferences", requireAuth, async (req, res) => {
  try {
    const { preferences } = req.body;

    await db
      .update(users)
      .set({ preferences })
      .where(eq(users.id, req.user.id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

export default router;