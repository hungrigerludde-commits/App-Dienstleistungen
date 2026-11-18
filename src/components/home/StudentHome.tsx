import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import {
  Avatar, Banner, Button, Card, Empty, H2, P, Row, Screen, Stars, colors,
} from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { ageOn, fromIsoDate, categoryLabel, formatPrice } from '@/lib/rules';
import { errorText, supabase } from '@/lib/supabase';
import { notify } from '@/lib/dialog';
import type { Offer, PublicProfile } from '@/lib/types';

export default function StudentHome() {
  const me = useProfile();
  const { refreshProfile } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [pub, setPub] = useState<PublicProfile | null>(null);

  const load = useCallback(async () => {
    const [{ data: o }, { data: p }] = await Promise.all([
      supabase.from('offers').select('*').eq('student_id', me.id).order('created_at'),
      supabase.from('public_profiles').select('*').eq('id', me.id).maybeSingle(),
    ]);
    setOffers((o ?? []) as Offer[]);
    setPub(p as PublicProfile | null);
    refreshProfile();
  }, [me.id, refreshProfile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleListed(v: boolean) {
    const { error } = await supabase.from('profiles').update({ is_listed: v }).eq('id', me.id);
    if (error) notify('Fehler', errorText(error));
    await refreshProfile();
  }

  const age = ageOn(fromIsoDate(me.birth_date));
  const displayName = `${me.first_name} ${me.last_name[0]}.`;
  const visible = me.is_listed && !me.is_suspended && ['approved', 'not_required'].includes(me.parent_consent);

  return (
    <Screen>
      {me.parent_consent === 'pending' && (
        <Banner tone="warning">
          <Text style={{ fontWeight: '700' }}>Deine Eltern müssen noch zustimmen</Text>
          <P>
            Bitte deine Eltern, die App zu installieren, sich als „Elternteil“ zu registrieren und diesen Code einzugeben:
          </P>
          <Text selectable style={{ fontSize: 28, fontWeight: '800', letterSpacing: 4, textAlign: 'center', marginVertical: 6 }}>
            {me.parent_link_code}
          </Text>
          <P muted>Bis dahin ist dein Profil für Auftraggeber unsichtbar. Du kannst aber schon Angebote anlegen.</P>
        </Banner>
      )}
      {me.parent_consent === 'rejected' && (
        <Banner tone="danger">Deine Eltern haben der Nutzung (noch) nicht zugestimmt. Sprich mit ihnen darüber.</Banner>
      )}
      {me.is_suspended && <Banner tone="danger">Dein Konto wurde vom Moderationsteam gesperrt.</Banner>}

      <Card>
        <Row>
          <Avatar name={displayName} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 18 }}>{displayName}, {age}</Text>
            <P muted>{me.postal_code} {me.city} · Umkreis {me.radius_km} km</P>
          </View>
        </Row>
        {pub && (
          <Row>
            <Stars value={pub.avg_rating ?? 0} />
            <Text style={{ color: colors.muted }}>{pub.review_count === 1 ? '1 Bewertung' : `${pub.review_count} Bewertungen`} · {pub.completed_jobs} erledigt</Text>
          </Row>
        )}
        {me.bio ? <P>{me.bio}</P> : <P muted>Noch keine Beschreibung. Erzähl etwas über dich!</P>}
        {me.availability_note ? <P>🕒 {me.availability_note}</P> : null}
        <Button title="Profil bearbeiten" variant="secondary" onPress={() => router.push('/profile/edit')} />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>
              {visible ? '🟢 Du bist sichtbar' : me.is_listed ? '⚪️ Noch nicht sichtbar (Eltern-Zustimmung fehlt)' : '⚪️ Du bist unsichtbar geschaltet'}
            </Text>
            <P muted>Schalte das aus, wenn du gerade keine Zeit hast (z. B. in der Prüfungsphase).</P>
          </View>
          <Switch value={me.is_listed} onValueChange={toggleListed} />
        </Row>
      </Card>

      <Row style={{ justifyContent: 'space-between' }}>
        <H2>Meine Angebote</H2>
        <Button title="+ Neu" variant="ghost" onPress={() => router.push('/offer/edit')} />
      </Row>
      {offers.length === 0 ? (
        <Empty title="Noch keine Angebote" text="Lege fest, was du anbietest – z. B. Mathe-Nachhilfe oder Rasen mähen – und deinen Preis." />
      ) : offers.map((o) => (
        <Card key={o.id} onPress={() => router.push({ pathname: '/offer/edit', params: { id: o.id } })}>
          <Text style={{ fontWeight: '700' }}>{categoryLabel(o.category)}</Text>
          <P>{o.title}</P>
          <P muted>{formatPrice(o.price_min, o.price_max, o.price_unit)}</P>
        </Card>
      ))}
    </Screen>
  );
}
