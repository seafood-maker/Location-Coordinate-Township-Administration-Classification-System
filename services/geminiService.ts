import { GoogleGenerativeAI } from "@google/generative-ai";
import { CoordinateData } from "../types";
import { CHANGHUA_TOWNSHIPS } from "../constants";

const BATCH_SIZE = 5; 
// 在 Vite/Vercel 中，前端環境變數需以 VITE_ 開頭
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const identifyTownshipsBatch = async (
  items: CoordinateData[]
): Promise<{ id: number; township: string }[]> => {
  
  const itemsText = items.map(item => `ID: ${item.id}, Lat: ${item.lat.toFixed(7)}, Lng: ${item.lng.toFixed(7)}`).join('\n');
  const townshipList = CHANGHUA_TOWNSHIPS.join(', ');

  const prompt = `
    任務：請辨識以下座標位於彰化縣的哪個「鄉鎮市區」。
    
    有效的鄉鎮市區列表：[${townshipList}]
    
    待處理數據：
    ${itemsText}

    指示：
    1. 使用 GOOGLE SEARCH 工具搜尋每個經緯度的實際地址。
    2. 從地址中提取正確的鄉鎮市區名稱（例如：地址包含「埤頭鄉」，則回傳「埤頭鄉」）。
    3. 必須從提供的「有效的鄉鎮市區列表」中選擇。
    4. 僅回傳原始 JSON 陣列，不要有任何解釋或 Markdown 語法。
    
    格式範例：
    [{"id": 1, "township": "田尾鄉"}, {"id": 2, "township": "二林鎮"}]
  `;

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      // 啟用 Google Search 工具進行地理定位校正
      tools: [{ googleSearchRetrieval: {} }] as any,
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // 清理可能出現的 markdown 標籤
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 提取 JSON 部分
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    return JSON.parse(text) as { id: number; township: string }[];

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
    
    // 標記為處理中
    batch.forEach(item => {
        const idx = resultData.findIndex(r => r.id === item.id);
        if (idx !== -1) resultData[idx].status = 'processing';
    });
    onProgress(processedCount, [...resultData]);

    try {
      // 避免觸發 API 頻率限制
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
