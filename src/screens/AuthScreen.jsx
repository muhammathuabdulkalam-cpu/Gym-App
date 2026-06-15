import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { login, register } from '../api';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please fill out all fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userData = isLogin
        ? await login({ email, password })
        : await register({ email, password });
      loginUser(userData);
    } catch (err) {
      setError(err.response?.data?.message || `${isLogin ? 'Login' : 'Registration'} failed`);
    }
    setLoading(false);
  };

  const switchMode = (toLogin) => {
    if (toLogin === isLogin) return;
    setIsLogin(toLogin);
    setError(null);
    setEmail('');
    setPassword('');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        {/* Toggle between Login and Signup */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity style={[styles.toggleBtn, isLogin && styles.toggleBtnActive]} onPress={() => switchMode(true)}>
            <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, !isLogin && styles.toggleBtnActive]} onPress={() => switchMode(false)}>
            <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Header Text */}
        <Text style={styles.headerTitle}>{isLogin ? 'Welcome Back 👋' : 'Create Account 🚀'}</Text>
        <Text style={styles.headerSubtitle}>
          {isLogin ? 'Sign in to continue your fitness journey.' : 'Join thousands of athletes tracking their best selves.'}
        </Text>

        {/* Error Message */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput 
            style={styles.input} 
            placeholder="you@email.com" 
            placeholderTextColor="#52525b"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.passwordContainer}>
            <TextInput 
              style={[styles.input, styles.passwordInput]} 
              placeholder="••••••••" 
              placeholderTextColor="#52525b"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
              <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={24} color="#52525b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
          )}
        </TouchableOpacity>

        {/* Footer Hint */}
        <Text style={styles.footerHint}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <Text style={styles.footerAction} onPress={() => switchMode(!isLogin)}>
            {isLogin ? 'Sign Up' : 'Sign In'}
          </Text>
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1016' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#1a1b23', borderRadius: 12, p: 4, marginBottom: 32, alignSelf: 'center' },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 24, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: '#3b82f6' },
  toggleText: { color: '#a1a1aa', fontWeight: 'bold' },
  toggleTextActive: { color: '#ffffff' },
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#ffffff', marginBottom: 8 },
  headerSubtitle: { fontSize: 14, color: '#a1a1aa', marginBottom: 32, fontWeight: '500' },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 20 },
  errorText: { color: '#f87171', fontSize: 14, fontWeight: '600' },
  formGroup: { marginBottom: 20 },
  label: { color: '#a1a1aa', fontSize: 11, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: '#1a1b23', borderWidth: 1, borderColor: '#27272a', borderRadius: 12, padding: 16, color: '#ffffff', fontSize: 16 },
  passwordContainer: { position: 'relative' },
  passwordInput: { paddingRight: 50 },
  eyeIcon: { position: 'absolute', right: 16, top: 16 },
  submitBtn: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  footerHint: { textAlign: 'center', color: '#a1a1aa', marginTop: 32, fontSize: 14 },
  footerAction: { color: '#3b82f6', fontWeight: 'bold' },
});
