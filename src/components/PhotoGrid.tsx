import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { colors } from './ui';
import { useSignedUrls } from '@/lib/photos';
import { useI18n } from '@/lib/i18n';

/** Horizontale Fotoreihe. Optional mit „+ Foto“ und Löschen (langes Drücken). */
export default function PhotoGrid({
  paths, onAdd, onRemove, size = 110, busy,
}: { paths: string[]; onAdd?: () => void; onRemove?: (path: string) => void; size?: number; busy?: boolean }) {
  const urls = useSignedUrls('photos', paths);
  const { t } = useI18n();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {paths.map((p) => (
        <Pressable key={p} onLongPress={onRemove ? () => onRemove(p) : undefined}>
          {urls[p] ? (
            <Image source={{ uri: urls[p] }} style={{ width: size, height: size, borderRadius: 10, backgroundColor: '#E5E7EB' }} />
          ) : (
            <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: '#E5E7EB' }} />
          )}
        </Pressable>
      ))}
      {onAdd && (
        <Pressable
          onPress={onAdd}
          disabled={busy}
          style={{ width: size, height: size, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}
        >
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{busy ? '…' : t('add_photo')}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
