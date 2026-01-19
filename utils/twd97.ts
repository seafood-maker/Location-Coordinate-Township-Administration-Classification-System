/**
 * Converts TWD97 coordinates to WGS84 Latitude/Longitude.
 * TWD97 uses the GRS80 ellipsoid and TM2 projection.
 * Parameters based on standard Taiwan projection settings.
 */
export const twd97ToWgs84 = (x: number, y: number): { lat: number; lng: number } => {
  const a = 6378137.0; // Semi-major axis
  const b = 6356752.314245; // Semi-minor axis
  const long0 = 121 * Math.PI / 180; // Central Meridian (121 E)
  const k0 = 0.9999; // Scale factor
  const dx = 250000; // False Easting

  // Calculate eccentricity
  const e = Math.sqrt(1 - (b ** 2) / (a ** 2));
  const e2 = e ** 2 / (1 - e ** 2);

  // Calculate meridional arc
  const xx = x - dx;
  const M = y / k0;

  const mu = M / (a * (1 - e ** 2 / 4 - 3 * e ** 4 / 64 - 5 * e ** 6 / 256));
  const e1 = (1 - Math.sqrt(1 - e ** 2)) / (1 + Math.sqrt(1 - e ** 2));

  const J1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const J2 = (21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32;
  const J3 = (151 * e1 ** 3) / 96;
  const J4 = (1097 * e1 ** 4) / 512;

  const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

  const C1 = e2 * Math.cos(fp) ** 2;
  const T1 = Math.tan(fp) ** 2;
  const R1 = a * (1 - e ** 2) / Math.pow(1 - e ** 2 * Math.sin(fp) ** 2, 1.5);
  const N1 = a / Math.sqrt(1 - e ** 2 * Math.sin(fp) ** 2);
  const D = xx / (N1 * k0);

  // Calculate Latitude
  const Q1 = N1 * Math.tan(fp) / R1;
  const Q2 = (D ** 2) / 2;
  const Q3 = (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e2) * (D ** 4) / 24;
  const Q4 = (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * e2 - 3 * C1 ** 2) * (D ** 6) / 720;
  let lat = fp - Q1 * (Q2 - Q3 + Q4);

  // Calculate Longitude
  const Q5 = D;
  const Q6 = (1 + 2 * T1 + C1) * (D ** 3) / 6;
  const Q7 = (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e2 + 24 * T1 ** 2) * (D ** 5) / 120;
  let lng = long0 + (Q5 - Q6 + Q7) / Math.cos(fp);

  // Convert to degrees
  lat = (lat * 180) / Math.PI;
  lng = (lng * 180) / Math.PI;

  return { lat, lng };
};

export const parseCoordinates = (text: string): { x: number; y: number }[] => {
  // 濾掉標題列並拆分行
  const lines = text.trim().split('\n').filter(line => !line.includes('點位名稱') && !line.includes('X'));
  const coordinates: { x: number; y: number }[] = [];

  for (const line of lines) {
    // 支援逗號、Tab 或空白分隔
    const parts = line.split(/[,\t\s]+/).map(p => p.trim());
    
    // 從後往前找數字，通常座標會放在最後兩欄
    const y = parseFloat(parts[parts.length - 1]);
    const x = parseFloat(parts[parts.length - 2]);

    if (!isNaN(x) && !isNaN(y) && x > 100000 && y > 1000000) {
      coordinates.push({ x, y });
    }
  }
  return coordinates;
};
