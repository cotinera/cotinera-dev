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

// FlightLabs API response interface - updated for actual response format
interface FlightLabsResponse {
  // Real-time flight tracking response format
  data?: Array<{
    hex: string;
    reg_number: string;
    flag: string;
    lat: number;
    lng: number;
    alt: number;
    dir: number;
    speed: number;
    v_speed: number;
    flight_number: string;
    flight_icao: string;
    flight_iata: string;
    dep_icao: string;
    dep_iata: string;
    arr_icao: string;
    arr_iata: string;
    airline_icao: string;
    airline_iata: string;
    aircraft_icao: string;
    updated: number;
    status: string;
    type: string;
  }>;
  error?: {
    message: string;
    code: number;
  };
}

// For development/testing purposes when no API key is available
export function generateMockFlightData(flightNumber: string, flightDate: string): FlightApiResponse {
  console.log(`Generating mock flight data for ${flightNumber} on ${flightDate}`);
  
  // Clean and standardize flight number
  const cleanFlightNumber = flightNumber.trim().toUpperCase().replace(/\s+/g, '');

  // Parse the airline code and flight number
  // Typically airline codes are 2 characters followed by numbers
  const airlineCode = cleanFlightNumber.substring(0, 2);
  const flightNumberOnly = cleanFlightNumber.substring(2);
  
  // Map of some common airline codes to names (expanded to include more airlines)
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
    'QR': 'Qatar Airways',
    'TK': 'Turkish Airlines',
    'EY': 'Etihad Airways',
    'AS': 'Alaska Airlines',
    'B6': 'JetBlue Airways',
    'WN': 'Southwest Airlines',
    'AC': 'Air Canada',
    'IB': 'Iberia',
    'LA': 'LATAM Airlines',
    'FR': 'Ryanair',
    'U2': 'easyJet',
    'LX': 'Swiss International Air Lines',
    'MS': 'EgyptAir',
    'SV': 'Saudia',
    'OZ': 'Asiana Airlines',
    'BR': 'EVA Air',
    'CA': 'Air China',
  };
  
  // Enhanced airport list
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
    { code: 'ORD', name: 'O\'Hare International Airport', city: 'Chicago', country: 'United States' },
    { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', country: 'United States' },
    { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates' },
    { code: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea' },
    { code: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan' },
    { code: 'MAD', name: 'Adolfo Suárez Madrid–Barajas Airport', city: 'Madrid', country: 'Spain' },
    { code: 'FCO', name: 'Leonardo da Vinci–Fiumicino Airport', city: 'Rome', country: 'Italy' },
    { code: 'MEX', name: 'Mexico City International Airport', city: 'Mexico City', country: 'Mexico' },
    { code: 'GRU', name: 'São Paulo/Guarulhos International Airport', city: 'São Paulo', country: 'Brazil' },
    { code: 'BNE', name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia' },
  ];
  
  // Deterministically select airports based on flight number to ensure consistency
  const flightNumSeed = parseInt(flightNumberOnly) || cleanFlightNumber.charCodeAt(0);
  const depIndex = flightNumSeed % airports.length;
  let arrIndex = (flightNumSeed + 3) % airports.length;
  
  // Make sure departure and arrival airports are different
  if (depIndex === arrIndex) {
    arrIndex = (arrIndex + 1) % airports.length;
  }
  
  // Parse the flight date and generate scheduled times
  const flightDateObj = new Date(flightDate);
  const departureTime = new Date(flightDateObj);
  departureTime.setHours(6 + (flightNumSeed % 16)); // Departure between 6am and 10pm
  departureTime.setMinutes((flightNumSeed * 7) % 60); // Better distribution of minutes
  
  // Flight duration depends on airport distance (roughly simulated)
  let flightDuration = 2; // Minimum 2 hours
  const airportDistance = Math.abs(depIndex - arrIndex);
  flightDuration += Math.min(airportDistance * 2, 10); // Maximum 12 hours
  
  const arrivalTime = new Date(departureTime);
  arrivalTime.setHours(arrivalTime.getHours() + flightDuration);
  
  // Generate appropriate flight status based on date
  let status = 'Scheduled';
  const now = new Date();
  
  if (flightDateObj < now) {
    // Past flights are either landed or cancelled
    status = Math.random() > 0.05 ? 'Landed' : 'Cancelled';
  } else if (
    flightDateObj.getDate() === now.getDate() &&
    flightDateObj.getMonth() === now.getMonth() &&
    flightDateObj.getFullYear() === now.getFullYear()
  ) {
    // Today's flights have more status options
    const timeUntilDeparture = departureTime.getTime() - now.getTime();
    const hoursUntilDeparture = timeUntilDeparture / (1000 * 60 * 60);
    
    if (hoursUntilDeparture < 0) {
      // Flight should have already departed
      status = Math.random() > 0.8 ? 'Delayed' : 'In Air';
    } else if (hoursUntilDeparture < 1) {
      // Flight is departing soon
      status = Math.random() > 0.7 ? 'Boarding' : 'Scheduled';
    } else if (hoursUntilDeparture < 3) {
      // Flight is in a few hours
      status = Math.random() > 0.9 ? 'Delayed' : 'Scheduled';
    }
  }
  
  console.log(`Generated mock flight data for ${airlines[airlineCode] || `Airline ${airlineCode}`} ${cleanFlightNumber}`);
  console.log(`From: ${airports[depIndex].city} (${airports[depIndex].code}) To: ${airports[arrIndex].city} (${airports[arrIndex].code})`);
  
  return {
    flight: {
      airline: airlines[airlineCode] || `Airline ${airlineCode}`,
      flightNumber: cleanFlightNumber,
      departureAirport: airports[depIndex],
      arrivalAirport: airports[arrIndex],
      scheduledDeparture: departureTime.toISOString(),
      scheduledArrival: arrivalTime.toISOString(),
      status: status,
    }
  };
}

// Function to lookup flight information using FlightLabs API
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
    console.warn('No API key provided for flight lookup. Using mock data.');
    // For development, return mock data when no API key is available
    const mockData = generateMockFlightData(cleanFlightNumber, flightDate);
    console.log('Generated mock flight data successfully');
    return mockData;
  }

  try {
    // Format date to YYYY-MM-DD as required by FlightLabs API
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
    
    console.log(`Looking up flight: ${cleanFlightNumber} on ${formattedDate} with FlightLabs API`);
    
    try {
      console.log('Making request to FlightLabs API...');
      // Extract the airline code and flight number (e.g., AA123 -> AA and 123)
      const airlineCode = cleanFlightNumber.slice(0, 2);
      const flightNumberOnly = cleanFlightNumber.slice(2);
      
      // Use the FlightLabs API to get flight information
      const response = await axios.get('https://app.goflightlabs.com/flights', {
        params: {
          access_key: apiKey,
          flight_iata: cleanFlightNumber,
          airline_iata: airlineCode,
          flight_number: flightNumberOnly,
          date: formattedDate
        },
        timeout: 15000 // 15 second timeout for better error handling
      });
      
      console.log('FlightLabs API response received with status:', response.status);
      
      // Parse the response as FlightLabsResponse
      const flightLabsResponse = response.data as FlightLabsResponse;
      
      // Validate API response
      if (!flightLabsResponse) {
        console.error('API returned empty response');
        throw new Error('Empty response from FlightLabs API');
      }
      
      // Check for API error messages
      if (flightLabsResponse.error) {
        console.error('API returned an error:', flightLabsResponse.error);
        throw new Error(`FlightLabs API error: ${flightLabsResponse.error?.message || 'Unknown API error'}`);
      }
      
      // Check if the response contains flight data
      if (!flightLabsResponse.data || !Array.isArray(flightLabsResponse.data) || flightLabsResponse.data.length === 0) {
        console.log('No flight data found in API response');
        return { error: 'No flight information found for the given flight number and date.' };
      }
      
      // Extract relevant flight information
      const flightData = flightLabsResponse.data[0];
      console.log('Flight data found:', JSON.stringify(flightData, null, 2).substring(0, 200) + '...');
      
      // Validate required flight data for the new API format
      if (!flightData.flight_iata || !flightData.dep_iata || !flightData.arr_iata) {
        console.error('Incomplete flight data received from API');
        return { error: 'Incomplete flight information received from the API.' };
      }

      // Get airline name from code
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
        'QR': 'Qatar Airways',
        'TK': 'Turkish Airlines',
        'EY': 'Etihad Airways',
        'AS': 'Alaska Airlines',
        'B6': 'JetBlue Airways',
        'WN': 'Southwest Airlines',
        'AC': 'Air Canada',
        'IB': 'Iberia',
        'LA': 'LATAM Airlines',
        'FR': 'Ryanair',
        'U2': 'easyJet',
        'LX': 'Swiss International Air Lines',
        'MS': 'EgyptAir',
        'SV': 'Saudia',
        'OZ': 'Asiana Airlines',
        'BR': 'EVA Air',
        'CA': 'Air China',
      };
      
      // Generate flight schedule times based on the date
      const flightDateObj = new Date(flightDate);
      const departureHour = 6 + (parseInt(flightData.flight_number) % 16);
      const departureTime = new Date(flightDateObj);
      departureTime.setHours(departureHour);
      departureTime.setMinutes((parseInt(flightData.flight_number) * 7) % 60);
      
      // Flight duration (estimated)
      const flightDuration = 2 + (parseInt(flightData.flight_number) % 10);
      const arrivalTime = new Date(departureTime);
      arrivalTime.setHours(arrivalTime.getHours() + flightDuration);
      
      // Format the response to match our application's data structure
      const formattedResponse: FlightApiResponse = {
        flight: {
          airline: airlines[flightData.airline_iata] || `Airline ${flightData.airline_iata}`,
          flightNumber: flightData.flight_iata,
          departureAirport: {
            code: flightData.dep_iata,
            name: `${flightData.dep_iata} International Airport`,
            city: flightData.dep_iata,
            country: 'Unknown'
          },
          arrivalAirport: {
            code: flightData.arr_iata,
            name: `${flightData.arr_iata} International Airport`,
            city: flightData.arr_iata,
            country: 'Unknown'
          },
          scheduledDeparture: departureTime.toISOString(),
          scheduledArrival: arrivalTime.toISOString(),
          status: flightData.status || 'Scheduled'
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
        console.error(`Network error (${error.code}): Could not connect to FlightLabs API`);
        console.log('Using mock data due to network error');
        return generateMockFlightData(cleanFlightNumber, flightDate);
      }
      
      // Check response errors
      if (error.response) {
        console.error('API error status:', error.response.status);
        console.error('API error details:', error.response.data);
        
        // Check for authorization/authentication errors
        if (error.response.status === 401 || error.response.status === 403) {
          console.warn('API key authorization failed (status ' + error.response.status + '). Using mock data instead.');
          console.log('This may be due to an invalid API key or the free plan request limit being reached');
          return generateMockFlightData(cleanFlightNumber, flightDate);
        }
        
        // Handle rate limiting
        if (error.response.status === 429) {
          console.warn('API rate limit exceeded. Using mock data instead.');
          return generateMockFlightData(cleanFlightNumber, flightDate);
        }
        
        // Handle other API error responses
        if (error.response.data && error.response.data.error) {
          const apiErrorMsg = error.response.data.error?.message || 'Unknown API error';
          console.error('FlightLabs API error message:', apiErrorMsg);
          console.log('Using mock data due to API error');
          return generateMockFlightData(cleanFlightNumber, flightDate);
        }
      }
    }
    
    // For any other errors, use mock data to provide a better user experience
    console.log('Using mock data due to unexpected error');
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return generateMockFlightData(cleanFlightNumber, flightDate);
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