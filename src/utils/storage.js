import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getStorageItem = async (key) => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error('Error reading storage item:', error);
    return null;
  }
};

export const setStorageItem = async (key, value) => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error('Error writing storage item:', error);
  }
};

export const deleteStorageItem = async (key) => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error deleting storage item:', error);
  }
};
