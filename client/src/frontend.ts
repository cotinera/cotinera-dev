/**
 * This file consolidates all frontend UI/UX related components.
 * These components are focused on user interface and experience, 
 * separating them from backend functionality.
 */

// UI Components
export * from "@/components/ui";

// Map Related UI
export * from "@/components/map-view";
export * from "@/components/map-picker";
export * from "@/components/map-route-view";
export * from "@/components/location-search";
export * from "@/components/location-search-bar";
export * from "@/components/location-map-picker";
export * from "@/components/location-autocomplete";
export * from "@/components/pinned-places";

// Trip Related UI
export * from "@/components/trip-card";
export * from "@/components/trip-header-edit";
export * from "@/components/trip-timeline";
export * from "@/components/trip-destinations";
export * from "@/components/trip-destination-tabs";
// TripParticipantDetails is now directly imported in pages that use it

// Authentication UI
export * from "@/components/login-form";
export * from "@/components/register-form";
export * from "@/components/auth-layout";

// Theme and Display
export * from "@/components/shared/theme-provider";
export * from "@/components/shared/theme-toggle";
export * from "@/components/shared/image-upload";
export * from "@/components/shared/view-toggle";

// Calendar and Scheduling
export * from "@/components/calendar-view";

// Travel Features
export * from "@/components/travel-preferences-form";
export * from "@/components/travel-recommendations";
export * from "@/components/travel-guide";

// Booking and Reservations
export * from "@/components/accommodation-bookings";
export * from "@/components/flight-bookings";

// Collaboration Features
export * from "@/components/share-trip-dialog";
export * from "@/components/chat-messages";
export * from "@/components/checklist";

// Miscellaneous UI Components
export * from "@/components/image-upload";
export * from "@/components/view-toggle";

/**
 * Frontend Services and Hooks
 * These are UI-specific services and hooks that handle UI state and logic
 */

// User Interface Hooks
export * from "@/hooks/use-mobile";
export * from "@/hooks/use-tutorial";
export * from "@/hooks/use-toast";

/**
 * Frontend Utilities
 * Utility functions that specifically help with UI manipulation and rendering
 */
export * from "@/lib/utils";