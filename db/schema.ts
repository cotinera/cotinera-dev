import { 
  pgTable, 
  text, 
  serial, 
  timestamp, 
  boolean,
  json,
  date,
  integer,
  uuid,
  time,
  numeric,
  jsonb
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import * as z from 'zod';

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  name: text("name"),
  username: text("username"),
  avatar: text("avatar"),
  provider: text("provider").default("email"),
  providerId: text("provider_id"),
  preferences: jsonb("preferences").$type<{
    notifications: boolean;
    frequentDestinations: string[];
    airlines: string[];
    travelPreferences: {
      preferredActivities: string[];
      interests: string[];
      budgetRange: {
        min: number;
        max: number;
        currency: string;
      };
      preferredAccommodations: string[];
      dietaryRestrictions: string[];
      accessibility: string[];
      travelStyle: string[]; // e.g., ["adventure", "luxury", "budget", "cultural"]
      preferredClimate: string[]; // e.g., ["tropical", "mediterranean", "alpine"]
      tripDuration: {
        min: number;
        max: number;
      };
      travelPace: string; // "slow", "moderate", "fast"
      mustHaveAmenities: string[];
      transportationPreferences: string[];
      mealPreferences: string[];
      seasonalPreferences: string[];
      specialInterests: string[];
      languagesSpoken: string[];
      travelCompanions: string[]; // "solo", "couple", "family", "friends"
      photoOpportunities: boolean;
      localExperiences: boolean;
      guidedTours: boolean;
      adventureLevel: number; // 1-5 scale
      partyingLevel: number; // 1-5 scale
      relaxationLevel: number; // 1-5 scale
      culturalImmersionLevel: number; // 1-5 scale
    };
  }>(),
});

export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  coordinates: json("coordinates").$type<{
    lat: number;
    lng: number;
  }>(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  thumbnail: text("thumbnail"),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const destinations = pgTable("destinations", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  name: text("name").notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  coordinates: json("coordinates").$type<{
    lat: number;
    lng: number;
  }>(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  userId: integer("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activitySuggestions = pgTable("activity_suggestions", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  suggestedBy: integer("suggested_by").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  estimatedCost: numeric("estimated_cost"),
  currency: text("currency").default("USD"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityVotes = pgTable("activity_votes", {
  id: serial("id").primaryKey(),
  suggestionId: integer("suggestion_id").notNull().references(() => activitySuggestions.id),
  userId: integer("user_id").notNull().references(() => users.id),
  vote: text("vote").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  paidBy: integer("paid_by").notNull().references(() => users.id),
  title: text("title").notNull(),
  amount: numeric("amount").notNull(),
  currency: text("currency").default("USD"),
  category: text("category").notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenseSplits = pgTable("expense_splits", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull().references(() => expenses.id),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: numeric("amount").notNull(),
  status: text("status").notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskAssignments = pgTable("task_assignments", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  assignedTo: integer("assigned_to").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  status: text("status").notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const flights = pgTable("flights", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  participantId: integer("participant_id").references(() => participants.id),
  direction: text("direction").default("inbound"), // 'inbound' or 'outbound'
  airline: text("airline").notNull(),
  flightNumber: text("flight_number").notNull(),
  departureAirport: text("departure_airport").notNull(),
  arrivalAirport: text("arrival_airport").notNull(),
  departureDate: date("departure_date").notNull(),
  departureTime: time("departure_time").notNull(),
  arrivalDate: date("arrival_date").notNull(),
  arrivalTime: time("arrival_time").notNull(),
  bookingReference: text("booking_reference").notNull(),
  bookingStatus: text("booking_status").notNull(),
  price: integer("price"),
  currency: text("currency").default("USD"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accommodations = pgTable("accommodations", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  address: text("address").notNull(),
  coordinates: json("coordinates").$type<{
    lat: number;
    lng: number;
  }>(),
  checkInDate: date("check_in_date").notNull(),
  checkOutDate: date("check_out_date").notNull(),
  checkInTime: time("check_in_time"),
  checkOutTime: time("check_out_time"),
  bookingReference: text("booking_reference").notNull(),
  bookingStatus: text("booking_status").notNull(),
  price: integer("price"),
  currency: text("currency").default("USD"),
  roomType: text("room_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shareLinks = pgTable("share_links", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  token: uuid("token").notNull().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  accessLevel: text("access_level").notNull().default('view'),
});

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  userId: integer("user_id").references(() => users.id),
  name: text("name"),
  status: text("status").notNull().default('pending'),
  arrivalDate: date("arrival_date"),
  departureDate: date("departure_date"),
  flightStatus: text("flight_status").notNull().default('pending'),
  hotelStatus: text("hotel_status").notNull().default('pending'),
  accommodationId: integer("accommodation_id").references(() => accommodations.id),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  coordinates: json("coordinates").$type<{
    lat: number;
    lng: number;
  }>(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const checklist = pgTable("checklist", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  title: text("title").notNull(),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pinnedPlaces = pgTable("pinned_places", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  name: text("name").notNull(),
  notes: text("notes"),
  coordinates: json("coordinates").$type<{
    lat: number;
    lng: number;
  }>(),
  destinationId: integer("destination_id").references(() => destinations.id),
  addedToChecklist: boolean("added_to_checklist").notNull().default(false),
  category: text("category").notNull().default('other'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const polls = pgTable("polls", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  userId: integer("user_id").notNull().references(() => users.id),
  question: text("question").notNull(),
  options: json("options").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  endTime: timestamp("end_time"),
  isClosed: boolean("is_closed").default(false),
});

export const pollVotes = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull().references(() => polls.id),
  userId: integer("user_id").notNull().references(() => users.id),
  optionIndex: integer("option_index").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const travelRecommendations = pgTable("travel_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  tripId: integer("trip_id").references(() => trips.id),
  destinationName: text("destination_name").notNull(),
  description: text("description").notNull(),
  activities: json("activities").$type<string[]>().notNull(),
  interests: json("interests").$type<string[]>().notNull(),
  estimatedBudget: numeric("estimated_budget"),
  currency: text("currency").default("USD"),
  recommendedDuration: integer("recommended_duration"),
  score: numeric("score"),
  matchingPreferences: json("matching_preferences").$type<{
    activityMatch: number;
    budgetMatch: number;
    climateMatch: number;
    styleMatch: number;
    seasonalMatch: number;
    overallScore: number;
  }>(),
  seasonalInfo: json("seasonal_info").$type<{
    bestTimeToVisit: string[];
    weather: {
      season: string;
      temperature: string;
      precipitation: string;
    }[];
  }>(),
  localCuisine: json("local_cuisine").$type<string[]>(),
  culturalHighlights: json("cultural_highlights").$type<string[]>(),
  practicalInfo: json("practical_info").$type<{
    languages: string[];
    currency: string;
    timeZone: string;
    visaRequirements: string;
    safetyInfo: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tripsRelations = relations(trips, ({ one, many }) => ({
  owner: one(users, {
    fields: [trips.ownerId],
    references: [users.id],
  }),
  destinations: many(destinations),
  participants: many(participants),
  activities: many(activities),
  checklist: many(checklist),
  documents: many(documents),
  shareLinks: many(shareLinks),
  flights: many(flights),
  accommodations: many(accommodations),
  chatMessages: many(chatMessages),
  pinnedPlaces: many(pinnedPlaces),
  polls: many(polls),

}));

export const destinationsRelations = relations(destinations, ({ one }) => ({
  trip: one(trips, {
    fields: [destinations.tripId],
    references: [trips.id],
  }),
}));

export const checklistRelations = relations(checklist, ({ one }) => ({
  trip: one(trips, {
    fields: [checklist.tripId],
    references: [trips.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  trip: one(trips, {
    fields: [activities.tripId],
    references: [trips.id],
  }),
}));

export const flightsRelations = relations(flights, ({ one }) => ({
  trip: one(trips, {
    fields: [flights.tripId],
    references: [trips.id],
  }),
  participant: one(participants, {
    fields: [flights.participantId],
    references: [participants.id],
  }),
}));

export const accommodationsRelations = relations(accommodations, ({ one, many }) => ({
  trip: one(trips, {
    fields: [accommodations.tripId],
    references: [trips.id],
  }),
  participants: many(participants),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  trip: one(trips, {
    fields: [shareLinks.tripId],
    references: [trips.id],
  }),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  trip: one(trips, {
    fields: [participants.tripId],
    references: [trips.id],
  }),
  user: one(users, {
    fields: [participants.userId],
    references: [users.id],
  }),
  accommodation: one(accommodations, {
    fields: [participants.accommodationId],
    references: [accommodations.id],
    relationName: "participant_accommodation"
  }),
  flights: many(flights),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  trip: one(trips, {
    fields: [chatMessages.tripId],
    references: [trips.id],
  }),
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

export const activitySuggestionsRelations = relations(activitySuggestions, ({ one, many }) => ({
  trip: one(trips, {
    fields: [activitySuggestions.tripId],
    references: [trips.id],
  }),
  suggestedByUser: one(users, {
    fields: [activitySuggestions.suggestedBy],
    references: [users.id],
  }),
  votes: many(activityVotes),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  trip: one(trips, {
    fields: [expenses.tripId],
    references: [trips.id],
  }),
  paidByUser: one(users, {
    fields: [expenses.paidBy],
    references: [users.id],
  }),
  splits: many(expenseSplits),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  trip: one(trips, {
    fields: [taskAssignments.tripId],
    references: [trips.id],
  }),
  assignedToUser: one(users, {
    fields: [taskAssignments.assignedTo],
    references: [users.id],
  }),
}));

export const pinnedPlacesRelations = relations(pinnedPlaces, ({ one }) => ({
  trip: one(trips, {
    fields: [pinnedPlaces.tripId],
    references: [trips.id],
  }),
  destination: one(destinations, {
    fields: [pinnedPlaces.destinationId],
    references: [destinations.id],
  }),
}));

export const pollsRelations = relations(polls, ({ one, many }) => ({
  trip: one(trips, {
    fields: [polls.tripId],
    references: [trips.id],
  }),
  user: one(users, {
    fields: [polls.userId],
    references: [users.id],
  }),
  votes: many(pollVotes),
}));

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  poll: one(polls, {
    fields: [pollVotes.pollId],
    references: [polls.id],
  }),
  user: one(users, {
    fields: [pollVotes.userId],
    references: [users.id],
  }),
}));

export const travelRecommendationsRelations = relations(travelRecommendations, ({ one }) => ({
  user: one(users, {
    fields: [travelRecommendations.userId],
    references: [users.id],
  }),
  trip: one(trips, {
    fields: [travelRecommendations.tripId],
    references: [trips.id],
  }),
}));


export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
  username: z.string().optional(),
  provider: z.enum(["email", "google", "apple"]).default("email"),
  providerId: z.string().optional(),
});
export const selectUserSchema = createSelectSchema(users);
export const insertTripSchema = createInsertSchema(trips);
export const selectTripSchema = createSelectSchema(trips);
export const insertShareLinkSchema = createInsertSchema(shareLinks);
export const selectShareLinkSchema = createSelectSchema(shareLinks);
export const insertFlightSchema = createInsertSchema(flights);
export const selectFlightSchema = createSelectSchema(flights);
export const insertAccommodationSchema = createInsertSchema(accommodations);
export const selectAccommodationSchema = createSelectSchema(accommodations);
export const insertChatMessageSchema = createInsertSchema(chatMessages);
export const selectChatMessageSchema = createSelectSchema(chatMessages);
export const insertActivitySuggestionSchema = createInsertSchema(activitySuggestions);
export const selectActivitySuggestionSchema = createSelectSchema(activitySuggestions);
export const insertExpenseSchema = createInsertSchema(expenses);
export const selectExpenseSchema = createSelectSchema(expenses);
export const insertTaskAssignmentSchema = createInsertSchema(taskAssignments);
export const selectTaskAssignmentSchema = createSelectSchema(taskAssignments);
export const insertDestinationSchema = createInsertSchema(destinations);
export const selectDestinationSchema = createSelectSchema(destinations);
export const insertPollSchema = createInsertSchema(polls);
export const selectPollSchema = createSelectSchema(polls);
export const insertPollVoteSchema = createInsertSchema(pollVotes);
export const selectPollVoteSchema = createSelectSchema(pollVotes);
export const insertTravelRecommendationSchema = createInsertSchema(travelRecommendations);
export const selectTravelRecommendationSchema = createSelectSchema(travelRecommendations);

export type User = typeof users.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type ChecklistItem = typeof checklist.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Flight = typeof flights.$inferSelect;
export type Accommodation = typeof accommodations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ActivitySuggestion = typeof activitySuggestions.$inferSelect;
export type ActivityVote = typeof activityVotes.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type Destination = typeof destinations.$inferSelect;
export type PinnedPlace = typeof pinnedPlaces.$inferSelect;
export type Poll = typeof polls.$inferSelect;
export type PollVote = typeof pollVotes.$inferSelect;
export type TravelRecommendation = typeof travelRecommendations.$inferSelect;