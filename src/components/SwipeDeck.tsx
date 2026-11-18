import { useMemo, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { colors } from './ui';

const THRESHOLD = 110;

/**
 * Karten zum Wischen: rechts = Interesse, links = weiter.
 * Unter den Karten gibt es zusätzlich Knöpfe (barrierefrei).
 */
export default function SwipeDeck<T>({
  items, keyOf, renderCard, onSwipe, empty,
}: {
  items: T[];
  keyOf: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onSwipe: (item: T, liked: boolean) => void;
  empty: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [pos] = useState(() => new Animated.ValueXY());
  const item = items[index];

  const finish = (liked: boolean) => {
    if (!item) return;
    Animated.timing(pos, { toValue: { x: liked ? 600 : -600, y: 0 }, duration: 220, useNativeDriver: false }).start(() => {
      pos.setValue({ x: 0, y: 0 });
      setIndex((i) => i + 1);
      onSwipe(item, liked);
    });
  };

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > THRESHOLD) finish(true);
      else if (g.dx < -THRESHOLD) finish(false);
      else Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [index, items]);

  if (!item) return <>{empty}</>;

  const rotate = pos.x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-12deg', '0deg', '12deg'] });
  const likeOpacity = pos.x.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = pos.x.interpolate({ inputRange: [-THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const next = items[index + 1];

  return (
    <View style={{ gap: 14 }}>
      <View style={{ minHeight: 430 }}>
        {next && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 8, transform: [{ scale: 0.96 }], opacity: 0.6 }} pointerEvents="none">
            {renderCard(next)}
          </View>
        )}
        <Animated.View
          key={keyOf(item)}
          {...pan.panHandlers}
          style={{ transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }] }}
        >
          {renderCard(item)}
          <Animated.Text style={[stamp, { left: 18, color: colors.success, borderColor: colors.success, opacity: likeOpacity }]}>✓</Animated.Text>
          <Animated.Text style={[stamp, { right: 18, color: colors.danger, borderColor: colors.danger, opacity: nopeOpacity }]}>✕</Animated.Text>
        </Animated.View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 40 }}>
        <RoundButton label="✕" color={colors.danger} onPress={() => finish(false)} testID="swipe-no" />
        <RoundButton label="✓" color={colors.success} onPress={() => finish(true)} testID="swipe-yes" />
      </View>
    </View>
  );
}

function RoundButton({ label, color, onPress, testID }: { label: string; color: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label === '✓' ? 'Ja' : 'Nein'}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', borderWidth: 2, borderColor: color,
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 28, color, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

const stamp = {
  position: 'absolute' as const, top: 18, fontSize: 36, fontWeight: '900' as const,
  borderWidth: 3, borderRadius: 10, paddingHorizontal: 12,
};
