import { 
  pgTable, 
  text, 
  serial, 
  timestamp, 
  boolean,
  json,
  integer,
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
  provider: text("provider").default("email"), // 'email', 'google', or 'apple'
  providerId: text("provider_id"), // ID from the provider
  preferences: json("preferences").$type<{
    notifications: boolean;
    frequentDestinations: string[];
    airlines: string[];
  }>(),
});

export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"), // Made optional
  coordinates: json("coordinates").$type<{
    lat: number;
    lng: number;
  }>(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
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
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  coordinates: json("coordinates").$type<{
    lat: number;
    lng: number;
  }>(),
  order: integer("order").notNull(), // For maintaining the sequence of destinations
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
  estimatedCost: integer("estimated_cost"),
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
  amount: integer("amount").notNull(),
  currency: text("currency").default("USD"),
  category: text("category").notNull(), 
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenseSplits = pgTable("expense_splits", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull().references(() => expenses.id),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default('pending'), 
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskAssignments = pgTable("task_assignments", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  assignedTo: integer("assigned_to").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default('pending'), 
  createdAt: timestamp("created_at").defaultNow(),
});

export const flights = pgTable("flights", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  airline: text("airline").notNull(),
  flightNumber: text("flight_number").notNull(),
  departureAirport: text("departure_airport").notNull(),
  arrivalAirport: text("arrival_airport").notNull(),
  departureDate: timestamp("departure_date").notNull(),
  departureTime: timestamp("departure_time").notNull(),
  arrivalDate: timestamp("arrival_date").notNull(),
  arrivalTime: timestamp("arrival_time").notNull(),
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
  checkInDate: timestamp("check_in_date").notNull(),
  checkOutDate: timestamp("check_out_date").notNull(),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
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
  token: text("token").notNull(), // Remove default value - will be set by the API
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
  arrivalDate: timestamp("arrival_date"),
  departureDate: timestamp("departure_date"),
  flightStatus: text("flight_status").notNull().default('pending'),
  hotelStatus: text("hotel_status").notNull().default('pending'),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
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
  createdAt: timestamp("created_at").defaultNow(),
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
  participant: one(participants),
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
  flights: many(flights),
  accommodation: one(accommodations),
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