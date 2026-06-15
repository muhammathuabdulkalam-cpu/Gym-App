import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ThouficSignature() {
  return (
    <View style={styles.container}>
      <View style={styles.divider} />
      <Text style={styles.label}>DESIGNED & DEVELOPED BY</Text>
      <Text style={styles.name}>THOUFIC AFZAL</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
    width: '100%',
  },
  divider: {
    width: 32,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginBottom: 20,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  name: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
  },
});
