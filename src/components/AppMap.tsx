import MapView, { Circle, Marker } from 'react-native-maps';
import type { MapMarkerData } from './AppMap.types';

export type { MapMarkerData } from './AppMap.types';

/** Karte (Apple Maps auf dem iPhone) mit Umkreis und Markierungen. */
export default function AppMap({
  center, radiusKm, markers, onMarkerPress, onMapPress, height = 360,
}: {
  center: { lat: number; lng: number };
  radiusKm?: number;
  markers: MapMarkerData[];
  onMarkerPress?: (id: string) => void;
  onMapPress?: (p: { lat: number; lng: number }) => void;
  height?: number;
}) {
  const delta = Math.max(0.02, ((radiusKm ?? 5) / 111) * 2.6);
  return (
    <MapView
      style={{ height, borderRadius: 14 }}
      region={{ latitude: center.lat, longitude: center.lng, latitudeDelta: delta, longitudeDelta: delta }}
      onPress={(e) => onMapPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
    >
      {radiusKm ? (
        <Circle
          center={{ latitude: center.lat, longitude: center.lng }}
          radius={radiusKm * 1000}
          strokeColor="rgba(46,107,230,0.8)"
          fillColor="rgba(46,107,230,0.12)"
        />
      ) : null}
      <Marker coordinate={{ latitude: center.lat, longitude: center.lng }} pinColor="#2E6BE6" title="📍" />
      {markers.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.lat, longitude: m.lng }}
          title={m.title}
          description={m.subtitle}
          pinColor={m.color ?? '#D93025'}
          onCalloutPress={() => onMarkerPress?.(m.id)}
        />
      ))}
    </MapView>
  );
}
