# Deutsche Bahn Price Search Backend

This is a backend service for searching Deutsche Bahn train prices and connections. It's designed as a supporting microservice for the main application at [bahn.vibe](https://github.com/jschae23/bahn.vibe).

## Overview

This Express.js backend provides REST API endpoints to:
- Search for train stations dynamically using the Deutsche Bahn API
- Find the best prices for train connections across multiple dates
- Return detailed connection information including departure/arrival times

## Features

- **Dynamic Station Search**: Automatically resolves station names to Deutsche Bahn station IDs
- **Multi-day Price Search**: Search for best prices across multiple consecutive days
- **Flexible Configuration**: Support for different travel classes, connection types, and transfer limits
- **Real-time Data**: Fetches live pricing data from Deutsche Bahn's official API
- **CORS Enabled**: Ready for cross-origin requests from frontend applications

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd bahn-backend

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on port 3000 by default (or the port specified in the `PORT` environment variable).

## API Endpoints

### 1. Search Station

Search for a train station by name or partial name.

**Endpoint:** `GET /api/search-station`

**Parameters:**
- `query` (string, required): Station name or partial name to search for

**Example:**
```bash
curl "http://localhost:3000/api/search-station?query=München"
```

**Response:**
```json
{
  "id": "A=1@O=München Hbf@X=11558339@Y=48140229@U=80@L=8000261@B=1@p=1751482402@i=U×008020347@",
  "name": "München Hbf"
}
```

### 2. Search Prices

Search for train connections and prices across multiple dates.

**Endpoint:** `POST /api/search-prices`

**Request Body:**
```json
{
  "start": "München",
  "ziel": "Berlin",
  "abfahrtab": "2025-01-30",
  "klasse": "KLASSE_2",
  "schnelleVerbindungen": false,
  "nurDeutschlandTicketVerbindungen": false,
  "maximaleUmstiege": "9",
  "dayLimit": 3
}
```

**Parameters:**
- `start` (string, required): Departure city/station name
- `ziel` (string, required): Destination city/station name  
- `abfahrtab` (string, required): Start date in YYYY-MM-DD format
- `klasse` (string): Travel class (`KLASSE_1` or `KLASSE_2`)
- `schnelleVerbindungen` (boolean): Prefer fast connections
- `nurDeutschlandTicketVerbindungen` (boolean): Deutschland-Ticket only connections
- `maximaleUmstiege` (string): Maximum number of transfers (e.g., "9")
- `dayLimit` (number): Number of consecutive days to search (default: 3)

**Example:**
```bash
curl -X POST http://localhost:3000/api/search-prices \
  -H "Content-Type: application/json" \
  -d '{
    "start": "München",
    "ziel": "Berlin",
    "abfahrtab": "2025-01-30",
    "klasse": "KLASSE_2",
    "schnelleVerbindungen": false,
    "nurDeutschlandTicketVerbindungen": false,
    "maximaleUmstiege": "9",
    "dayLimit": 3
  }'
```

**Response:**
```json
{
  "2025-01-30": {
    "preis": 29.90,
    "info": "30.01.2025, 08:15:00 München Hbf -> 30.01.2025, 12:28:00 Berlin Hbf",
    "abfahrtsZeitpunkt": "2025-01-30T07:15:00.000Z",
    "ankunftsZeitpunkt": "2025-01-30T11:28:00.000Z",
    "allIntervals": [...]
  },
  "2025-01-31": { ... },
  "2025-02-01": { ... },
  "_meta": {
    "startStation": {
      "id": "A=1@O=München Hbf@...",
      "name": "München Hbf"
    },
    "zielStation": {
      "id": "A=1@O=Berlin Hbf@...", 
      "name": "Berlin Hbf"
    },
    "searchParams": {
      "klasse": "KLASSE_2",
      "maximaleUmstiege": 9,
      "schnelleVerbindungen": false,
      "nurDeutschlandTicketVerbindungen": false
    }
  }
}
```

## Travel Classes

- `KLASSE_1`: First class
- `KLASSE_2`: Second class

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (missing required parameters)
- `404`: Station not found
- `500`: Internal server error

Error responses include details:
```json
{
  "error": "Station not found",
  "message": "Start station \"InvalidStation\" not found"
}
```

## Integration

This backend is designed to work with the main [bahn.vibe](https://github.com/jschae23/bahn.vibe) application.

## Development

### Project Structure
```
├── server.js          # Main application file
├── package.json       # Dependencies and scripts
└── README.md         # This file
```

### Dependencies
- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **body-parser**: Request body parsing
- **axios**: HTTP client (imported but can be removed if not used elsewhere)

### Environment Variables
- `PORT`: Server port (default: 3000)

## Contributing

This backend service is part of the larger [bahn.vibe](https://github.com/jschae23/bahn.vibe) project. Please refer to the main repository for contribution guidelines and project roadmap.

## Notes

- This service makes requests to Deutsche Bahn's official APIs
- Rate limiting may apply from Deutsche Bahn's side
- The service includes appropriate headers to mimic browser requests
- Station IDs are used as-is from the Deutsche Bahn API without normalization
