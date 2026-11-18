import { router } from 'expo-router';
import { Text } from 'react-native';
import { Banner, Button, P } from './ui';
import { useProfile } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { ageOn, fromIsoDate } from '@/lib/rules';

/** Hinweise, was noch fehlt (Ausweis, Eltern-Zustimmung, Standort, Angebote). */
export default function StatusBanners({ hasOffers, needsLocation = true }: { hasOffers?: boolean; needsLocation?: boolean }) {
  const me = useProfile();
  const { t } = useI18n();
  const age = ageOn(fromIsoDate(me.birth_date));
  const needsId = me.role !== 'student' || age >= 16;

  return (
    <>
      {me.is_suspended && <Banner tone="danger">{t('banner_suspended')}</Banner>}

      {me.role === 'student' && me.parent_consent === 'pending' && (
        <Banner tone="warning">
          <Text style={{ fontWeight: '700' }}>{t('banner_parent_code')}</Text>
          <P>{t('banner_parent_code_text')}</P>
          <Text selectable testID="parent-code" style={{ fontSize: 28, fontWeight: '800', letterSpacing: 4, textAlign: 'center', marginVertical: 6 }}>
            {me.parent_link_code}
          </Text>
          <P muted>{t('banner_parent_code_after')}</P>
        </Banner>
      )}
      {me.role === 'student' && me.parent_consent === 'rejected' && <Banner tone="danger">{t('banner_parent_rejected')}</Banner>}

      {needsId && me.verification_status === 'pending' && <Banner>{t('banner_verify_pending')}</Banner>}
      {needsId && (me.verification_status === 'none' || me.verification_status === 'rejected') && (
        <Banner tone="warning">
          <P>
            {me.verification_status === 'rejected'
              ? t('banner_verify_rejected')
              : t(me.role === 'client' ? 'banner_verify_client' : me.role === 'parent' ? 'banner_verify_parent' : 'banner_verify_student')}
          </P>
          <Button title={t('verify_now')} onPress={() => router.push('/verify')} />
        </Banner>
      )}

      {needsLocation && me.role === 'student' && me.home_lat == null && (
        <Banner tone="warning">
          <P>{t('banner_location')}</P>
          <Button title={t('set_location')} variant="secondary" onPress={() => router.push('/location')} />
        </Banner>
      )}

      {me.role === 'student' && hasOffers === false && (
        <Banner>
          <P>{t('banner_no_offers')}</P>
          <Button title={t('add_offer')} variant="secondary" onPress={() => router.push('/offer/edit')} />
        </Banner>
      )}
    </>
  );
}
