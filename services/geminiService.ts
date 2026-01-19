import { GoogleGenAI } from "@google/genai";
import { CoordinateData } from "../types";
import { CHANGHUA_TOWNSHIPS } from "../constants";

// Reduced batch size because Google Search takes more time and tokens
const BATCH_SIZE = 5; 

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to pause execution (to avoid hitting rate limits with search)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const identifyTownshipsBatch = async (
  items: CoordinateData[]
): Promise<{ id: number; township: string }[]> => {
  
  const itemsText = items.map(item => `ID: ${item.id}, Lat: ${item.lat.toFixed(7)}, Lng: ${item.lng.toFixed(7)}`).join('\n');
  const townshipList = CHANGHUA_TOWNSHIPS.join(', ');

  const prompt = `
    Task: Identify the exact Township (鄉鎮市區) in Changhua County (彰化縣) for these coordinates.
    
    Valid Townships: [${townshipList}]
    
    Input Data:
    ${itemsText}

    Instructions:
    1. USE THE GOOGLE SEARCH TOOL to find the actual address for each latitude/longitude.
    2. Based on the address found (e.g., "No. 123, Sec 4, Zhangshui Rd, Pitou Township"), extract the Township name.
    3. Determine the correct township from the 'Valid Townships' list.
    4. If the search result is near a border, trust the Google Maps address data over the coordinate estimation.
    5. RETURN ONLY A RAW JSON ARRAY. No markdown, no explanations.
    
    Format:
    [{"id": 1, "township": "田尾鄉"}, {"id": 2, "township": "二林鎮"}]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Flash is faster for search tasks
      contents: prompt,
      config: {
        // We use the googleSearch tool to ground the data in reality
        tools: [{ googleSearch: {} }],
        // Note: responseSchema is often not supported when tools are enabled in some versions,
        // so we will parse the text manually to be safe.
      },
    });

    let text = response.text;
    if (!text) return [];
    
    // Clean up markdown code blocks if present
    text = text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(json)?/, '').replace(/```$/, '');
    }

    // Extract the array part just in case there is extra text
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    const result = JSON.parse(text) as { id: number; township: string }[];
    return result;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return [];
  }
};

export const processCoordinates = async (
  allData: CoordinateData[],
  onProgress: (processedCount: number, updatedData: CoordinateData[]) => void
) => {
  let processedCount = 0;
  const total = allData.length;
  const resultData = [...allData];

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = resultData.slice(i, i + BATCH_SIZE);
    
    // Mark current batch as processing
    batch.forEach(item => {
        const idx = resultData.findIndex(r => r.id === item.id);
        if (idx !== -1) resultData[idx].status = 'processing';
    });
    onProgress(processedCount, [...resultData]);

    try {
      // Add a small delay between batches to respect rate limits (especially with search tool)
      if (i > 0) await delay(2000); 

      const identifications = await identifyTownshipsBatch(batch);
      
      batch.forEach(item => {
        const match = identifications.find(ident => ident.id === item.id);
        const index = resultData.findIndex(r => r.id === item.id);
        
        if (index !== -1) {
          if (match && match.township) {
            resultData[index].township = match.township;
            resultData[index].status = 'completed';
          } else {
            resultData[index].township = null;
            resultData[index].status = 'error';
          }
        }
      });

    } catch (e) {
      console.error("Batch processing failed:", e);
      batch.forEach(item => {
         const index = resultData.findIndex(r => r.id === item.id);
         if(index !== -1) resultData[index].status = 'error';
      });
    }

    processedCount += batch.length;
    onProgress(processedCount, [...resultData]); 
  }
};