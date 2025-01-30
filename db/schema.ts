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
  time
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
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
  location: text("location").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  thumbnail: text("thumbnail"),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const flights = pgTable("flights", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
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
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status").notNull(),
  arrivalDate: date("arrival_date"),
  departureDate: date("departure_date"),
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

export const tripsRelations = relations(trips, ({ one, many }) => ({
  owner: one(users, {
    fields: [trips.ownerId],
    references: [users.id],
  }),
  participants: many(participants),
  activities: many(activities),
  checklist: many(checklist),
  documents: many(documents),
  shareLinks: many(shareLinks),
  flights: many(flights),
  accommodations: many(accommodations),
}));

export const flightsRelations = relations(flights, ({ one }) => ({
  trip: one(trips, {
    fields: [flights.tripId],
    references: [trips.id],
  }),
}));

export const accommodationsRelations = relations(accommodations, ({ one }) => ({
  trip: one(trips, {
    fields: [accommodations.tripId],
    references: [trips.id],
  }),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  trip: one(trips, {
    fields: [shareLinks.tripId],
    references: [trips.id],
  }),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  trip: one(trips, {
    fields: [participants.tripId],
    references: [trips.id],
  }),
  user: one(users, {
    fields: [participants.userId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertTripSchema = createInsertSchema(trips);
export const selectTripSchema = createSelectSchema(trips);
export const insertShareLinkSchema = createInsertSchema(shareLinks);
export const selectShareLinkSchema = createSelectSchema(shareLinks);
export const insertFlightSchema = createInsertSchema(flights);
export const selectFlightSchema = createSelectSchema(flights);
export const insertAccommodationSchema = createInsertSchema(accommodations);
export const selectAccommodationSchema = createSelectSchema(accommodations);

export type User = typeof users.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type ChecklistItem = typeof checklist.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Flight = typeof flights.$inferSelect;
export type Accommodation = typeof accommodations.$inferSelect;