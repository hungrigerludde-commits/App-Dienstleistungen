import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useI18n } from '@/lib/i18n';

// Platzhalter-Werbung (frei erfunden). Später durch ein echtes, NICHT personalisiertes
// Werbenetzwerk ersetzen – personalisierte Werbung an Minderjährige ist verboten (DSA Art. 28).
const ADS = {
  de: [
    { icon: '🌱', brand: 'GrünWerk Gartencenter', text: '20 % auf alle Rasenmäher – nur diese Woche!', color: '#E7F6EC' },
    { icon: '🎧', brand: 'SoundBox', text: 'Kopfhörer für Schüler ab 19 € – mit Schülerausweis.', color: '#EEF0FF' },
    { icon: '🚲', brand: 'RadHaus', text: 'Fahrrad-Check für 9,90 € – sicher zum nächsten Auftrag.', color: '#FFF4E0' },
    { icon: '📚', brand: 'LernStern', text: 'Mathe-Hefte für alle Klassen – jetzt im Angebot.', color: '#FDECEC' },
  ],
  en: [
    { icon: '🌱', brand: 'GreenWorks Garden Centre', text: '20% off all lawn mowers – this week only!', color: '#E7F6EC' },
    { icon: '🎧', brand: 'SoundBox', text: 'Headphones for students from €19 – with student ID.', color: '#EEF0FF' },
    { icon: '🚲', brand: 'BikeHouse', text: 'Bike check for €9.90 – ride safely to your next job.', color: '#FFF4E0' },
    { icon: '📚', brand: 'StudyStar', text: 'Maths workbooks for all grades – on sale now.', color: '#FDECEC' },
  ],
};

export default function AdBanner({ seed = 0, large = false }: { seed?: number; large?: boolean }) {
  const { t, lang } = useI18n();
  const ad = useMemo(() => ADS[lang][Math.abs(seed) % ADS[lang].length], [lang, seed]);
  return (
    <View style={{ backgroundColor: ad.color, borderRadius: 14, padding: large ? 24 : 12, gap: large ? 12 : 4, alignItems: large ? 'center' : 'flex-start', justifyContent: 'center', flex: large ? 1 : undefined }}>
      <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase' }}>{t('ad')}</Text>
      <Text style={{ fontSize: large ? 64 : 15 }}>{ad.icon} {large ? '' : ad.brand}</Text>
      {large && <Text style={{ fontWeight: '800', fontSize: 20 }}>{ad.brand}</Text>}
      <Text style={{ fontSize: large ? 17 : 14, textAlign: large ? 'center' : 'left' }}>{ad.text}</Text>
    </View>
  );
}
