import { Text, View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { ratePrice } from '@/lib/rules';

const COLORS = { green: '#1B9E4B', yellow: '#E0A100', red: '#D93025' };

/** Ampel: grün = angemessen, gelb = leicht daneben, rot = deutlich zu wenig/zu viel. */
export default function PriceLight({
  service, min, max, unit, durationMinutes, showReference = false,
}: { service: string; min: number; max: number; unit: string; durationMinutes?: number; showReference?: boolean }) {
  const { t } = useI18n();
  const r = ratePrice(service, min, max, unit, durationMinutes);
  if (!r) return null;
  const label = t(r.rating === 'fair' ? 'price_fair' : r.rating === 'low' ? 'price_low' : 'price_high');
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS[r.color] }} />
        <Text style={{ color: COLORS[r.color], fontWeight: '700', fontSize: 13 }}>{label}</Text>
      </View>
      {showReference && (
        <Text style={{ color: '#6B7280', fontSize: 12 }}>{t('price_reference', { min: r.ref[0], max: r.ref[1] })}</Text>
      )}
    </View>
  );
}
