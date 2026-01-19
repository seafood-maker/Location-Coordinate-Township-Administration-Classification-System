import { GoogleGenerativeAI } from "@google/generative-ai";
import { CoordinateData } from "../types";
import { CHANGHUA_TOWNSHIPS } from "../constants";

const BATCH_SIZE = 5; 
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export const identifyTownshipsBatch = async (
  items: CoordinateData[]
): Promise<{ id: number; township: string }[]> => {
  
  const itemsText = items.map(item => `ID: ${item.id}, Lat: ${item.lat.toFixed(7)}, Lng: ${item.lng.toFixed(7)}`).join('\n');
  const townshipList = CHANGHUA_TOWNSHIPS.join('、');

  const prompt = `你是一個地理助手，請根據緯度(Lat)與經度(Lng)判斷該位置屬於彰化縣的哪個鄉鎮市區。
  可選清單：[${townshipList}]
  待辨識資料：
  ${itemsText}
  請回傳 JSON 陣列：[{"id": 1, "township": "彰化市"}]`;

  try {
    if (!API_KEY) {
      throw new Error("找不到 API 金鑰，請確認 Vercel 環境變數。");
    }

    // 使用 gemini-1.5-flash (這是目前最穩定的免費版名稱)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json/g, '').replace(/```/g, '');
    
    console.log("AI 回傳原始資料:", text);
    const jsonMatch = text.match(/\[.*\]/s);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];

  } catch (error: any) {
    // 這裡會在 F12 Console 印出更詳細的錯誤
    console.error("Gemini 詳細錯誤:", error.message);
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
    batch.forEach(item => { item.status = 'processing'; });
    onProgress(processedCount, [...resultData]);

    try {
      const identifications = await identifyTownshipsBatch(batch);
      batch.forEach(item => {
        const match = identifications.find(ident => ident.id === item.id);
        const index = resultData.findIndex(r => r.id === item.id);
        if (index !== -1) {
          resultData[index].township = match?.township || null;
          resultData[index].status = match?.township ? 'completed' : 'error';
        }
      });
    } catch (e) {
      console.error("處理批次時發生中斷");
    }
    processedCount += batch.length;
    onProgress(processedCount, [...resultData]); 
  }
};
