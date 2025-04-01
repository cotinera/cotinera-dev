import React, { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Participant, Flight } from "db/schema";
import { useFlights } from "../hooks/use-flights";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Check,
  Clock,
  Copy,
  Edit,
  Loader2,
  MoreHorizontal,
  Plane,
  Plus,
  Search,
  User,
  UserPlus,
  X as XIcon,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Function to handle the flight in button click for a participant
export function handleAddFlightInClick(
  participantId: number, 
  selectedParticipant: any, 
  flightForm: any, 
  setCurrentParticipantId: (id: number) => void, 
  setFlightDetails: React.Dispatch<React.SetStateAction<any>>, 
  setIsAddFlightInOpen: React.Dispatch<React.SetStateAction<boolean>>
) {
  setCurrentParticipantId(participantId);
  
  // Pre-populate the flight date with the participant's arrival date if available
  const arrivalDate = selectedParticipant?.arrivalDate || format(new Date(), "yyyy-MM-dd");
  
  flightForm.reset({
    flightNumber: "",
    airline: "",
    departureAirport: "",
    arrivalAirport: "",
    departureDate: arrivalDate,
    departureTime: "",
    arrivalDate: "",
    arrivalTime: "",
    bookingReference: "",
    bookingStatus: "confirmed",
  });
  
  setFlightDetails(null);
  setIsAddFlightInOpen(true);
}

// Function to handle the flight out button click for a participant
export function handleAddFlightOutClick(
  participantId: number, 
  selectedParticipant: any, 
  flightForm: any, 
  setCurrentParticipantId: (id: number) => void, 
  setFlightDetails: React.Dispatch<React.SetStateAction<any>>, 
  setIsAddFlightOutOpen: React.Dispatch<React.SetStateAction<boolean>>
) {
  setCurrentParticipantId(participantId);
  
  // Pre-populate the flight date with the participant's departure date if available
  const departureDate = selectedParticipant?.departureDate || format(new Date(), "yyyy-MM-dd");
  
  flightForm.reset({
    flightNumber: "",
    airline: "",
    departureAirport: "",
    arrivalAirport: "",
    departureDate: departureDate,
    departureTime: "",
    arrivalDate: "",
    arrivalTime: "",
    bookingReference: "",
    bookingStatus: "confirmed",
  });
  
  setFlightDetails(null);
  setIsAddFlightOutOpen(true);
}

interface FlightDialogProps {
  isAddFlightInOpen: boolean;
  setIsAddFlightInOpen: React.Dispatch<React.SetStateAction<boolean>>;
  flightForm: any;
  flightDetails: any;
  setFlightDetails: React.Dispatch<React.SetStateAction<any>>;
  isLookingUpFlight: boolean;
  lookupFlightDetails: () => Promise<void>;
  handleFlightInSubmit: (data: any) => void;
}

// Flight Details Dialog for inbound flights
export function FlightInDialog({ 
  isAddFlightInOpen, 
  setIsAddFlightInOpen, 
  flightForm, 
  flightDetails, 
  setFlightDetails, 
  isLookingUpFlight, 
  lookupFlightDetails, 
  handleFlightInSubmit 
}: FlightDialogProps) {
  return (
    <Dialog 
      open={isAddFlightInOpen} 
      onOpenChange={(open) => {
        if (!open) setFlightDetails(null);
        setIsAddFlightInOpen(open);
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Inbound Flight</DialogTitle>
          <DialogDescription>
            Enter flight number and date to retrieve flight details.
          </DialogDescription>
        </DialogHeader>
        <Form {...flightForm}>
          <form onSubmit={flightForm.handleSubmit(handleFlightInSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={flightForm.control}
                name="flightNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. BA123" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter airline code and flight number
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={flightForm.control}
                name="departureDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Date of the flight
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="button" 
                variant="secondary"
                onClick={lookupFlightDetails}
                disabled={isLookingUpFlight}
                className="w-full md:w-auto"
              >
                {isLookingUpFlight ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Lookup Flight Details
              </Button>
            </div>
            
            {/* Flight Details Card - Only shown after successful lookup */}
            {flightDetails && (
              <Card className="bg-accent/50">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center">
                      <Plane className="h-5 w-5 mr-2 inline" />
                      {flightDetails.airline} {flightDetails.flightNumber}
                    </CardTitle>
                    <Badge variant={
                      flightDetails.status.toLowerCase() === 'landed' ? 'default' :
                      flightDetails.status.toLowerCase() === 'delayed' ? 'destructive' :
                      'secondary'
                    }>
                      {flightDetails.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">Departure</div>
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-background mr-2">
                          <span className="text-sm font-medium">{flightDetails.departureAirport.code}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium">{flightDetails.departureAirport.city}</div>
                          <div className="text-xs text-muted-foreground">{flightDetails.departureAirport.name}</div>
                          <div className="text-xs">
                            {format(new Date(flightDetails.scheduledDeparture), "MMM d, yyyy")} • {format(new Date(flightDetails.scheduledDeparture), "HH:mm")}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">Arrival</div>
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-background mr-2">
                          <span className="text-sm font-medium">{flightDetails.arrivalAirport.code}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium">{flightDetails.arrivalAirport.city}</div>
                          <div className="text-xs text-muted-foreground">{flightDetails.arrivalAirport.name}</div>
                          <div className="text-xs">
                            {format(new Date(flightDetails.scheduledArrival), "MMM d, yyyy")} • {format(new Date(flightDetails.scheduledArrival), "HH:mm")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Hidden fields that will be auto-populated by the API */}
            <div className="hidden">
              <FormField name="airline" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="departureAirport" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="arrivalAirport" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="departureTime" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="arrivalDate" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="arrivalTime" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="bookingReference" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="bookingStatus" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddFlightInOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLookingUpFlight || !flightForm.getValues("airline")}>
                <Plane className="h-4 w-4 mr-2" />
                Save Flight
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface FlightOutDialogProps {
  isAddFlightOutOpen: boolean;
  setIsAddFlightOutOpen: React.Dispatch<React.SetStateAction<boolean>>;
  flightForm: any;
  flightDetails: any;
  setFlightDetails: React.Dispatch<React.SetStateAction<any>>;
  isLookingUpFlight: boolean;
  lookupFlightDetails: () => Promise<void>;
  handleFlightOutSubmit: (data: any) => void;
}

// Flight Details Dialog for outbound flights
export function FlightOutDialog({ 
  isAddFlightOutOpen, 
  setIsAddFlightOutOpen, 
  flightForm, 
  flightDetails, 
  setFlightDetails, 
  isLookingUpFlight, 
  lookupFlightDetails, 
  handleFlightOutSubmit 
}: FlightOutDialogProps) {
  return (
    <Dialog 
      open={isAddFlightOutOpen} 
      onOpenChange={(open) => {
        if (!open) setFlightDetails(null);
        setIsAddFlightOutOpen(open);
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Outbound Flight</DialogTitle>
          <DialogDescription>
            Enter flight number and date to retrieve flight details.
          </DialogDescription>
        </DialogHeader>
        <Form {...flightForm}>
          <form onSubmit={flightForm.handleSubmit(handleFlightOutSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={flightForm.control}
                name="flightNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. BA123" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter airline code and flight number
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={flightForm.control}
                name="departureDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Date of the flight
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="button" 
                variant="secondary"
                onClick={lookupFlightDetails}
                disabled={isLookingUpFlight}
                className="w-full md:w-auto"
              >
                {isLookingUpFlight ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Lookup Flight Details
              </Button>
            </div>
            
            {/* Flight Details Card - Only shown after successful lookup */}
            {flightDetails && (
              <Card className="bg-accent/50">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center">
                      <Plane className="h-5 w-5 mr-2 inline" />
                      {flightDetails.airline} {flightDetails.flightNumber}
                    </CardTitle>
                    <Badge variant={
                      flightDetails.status.toLowerCase() === 'landed' ? 'default' :
                      flightDetails.status.toLowerCase() === 'delayed' ? 'destructive' :
                      'secondary'
                    }>
                      {flightDetails.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">Departure</div>
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-background mr-2">
                          <span className="text-sm font-medium">{flightDetails.departureAirport.code}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium">{flightDetails.departureAirport.city}</div>
                          <div className="text-xs text-muted-foreground">{flightDetails.departureAirport.name}</div>
                          <div className="text-xs">
                            {format(new Date(flightDetails.scheduledDeparture), "MMM d, yyyy")} • {format(new Date(flightDetails.scheduledDeparture), "HH:mm")}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">Arrival</div>
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-background mr-2">
                          <span className="text-sm font-medium">{flightDetails.arrivalAirport.code}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium">{flightDetails.arrivalAirport.city}</div>
                          <div className="text-xs text-muted-foreground">{flightDetails.arrivalAirport.name}</div>
                          <div className="text-xs">
                            {format(new Date(flightDetails.scheduledArrival), "MMM d, yyyy")} • {format(new Date(flightDetails.scheduledArrival), "HH:mm")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Hidden fields that will be auto-populated by the API */}
            <div className="hidden">
              <FormField name="airline" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="departureAirport" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="arrivalAirport" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="departureTime" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="arrivalDate" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="arrivalTime" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="bookingReference" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
              <FormField name="bookingStatus" control={flightForm.control} render={({ field }) => (
                <Input {...field} type="hidden" />
              )} />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddFlightOutOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLookingUpFlight || !flightForm.getValues("airline")}>
                <Plane className="h-4 w-4 mr-2" />
                Save Flight
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}