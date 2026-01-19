import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx'; // 引入 Excel 讀取套件
import { CoordinateData, AppState } from './types';
import { twd97ToWgs84, parseCoordinates } from './utils/twd97';
import { processCoordinates } from './services/geminiService';
import { 
  ArrowUpTrayIcon, 
  MapPinIcon, 
  TableCellsIcon, 
  ArrowDownTrayIcon,
  CpuChipIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [coordinates, setCoordinates] = useState<CoordinateData[]>([]);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [processedCount, setProcessedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = (e) => {
      let text = '';
      if (isExcel) {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        // 將 Excel 轉換為 CSV 文字格式以便解析
        text = XLSX.utils.sheet_to_csv(worksheet);
      } else {
        text = e.target?.result as string;
      }
      
      setInputText(text);
      handleParse(text);
    };

    if (isExcel) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleParse = (text: string) => {
    setAppState(AppState.PARSING);
    const parsed = parseCoordinates(text);
    
    const mappedData: CoordinateData[] = parsed.map((p, index) => {
      const { lat, lng } = twd97ToWgs84(p.x, p.y);
      return {
        id: index + 1,
        originalX: p.x,
        originalY: p.y,
        lat,
        lng,
        township: null,
        status: 'pending'
      };
    });

    setCoordinates(mappedData);
    setAppState(AppState.IDLE);
    setProcessedCount(0);
  };

  const startProcessing = async () => {
    if (coordinates.length === 0) return;
    
    // 檢查 API KEY
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      alert("請先設定 VITE_GEMINI_API_KEY 環境變數");
      return;
    }

    setAppState(AppState.PROCESSING);
    setProcessedCount(0);

    await processCoordinates(coordinates, (count, updatedData) => {
      setProcessedCount(count);
      setCoordinates(updatedData);
    });

    setAppState(AppState.COMPLETED);
  };

  const downloadCSV = () => {
    const headers = ['ID', 'TWD97_X', 'TWD97_Y', 'Latitude', 'Longitude', 'Township', 'Maps Link'];
    const rows = coordinates.map(c => 
      `${c.id},${c.originalX},${c.originalY},${c.lat.toFixed(7)},${c.lng.toFixed(7)},${c.township || 'Unknown'},https://www.google.com/maps?q=${c.lat},${c.lng}`
    );
    
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'processed_coordinates.csv';
    link.click();
  };

  const successCount = coordinates.filter(c => c.status === 'completed').length;
  const progressPercent = coordinates.length > 0 ? Math.round((processedCount / coordinates.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">彰化座標定位器</h1>
          </div>
          <div className="text-sm text-gray-500 font-medium">TWD97 ➜ 鄉鎮市區</div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TableCellsIcon className="h-5 w-5 text-blue-500" />
              1. 上傳檔案 (Excel/CSV/TXT)
            </h2>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="貼上座標 (X Y) 或上傳檔案..."
              className="w-full h-48 p-3 bg-gray-50 border rounded-lg font-mono text-sm"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-all"
            >
              <ArrowUpTrayIcon className="h-4 w-4" /> 選擇檔案
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".txt,.csv,.xlsx,.xls"
              onChange={handleFileUpload}
            />
          </div>

          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CpuChipIcon className="h-5 w-5 text-purple-500" />
                2. AI 辨識狀態
              </h2>
              <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
                <div className="flex justify-between text-sm">
                  <span>處理進度</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>總數: {coordinates.length}</span>
                  <span>成功: {successCount}</span>
                </div>
              </div>
            </div>

            <button
              onClick={startProcessing}
              disabled={coordinates.length === 0 || appState === AppState.PROCESSING}
              className={`w-full py-4 rounded-lg font-bold text-white shadow-lg transition-all ${
                coordinates.length === 0 || appState === AppState.PROCESSING ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {appState === AppState.PROCESSING ? 'AI 搜尋辨識中...' : '開始辨識'}
            </button>
          </div>
        </section>

        {coordinates.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-700">結果預覽</h3>
              <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-all">
                <ArrowDownTrayIcon className="h-4 w-4" /> 下載 CSV
              </button>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-3 border-b">ID</th>
                    <th className="p-3 border-b">TWD97 X / Y</th>
                    <th className="p-3 border-b">鄉鎮市區</th>
                    <th className="p-3 border-b">地圖</th>
                    <th className="p-3 border-b">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {coordinates.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{row.id}</td>
                      <td className="p-3 font-mono">
                        {row.originalX.toFixed(0)}, {row.originalY.toFixed(0)}
                      </td>
                      <td className="p-3">
                        {row.township ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-bold">{row.township}</span>
                        ) : '-'}
                      </td>
                      <td className="p-3">
                        <a href={`https://www.google.com/maps?q=${row.lat},${row.lng}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" /> 查看
                        </a>
                      </td>
                      <td className="p-3">
                        {row.status === 'completed' && <span className="text-green-600">✓ 完成</span>}
                        {row.status === 'processing' && <span className="text-yellow-600 animate-pulse">● 辨識中</span>}
                        {row.status === 'error' && <span className="text-red-600">✕ 失敗</span>}
                        {row.status === 'pending' && <span className="text-gray-400">等待</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;
