// Web-Version (nur zum Testen im Browser): Browser-Standort, kein Geocoding.
export type LatLng = { lat: number; lng: number };

export function currentPosition(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 },
    );
  });
}

export async function geocode(_address: string): Promise<LatLng | null> {
  return null;
}
