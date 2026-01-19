export interface CoordinateData {
  id: number;
  originalX: number;
  originalY: number;
  lat: number;
  lng: number;
  township: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface ProcessingStats {
  total: number;
  processed: number;
  success: number;
  failed: number;
}

export enum AppState {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
}
