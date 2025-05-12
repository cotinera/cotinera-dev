import { Router } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { addDays, addHours, format, nextFriday, nextMonday, nextSaturday, nextSunday, nextThursday, nextTuesday, nextWednesday } from "date-fns";

const router = Router();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Schema for request validation
const parseEventSchema = z.object({
  text: z.string().min(1, "Event description is required"),
});

router.post("/parse-event", async (req, res) => {
  try {
    const result = parseEventSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const { text } = result.data;

    // Using OpenAI to parse the natural language input
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a calendar assistant that extracts structured event information from natural language. 
          Extract the event details for a calendar entry from the user's input.
          Today is ${format(new Date(), "yyyy-MM-dd")}.
          If a specific date is not provided, assume it's for today.
          If a day of week is mentioned (e.g., "Friday"), find the next occurrence of that day.
          If only time is provided without a date, assume it's for today.
          If no time is provided, default to 9:00 AM.
          If no duration is provided, assume the event is 1 hour long.
          Return a JSON object with the following fields:
          - title: the name or title of the event
          - description: any additional details (null if none)
          - location: the location of the event (null if none)
          - startTime: ISO string of when the event starts
          - endTime: ISO string of when the event ends`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const parsedContent = JSON.parse(response.choices[0].message.content);
    
    // Validate the response structure
    if (!parsedContent.title || !parsedContent.startTime || !parsedContent.endTime) {
      return res.status(400).json({ 
        error: "Could not extract complete event details. Please try with more specific information." 
      });
    }

    // Return the structured event data
    return res.status(200).json(parsedContent);
  } catch (error) {
    console.error("Error processing NLP request:", error);
    return res.status(500).json({ 
      error: "Failed to process your request. Please try again."
    });
  }
});

export default router;