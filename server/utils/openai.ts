import OpenAI from "openai";
import { db } from "@/db";
import { users, travelRecommendations } from "@/db/schema";
import { eq } from "drizzle-orm";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface RecommendationRequest {
  userId: number;
  context?: {
    location?: string;
    startDate?: string;
    endDate?: string;
    tripId?: number;
  };
}

export async function generateTravelRecommendations(request: RecommendationRequest) {
  // Fetch user preferences
  const user = await db.query.users.findFirst({
    where: eq(users.id, request.userId),
  });

  if (!user || !user.preferences?.travelPreferences) {
    throw new Error("User preferences not found");
  }

  const { travelPreferences } = user.preferences;

  // Create a prompt for OpenAI based on user preferences
  const prompt = {
    role: "system",
    content: `You are a travel recommendation expert. Generate personalized travel recommendations based on the following preferences:
    - Activities: ${travelPreferences.preferredActivities.join(', ')}
    - Interests: ${travelPreferences.interests.join(', ')}
    - Budget Range: ${travelPreferences.budgetRange.min}-${travelPreferences.budgetRange.max} ${travelPreferences.budgetRange.currency}
    - Accommodation Types: ${travelPreferences.preferredAccommodations.join(', ')}
    - Travel Style: ${travelPreferences.travelStyle.join(', ')}
    - Preferred Climate: ${travelPreferences.preferredClimate.join(', ')}
    - Trip Duration: ${travelPreferences.tripDuration.min}-${travelPreferences.tripDuration.max} days
    ${request.context?.location ? `- Considering location: ${request.context.location}` : ''}
    ${request.context?.startDate ? `- For dates: ${request.context.startDate} to ${request.context.endDate}` : ''}
    
    Provide recommendations in JSON format with the following structure:
    {
      "destinations": [{
        "name": "string",
        "description": "string",
        "activities": ["string"],
        "interests": ["string"],
        "estimatedBudget": number,
        "currency": "string",
        "recommendedDuration": number,
        "score": number
      }]
    }`
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: prompt.content }],
      response_format: { type: "json_object" }
    });

    const recommendations = JSON.parse(completion.choices[0].message.content);

    // Store recommendations in database
    const savedRecommendations = await Promise.all(
      recommendations.destinations.map(async (rec: any) => {
        return await db.insert(travelRecommendations).values({
          userId: request.userId,
          tripId: request.context?.tripId,
          destinationName: rec.name,
          description: rec.description,
          activities: rec.activities,
          interests: rec.interests,
          estimatedBudget: rec.estimatedBudget,
          currency: rec.currency,
          recommendedDuration: rec.recommendedDuration,
          score: rec.score,
        }).returning();
      })
    );

    return savedRecommendations;
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw new Error('Failed to generate travel recommendations');
  }
}
