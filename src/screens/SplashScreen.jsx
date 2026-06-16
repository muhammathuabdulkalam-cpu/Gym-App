import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle, Line, G } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

const QUOTES = [
  '"The body achieves what the mind believes."',
  '"Push harder than yesterday, if you want a different tomorrow."',
  '"Sweat now. Shine later."',
  '"Your only limit is you."',
  '"Stronger every single day."',
  '"Results happen over time, not overnight."',
  '"Train insane or remain the same."',
];

export default function SplashScreen({ mode = 'loading' }) {
  const { user } = useAuth();

  // Pick a random quote once on mount
  const quote = useMemo(
    () => QUOTES[Math.floor(Math.random() * QUOTES.length)],
    []
  );

  // ─── Animation values ──────────────────────────────────────────────────────
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoTranslateY = useRef(new Animated.Value(0)).current;
  const dividerScaleX = useRef(new Animated.Value(0)).current;
  const swipeAnim = useRef(new Animated.Value(-180)).current;

  // Background HUD rotation and pulsing
  const hudRotate = useRef(new Animated.Value(0)).current;
  const radarPulse = useRef(new Animated.Value(0)).current;

  // Welcome container fade/slide
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeTranslateY = useRef(new Animated.Value(18)).current;

  // Username Badge animations
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameScale = useRef(new Animated.Value(0.9)).current;
  const nameProgress = useRef(new Animated.Value(0)).current;

  // Motivational Quote
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const quoteTranslateY = useRef(new Animated.Value(14)).current;
  const quoteScale = useRef(new Animated.Value(1.0)).current;

  // Background Ambient Orbs
  const orb1Y = useRef(new Animated.Value(0)).current;
  const orb2Y = useRef(new Animated.Value(0)).current;

  // Overall Exit transition
  const containerOpacity = useRef(new Animated.Value(1)).current;

  const [displayName, setDisplayName] = useState('');
  const welcomeAnimated = useRef(false);

  // Interpolations for background rotation
  const hudRotateStr = hudRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Interpolations for radar pulse
  const radarScale = radarPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1.8],
  });

  const radarOpacity = radarPulse.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0.45, 0],
  });

  // ─── Phase 1: Background & Brand Logo (Fires Immediately) ────────────────
  useEffect(() => {
    // 1. Loop Ambient Background Orbs
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(orb1Y, { toValue: 40, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(orb1Y, { toValue: 0, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.sequence([
          Animated.timing(orb2Y, { toValue: -50, duration: 4500, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(orb2Y, { toValue: 0, duration: 4500, useNativeDriver: Platform.OS !== 'web' }),
        ]),
      ])
    ).start();

    // 2. Loop Cybernetic HUD Rotation & Pulsing Radar
    Animated.loop(
      Animated.timing(hudRotate, {
        toValue: 1,
        duration: 25000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    ).start();

    Animated.loop(
      Animated.timing(radarPulse, {
        toValue: 1,
        duration: 3200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      })
    ).start();

    // 3. Brand Logo entrance (spring + fade)
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // 4. Swipe Shimmer Reflector
    setTimeout(() => {
      Animated.timing(swipeAnim, {
        toValue: 220,
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }, 250);

    // 5. Drawing Brand Divider line
    setTimeout(() => {
      Animated.timing(dividerScaleX, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }, 450);
  }, []);

  // ─── Phase 2: Welcome Presentation (Fires when mode is 'welcome') ─────────
  useEffect(() => {
    if (mode !== 'welcome') return;
    if (welcomeAnimated.current) return;
    welcomeAnimated.current = true;

    // Grab first name or fallback
    const name = user?.name?.split(' ')[0] || 'Athlete';
    setDisplayName(name);

    // Start welcome animation chain after brand logo has fully presented
    setTimeout(() => {
      Animated.parallel([
        // Logo shifts upward
        Animated.spring(logoTranslateY, {
          toValue: -60,
          friction: 8,
          tension: 40,
          useNativeDriver: Platform.OS !== 'web',
        }),

        // "Welcome back," slides into view
        Animated.parallel([
          Animated.timing(welcomeOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(welcomeTranslateY, {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ]).start();

      // Username text entrance sequence
      setTimeout(() => {
        // 1. Animate 3D character arrival properties
        Animated.parallel([
          Animated.timing(nameProgress, {
            toValue: 1,
            duration: 1200,
            easing: Easing.out(Easing.bezier(0.16, 1, 0.3, 1)),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.spring(nameScale, {
            toValue: 1,
            friction: 7,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();

        // 2. Username container glitch/flicker pop-in
        Animated.sequence([
          Animated.timing(nameOpacity, { toValue: 0.2, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(nameOpacity, { toValue: 0.05, duration: 30, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(nameOpacity, { toValue: 0.7, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(nameOpacity, { toValue: 0.15, duration: 40, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(nameOpacity, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();
      }, 200);

      // Quote presentation (slides up and breathes)
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(quoteOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(quoteTranslateY, {
            toValue: 0,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start(() => {
          // Quote Breathing Scale Loop
          Animated.loop(
            Animated.sequence([
              Animated.timing(quoteScale, {
                toValue: 1.03,
                duration: 2500,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: Platform.OS !== 'web',
              }),
              Animated.timing(quoteScale, {
                toValue: 1.0,
                duration: 2500,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: Platform.OS !== 'web',
              }),
            ])
          ).start();
        });
      }, 1000);
    }, 700);

    // Smooth exit fade out of the entire splash screen
    setTimeout(() => {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }, 2850);
  }, [mode, user]);

  const characters = displayName.split('');

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      {/* Base Dark Palette Gradient */}
      <LinearGradient
        colors={['#06060c', '#0c081e', '#050712']}
        style={StyleSheet.absoluteFill}
      />

      {/* Cybernetic HUD Rotator Overlay */}
      <Animated.View
        style={[
          styles.hudRotatorContainer,
          { transform: [{ rotate: hudRotateStr }] },
        ]}
      >
        <Svg width="360" height="360" viewBox="0 0 360 360" style={styles.hudSvg}>
          {/* Concentric Tech Rings */}
          <Circle cx="180" cy="180" r="170" stroke="rgba(6, 182, 212, 0.03)" strokeWidth="0.8" fill="none" />
          <Circle cx="180" cy="180" r="140" stroke="rgba(167, 139, 250, 0.05)" strokeWidth="1.2" strokeDasharray="15, 12, 8, 12" fill="none" />
          <Circle cx="180" cy="180" r="110" stroke="rgba(6, 182, 212, 0.04)" strokeWidth="1" strokeDasharray="40, 20" fill="none" />
          <Circle cx="180" cy="180" r="80" stroke="rgba(167, 139, 250, 0.03)" strokeWidth="1" strokeDasharray="5, 10" fill="none" />

          {/* Futuristic HUD Crosshairs / Ticks */}
          <G stroke="rgba(6, 182, 212, 0.08)" strokeWidth="1">
            <Line x1="180" y1="5" x2="180" y2="15" />
            <Line x1="180" y1="345" x2="180" y2="355" />
            <Line x1="5" y1="180" x2="15" y2="180" />
            <Line x1="345" y1="180" x2="355" y2="180" />
          </G>
        </Svg>
      </Animated.View>

      {/* Pulsing Sonar / Radar Rings */}
      <Animated.View
        style={[
          styles.radarPulseContainer,
          { transform: [{ scale: radarScale }], opacity: radarOpacity },
        ]}
      >
        <Svg width="220" height="220" viewBox="0 0 220 220">
          <Circle cx="110" cy="110" r="105" stroke="rgba(6, 182, 212, 0.22)" strokeWidth="1" fill="none" />
          <Circle cx="110" cy="110" r="75" stroke="rgba(167, 139, 250, 0.15)" strokeWidth="0.8" fill="none" />
        </Svg>
      </Animated.View>

      {/* Background Ambient Glowing Orbs */}
      <Animated.View style={[styles.glowOrb, styles.purpleOrb, { transform: [{ translateY: orb1Y }] }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="pOrb" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pOrb)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.glowOrb, styles.cyanOrb, { transform: [{ translateY: orb2Y }] }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="cOrb" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#0891b2" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#cOrb)" />
        </Svg>
      </Animated.View>

      {/* ── Main Content Area ─────────────────────────────── */}
      <View style={styles.content}>
        
        {/* BRAND LOGO */}
        <Animated.View
          style={[
            styles.brandContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }, { translateY: logoTranslateY }],
            },
          ]}
        >
          <Text style={styles.brandSubtitle}>FITNESS HUB</Text>
          <View style={styles.brandLogoWrapper}>
            <Text style={styles.brandName}>TRANZIO</Text>
            {/* Shimmer overlay sweep reflection */}
            <Animated.View
              style={[
                styles.shimmerContainer,
                {
                  transform: [{ translateX: swipeAnim }, { rotate: '30deg' }],
                }
              ]}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <Animated.View style={[styles.glowLine, { transform: [{ scaleX: dividerScaleX }] }]} />
        </Animated.View>

        {/* WELCOME SECTION */}
        {mode === 'welcome' && (
          <View style={styles.welcomeContainer}>
            
            {/* "Welcome back," greeting */}
            <Animated.Text
              style={[
                styles.welcomeGreeting,
                { opacity: welcomeOpacity, transform: [{ translateY: welcomeTranslateY }] },
              ]}
            >
              Welcome back,
            </Animated.Text>

            {/* Premium Standalone Username presentation */}
            <Animated.View
              style={[
                styles.nameContainer,
                {
                  opacity: nameOpacity,
                  transform: [{ scale: nameScale }],
                }
              ]}
            >
              <View style={styles.nameRow}>
                {characters.map((char, index) => {
                  const start = Math.max(0.001, Math.min(0.4, index * 0.05));
                  const end = Math.min(1.0, start + 0.5);

                  const charTranslateY = nameProgress.interpolate({
                    inputRange: [0, start, end, 1],
                    outputRange: [15, 15, 0, 0],
                  });

                  const charScale = nameProgress.interpolate({
                    inputRange: [0, start, (start + end) / 2, end, 1],
                    outputRange: [0.4, 0.4, 1.25, 1.0, 1.0],
                  });

                  const charOpacity = nameProgress.interpolate({
                    inputRange: [0, start, end, 1],
                    outputRange: [0, 0, 1, 1],
                  });

                  const charRotateX = nameProgress.interpolate({
                    inputRange: [0, start, end, 1],
                    outputRange: ['90deg', '90deg', '0deg', '0deg'],
                  });

                  return (
                    <Animated.View
                      key={index}
                      style={{
                        opacity: charOpacity,
                        transform: [
                          { perspective: 400 },
                          { translateY: charTranslateY },
                          { scale: charScale },
                          { rotateX: charRotateX },
                        ],
                      }}
                    >
                      <Text style={styles.charText}>
                        {char.toUpperCase()}
                      </Text>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>

            {/* Elegant Tech Separator */}
            <Animated.View
              style={[
                styles.separatorContainer,
                {
                  opacity: quoteOpacity,
                  transform: [
                    { scale: quoteScale },
                  ],
                },
              ]}
            >
              <Text style={styles.separatorDiamond}>◇</Text>
            </Animated.View>

            {/* Motivational Health/Fitness Quote */}
            <Animated.View
              style={{
                opacity: quoteOpacity,
                transform: [
                  { translateY: quoteTranslateY },
                  { scale: quoteScale },
                ],
              }}
            >
              <Text style={styles.quoteText}>
                {quote}
              </Text>
            </Animated.View>

          </View>
        )}

      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06060c',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Cybernetic SVG HUD Overlays
  hudRotatorContainer: {
    position: 'absolute',
    width: 360,
    height: 360,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudSvg: {
    opacity: 0.8,
  },
  radarPulseContainer: {
    position: 'absolute',
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Ambient Glow Orbs
  glowOrb: {
    position: 'absolute',
    overflow: 'hidden',
  },
  purpleOrb: {
    width: width * 1.1,
    height: width * 1.1,
    top: height * 0.04,
    right: -width * 0.3,
  },
  cyanOrb: {
    width: width * 1.0,
    height: width * 1.0,
    bottom: height * 0.04,
    left: -width * 0.3,
  },

  // Center Content Box
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 360,
  },

  // Brand Logo styles
  brandContainer: {
    alignItems: 'center',
    position: 'absolute',
  },
  brandLogoWrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  brandSubtitle: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 6,
    marginBottom: 4,
    textAlign: 'center',
  },
  brandName: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
  },
  shimmerContainer: {
    position: 'absolute',
    height: 70,
    width: 60,
    top: 0,
    overflow: 'hidden',
  },
  glowLine: {
    width: width * 0.48,
    height: 1.5,
    backgroundColor: 'rgba(167, 139, 250, 0.8)',
    marginTop: 12,
    borderRadius: 99,
  },

  // Welcome Presentation styles
  welcomeContainer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: -90,
    width: width * 0.85,
  },
  welcomeGreeting: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },

  // Standalone Username Container
  nameContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  charText: {
    color: '#ffffff',
    fontSize: 24, // premium stand-alone username size
    fontWeight: '800',
    marginHorizontal: 3,
  },

  // Tech Separator styling
  separatorContainer: {
    marginTop: 10,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  separatorDiamond: {
    color: 'rgba(167, 139, 250, 0.35)',
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 2,
  },

  // Quotes styling
  quoteText: {
    color: 'rgba(167, 139, 250, 0.55)',
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
});
