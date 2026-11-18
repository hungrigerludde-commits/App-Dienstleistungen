import { Text, View } from 'react-native';
import { Card, P, colors } from './ui';
import type { MapMarkerData } from './AppMap.types';
import { useI18n } from '@/lib/i18n';

export type { MapMarkerData } from './AppMap.types';

/** Im Browser gibt es keine Apple-Karte – stattdessen eine Liste (nur zum Testen). */
export default function AppMap({
  radiusKm, markers, onMarkerPress,
}: {
  center: { lat: number; lng: number };
  radiusKm?: number;
  markers: MapMarkerData[];
  onMarkerPress?: (id: string) => void;
  onMapPress?: (p: { lat: number; lng: number }) => void;
  height?: number;
}) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 120, borderRadius: 14, backgroundColor: '#DDE7F7', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Text style={{ fontSize: 34 }}>🗺️</Text>
        <Text style={{ color: colors.muted, textAlign: 'center', paddingHorizontal: 16 }}>
          {t('map_web_hint')}{radiusKm ? ` · ${t('map_radius')}: ${radiusKm} km` : ''}
        </Text>
      </View>
      {markers.map((m) => (
        <Card key={m.id} onPress={onMarkerPress ? () => onMarkerPress(m.id) : undefined}>
          <Text style={{ fontWeight: '700' }}>📍 {m.title}</Text>
          {m.subtitle ? <P muted>{m.subtitle}</P> : null}
        </Card>
      ))}
    </View>
  );
}
