import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

export default function ScreenWrapper({ children, style }) {
  return (
    <View style={styles.container}>
      {/* 1. Richer, More Colorful Dark Base Gradient */}
      <LinearGradient
        colors={['#0a0b1e', '#130f30', '#071524']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Larger, More Vibrant Soft Blurred Radial Glows covering all corners */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Top Right Purple Glow - Large & Luminous */}
          <RadialGradient id="topRightGlow" cx="80%" cy="15%" r="85%">
            <Stop offset="0%" stopColor="#7c3aed" stopOpacity="0.38" />
            <Stop offset="50%" stopColor="#7c3aed" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </RadialGradient>

          {/* Middle/Bottom Right Pink/Magenta Glow */}
          <RadialGradient id="midRightGlow" cx="100%" cy="65%" r="75%">
            <Stop offset="0%" stopColor="#db2777" stopOpacity="0.25" />
            <Stop offset="60%" stopColor="#db2777" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#db2777" stopOpacity="0" />
          </RadialGradient>

          {/* Bottom Left Cyan/Teal Glow - Large & High Visibility */}
          <RadialGradient id="bottomLeftGlow" cx="15%" cy="85%" r="85%">
            <Stop offset="0%" stopColor="#0891b2" stopOpacity="0.32" />
            <Stop offset="50%" stopColor="#0891b2" stopOpacity="0.1" />
            <Stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Fill screen layers with blends */}
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#topRightGlow)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#midRightGlow)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bottomLeftGlow)" />
      </Svg>

      <View style={[styles.content, style]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b1e',
  },
  content: {
    flex: 1,
  },
});
