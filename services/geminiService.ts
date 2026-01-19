import { GoogleGenerativeAI } from "@google/generative-ai";
import { CoordinateData } from "../types";
import { CHANGHUA_TOWNSHIPS } from "../constants";

const BATCH_SIZE = 5; 
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const identifyTownshipsBatch = async (
  items: CoordinateData[]
): Promise<{ id: number; township: string }[]> => {
  
  const itemsText = items.map(item => `ID: ${item.id}, Lat: ${item.lat.toFixed(7)}, Lng: ${item.lng.toFixed(7)}`).join('\n');
  const townshipList = CHANGHUA_TOWNSHIPS.join(', ');

  const prompt = `
    你是一個地理專家。請根據經緯度，判斷該位置屬於彰化縣的哪個鄉鎮市區。
    
    有效的清單：[${townshipList}]
    
    待處理數據：
    ${itemsText}

    指示：
    1. 直接根據經緯度判斷。
    2. 必須嚴格從「有效的清單」中選擇一個最接近的。
    3. 只回傳 JSON 陣列，格式如：[{"id": 1, "township": "彰化市"}]
    4. 不要包含任何解釋文字或 Markdown 標籤。
  `;

  try {
    // 為了穩定性，我們先移除 googleSearch 工具，改用模型內建知識（Gemini 對台灣地理非常熟）
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();
    
    // 強力清理 JSON 文字
    if (text.includes('[')) {
      text = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
    }
    
    console.log("Gemini Response:", text); // 讓你在 F12 可以看到 AI 回傳了什麼
    return JSON.parse(text) as { id: number; township: string }[];

  } catch (error) {
    console.error("Gemini API 發生錯誤:", error);
    return [];
  }
};

export const processCoordinates = async (
  allData: CoordinateData[],
  onProgress: (processedCount: number, updatedData: CoordinateData[]) => void
) => {
  let processedCount = 0;
  const resultData = [...allData];

  for (let i = 0; i < resultData.length; i += BATCH_SIZE) {
    const batch = resultData.slice(i, i + BATCH_SIZE);
    
    batch.forEach(item => {
        const idx = resultData.findIndex(r => r.id === item.id);
        if (idx !== -1) resultData[idx].status = 'processing';
    });
    onProgress(processedCount, [...resultData]);

    try {
      if (i > 0) await delay(1000); 

      const identifications = await identifyTownshipsBatch(batch);
      
      batch.forEach(item => {
        const match = identifications.find(ident => ident.id === item.id);
        const index = resultData.findIndex(r => r.id === item.id);
        
        if (index !== -1) {
          if (match && match.township && CHANGHUA_TOWNSHIPS.includes(match.township)) {
            resultData[index].township = match.township;
            resultData[index].status = 'completed';
          } else {
            resultData[index].status = 'error';
          }
        }
      });
    } catch (e) {
      batch.forEach(item => {
         const index = resultData.findIndex(r => r.id === item.id);
         if(index !== -1) resultData[index].status = 'error';
      });
    }

    processedCount += batch.length;
    onProgress(processedCount, [...resultData]); 
  }
};
