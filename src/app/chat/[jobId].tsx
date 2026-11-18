import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, colors } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { errorMessage, useI18n } from '@/lib/i18n';
import { containsContactData } from '@/lib/rules';
import { supabase } from '@/lib/supabase';
import type { Job, Message } from '@/lib/types';

export default function Chat() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const me = useProfile();
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const list = useRef<FlatList<Message>>(null);

  useEffect(() => {
    (async () => {
      const [{ data: j }, { data: m }] = await Promise.all([
        supabase.from('jobs').select('*').eq('id', jobId).single(),
        supabase.from('messages').select('*').eq('job_id', jobId).order('created_at'),
      ]);
      setJob(j as Job);
      setMessages((m ?? []) as Message[]);
      if (j) {
        const { data: ps } = await supabase.from('public_profiles').select('id, display_name').in('id', [j.client_id, j.student_id]);
        setNames(Object.fromEntries((ps ?? []).map((p) => [p.id, p.display_name as string])));
      }
    })();
    const channel = supabase
      .channel(`chat-${jobId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${jobId}` },
        (payload) => setMessages((prev) => (prev.some((x) => x.id === payload.new.id) ? prev : [...prev, payload.new as Message])))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobId]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    if (containsContactData(body)) return setError(t('ERR_CONTACT_DATA'));
    setError(null);
    setText('');
    const { data, error } = await supabase.from('messages').insert({ job_id: jobId, sender_id: me.id, body }).select().single();
    if (error) {
      setText(body);
      return setError(errorMessage(t, error));
    }
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]));
  }

  const open = job && ['requested', 'accepted'].includes(job.status);
  const canWrite = me.role !== 'parent' && open;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={{ padding: 10, gap: 6 }}>
          <Banner>{me.role === 'parent' ? t('chat_parent_hint') : t('chat_hint')}</Banner>
          {job && (
            <Text style={{ color: colors.primary, fontWeight: '600', textAlign: 'center' }} onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}>
              {job.title} ›
            </Text>
          )}
        </View>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'center', marginTop: 30 }}>{job && !open ? t('chat_deleted') : t('no_messages')}</Text>}
          renderItem={({ item }) => {
            const mine = item.sender_id === me.id;
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                {!mine && <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 2 }}>{names[item.sender_id] ?? ''}</Text>}
                <View style={{ backgroundColor: mine ? colors.primary : '#fff', borderRadius: 16, padding: 10, borderWidth: mine ? 0 : 1, borderColor: colors.border }}>
                  <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 15 }}>{item.body}</Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.muted, alignSelf: mine ? 'flex-end' : 'flex-start' }}>
                  {new Date(item.created_at).toLocaleTimeString(lang === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />
        {error && <Text style={{ color: colors.danger, paddingHorizontal: 12 }}>{error}</Text>}
        {canWrite && (
          <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderColor: colors.border, backgroundColor: '#fff' }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('write_message')}
              placeholderTextColor="#9AA3B2"
              multiline
              style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, maxHeight: 120 }}
            />
            <Pressable accessibilityRole="button" onPress={send} style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t('send')}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
