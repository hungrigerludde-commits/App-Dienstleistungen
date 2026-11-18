import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey && !url.includes('DEIN-PROJEKT'));

export const supabase = createClient(
  url || 'https://example.supabase.co',
  anonKey || 'missing-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

// Token nur erneuern, solange die App im Vordergrund ist.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Wandelt Supabase-/Postgres-Fehler in verständliche Texte um. */
export function errorText(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  if (msg.includes('Invalid login credentials')) return 'E-Mail oder Passwort ist falsch.';
  if (msg.includes('User already registered')) return 'Diese E-Mail-Adresse ist bereits registriert.';
  if (msg.includes('Email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail-Adresse (Link im Postfach).';
  if (msg.includes('Password should be')) return 'Das Passwort muss mindestens 8 Zeichen lang sein.';
  if (msg.includes('row-level security')) return 'Dafür hast du keine Berechtigung.';
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch'))
    return 'Keine Internetverbindung.';
  return msg;
}
