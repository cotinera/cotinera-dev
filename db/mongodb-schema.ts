import mongoose, { Schema, Document, Model } from 'mongoose';

// User Document Interface
export interface IUser extends Document {
  email: string;
  password?: string;
  name?: string;
  username?: string;
  avatar?: string;
  provider: 'email' | 'google' | 'apple';
  provider_id?: string;
  preferences?: {
    notifications?: boolean;
    frequentDestinations?: string[];
    airlines?: string[];
    travelPreferences?: {
      preferredActivities?: string[];
      interests?: string[];
      budgetRange?: {
        min: number;
        max: number;
        currency: string;
      };
      preferredAccommodations?: string[];
      dietaryRestrictions?: string[];
      accessibility?: string[];
      travelStyle?: string[];
      preferredClimate?: string[];
      tripDuration?: {
        min: number;
        max: number;
      };
      travelPace?: string;
      mustHaveAmenities?: string[];
      transportationPreferences?: string[];
      mealPreferences?: string[];
      seasonalPreferences?: string[];
      specialInterests?: string[];
      languagesSpoken?: string[];
      travelCompanions?: string[];
      photoOpportunities?: boolean;
      localExperiences?: boolean;
      guidedTours?: boolean;
      adventureLevel?: number;
      partyingLevel?: number;
      relaxationLevel?: number;
      culturalImmersionLevel?: number;
    };
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  name: String,
  username: String,
  avatar: String,
  provider: { type: String, enum: ['email', 'google', 'apple'], default: 'email' },
  provider_id: String,
  preferences: {
    notifications: Boolean,
    frequentDestinations: [String],
    airlines: [String],
    travelPreferences: {
      preferredActivities: [String],
      interests: [String],
      budgetRange: {
        min: Number,
        max: Number,
        currency: String
      },
      preferredAccommodations: [String],
      dietaryRestrictions: [String],
      accessibility: [String],
      travelStyle: [String],
      preferredClimate: [String],
      tripDuration: {
        min: Number,
        max: Number
      },
      travelPace: String,
      mustHaveAmenities: [String],
      transportationPreferences: [String],
      mealPreferences: [String],
      seasonalPreferences: [String],
      specialInterests: [String],
      languagesSpoken: [String],
      travelCompanions: [String],
      photoOpportunities: Boolean,
      localExperiences: Boolean,
      guidedTours: Boolean,
      adventureLevel: Number,
      partyingLevel: Number,
      relaxationLevel: Number,
      culturalImmersionLevel: Number
    }
  }
}, { timestamps: true });

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

// Trip Document Interface
export interface ITrip extends Document {
  title: string;
  description?: string;
  location?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  startDate: Date;
  endDate: Date;
  thumbnail?: string;
  ownerId: mongoose.Types.ObjectId;
  viewPreferences?: {
    showCalendar: boolean;
    showSpending: boolean;
    showMap: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const tripSchema = new Schema<ITrip>({
  title: { type: String, required: true },
  description: String,
  location: String,
  coordinates: {
    lat: Number,
    lng: Number
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  thumbnail: String,
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  viewPreferences: {
    showCalendar: { type: Boolean, default: true },
    showSpending: { type: Boolean, default: true },
    showMap: { type: Boolean, default: true }
  }
}, { timestamps: true });

export const Trip: Model<ITrip> = mongoose.models.Trip || mongoose.model<ITrip>('Trip', tripSchema);

// Destination Document Interface
export interface IDestination extends Document {
  tripId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  coordinates?: {
    lat: number;
    lng: number;
  };
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const destinationSchema = new Schema<IDestination>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  name: { type: String, required: true },
  description: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  coordinates: {
    lat: Number,
    lng: Number
  },
  order: { type: Number, required: true }
}, { timestamps: true });

export const Destination: Model<IDestination> = mongoose.models.Destination || mongoose.model<IDestination>('Destination', destinationSchema);

// Participant Document Interface
export interface IParticipant extends Document {
  tripId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  name?: string;
  status: string;
  role: string;
  email?: string;
  phone?: string;
  joinedAt?: Date;
  arrivalDate?: Date;
  departureDate?: Date;
  flightStatus: string;
  hotelStatus: string;
  accommodationId?: mongoose.Types.ObjectId;
}

const participantSchema = new Schema<IParticipant>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  name: String,
  status: { type: String, default: 'pending' },
  role: { type: String, default: 'viewer' },
  email: String,
  phone: String,
  joinedAt: { type: Date, default: Date.now },
  arrivalDate: Date,
  departureDate: Date,
  flightStatus: { type: String, default: 'pending' },
  hotelStatus: { type: String, default: 'pending' },
  accommodationId: { type: Schema.Types.ObjectId, ref: 'Accommodation' }
});

export const Participant: Model<IParticipant> = mongoose.models.Participant || mongoose.model<IParticipant>('Participant', participantSchema);

// Activity Document Interface
export interface IActivity extends Document {
  tripId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  location?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  startTime: Date;
  endTime: Date;
  googleEventId?: string;
  createdAt?: Date;
}

const activitySchema = new Schema<IActivity>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  title: { type: String, required: true },
  description: String,
  location: String,
  coordinates: {
    lat: Number,
    lng: Number
  },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  googleEventId: String,
  createdAt: { type: Date, default: Date.now }
});

export const Activity: Model<IActivity> = mongoose.models.Activity || mongoose.model<IActivity>('Activity', activitySchema);

// Expense Document Interface
export interface IExpense extends Document {
  tripId: mongoose.Types.ObjectId;
  paidBy: mongoose.Types.ObjectId;
  title: string;
  amount: mongoose.Types.Decimal128;
  currency: string;
  category: string;
  date: Date;
  createdAt?: Date;
}

const expenseSchema = new Schema<IExpense>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  amount: { type: Schema.Types.Decimal128, required: true },
  currency: { type: String, default: 'USD' },
  category: { type: String, required: true },
  date: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Expense: Model<IExpense> = mongoose.models.Expense || mongoose.model<IExpense>('Expense', expenseSchema);

// ExpenseSplit Document Interface
export interface IExpenseSplit extends Document {
  expenseId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: mongoose.Types.Decimal128;
  status: string;
  createdAt?: Date;
}

const expenseSplitSchema = new Schema<IExpenseSplit>({
  expenseId: { type: Schema.Types.ObjectId, ref: 'Expense', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Schema.Types.Decimal128, required: true },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export const ExpenseSplit: Model<IExpenseSplit> = mongoose.models.ExpenseSplit || mongoose.model<IExpenseSplit>('ExpenseSplit', expenseSplitSchema);

// Repayment Document Interface
export interface IRepayment extends Document {
  tripId: mongoose.Types.ObjectId;
  expenseId: mongoose.Types.ObjectId;
  paidBy: mongoose.Types.ObjectId;
  paidTo: mongoose.Types.ObjectId;
  amount: mongoose.Types.Decimal128;
  currency: string;
  date: Date;
  notes?: string;
  createdAt?: Date;
}

const repaymentSchema = new Schema<IRepayment>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  expenseId: { type: Schema.Types.ObjectId, ref: 'Expense', required: true },
  paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  paidTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Schema.Types.Decimal128, required: true },
  currency: { type: String, default: 'USD' },
  date: { type: Date, required: true },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

export const Repayment: Model<IRepayment> = mongoose.models.Repayment || mongoose.model<IRepayment>('Repayment', repaymentSchema);

// Flight Document Interface
export interface IFlight extends Document {
  tripId: mongoose.Types.ObjectId;
  participantId?: mongoose.Types.ObjectId;
  direction: string;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDate: Date;
  departureTime: string;
  arrivalDate: Date;
  arrivalTime: string;
  bookingReference: string;
  bookingStatus: string;
  price?: number;
  currency: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const flightSchema = new Schema<IFlight>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  participantId: { type: Schema.Types.ObjectId, ref: 'Participant' },
  direction: { type: String, default: 'inbound' },
  airline: { type: String, required: true },
  flightNumber: { type: String, required: true },
  departureAirport: { type: String, required: true },
  arrivalAirport: { type: String, required: true },
  departureDate: { type: Date, required: true },
  departureTime: { type: String, required: true },
  arrivalDate: { type: Date, required: true },
  arrivalTime: { type: String, required: true },
  bookingReference: { type: String, required: true },
  bookingStatus: { type: String, required: true },
  price: Number,
  currency: { type: String, default: 'USD' }
}, { timestamps: true });

export const Flight: Model<IFlight> = mongoose.models.Flight || mongoose.model<IFlight>('Flight', flightSchema);

// Accommodation Document Interface
export interface IAccommodation extends Document {
  tripId: mongoose.Types.ObjectId;
  name: string;
  type: string;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  checkInDate: Date;
  checkOutDate: Date;
  checkInTime?: string;
  checkOutTime?: string;
  bookingReference: string;
  bookingStatus: string;
  price?: number;
  currency: string;
  roomType?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const accommodationSchema = new Schema<IAccommodation>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  address: { type: String, required: true },
  coordinates: {
    lat: Number,
    lng: Number
  },
  checkInDate: { type: Date, required: true },
  checkOutDate: { type: Date, required: true },
  checkInTime: String,
  checkOutTime: String,
  bookingReference: { type: String, required: true },
  bookingStatus: { type: String, required: true },
  price: Number,
  currency: { type: String, default: 'USD' },
  roomType: String
}, { timestamps: true });

export const Accommodation: Model<IAccommodation> = mongoose.models.Accommodation || mongoose.model<IAccommodation>('Accommodation', accommodationSchema);

// PinnedPlace Document Interface
export interface IPinnedPlace extends Document {
  tripId: mongoose.Types.ObjectId;
  name: string;
  notes?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  placeId?: string;
  destinationId?: mongoose.Types.ObjectId;
  addedToChecklist: boolean;
  category: string;
  icon: string;
  status: 'places' | 'pending' | 'booked';
  createdAt?: Date;
}

const pinnedPlaceSchema = new Schema<IPinnedPlace>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  name: { type: String, required: true },
  notes: String,
  coordinates: {
    lat: Number,
    lng: Number
  },
  placeId: String,
  destinationId: { type: Schema.Types.ObjectId, ref: 'Destination' },
  addedToChecklist: { type: Boolean, default: false },
  category: { type: String, default: 'other' },
  icon: { type: String, default: '📍' },
  status: { type: String, enum: ['places', 'pending', 'booked'], default: 'places' },
  createdAt: { type: Date, default: Date.now }
});

export const PinnedPlace: Model<IPinnedPlace> = mongoose.models.PinnedPlace || mongoose.model<IPinnedPlace>('PinnedPlace', pinnedPlaceSchema);

// ChatMessage Document Interface
export interface IChatMessage extends Document {
  tripId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  message: string;
  createdAt?: Date;
}

const chatMessageSchema = new Schema<IChatMessage>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const ChatMessage: Model<IChatMessage> = mongoose.models.ChatMessage || mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);

// Poll Document Interface
export interface IPoll extends Document {
  tripId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  question: string;
  options: string[];
  createdAt?: Date;
  endTime?: Date;
  isClosed: boolean;
}

const pollSchema = new Schema<IPoll>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: String, required: true },
  options: { type: [String], required: true },
  createdAt: { type: Date, default: Date.now },
  endTime: Date,
  isClosed: { type: Boolean, default: false }
});

export const Poll: Model<IPoll> = mongoose.models.Poll || mongoose.model<IPoll>('Poll', pollSchema);

// PollVote Document Interface
export interface IPollVote extends Document {
  pollId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  optionIndex: number;
  createdAt?: Date;
}

const pollVoteSchema = new Schema<IPollVote>({
  pollId: { type: Schema.Types.ObjectId, ref: 'Poll', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  optionIndex: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const PollVote: Model<IPollVote> = mongoose.models.PollVote || mongoose.model<IPollVote>('PollVote', pollVoteSchema);

// ActivitySuggestion Document Interface
export interface IActivitySuggestion extends Document {
  tripId: mongoose.Types.ObjectId;
  suggestedBy: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  location?: string;
  estimatedCost?: mongoose.Types.Decimal128;
  currency: string;
  startTime?: Date;
  endTime?: Date;
  status: string;
  createdAt?: Date;
}

const activitySuggestionSchema = new Schema<IActivitySuggestion>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  suggestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: String,
  location: String,
  estimatedCost: Schema.Types.Decimal128,
  currency: { type: String, default: 'USD' },
  startTime: Date,
  endTime: Date,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export const ActivitySuggestion: Model<IActivitySuggestion> = mongoose.models.ActivitySuggestion || mongoose.model<IActivitySuggestion>('ActivitySuggestion', activitySuggestionSchema);

// ActivityVote Document Interface
export interface IActivityVote extends Document {
  suggestionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  vote: string;
  createdAt?: Date;
}

const activityVoteSchema = new Schema<IActivityVote>({
  suggestionId: { type: Schema.Types.ObjectId, ref: 'ActivitySuggestion', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  vote: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const ActivityVote: Model<IActivityVote> = mongoose.models.ActivityVote || mongoose.model<IActivityVote>('ActivityVote', activityVoteSchema);

// Checklist Document Interface
export interface IChecklist extends Document {
  tripId: mongoose.Types.ObjectId;
  title: string;
  completed: boolean;
  createdAt?: Date;
}

const checklistSchema = new Schema<IChecklist>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const Checklist: Model<IChecklist> = mongoose.models.Checklist || mongoose.model<IChecklist>('Checklist', checklistSchema);

// Document Document Interface
export interface IDocument extends Document {
  tripId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: string;
  title: string;
  content: string;
  createdAt?: Date;
}

const documentSchema = new Schema<IDocument>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const TripDocument: Model<IDocument> = mongoose.models.TripDocument || mongoose.model<IDocument>('TripDocument', documentSchema);

// ShareLink Document Interface
export interface IShareLink extends Document {
  tripId: mongoose.Types.ObjectId;
  token: string;
  createdAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  accessLevel: string;
}

const shareLinkSchema = new Schema<IShareLink>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
  isActive: { type: Boolean, default: true },
  accessLevel: { type: String, default: 'view' }
});

export const ShareLink: Model<IShareLink> = mongoose.models.ShareLink || mongoose.model<IShareLink>('ShareLink', shareLinkSchema);

// TaskAssignment Document Interface
export interface ITaskAssignment extends Document {
  tripId: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  dueDate?: Date;
  status: string;
  createdAt?: Date;
}

const taskAssignmentSchema = new Schema<ITaskAssignment>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: String,
  dueDate: Date,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export const TaskAssignment: Model<ITaskAssignment> = mongoose.models.TaskAssignment || mongoose.model<ITaskAssignment>('TaskAssignment', taskAssignmentSchema);

// TripIdea Document Interface
export interface ITripIdea extends Document {
  tripId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status: string;
  ownerId?: mongoose.Types.ObjectId;
  location?: string;
  coordinates?: any;
  votes: number;
  plannedDate?: Date;
  plannedTime?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const tripIdeaSchema = new Schema<ITripIdea>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  title: { type: String, required: true },
  description: String,
  status: { type: String, default: 'pending' },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  location: String,
  coordinates: Schema.Types.Mixed,
  votes: { type: Number, default: 0 },
  plannedDate: Date,
  plannedTime: String
}, { timestamps: true });

export const TripIdea: Model<ITripIdea> = mongoose.models.TripIdea || mongoose.model<ITripIdea>('TripIdea', tripIdeaSchema);

// TravelRecommendation Document Interface
export interface ITravelRecommendation extends Document {
  userId: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId;
  destinationName: string;
  description: string;
  activities: string[];
  interests: string[];
  estimatedBudget?: mongoose.Types.Decimal128;
  currency: string;
  recommendedDuration?: number;
  score?: mongoose.Types.Decimal128;
  matchingPreferences?: any;
  seasonalInfo?: any;
  localCuisine?: string[];
  culturalHighlights?: string[];
  practicalInfo?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

const travelRecommendationSchema = new Schema<ITravelRecommendation>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
  destinationName: { type: String, required: true },
  description: { type: String, required: true },
  activities: { type: [String], required: true },
  interests: { type: [String], required: true },
  estimatedBudget: Schema.Types.Decimal128,
  currency: { type: String, default: 'USD' },
  recommendedDuration: Number,
  score: Schema.Types.Decimal128,
  matchingPreferences: Schema.Types.Mixed,
  seasonalInfo: Schema.Types.Mixed,
  localCuisine: [String],
  culturalHighlights: [String],
  practicalInfo: Schema.Types.Mixed
}, { timestamps: true });

export const TravelRecommendation: Model<ITravelRecommendation> = mongoose.models.TravelRecommendation || mongoose.model<ITravelRecommendation>('TravelRecommendation', travelRecommendationSchema);

// Notification Document Interface
export interface INotification extends Document {
  userId?: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId;
  participantId?: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt?: Date;
}

const notificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
  participantId: { type: Schema.Types.ObjectId, ref: 'Participant' },
  type: { type: String, default: 'invitation' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const Notification: Model<INotification> = mongoose.models.Notification || mongoose.model<INotification>('Notification', notificationSchema);

// CustomColumn Document Interface
export interface ICustomColumn extends Document {
  tripId: mongoose.Types.ObjectId;
  name: string;
  type: string;
  columnId: string;
  createdAt?: Date;
}

const customColumnSchema = new Schema<ICustomColumn>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  columnId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const CustomColumn: Model<ICustomColumn> = mongoose.models.CustomColumn || mongoose.model<ICustomColumn>('CustomColumn', customColumnSchema);

// CustomValue Document Interface
export interface ICustomValue extends Document {
  columnId: string;
  participantId: mongoose.Types.ObjectId;
  value: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const customValueSchema = new Schema<ICustomValue>({
  columnId: { type: String, required: true },
  participantId: { type: Schema.Types.ObjectId, ref: 'Participant', required: true },
  value: { type: String, required: true }
}, { timestamps: true });

export const CustomValue: Model<ICustomValue> = mongoose.models.CustomValue || mongoose.model<ICustomValue>('CustomValue', customValueSchema);

// GoogleCalendarSync Document Interface
export interface IGoogleCalendarSync extends Document {
  tripId: mongoose.Types.ObjectId;
  calendarId: string;
  syncToken?: string;
  webhookChannelId?: string;
  webhookResourceId?: string;
  webhookExpiration?: Date;
  lastSyncedAt?: Date;
  createdAt?: Date;
}

const googleCalendarSyncSchema = new Schema<IGoogleCalendarSync>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  calendarId: { type: String, required: true },
  syncToken: String,
  webhookChannelId: String,
  webhookResourceId: String,
  webhookExpiration: Date,
  lastSyncedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

export const GoogleCalendarSync: Model<IGoogleCalendarSync> = mongoose.models.GoogleCalendarSync || mongoose.model<IGoogleCalendarSync>('GoogleCalendarSync', googleCalendarSyncSchema);
