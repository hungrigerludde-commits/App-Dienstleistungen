import { Text, View } from 'react-native';
import { Chip, ChipRow, colors } from './ui';
import { useI18n } from '@/lib/i18n';
import { CATEGORIES, SERVICE_ICON, categoryKey, serviceKey, type Service } from '@/lib/rules';

/** Auswahl der Leistung, gruppiert nach Kategorie. */
export default function ServicePicker({ value, onChange, hideAdultOnly }: { value: string; onChange: (s: Service) => void; hideAdultOnly?: boolean }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 10 }}>
      {CATEGORIES.map((c) => (
        <View key={c.key} style={{ gap: 6 }}>
          <Text style={{ fontWeight: '700', color: colors.muted }}>{c.icon} {t(categoryKey(c.key))}</Text>
          <ChipRow>
            {c.services.filter((s) => !(hideAdultOnly && s === 'tagesmutter')).map((s) => (
              <Chip key={s} label={`${SERVICE_ICON[s]} ${t(serviceKey(s))}`} selected={value === s} onPress={() => onChange(s)} />
            ))}
          </ChipRow>
        </View>
      ))}
    </View>
  );
}
