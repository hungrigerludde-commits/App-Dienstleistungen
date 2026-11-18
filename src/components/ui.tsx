import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  primary: '#2E6BE6',
  primaryDark: '#1F4FB2',
  accent: '#FFB020',
  bg: '#F5F7FB',
  card: '#FFFFFF',
  text: '#1A1F2B',
  muted: '#6B7280',
  border: '#E3E7EF',
  danger: '#C62828',
  success: '#1B7F3B',
  warningBg: '#FFF4E0',
  infoBg: '#E8F0FE',
};

export function Screen({
  children, scroll = true, padded = true, edges,
}: { children: ReactNode; scroll?: boolean; padded?: boolean; edges?: ('top' | 'bottom')[] }) {
  const content = <View style={[padded && styles.padded, { gap: 14 }]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges ?? ['bottom']}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
          {content}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{content}</View>
      )}
    </SafeAreaView>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}
export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}
export function P({ children, muted, style, numberOfLines }: { children: ReactNode; muted?: boolean; style?: object; numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={[styles.p, muted && { color: colors.muted }, style]}>{children}</Text>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title, onPress, variant = 'primary', loading, disabled,
}: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean; disabled?: boolean;
}) {
  const bg = { primary: colors.primary, secondary: colors.card, danger: colors.danger, ghost: 'transparent' }[variant];
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : variant === 'ghost' ? colors.primary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#9AA3B2"
        {...props}
        style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, error && { borderColor: colors.danger }]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={{ color: selected ? '#fff' : colors.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

export function Banner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'danger' | 'success' }) {
  const bg = { info: colors.infoBg, warning: colors.warningBg, danger: '#FDECEC', success: '#E7F6EC' }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      {typeof children === 'string' ? <Text style={styles.p}>{children}</Text> : children}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: onChange ? 8 : 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          onPress={onChange ? () => onChange(i) : undefined}
          style={{ fontSize: size, color: i <= Math.round(value) ? colors.accent : '#D0D5DD' }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: color + '1A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color, fontWeight: '600', fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>{children}</View>;
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 30, gap: 6 }}>
      <Text style={styles.h2}>{title}</Text>
      {text ? <Text style={[styles.p, { color: colors.muted, textAlign: 'center' }]}>{text}</Text> : null}
    </View>
  );
}

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.infoBg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.primaryDark, fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: 16 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text },
  p: { fontSize: 15, lineHeight: 21, color: colors.text },
  card: {
    backgroundColor: colors.card, borderRadius: 14, padding: 14, gap: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  button: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.text,
  },
  hint: { fontSize: 13, color: colors.muted },
  error: { fontSize: 14, color: colors.danger },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  banner: { borderRadius: 12, padding: 12, gap: 6 },
});
