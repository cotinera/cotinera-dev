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

// AviationStack API response interface
interface AviationStackResponse {
  pagination: {
    limit: number;
    offset: number;
    count: number;
    total: number;
  };
  data: Array<{
    flight_date: string;
    flight_status: string;
    departure: {
      airport: string;
      timezone: string;
      iata: string;
      icao: string;
      terminal?: string;
      gate?: string;
      delay?: number;
      scheduled: string;
      estimated: string;
      actual?: string;
      estimated_runway?: string;
      actual_runway?: string;
    };
    arrival: {
      airport: string;
      timezone: string;
      iata: string;
      icao: string;
      terminal?: string;
      gate?: string;
      baggage?: string;
      delay?: number;
      scheduled: string;
      estimated: string;
      actual?: string;
      estimated_runway?: string;
      actual_runway?: string;
    };
    airline: {
      name: string;
      iata: string;
      icao: string;
    };
    flight: {
      number: string;
      iata: string;
      icao: string;
      codeshared?: {
        airline_name: string;
        airline_iata: string;
        airline_icao: string;
        flight_number: string;
        flight_iata: string;
        flight_icao: string;
      };
    };
    aircraft?: {
      registration: string;
      iata: string;
      icao: string;
      icao24: string;
    };
    live?: {
      updated: string;
      latitude: number;
      longitude: number;
      altitude: number;
      direction: number;
      speed_horizontal: number;
      speed_vertical: number;
      is_ground: boolean;
    };
  }>;
}

// We now only use authenticated AviationStack API data
// No mock data generation to ensure data integrity

// Function to lookup flight information using AviationStack API
export async function lookupFlightInfo(
  flightNumber: string, 
  flightDate: string,
  apiKey?: string
): Promise<FlightApiResponse | ErrorResponse> {
  // Validate input
  if (!flightNumber) {
    console.warn('Flight lookup called without flight number');
    return { error: 'Flight number is required.' };
  }
  
  if (!flightDate) {
    console.warn('Flight lookup called without flight date');
    return { error: 'Flight date is required.' };
  }
  
  // Clean and standardize the flight number
  const cleanFlightNumber = flightNumber.trim().replace(/\s+/g, '').toUpperCase();
  console.log(`Cleaned flight number: "${cleanFlightNumber}" from input: "${flightNumber}"`);
  
  if (!apiKey) {
    console.warn('No API key provided for flight lookup.');
    // For data integrity, we should not use mock data when no API key is available
    return { error: 'API key is required to fetch authentic flight data.' };
  }

  try {
    // Format date to YYYY-MM-DD as required by AviationStack API
    let formattedDate: string;
    
    try {
      // Try to parse the date
      const dateObj = new Date(flightDate);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date');
      }
      formattedDate = dateObj.toISOString().split('T')[0];
      console.log(`Formatted date: ${formattedDate} from input: ${flightDate}`);
    } catch (e) {
      console.error('Invalid date format provided:', flightDate, e);
      return { error: 'Invalid date format. Please use YYYY-MM-DD format.' };
    }
    
    console.log(`Looking up flight: ${cleanFlightNumber} on ${formattedDate} with AviationStack API`);
    
    try {
      console.log('Making request to AviationStack API...');
      // Extract the airline code and flight number (e.g., AA123 -> AA and 123)
      const airlineCode = cleanFlightNumber.slice(0, 2);
      const flightNumberOnly = cleanFlightNumber.slice(2);
      
      // Use the AviationStack API to get flight information
      const response = await axios.get('http://api.aviationstack.com/v1/flights', {
        params: {
          access_key: apiKey,
          flight_iata: cleanFlightNumber,
          flight_date: formattedDate
        },
        timeout: 15000 // 15 second timeout for better error handling
      });
      
      console.log('AviationStack API response received with status:', response.status);
      
      // Parse the response as AviationStackResponse
      const aviationStackResponse = response.data as AviationStackResponse;
      
      // Validate API response
      if (!aviationStackResponse) {
        console.error('API returned empty response');
        throw new Error('Empty response from AviationStack API');
      }
      
      // Check for API error responses
      if (response.data.error) {
        console.error('API returned an error:', response.data.error);
        return { error: 'The flight data service returned an error. Please try again later.' };
      }
      
      // Check if the response contains flight data
      if (!aviationStackResponse.data || !Array.isArray(aviationStackResponse.data) || aviationStackResponse.data.length === 0) {
        console.log('No flight data found in API response');
        return { error: 'No flight information found for the given flight number and date.' };
      }
      
      // Extract the first matching flight (which should be the most relevant)
      const flightData = aviationStackResponse.data[0];
      console.log('Flight data found:', JSON.stringify(flightData, null, 2).substring(0, 200) + '...');
      
      // Validate required flight data exists
      if (!flightData.flight || !flightData.departure || !flightData.arrival) {
        console.error('Incomplete flight data received from API');
        return { error: 'Incomplete flight information received from the API.' };
      }

      // Format the response to match our application's data structure
      const formattedResponse: FlightApiResponse = {
        flight: {
          airline: flightData.airline.name,
          flightNumber: flightData.flight.iata,
          departureAirport: {
            code: flightData.departure.iata,
            name: flightData.departure.airport,
            city: getAirportCity(flightData.departure.airport),
            country: getAirportCountry(flightData.departure.airport)
          },
          arrivalAirport: {
            code: flightData.arrival.iata,
            name: flightData.arrival.airport,
            city: getAirportCity(flightData.arrival.airport),
            country: getAirportCountry(flightData.arrival.airport)
          },
          scheduledDeparture: flightData.departure.scheduled,
          scheduledArrival: flightData.arrival.scheduled,
          status: flightData.flight_status
        }
      };
      
      console.log('Successfully formatted API response:', {
        airline: formattedResponse.flight.airline,
        flightNumber: formattedResponse.flight.flightNumber,
        departure: formattedResponse.flight.departureAirport.code,
        arrival: formattedResponse.flight.arrivalAirport.code,
        status: formattedResponse.flight.status
      });
      
      return formattedResponse;
    } catch (apiError) {
      throw apiError; // Re-throw to be handled by the outer catch block
    }
  } catch (error) {
    console.error('Error fetching flight information:', error);
    
    // Enhanced error handling for different error types
    if (axios.isAxiosError(error)) {
      // Network or Axios specific errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        console.error(`Network error (${error.code}): Could not connect to AviationStack API`);
        return { 
          error: 'Network error: Could not connect to flight data service. Please try again later.' 
        };
      }
      
      // Check response errors
      if (error.response) {
        console.error('API error status:', error.response.status);
        console.error('API error details:', error.response.data);
        
        // Check for authorization/authentication errors
        if (error.response.status === 401 || error.response.status === 403) {
          console.warn('API key authorization failed (status ' + error.response.status + ').');
          console.log('This may be due to an invalid API key or the free plan request limit being reached');
          return { 
            error: 'Authentication error: The flight data service could not validate our request. Please try again later.' 
          };
        }
        
        // Handle rate limiting
        if (error.response.status === 429) {
          console.warn('API rate limit exceeded.');
          return { 
            error: 'Rate limit exceeded: Too many requests to the flight data service. Please try again later.' 
          };
        }
        
        // Handle other API error responses
        if (error.response.data && error.response.data.error) {
          const apiErrorMsg = typeof error.response.data.error === 'string' 
            ? error.response.data.error 
            : JSON.stringify(error.response.data.error);
            
          console.error('AviationStack API error message:', apiErrorMsg);
          return { 
            error: `Flight data service error: ${apiErrorMsg}` 
          };
        }
      }
    }
    
    // For any other errors, return an appropriate error message
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      return { 
        error: `Could not retrieve flight information: ${error.message}` 
      };
    }
    
    return { 
      error: 'An unexpected error occurred while retrieving flight information. Please try again later.' 
    };
  }
}

// Helper function to extract city from airport name
function getAirportCity(airportName: string): string {
  // Try to extract city from common airport name formats
  // Format: "City International Airport" or "City Airport"
  const cityMatches = airportName.match(/^(.*?)\s(?:International\s)?Airport/i);
  if (cityMatches && cityMatches[1]) {
    return cityMatches[1].trim();
  }
  
  // If we can't extract the city, return Unknown City
  return 'Unknown City';
}

// Helper function to guess country based on airport name
function getAirportCountry(airportName: string): string {
  // This is a simplified approach - in a real application, you would use a more comprehensive database
  // of airport information to determine the country
  
  // Check for common country indicators in airport names
  const countryIndicators: { [key: string]: string } = {
    'Heathrow': 'United Kingdom',
    'Gatwick': 'United Kingdom',
    'JFK': 'United States',
    'LAX': 'United States',
    'O\'Hare': 'United States',
    'Charles de Gaulle': 'France',
    'Frankfurt': 'Germany',
    'Schiphol': 'Netherlands',
    'Narita': 'Japan',
    'Haneda': 'Japan',
    'Incheon': 'South Korea',
    'Sydney': 'Australia',
    'Toronto': 'Canada',
    'Vancouver': 'Canada',
    'Dubai': 'United Arab Emirates',
    'Beijing': 'China',
    'Shanghai': 'China',
    'Hong Kong': 'China',
    'Singapore': 'Singapore',
    'Changi': 'Singapore',
    'Mumbai': 'India',
    'Delhi': 'India',
    'São Paulo': 'Brazil',
    'Rio de Janeiro': 'Brazil',
    'Johannesburg': 'South Africa',
    'Cape Town': 'South Africa',
    'Madrid': 'Spain',
    'Barcelona': 'Spain',
    'Rome': 'Italy',
    'Milan': 'Italy',
    'Zurich': 'Switzerland',
    'Geneva': 'Switzerland',
    'Vienna': 'Austria',
    'Oslo': 'Norway',
    'Stockholm': 'Sweden',
    'Copenhagen': 'Denmark',
    'Helsinki': 'Finland',
    'Moscow': 'Russia',
    'Saint Petersburg': 'Russia',
  };
  
  for (const indicator in countryIndicators) {
    if (airportName.includes(indicator)) {
      return countryIndicators[indicator];
    }
  }
  
  return 'Unknown Country';
}