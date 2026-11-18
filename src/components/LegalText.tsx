import { Banner, H2, P, Screen } from './ui';
import { useI18n } from '@/lib/i18n';

export type Section = { title: string; text: string };

export default function LegalText({ de, en, draft = true }: { de: Section[]; en: Section[]; draft?: boolean }) {
  const { t, lang } = useI18n();
  return (
    <Screen>
      {draft && <Banner tone="warning">{t('legal_draft')}</Banner>}
      {(lang === 'de' ? de : en).map((s) => (
        <P key={s.title}>
          <H2>{s.title}</H2>
          {'\n'}
          {s.text}
        </P>
      ))}
    </Screen>
  );
}
