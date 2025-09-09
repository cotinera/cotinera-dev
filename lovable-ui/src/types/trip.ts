// Enhanced trip interface with all your comprehensive features
export interface Trip {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  ownerId: string;
  coverImage?: string;
  status: "planned" | "active" | "completed" | "cancelled";
  isPublic: boolean;
  shareToken?: string;
  
  // Enhanced locations with coordinates
  locations: TripLocation[];
  
  // Collaborative features
  participants: TripParticipant[];
  
  // Budget management
  budget: TripBudget;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface TripLocation {
  id: string;
  name: string;
  description?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  startDate: string;
  endDate: string;
  address?: string;
  placeId?: string;
}

export interface TripParticipant {
  userId: string;
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
  status: "pending" | "accepted";
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface TripBudget {
  total: number;
  currency: string;
  categories: {
    accommodation: number;
    transportation: number;
    food: number;
    activities: number;
    other: number;
  };
}

export interface TripExpense {
  id: string;
  tripId: string;
  title: string;
  amount: number;
  currency: string;
  category: keyof TripBudget["categories"];
  description?: string;
  paidBy: string;
  splitAmong: string[];
  date: string;
  receipt?: string;
  createdAt: string;
}

export interface TripActivity {
  id: string;
  tripId: string;
  destinationId?: string;
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: {
    name: string;
    coordinates: { lat: number; lng: number };
    placeId?: string;
  };
  category: string;
  cost?: number;
  bookedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface TripAccommodation {
  id: string;
  tripId: string;
  destinationId?: string;
  name: string;
  type: "hotel" | "airbnb" | "hostel" | "resort" | "other";
  checkIn: string;
  checkOut: string;
  location: {
    name: string;
    address: string;
    coordinates: { lat: number; lng: number };
  };
  booking: {
    confirmationNumber?: string;
    totalCost: number;
    currency: string;
    bookedBy: string;
    bookingDate: string;
  };
  rooms: number;
  guests: number;
  amenities: string[];
  notes?: string;
  photos: string[];
  createdAt: string;
}

export interface PinnedPlace {
  id: string;
  tripId: string;
  name: string;
  description?: string;
  coordinates: { lat: number; lng: number };
  placeId: string;
  category: string;
  rating?: number;
  photos: string[];
  notes?: string;
  visitStatus: "want_to_visit" | "visited" | "not_interested";
  addedBy: string;
  createdAt: string;
}

export interface TripMessage {
  id: string;
  tripId: string;
  senderId: string;
  content: string;
  type: "text" | "image" | "location" | "system";
  timestamp: string;
  edited?: boolean;
  editedAt?: string;
}

export interface TripChecklist {
  id: string;
  tripId: string;
  title: string;
  items: ChecklistItem[];
  createdBy: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  assignedTo?: string;
  dueDate?: string;
  completedBy?: string;
  completedAt?: string;
}

export interface TravelPreferences {
  budget: "budget" | "mid-range" | "luxury";
  accommodation: ("hotel" | "airbnb" | "hostel" | "resort")[];
  transportation: ("flight" | "train" | "bus" | "car" | "bike")[];
  activities: ("adventure" | "cultural" | "relaxation" | "nightlife" | "food" | "nature")[];
  climate: ("tropical" | "temperate" | "cold" | "arid")[];
  groupSize: "solo" | "couple" | "small-group" | "large-group";
  accessibility: string[];
  dietary: string[];
}