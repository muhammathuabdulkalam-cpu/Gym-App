import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Onboarding</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141e', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#fff', fontSize: 24 }
});
