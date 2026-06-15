import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
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

export default function SplashScreen() {
  const { user, loading } = useAuth();

  // Pick a random quote once on mount
  const quote = useMemo(
    () => QUOTES[Math.floor(Math.random() * QUOTES.length)],
    []
  );

  // ─── Animation refs ───────────────────────────────────────────────────────
  const logoOpacity    = useRef(new Animated.Value(0)).current;
  const logoScale      = useRef(new Animated.Value(0.4)).current;
  const logoTranslateY = useRef(new Animated.Value(0)).current;
  const dividerScaleX  = useRef(new Animated.Value(0)).current;

  const welcomeOpacity    = useRef(new Animated.Value(0)).current;
  const welcomeTranslateY = useRef(new Animated.Value(18)).current;

  // Name uses SCALE spring for a "pop" effect
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameScale   = useRef(new Animated.Value(0.4)).current;

  const quoteOpacity    = useRef(new Animated.Value(0)).current;
  const quoteTranslateY = useRef(new Animated.Value(14)).current;

  const orb1Y = useRef(new Animated.Value(0)).current;
  const orb2Y = useRef(new Animated.Value(0)).current;

  const [displayName, setDisplayName] = useState('');
  const nameAnimated = useRef(false);

  // ─── Phase 1: background + logo (fires immediately, no user needed) ────────
  useEffect(() => {
    // Background orbs breathe forever
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(orb1Y, { toValue: 40, duration: 4000, useNativeDriver: true }),
          Animated.timing(orb1Y, { toValue: 0,  duration: 4000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(orb2Y, { toValue: -50, duration: 4500, useNativeDriver: true }),
          Animated.timing(orb2Y, { toValue: 0,   duration: 4500, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Logo pops in (0 → 500ms)
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();

    // Divider draws in slightly after logo (350ms delay)
    setTimeout(() => {
      Animated.timing(dividerScaleX, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 350);
  }, []);

  // ─── Phase 2: welcome + name + quote (fires as soon as auth is ready) ─────
  useEffect(() => {
    if (loading) return;                  // wait for AsyncStorage read
    if (nameAnimated.current) return;     // only play once
    nameAnimated.current = true;

    const name = user?.name?.split(' ')[0] || 'Athlete';
    setDisplayName(name);

    // Wait just long enough for the logo entrance (≈700ms from mount)
    const delay = Math.max(0, 700 - Date.now()); // remaining time toward 700ms
    setTimeout(() => {
      Animated.parallel([
        // Logo slides up
        Animated.spring(logoTranslateY, {
          toValue: -64,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),

        // "Welcome back," slides up
        Animated.parallel([
          Animated.timing(welcomeOpacity,    { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(welcomeTranslateY, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ]).start();

      // Name pops in 200ms after welcome starts
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(nameOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.spring(nameScale, {
            toValue: 1,
            friction: 4,   // low friction = more bounce
            tension: 90,   // high tension = fast spring
            useNativeDriver: true,
          }),
        ]).start();
      }, 200);

      // Quote fades in 420ms after welcome starts
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(quoteOpacity,    { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(quoteTranslateY, { toValue: 0, duration: 450, useNativeDriver: true }),
        ]).start();
      }, 420);
    }, 700);
  }, [loading, user]);

  return (
    <View style={styles.container}>
      {/* Base dark gradient */}
      <LinearGradient
        colors={['#070814', '#0d0b21', '#090d1a']}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated orbs */}
      <Animated.View style={[styles.glowOrb, styles.purpleOrb, { transform: [{ translateY: orb1Y }] }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="pOrb" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.28" />
              <Stop offset="100%" stopColor="#7c3aed" stopOpacity="0"    />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pOrb)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.glowOrb, styles.cyanOrb, { transform: [{ translateY: orb2Y }] }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="cOrb" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0%"   stopColor="#0891b2" stopOpacity="0.22" />
              <Stop offset="100%" stopColor="#0891b2" stopOpacity="0"    />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#cOrb)" />
        </Svg>
      </Animated.View>

      {/* ── Content ─────────────────────────────── */}
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
          <Text style={styles.brandName}>TRANZIO</Text>
          <Animated.View style={[styles.glowLine, { transform: [{ scaleX: dividerScaleX }] }]} />
        </Animated.View>

        {/* WELCOME SECTION */}
        <View style={styles.welcomeContainer}>
          {/* "Welcome back," */}
          <Animated.Text
            style={[
              styles.welcomeGreeting,
              { opacity: welcomeOpacity, transform: [{ translateY: welcomeTranslateY }] },
            ]}
          >
            Welcome back,
          </Animated.Text>

          {/* NAME — scale spring pop */}
          <Animated.Text
            style={[
              styles.welcomeUser,
              { opacity: nameOpacity, transform: [{ scale: nameScale }] },
            ]}
          >
            {displayName}!
          </Animated.Text>

          {/* QUOTE */}
          <Animated.Text
            style={[
              styles.quoteText,
              { opacity: quoteOpacity, transform: [{ translateY: quoteTranslateY }] },
            ]}
          >
            {quote}
          </Animated.Text>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070814',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Background orbs
  glowOrb: { position: 'absolute', overflow: 'hidden' },
  purpleOrb: {
    width: width * 1.1,
    height: width * 1.1,
    top: height * 0.05,
    right: -width * 0.3,
  },
  cyanOrb: {
    width: width * 1.0,
    height: width * 1.0,
    bottom: height * 0.05,
    left: -width * 0.3,
  },

  // Main content area
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 360,
  },

  // Brand
  brandContainer: {
    alignItems: 'center',
    position: 'absolute',
  },
  brandSubtitle: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 6,
    marginBottom: 6,
    textAlign: 'center',
  },
  brandName: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(167, 139, 250, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  glowLine: {
    width: width * 0.5,
    height: 2,
    backgroundColor: '#a78bfa',
    marginTop: 14,
    borderRadius: 99,
    shadowColor: '#a78bfa',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  // Welcome section (appears below the logo once it slides up)
  welcomeContainer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: -80,
    width: width * 0.85,
  },
  welcomeGreeting: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: 'center',
  },
  welcomeUser: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(167, 139, 250, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
    marginBottom: 16,
  },
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
