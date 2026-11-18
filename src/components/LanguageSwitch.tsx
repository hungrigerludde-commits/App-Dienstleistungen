import { Chip, ChipRow } from './ui';
import { useI18n } from '@/lib/i18n';

export default function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <ChipRow>
      <Chip label="🇩🇪 Deutsch" selected={lang === 'de'} onPress={() => setLang('de')} />
      <Chip label="🇬🇧 English" selected={lang === 'en'} onPress={() => setLang('en')} />
    </ChipRow>
  );
}
