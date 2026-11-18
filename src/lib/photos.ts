import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type Bucket = 'photos' | 'id-documents';

/** Foto aus der Mediathek wählen (oder mit der Kamera aufnehmen). Gibt die lokale URI zurück. */
export async function pickImage(camera = false): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: false };
  if (camera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.granted) {
      const r = await ImagePicker.launchCameraAsync(opts);
      return r.canceled ? null : r.assets[0].uri;
    }
  }
  const r = await ImagePicker.launchImageLibraryAsync(opts);
  return r.canceled ? null : r.assets[0].uri;
}

/** Lädt ein Bild in den Ordner des Nutzers hoch und gibt den Speicherpfad zurück. */
export async function uploadImage(bucket: Bucket, userId: string, uri: string, prefix = ''): Promise<string> {
  const body = await (await fetch(uri)).arrayBuffer();
  const path = `${userId}/${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Erzeugt zeitlich begrenzte Links (1 Std.) für private Bilder. */
export function useSignedUrls(bucket: Bucket, paths: string[]): Record<string, string> {
  const key = `${bucket}:${paths.join('|')}`;
  const [state, setState] = useState<{ key: string; urls: Record<string, string> }>({ key: '', urls: {} });
  useEffect(() => {
    const list = key.slice(bucket.length + 1).split('|').filter(Boolean);
    if (!list.length) return;
    let active = true;
    supabase.storage.from(bucket).createSignedUrls(list, 3600).then(({ data }) => {
      const urls: Record<string, string> = {};
      for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
      if (active) setState({ key, urls });
    });
    return () => { active = false; };
  }, [bucket, key]);
  return state.key === key ? state.urls : {};
}
