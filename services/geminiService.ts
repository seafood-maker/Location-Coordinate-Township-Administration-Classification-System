import { GoogleGenerativeAI } from "@google/generative-ai";
import { CoordinateData } from "../types";
import { CHANGHUA_TOWNSHIPS } from "../constants";

const BATCH_SIZE = 3; // 縮小批次，提高穩定性
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export const identifyTownshipsBatch = async (
  items: CoordinateData[]
): Promise<{ id: number; township: string }[]> => {
  
  const itemsText = items.map(item => `ID: ${item.id}, Lat: ${item.lat.toFixed(7)}, Lng: ${item.lng.toFixed(7)}`).join('\n');
  
  const prompt = `請辨識以下座標位於彰化縣哪個鄉鎮市區：
    [${CHANGHUA_TOWNSHIPS.join(',')}]
    
    資料：
    ${itemsText}

    請只回傳 JSON 陣列格式：[{"id": 1, "township": "彰化市"}]，不要有解釋。`;

  try {
    if (!API_KEY) throw new Error("API_KEY_MISSING");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json/g, '').replace(/```/g, '');
    
    console.log("AI 回傳原始資料:", text);
    
    const jsonMatch = text.match(/\[.*\]/s);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (error: any) {
    console.error("Gemini 呼叫失敗，錯誤內容:", error);
    // 如果是 API Key 錯誤，這裡會顯示原因
    throw error;
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
    batch.forEach(item => { item.status = 'processing'; });
    onProgress(processedCount, [...resultData]);

    try {
      const identifications = await identifyTownshipsBatch(batch);
      
      batch.forEach(item => {
        const match = identifications.find(ident => ident.id === item.id);
        const index = resultData.findIndex(r => r.id === item.id);
        if (index !== -1) {
          resultData[index].township = match?.township || "辨識失敗";
          resultData[index].status = match?.township ? 'completed' : 'error';
        }
      });
    } catch (e) {
      console.error("批次處理中斷:", e);
      batch.forEach(item => {
         const index = resultData.findIndex(r => r.id === item.id);
         if(index !== -1) resultData[index].status = 'error';
      });
    }
    processedCount += batch.length;
    onProgress(processedCount, [...resultData]);
  }
};
