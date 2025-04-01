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
  // Validate input
  if (!flightNumber) {
    return { error: 'Flight number is required.' };
  }
  
  if (!flightDate) {
    return { error: 'Flight date is required.' };
  }
  
  // Clean the flight number (remove spaces)
  const cleanFlightNumber = flightNumber.replace(/\s+/g, '').toUpperCase();
  
  if (!apiKey) {
    console.warn('No API key provided for flight lookup. Using mock data.');
    // For development, return mock data when no API key is available
    return generateMockFlightData(cleanFlightNumber, flightDate);
  }

  try {
    // Format date to YYYY-MM-DD as required by Aviation Stack API
    let formattedDate: string;
    
    try {
      formattedDate = new Date(flightDate).toISOString().split('T')[0];
    } catch (e) {
      console.error('Invalid date format provided:', flightDate);
      return { error: 'Invalid date format. Please use YYYY-MM-DD format.' };
    }
    
    console.log(`Looking up flight: ${cleanFlightNumber} on ${formattedDate}`);
    
    // Make request to Aviation Stack API
    const response = await axios.get('http://api.aviationstack.com/v1/flights', {
      params: {
        access_key: apiKey,
        flight_iata: cleanFlightNumber,
        flight_date: formattedDate
      }
    });
    
    console.log('Aviation Stack API response received');
    
    // Check if the response contains data
    if (!response.data || !response.data.data || response.data.data.length === 0) {
      console.log('No flight data found in API response');
      return { error: 'No flight information found for the given flight number and date.' };
    }
    
    // Extract relevant flight information
    const flightData = response.data.data[0];
    console.log('Flight data found:', JSON.stringify(flightData, null, 2).substring(0, 200) + '...');
    
    // Validate required flight data
    if (!flightData.airline || !flightData.departure || !flightData.arrival) {
      console.error('Incomplete flight data received from API');
      return { error: 'Incomplete flight information received from the API.' };
    }
    
    // Format the response to match our application's data structure
    return {
      flight: {
        airline: flightData.airline.name || 'Unknown Airline',
        flightNumber: cleanFlightNumber,
        departureAirport: {
          code: flightData.departure.iata || 'N/A',
          name: flightData.departure.airport || 'Unknown Airport',
          city: flightData.departure.city || 'Unknown City',
          country: flightData.departure.country || 'Unknown Country'
        },
        arrivalAirport: {
          code: flightData.arrival.iata || 'N/A',
          name: flightData.arrival.airport || 'Unknown Airport',
          city: flightData.arrival.city || 'Unknown City',
          country: flightData.arrival.country || 'Unknown Country'
        },
        scheduledDeparture: flightData.departure.scheduled || new Date().toISOString(),
        scheduledArrival: flightData.arrival.scheduled || new Date().toISOString(),
        status: flightData.flight_status || 'Unknown'
      }
    };
  } catch (error) {
    console.error('Error fetching flight information:', error);
    
    // Check if it's an API error with details
    if (axios.isAxiosError(error) && error.response) {
      console.error('API error details:', error.response.data);
      
      // Check for API-specific error messages
      if (error.response.data && error.response.data.error) {
        return { error: `API Error: ${error.response.data.error.message || error.response.data.error.info || 'Unknown API error'}` };
      }
    }
    
    return { error: 'Failed to fetch flight information. Please try again.' };
  }
}