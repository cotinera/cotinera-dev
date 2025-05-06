import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// This is an extremely minimal version just to display 
// the error message and prevent React hook errors
export function MapView({ className, location, tripId, pinnedPlaces, selectedPlace, onPinClick, onPlaceNameClick, hideSearchAndFilters }) {
  // No hooks at all in this component to avoid the hooks error

  // Display the error message
  return (
    <Card className={cn("w-full shadow-md", className)}>
      <div className="p-8 text-center">
        <div className="mb-4 text-red-500">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="48" 
            height="48" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="mx-auto"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3 className="font-bold text-xl mb-2">Google Maps Error</h3>
        <p className="text-muted-foreground mb-4">
          Unable to load Google Maps. This usually happens when Google Maps billing is not enabled.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          The Google Maps API requires billing to be enabled on your Google Cloud account. Please contact the administrator.
        </p>
        <div className="space-y-2">
          <p className="text-muted-foreground">You can still use other features of the application:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="outline" size="sm">View Trip Details</Button>
            <Button variant="outline" size="sm">Manage Participants</Button>
            <Button variant="outline" size="sm">Track Expenses</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}