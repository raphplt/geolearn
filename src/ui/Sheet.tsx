import { useCallback, useEffect } from 'react';
import {
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tap } from '@/fx/haptics';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { useReducedMotion } from './motion';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
  /** Bottom-anchored actions, kept inside the thumb zone. */
  footer?: React.ReactNode;
};

const DISMISS_DISTANCE = 110;

const DISMISS_VELOCITY = 900;

/** Parked one screen below the bottom edge, so it always rises from off-screen. */
const PARKED = Dimensions.get('window').height;

/**
 * A temporary decision rises from the bottom edge, is dragged back down to
 * dismiss, and answers the system back gesture. No cross, no full-screen page.
 */
export function Sheet({ visible, onClose, title, eyebrow, children, footer }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const translateY = useSharedValue(visible ? 0 : PARKED);
  const backdrop = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      translateY.value = reduced ? 0 : withSpring(0, theme.motion.spring.sheet);
      backdrop.value = withTiming(1, { duration: theme.motion.duration.base });
    } else {
      translateY.value = PARKED;
      backdrop.value = 0;
    }
  }, [visible, reduced, translateY, backdrop, theme.motion]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  const dismiss = useCallback(() => {
    tap();
    onClose();
  }, [onClose]);

  const drag = Gesture.Pan()
    .onChange((event) => {
      translateY.value = Math.max(0, translateY.value + event.changeY);
    })
    .onEnd((event) => {
      if (translateY.value > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)();
        return;
      }
      translateY.value = withSpring(0, theme.motion.spring.sheet);
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Gestures inside a Modal need their own root on Android. */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <KeyboardAvoidingView
          style={StyleSheet.absoluteFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }]}
              onPress={dismiss}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            />
          </Animated.View>

          <Animated.View
            style={[
              {
                marginTop: 'auto',
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: theme.radius.xl,
                borderTopRightRadius: theme.radius.xl,
                borderTopWidth: theme.borderWidth.hair,
                borderColor: theme.colors.border,
                paddingBottom: insets.bottom + theme.space.md,
                maxHeight: '92%',
                ...theme.elevation.overlay,
              },
              panelStyle,
            ]}
          >
            <GestureDetector gesture={drag}>
              <View style={{ paddingTop: theme.space.sm, paddingBottom: theme.space.xs }}>
                <View
                  style={{
                    alignSelf: 'center',
                    width: 38,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: theme.colors.borderStrong,
                    opacity: 0.5,
                  }}
                />
                {title ? (
                  <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.md }}>
                    {eyebrow ? (
                      <Text variant="cartouche" color="textTertiary">
                        {eyebrow}
                      </Text>
                    ) : null}
                    <Text variant="titleLg" style={{ marginTop: eyebrow ? 2 : 0 }}>
                      {title}
                    </Text>
                  </View>
                ) : null}
              </View>
            </GestureDetector>

            {children}

            {footer ? (
              <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.md }}>
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
