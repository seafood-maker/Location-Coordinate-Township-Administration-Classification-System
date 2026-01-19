import React, { useState, useRef, useCallback } from 'react';
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
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setInputText(text);
      handleParse(text);
    };
    reader.readAsText(file);
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
    
    setAppState(AppState.PROCESSING);
    setProcessedCount(0);

    await processCoordinates(coordinates, (count, updatedData) => {
      setProcessedCount(Math.min(count, coordinates.length));
      setCoordinates(updatedData);
    });

    setAppState(AppState.COMPLETED);
  };

  const downloadCSV = () => {
    const headers = ['ID', 'TWD97_X', 'TWD97_Y', 'Latitude', 'Longitude', 'Township (Changhua)', 'Google Maps Link'];
    const rows = coordinates.map(c => 
      `${c.id},${c.originalX},${c.originalY},${c.lat.toFixed(7)},${c.lng.toFixed(7)},${c.township || 'Unknown'},https://www.google.com/maps?q=${c.lat},${c.lng}`
    );
    
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n'); // Add BOM for Excel support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'changhua_coordinates_processed.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats
  const successCount = coordinates.filter(c => c.status === 'completed' || (c.status === 'error' && c.township)).length;
  const progressPercent = coordinates.length > 0 ? Math.round((processedCount / coordinates.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <MapPinIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Changhua GeoLocator <span className="text-xs font-normal text-white bg-green-500 px-2 py-0.5 rounded-full ml-2">Search Enhanced</span></h1>
          </div>
          <div className="text-sm text-gray-500">
             TWD97 to WGS84 Converter & Township Identification
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Input Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TableCellsIcon className="h-5 w-5 text-gray-500" />
                1. Upload Coordinates
              </h2>
              <p className="text-sm text-gray-600">
                Paste your TWD97 coordinates (X Y) or upload a text/CSV file. 
                Example format: <code>198765.123 2678901.456</code>
              </p>
              
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    if(e.target.value.trim().length > 0) handleParse(e.target.value);
                  }}
                  placeholder="Paste coordinates here..."
                  className="w-full h-40 p-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none"
                />
                <div className="absolute bottom-4 right-4 flex gap-2">
                   <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    Load File
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".txt,.csv"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
              {coordinates.length > 0 && (
                <div className="flex items-center justify-between bg-blue-50 text-blue-800 px-4 py-2 rounded-lg text-sm">
                  <span>Found {coordinates.length} coordinates ready for processing.</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4 flex flex-col justify-between">
               <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <CpuChipIcon className="h-5 w-5 text-gray-500" />
                    2. Processing
                </h2>
                <p className="text-sm text-gray-600 mt-2">
                    The system will use AI + Google Search to verify the actual address of each coordinate. 
                    <br/><span className="text-xs text-blue-600 font-medium">Updated: Now performing live address lookups to ensure border accuracy. Speed: ~5 items per few seconds.</span>
                </p>
               </div>

               <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 space-y-4">
                  <div className="flex justify-between text-sm font-medium text-gray-700">
                    <span>Progress</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Processed: {processedCount} / {coordinates.length}</span>
                    <span>Success: {successCount}</span>
                  </div>

                  <button
                    onClick={startProcessing}
                    disabled={coordinates.length === 0 || appState === AppState.PROCESSING}
                    className={`w-full py-3 px-4 rounded-lg font-semibold text-white shadow-sm transition-all
                        ${coordinates.length === 0 || appState === AppState.PROCESSING 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}`}
                  >
                    {appState === AppState.PROCESSING ? 'Searching & Identifying...' : 'Start Search & Identify'}
                  </button>
               </div>
            </div>
          </div>
        </section>

        {/* Results Section */}
        {coordinates.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Results Table</h2>
              <button
                onClick={downloadCSV}
                disabled={appState === AppState.PROCESSING}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${appState === AppState.PROCESSING 
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700 text-white'}`}
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download CSV
              </button>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">TWD97 X</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">TWD97 Y</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Lat / Lng (WGS84)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Township</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Check</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {coordinates.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{row.originalX}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{row.originalY}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{row.lat.toFixed(6)}</div>
                        <div>{row.lng.toFixed(6)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {row.township ? (
                            <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded">{row.township}</span>
                        ) : (
                            <span className="text-gray-300">-</span>
                        )}
                      </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <a 
                            href={`https://www.google.com/maps?q=${row.lat},${row.lng}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
                        >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            Map
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {row.status === 'completed' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Done</span>}
                        {row.status === 'processing' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 animate-pulse">Searching...</span>}
                        {row.status === 'error' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Failed</span>}
                        {row.status === 'pending' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Pending</span>}
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