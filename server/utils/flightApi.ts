import axios from 'axios';

// Interface for flight data returned by the API
export interface FlightApiResponse {
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

// Error response interface
interface ErrorResponse {
  error: string;
}

// For development/testing purposes when no API key is available
export function generateMockFlightData(flightNumber: string, flightDate: string): FlightApiResponse {
  // Parse the airline code and flight number
  // Typically airline codes are 2 characters followed by numbers
  const airlineCode = flightNumber.substring(0, 2);
  const flightNumberOnly = flightNumber.substring(2);
  
  // Map of some common airline codes to names
  const airlines: {[key: string]: string} = {
    'AA': 'American Airlines',
    'DL': 'Delta Air Lines',
    'UA': 'United Airlines',
    'BA': 'British Airways',
    'LH': 'Lufthansa',
    'AF': 'Air France',
    'KL': 'KLM Royal Dutch Airlines',
    'EK': 'Emirates',
    'QF': 'Qantas',
    'SQ': 'Singapore Airlines',
    'CX': 'Cathay Pacific',
    'JL': 'Japan Airlines',
    'NH': 'All Nippon Airways',
  };
  
  // Generate random airport codes (for testing only)
  const airports = [
    { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States' },
    { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States' },
    { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States' },
    { code: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom' },
    { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France' },
    { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany' },
    { code: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands' },
    { code: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'China' },
    { code: 'SYD', name: 'Sydney Airport', city: 'Sydney', country: 'Australia' },
    { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore' },
  ];
  
  // Deterministically select airports based on flight number to ensure consistency
  const flightNumSeed = parseInt(flightNumberOnly) || 0;
  const depIndex = flightNumSeed % airports.length;
  const arrIndex = (flightNumSeed + 3) % airports.length;
  
  // Parse the flight date and generate scheduled times
  const flightDateObj = new Date(flightDate);
  const departureTime = new Date(flightDateObj);
  departureTime.setHours(8 + (flightNumSeed % 12)); // Departure between 8am and 8pm
  departureTime.setMinutes((flightNumSeed * 17) % 60); // Random minutes
  
  const arrivalTime = new Date(departureTime);
  arrivalTime.setHours(arrivalTime.getHours() + 2 + (flightNumSeed % 10)); // Flight duration 2-12 hours
  
  return {
    flight: {
      airline: airlines[airlineCode] || `Airline ${airlineCode}`,
      flightNumber: flightNumber,
      departureAirport: airports[depIndex],
      arrivalAirport: airports[arrIndex],
      scheduledDeparture: departureTime.toISOString(),
      scheduledArrival: arrivalTime.toISOString(),
      status: 'Scheduled',
    }
  };
}

// Function to lookup flight information from Aviation Stack API
export async function lookupFlightInfo(
  flightNumber: string, 
  flightDate: string,
  apiKey?: string
): Promise<FlightApiResponse | ErrorResponse> {
  if (!apiKey) {
    console.warn('No API key provided for flight lookup. Using mock data.');
    // For development, return mock data when no API key is available
    return generateMockFlightData(flightNumber, flightDate);
  }

  try {
    // Parse the input flight number to extract airline IATA code and flight number
    const airlineCode = flightNumber.substring(0, 2); // Assuming 2-letter airline code
    const flightNum = flightNumber.substring(2); // Rest is the flight number
    
    // Format date to YYYY-MM-DD as required by Aviation Stack API
    const formattedDate = new Date(flightDate).toISOString().split('T')[0];
    
    // Make request to Aviation Stack API
    const response = await axios.get('http://api.aviationstack.com/v1/flights', {
      params: {
        access_key: apiKey,
        flight_iata: flightNumber,
        flight_date: formattedDate
      }
    });
    
    // Check if the response contains data
    if (!response.data || !response.data.data || response.data.data.length === 0) {
      return { error: 'No flight information found for the given flight number and date.' };
    }
    
    // Extract relevant flight information
    const flightData = response.data.data[0];
    
    // Format the response to match our application's data structure
    return {
      flight: {
        airline: flightData.airline.name,
        flightNumber: flightNumber,
        departureAirport: {
          code: flightData.departure.iata,
          name: flightData.departure.airport,
          city: flightData.departure.city,
          country: flightData.departure.country
        },
        arrivalAirport: {
          code: flightData.arrival.iata,
          name: flightData.arrival.airport,
          city: flightData.arrival.city,
          country: flightData.arrival.country
        },
        scheduledDeparture: flightData.departure.scheduled,
        scheduledArrival: flightData.arrival.scheduled,
        status: flightData.flight_status
      }
    };
  } catch (error) {
    console.error('Error fetching flight information:', error);
    return { error: 'Failed to fetch flight information. Please try again.' };
  }
}