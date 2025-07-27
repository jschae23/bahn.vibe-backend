const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const STATION_MAPPING = {
  'München': 'A=1@O=München Hbf@X=11558339@Y=48140229@U=80@L=8000261@B=1@p=1751482402@i=U×008020347@',
  'Nürnberg': 'A=1@O=NÜRNBERG@X=11077955@Y=49450748@U=80@L=8096025@B=1@p=1751482402@i=U×008022198@',
  // Add more stations as needed
};

function getStationId(cityName) {
  return STATION_MAPPING[cityName] || cityName;
}

function getStationDisplayName(cityName) {
  // For display purposes
  const mapping = {
    'München': 'München Hbf',
    'Nürnberg': 'NÜRNBERG'
  };
  return mapping[cityName] || cityName;
}

// Modified getBestPrice function to return single date result
async function getBestPrice(config) {
  const jetzt = config.anfrageZeitpunkt;
  const datum = new Date(jetzt).toISOString().slice(0, 10) + "T08:00:00";
  const tag = new Date(jetzt).toISOString().split("T")[0];
  console.log(`\n=== Getting best price for ${tag} ===`);
  
  const requestBody = {
    abfahrtsHalt: config.abfahrtsHalt,
    anfrageZeitpunkt: datum,
    ankunftsHalt: config.ankunftsHalt,
    ankunftSuche: "ABFAHRT",
    klasse: config.klasse,
    maxUmstiege: parseInt(config.maximaleUmstiege, 10),
    produktgattungen: ["ICE", "EC_IC", "IR", "REGIONAL", "SBAHN", "BUS", "SCHIFF", "UBAHN", "TRAM", "ANRUFPFLICHTIG"],
    reisende: [
      {
        typ: "ERWACHSENER",
        ermaessigungen: [
          {
            art: "KEINE_ERMAESSIGUNG",
            klasse: "KLASSENLOS",
          },
        ],
        alter: [],
        anzahl: 1,
      },
    ],
    schnelleVerbindungen: Boolean(config.schnelleVerbindungen),
    sitzplatzOnly: false,
    bikeCarriage: false,
    reservierungsKontingenteVorhanden: false,
    nurDeutschlandTicketVerbindungen: Boolean(config.nurDeutschlandTicketVerbindungen),
    deutschlandTicketVorhanden: false,
  };

  try {
    const response = await fetch("https://www.bahn.de/web/api/angebote/tagesbestpreis", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json; charset=utf-8",
        "Accept-Encoding": "gzip",
        "Origin": "https://www.bahn.de",
        "Referer": "https://www.bahn.de/buchung/fahrplan/suche",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        "Connection": "close",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP ${response.status} error:`, errorText);
      return {
        preis: 0,
        info: `API Error ${response.status}: ${errorText.slice(0, 100)}`,
        abfahrtsZeitpunkt: "",
        ankunftsZeitpunkt: "",
        allIntervals: []
      };
    }

    const responseText = await response.text();
    
    if (responseText.includes("Preisauskunft nicht möglich")) {
      console.log("Price info not available for this date");
      return {
        preis: 0,
        info: "Kein Bestpreis verfügbar!",
        abfahrtsZeitpunkt: "",
        ankunftsZeitpunkt: "",
        allIntervals: []
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse JSON:", parseError);
      return {
        preis: 0,
        info: "JSON Parse Error",
        abfahrtsZeitpunkt: "",
        ankunftsZeitpunkt: "",
        allIntervals: []
      };
    }

    if (!data || !data.intervalle) {
      console.log("No intervals found in response");
      return {
        preis: 0,
        info: "Keine Intervalle gefunden!",
        abfahrtsZeitpunkt: "",
        ankunftsZeitpunkt: "",
        allIntervals: []
      };
    }

    console.log(`Found ${data.intervalle.length} intervals`);
    
    const allIntervals = data.intervalle.map(iv => {
      const connection = iv.verbindungen?.[0]?.verbindung?.verbindungsAbschnitte?.[0];
      if (!connection) return null;
      
      const abfahrt = new Date(connection.abfahrtsZeitpunkt).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      
      const ankunft = new Date(connection.ankunftsZeitpunkt).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      
      return {
        preis: iv.preis?.betrag || 0,
        abfahrtsZeitpunkt: connection.abfahrtsZeitpunkt,
        ankunftsZeitpunkt: connection.ankunftsZeitpunkt,
        abfahrtsOrt: connection.abfahrtsOrt,
        ankunftsOrt: connection.ankunftsOrt,
        info: `${abfahrt} ${connection.abfahrtsOrt} -> ${ankunft} ${connection.ankunftsOrt}`,
      };
    }).filter(Boolean);

    if (allIntervals.length === 0) {
      return {
        preis: 0,
        info: "Keine gültigen Preise gefunden!",
        abfahrtsZeitpunkt: "",
        ankunftsZeitpunkt: "",
        allIntervals: []
      };
    }

    // Sort by price (cheapest first)
    const sortedIntervals = allIntervals.sort((a, b) => a.preis - b.preis);
    const bestConnection = sortedIntervals[0];

    return {
      preis: bestConnection.preis,
      info: bestConnection.info,
      abfahrtsZeitpunkt: bestConnection.abfahrtsZeitpunkt,
      ankunftsZeitpunkt: bestConnection.ankunftsZeitpunkt,
      allIntervals: sortedIntervals
    };
  } catch (error) {
    console.error(`Error in bestpreissuche for ${tag}:`, error);
    return {
      preis: 0,
      info: `Fetch Error: ${error instanceof Error ? error.message : "Unknown"}`,
      abfahrtsZeitpunkt: "",
      ankunftsZeitpunkt: "",
      allIntervals: []
    };
  }
}

// Generate date array based on start date and day limit
function generateDateArray(startDate, dayLimit) {
  const dates = [];
  const start = new Date(startDate + 'T08:00:00');
  
  for (let i = 0; i < dayLimit; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString());
  }
  
  return dates;
}

// Main function to handle the request format from your curl
async function searchPrices(requestData) {
  const { start, ziel, abfahrtab, klasse, schnelleVerbindungen, nurDeutschlandTicketVerbindungen, maximaleUmstiege, dayLimit } = requestData;
  
  // Convert city names to station IDs
  const startStationId = getStationId(start);
  const zielStationId = getStationId(ziel);
  
  // Generate dates array
  const dates = generateDateArray(abfahrtab, dayLimit || 3);
  
  const results = {};
  
  // Process each date
  for (const date of dates) {
    const config = {
      abfahrtsHalt: startStationId,
      ankunftsHalt: zielStationId,
      anfrageZeitpunkt: date,
      klasse: klasse,
      maximaleUmstiege: maximaleUmstiege,
      schnelleVerbindungen: schnelleVerbindungen,
      nurDeutschlandTicketVerbindungen: nurDeutschlandTicketVerbindungen
    };
    
    const result = await getBestPrice(config);
    const dateKey = new Date(date).toISOString().split("T")[0];
    results[dateKey] = result;
  }
  
  // Add metadata
  results._meta = {
    startStation: {
      id: startStationId,
      name: getStationDisplayName(start)
    },
    zielStation: {
      id: zielStationId,
      name: getStationDisplayName(ziel)
    },
    searchParams: {
      klasse: klasse,
      maximaleUmstiege: parseInt(maximaleUmstiege, 10),
      schnelleVerbindungen: Boolean(schnelleVerbindungen),
      nurDeutschlandTicketVerbindungen: Boolean(nurDeutschlandTicketVerbindungen)
    }
  };
  
  return results;
}

// Express route handler for the /api/search-prices endpoint
app.post('/api/search-prices', async (req, res) => {
  try {
    console.log('Received request:', req.body);
    
    const { start, ziel, abfahrtab, klasse, schnelleVerbindungen, nurDeutschlandTicketVerbindungen, maximaleUmstiege, dayLimit } = req.body;
    
    // Validate required fields
    if (!start || !ziel || !abfahrtab) {
      return res.status(400).json({ 
        error: 'Missing required fields: start, ziel, abfahrtab' 
      });
    }
    
    const results = await searchPrices(req.body);
    
    console.log('Sending response:', Object.keys(results));
    res.json(results);
    
  } catch (error) {
    console.error('Error in search-prices endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

