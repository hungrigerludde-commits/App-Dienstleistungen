import { Banner, H1, P, Screen } from './ui';
import { useI18n } from '@/lib/i18n';

/** Wird angezeigt, wenn die Supabase-Zugangsdaten in `.env` fehlen. */
export default function SetupMissing() {
  const { t } = useI18n();
  return (
    <Screen edges={['top', 'bottom']}>
      <H1>{t('app_name')}</H1>
      <Banner tone="warning">{t('setup_missing')}</Banner>
      <P>1. cp .env.example .env</P>
      <P>2. EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY</P>
      <P>3. npx expo start</P>
    </Screen>
  );
}
