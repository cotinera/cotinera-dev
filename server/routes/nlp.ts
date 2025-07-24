import { Router } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { addDays, addHours, format, nextFriday, nextMonday, nextSaturday, nextSunday, nextThursday, nextTuesday, nextWednesday, parse, setHours, setMinutes } from "date-fns";

const router = Router();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Schema for request validation
const parseEventSchema = z.object({
  text: z.string().min(1, "Event description is required"),
});

// Fallback parser for basic patterns when OpenAI is unavailable
function parseEventBasic(text: string) {
  const today = new Date();
  let title = text.trim();
  let startTime = setHours(setMinutes(today, 0), 9); // Default 9 AM today
  let endTime = addHours(startTime, 1); // Default 1 hour duration
  
  // Extract time patterns (7 pm, 2:30, 14:30, etc.)
  const timePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)?/i;
  const timeMatch = text.match(timePattern);
  
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3]?.toLowerCase();
    
    // Convert to 24-hour format
    if (period === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }
    
    startTime = setHours(setMinutes(startTime, minutes), hours);
    endTime = addHours(startTime, 1);
    
    // Remove time from title
    title = text.replace(timeMatch[0], '').trim();
  }
  
  // Extract date patterns (july 9, tomorrow, monday, etc.)
  const monthPattern = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i;
  const monthMatch = text.match(monthPattern);
  
  if (monthMatch) {
    const monthName = monthMatch[1];
    const day = parseInt(monthMatch[2]);
    const currentYear = new Date().getFullYear();
    
    try {
      const eventDate = parse(`${monthName} ${day} ${currentYear}`, 'MMMM d yyyy', new Date());
      startTime = setHours(setMinutes(eventDate, startTime.getMinutes()), startTime.getHours());
      endTime = addHours(startTime, 1);
      
      // Remove date from title
      title = title.replace(monthMatch[0], '').trim();
    } catch (e) {
      // If parsing fails, keep the original date
    }
  }
  
  // Handle "tomorrow"
  if (/\btomorrow\b/i.test(text)) {
    const tomorrow = addDays(today, 1);
    startTime = setHours(setMinutes(tomorrow, startTime.getMinutes()), startTime.getHours());
    endTime = addHours(startTime, 1);
    title = title.replace(/\btomorrow\b/i, '').trim();
  }
  
  // Handle "on" prefix cleanup
  title = title.replace(/\bon\s+/i, '').trim();
  title = title.replace(/\sat\s+/i, '').trim();
  
  // Ensure we have a title
  if (!title) {
    title = "New Event";
  }
  
  return {
    title,
    description: null,
    location: null,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString()
  };
}

router.post("/parse-event", async (req, res) => {
  try {
    const result = parseEventSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const { text } = result.data;

    try {
      // Try OpenAI first if available
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
      
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }
      const parsedContent = JSON.parse(content);
      
      // Validate the response structure
      if (!parsedContent.title || !parsedContent.startTime || !parsedContent.endTime) {
        throw new Error("Incomplete response from OpenAI");
      }

      // Return the structured event data
      return res.status(200).json(parsedContent);
    } catch (openaiError: any) {
      // If OpenAI fails (quota exceeded, network issues, etc.), fall back to basic parsing
      console.log("OpenAI parsing failed, using fallback parser:", openaiError?.message || "Unknown error");
      
      const fallbackResult = parseEventBasic(text);
      return res.status(200).json(fallbackResult);
    }
  } catch (error) {
    console.error("Error processing NLP request:", error);
    return res.status(500).json({ 
      error: "Failed to process your request. Please try again."
    });
  }
});

export default router;