import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import AppMap, { type MapMarkerData } from '@/components/AppMap';
import ChildJobCard from '@/components/ChildJobCard';
import { Banner, Button, Chip, ChipRow, Empty, P, Screen } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { RADIUS_OPTIONS, SERVICE_ICON, formatDateTime, formatPriceRange, type Service } from '@/lib/rules';
import { supabase } from '@/lib/supabase';
import type { ChildJob, JobPost } from '@/lib/types';

type MapPost = { post_id: string; service: string; title: string; approx_lat: number; approx_lng: number; price_min: number; price_max: number; price_unit: string; scheduled_start: string; distance_km: number };

/** Karte: Schüler sehen Gesuche im Umkreis, Auftraggeber ihre Gesuche, Eltern wo ihr Kind ist. */
export default function MapTab() {
  const me = useProfile();
  const { refreshProfile } = useAuth();
  const { t, lang } = useI18n();
  const [markers, setMarkers] = useState<MapMarkerData[]>([]);
  const [childJobs, setChildJobs] = useState<(ChildJob & { child: string })[]>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(me.home_lat != null ? { lat: me.home_lat, lng: me.home_lng! } : null);

  const load = useCallback(async () => {
    if (me.role === 'student') {
      const { data } = await supabase.rpc('map_posts');
      setMarkers(((data ?? []) as MapPost[]).map((p) => ({
        id: p.post_id, lat: p.approx_lat, lng: p.approx_lng,
        title: `${SERVICE_ICON[p.service as Service]} ${p.title}`,
        subtitle: `${formatPriceRange(p.price_min, p.price_max, lang)} ${p.price_unit === 'stunde' ? t('per_hour') : t('per_job')} · ${formatDateTime(p.scheduled_start, lang)} · ${t('away_km', { n: p.distance_km })}`,
      })));
    } else if (me.role === 'client') {
      const { data } = await supabase.from('job_posts').select('*').eq('client_id', me.id).eq('status', 'open');
      const posts = (data ?? []) as JobPost[];
      setMarkers(posts.map((p) => ({ id: p.id, lat: p.approx_lat, lng: p.approx_lng, title: `${SERVICE_ICON[p.service as Service]} ${p.title}`, subtitle: formatDateTime(p.scheduled_start, lang) })));
      if (!center && posts[0]) setCenter({ lat: posts[0].approx_lat, lng: posts[0].approx_lng });
    } else {
      const { data: kids } = await supabase.from('profiles').select('id, first_name').eq('parent_id', me.id);
      const all: (ChildJob & { child: string })[] = [];
      for (const k of kids ?? []) {
        const { data } = await supabase.rpc('child_jobs', { child: k.id });
        for (const j of (data ?? []) as ChildJob[]) if (j.status === 'accepted') all.push({ ...j, child: k.first_name });
      }
      setChildJobs(all);
      const located = all.filter((j) => j.lat != null);
      setMarkers(located.map((j) => ({ id: j.job_id, lat: j.lat!, lng: j.lng!, title: `${j.child}: ${j.title}`, subtitle: `${formatDateTime(j.scheduled_start, lang)} · ${j.client_name}`, color: '#1B7F3B' })));
      if (!center && located[0]) setCenter({ lat: located[0].lat!, lng: located[0].lng! });
    }
  }, [me.role, me.id, lang, t, center]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function setRadius(r: number) {
    await supabase.from('profiles').update({ radius_km: r }).eq('id', me.id);
    await refreshProfile();
    load();
  }

  const openMarker = (id: string) => {
    if (me.role === 'parent') router.push({ pathname: '/job/[id]', params: { id } });
    else router.push({ pathname: '/post/[id]', params: { id } });
  };

  if (me.role === 'student' && me.home_lat == null) {
    return (
      <Screen>
        <Banner tone="warning">{t('banner_location')}</Banner>
        <Button title={t('set_location')} onPress={() => router.push('/location')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {me.role === 'parent' && <P style={{ fontWeight: '700', fontSize: 18 }}>{t('map_parent_title')}</P>}
      {me.role === 'client' && <P muted>{t('map_client_hint')}</P>}
      {me.role === 'student' && (
        <ChipRow>
          {RADIUS_OPTIONS.map((r) => (
            <Chip key={r} label={`${r} km`} selected={me.radius_km === r} onPress={() => setRadius(r)} />
          ))}
        </ChipRow>
      )}
      {center ? (
        <AppMap center={center} radiusKm={me.role === 'student' ? me.radius_km : undefined} markers={markers} onMarkerPress={openMarker} height={420} />
      ) : null}
      {markers.length === 0 && (
        <Empty title={me.role === 'parent' ? t('map_parent_empty') : me.role === 'client' ? t('no_posts') : t('map_empty')} />
      )}
      {me.role === 'parent' && childJobs.map((j) => <ChildJobCard key={j.job_id} job={j} childName={j.child} onChanged={load} />)}
    </Screen>
  );
}
