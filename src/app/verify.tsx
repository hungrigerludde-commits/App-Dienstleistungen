import { goBack } from '@/lib/nav';
import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Banner, Button, Card, Chip, ChipRow, ErrorText, H2, P, Row, Screen } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { pickImage, uploadImage } from '@/lib/photos';
import { ageOn, fromIsoDate } from '@/lib/rules';
import type { StringKey } from '@/lib/strings';
import { supabase } from '@/lib/supabase';

const DOCS = ['personalausweis', 'reisepass', 'aufenthaltstitel'] as const;
type Slot = 'front' | 'back' | 'selfie';

/**
 * Ausweis-Prüfung: Vorder-/Rückseite + Selfie. Die Bilder landen im privaten Bucket
 * `id-documents` und werden nach der Prüfung durch das Moderationsteam gelöscht.
 * Später kann hier ein Anbieter wie IDnow/Veriff/Persona angebunden werden.
 */
export default function Verify() {
  const me = useProfile();
  const { refreshProfile } = useAuth();
  const { t } = useI18n();
  const [doc, setDoc] = useState<(typeof DOCS)[number]>('personalausweis');
  const [images, setImages] = useState<Partial<Record<Slot, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const age = ageOn(fromIsoDate(me.birth_date));
  if (me.role === 'student' && age < 16) return <Screen><Banner>{t('verify_under16')}</Banner></Screen>;
  if (me.verification_status === 'verified') return <Screen><Banner tone="success">{t('verify_done')}</Banner></Screen>;
  if (me.verification_status === 'pending') return <Screen><Banner>{t('banner_verify_pending')}</Banner></Screen>;

  const slots: Slot[] = doc === 'reisepass' ? ['front', 'selfie'] : ['front', 'back', 'selfie'];

  async function take(slot: Slot) {
    const uri = await pickImage(true);
    if (uri) setImages((i) => ({ ...i, [slot]: uri }));
  }

  async function submit() {
    if (slots.some((s) => !images[s])) return setError(t('verify_missing'));
    setError(null);
    setBusy(true);
    try {
      const paths: Partial<Record<Slot, string>> = {};
      for (const s of slots) paths[s] = await uploadImage('id-documents', me.id, images[s]!, `${s}-`);
      const { error } = await supabase.from('verifications').insert({
        user_id: me.id, doc_type: doc, front_path: paths.front, back_path: paths.back ?? null, selfie_path: paths.selfie,
      });
      if (error) throw error;
      await refreshProfile();
      notify(t('verify_sent'));
      goBack();
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Banner>{t('verify_intro')}</Banner>
      <H2>{t('doc_type')}</H2>
      <ChipRow>
        {DOCS.map((d) => <Chip key={d} label={t(`doc_${d}` as StringKey)} selected={doc === d} onPress={() => setDoc(d)} />)}
      </ChipRow>
      {slots.map((s) => (
        <Card key={s}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700' }}>{t(`doc_${s}` as StringKey)}</Text>
            {images[s] ? <Text>✅</Text> : null}
          </Row>
          {images[s] ? <Image source={{ uri: images[s] }} style={{ width: '100%', height: 160, borderRadius: 10 }} resizeMode="cover" /> : null}
          <Button title={images[s] ? t('retake') : t('take_photo')} variant="secondary" onPress={() => take(s)} />
        </Card>
      ))}
      <P muted>🔒 {t('verify_privacy')}</P>
      <ErrorText>{error}</ErrorText>
      <View>
        <Button title={t('verify_submit')} onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}
