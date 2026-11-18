import * as Location from 'expo-location';

export type LatLng = { lat: number; lng: number };

/** Aktueller Standort (fragt nach Erlaubnis). */
export async function currentPosition(): Promise<LatLng | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return null;
  const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
}

/** Adresse → Koordinaten (Apple-Geocoder auf dem iPhone, kostenlos). */
export async function geocode(address: string): Promise<LatLng | null> {
  try {
    const r = await Location.geocodeAsync(address);
    return r[0] ? { lat: r[0].latitude, lng: r[0].longitude } : null;
  } catch {
    return null;
  }
}
