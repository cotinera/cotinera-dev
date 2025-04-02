import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { UseFormReturn } from "react-hook-form";

interface FlightApiResponse {
  flight: {
    airline: string;
    flightNumber: string;
    departureAirport: {
      code: string;
      name: string;
      city: string;
      country: string;
    };
    arrivalAirport: {
      code: string;
      name: string;
      city: string;
      country: string;
    };
    scheduledDeparture: string; // ISO date string
    scheduledArrival: string;   // ISO date string
    status: string;
  };
}

interface ErrorResponse {
  error: string;
}

export function useFlightLookup(flightForm: UseFormReturn<any>) {
  const [isLookingUpFlight, setIsLookingUpFlight] = useState(false);
  const [flightDetails, setFlightDetails] = useState<FlightApiResponse['flight'] | null>(null);
  const { toast } = useToast();

  const lookupFlightDetails = async () => {
    const flightNumber = flightForm.getValues("flightNumber");
    const flightDate = flightForm.getValues("departureDate");

    if (!flightNumber || !flightDate) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter both flight number and date",
      });
      return;
    }

    setIsLookingUpFlight(true);

    try {
      const response = await fetch(
        `/api/flights/lookup?flightNumber=${encodeURIComponent(
          flightNumber
        )}&date=${encodeURIComponent(flightDate)}`
      );

      const data: FlightApiResponse | ErrorResponse = await response.json();

      if ('error' in data) {
        toast({
          variant: "destructive",
          title: "Flight Lookup Failed",
          description: data.error || "Could not find flight information",
        });
        return;
      }

      if (!data.flight) {
        toast({
          variant: "destructive",
          title: "Flight Lookup Failed",
          description: "No flight data available",
        });
        return;
      }

      // Store the flight details for display
      setFlightDetails(data.flight);

      // Update the form with the retrieved flight information
      flightForm.setValue("airline", data.flight.airline);
      flightForm.setValue("departureAirport", data.flight.departureAirport.code);
      flightForm.setValue("arrivalAirport", data.flight.arrivalAirport.code);

      // Parse departure date and time
      const departureDateObj = new Date(data.flight.scheduledDeparture);
      const departureTime = departureDateObj.toTimeString().substring(0, 5); // HH:MM format

      // Parse arrival date and time
      const arrivalDateObj = new Date(data.flight.scheduledArrival);
      const arrivalTime = arrivalDateObj.toTimeString().substring(0, 5); // HH:MM format
      const arrivalDate = arrivalDateObj.toISOString().split('T')[0]; // YYYY-MM-DD format

      flightForm.setValue("departureTime", departureTime);
      flightForm.setValue("arrivalDate", arrivalDate);
      flightForm.setValue("arrivalTime", arrivalTime);

      toast({
        title: "Flight Found",
        description: `Flight details found for ${data.flight.airline} ${data.flight.flightNumber}`,
      });
    } catch (error) {
      console.error("Flight lookup error:", error);
      toast({
        variant: "destructive",
        title: "Flight Lookup Error",
        description: "Failed to connect to flight information service",
      });
    } finally {
      setIsLookingUpFlight(false);
    }
  };

  return {
    isLookingUpFlight,
    flightDetails,
    setFlightDetails,
    lookupFlightDetails,
  };
}