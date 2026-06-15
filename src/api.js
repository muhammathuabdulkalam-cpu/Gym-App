import axios from 'axios';
import { getStorageItem } from './utils/storage';

const API_URL = 'https://gym-tracker-14iz.onrender.com/api';

const api = axios.create({ baseURL: API_URL });

// Automatically attach Bearer token if logged in
api.interceptors.request.use(async (config) => {
  try {
    const userData = await getStorageItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user && user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    }
  } catch (error) {
    console.log('Error reading token from storage', error);
  }
  return config;
});

// Authentication endpoints
export const login = async (data) => (await api.post('/auth/login', data)).data;
export const register = async (data) => (await api.post('/auth/register', data)).data;
export const googleLogin = async (data) => (await api.post('/auth/google', data)).data;
export const updateProfile = async (data) => (await api.put('/auth/profile', data)).data;
export const fetchUserProfile = async () => (await api.get('/auth/profile')).data;

// Fitness Tracking endpoints
export const fetchFitnessData = async () => (await api.get('/fitness')).data;
export const saveFitnessData = async (data) => (await api.post('/fitness', data)).data;

// Workout endpoints
export const fetchWorkouts = async () => (await api.get('/workouts')).data;
export const saveWorkout = async (data) => (await api.post('/workouts', data)).data;

// Food log endpoints
export const fetchFoodLogs = async (date) => (await api.get('/food', { params: date ? { date } : {} })).data;
export const saveFoodLog = async (data) => (await api.post('/food', data)).data;
export const deleteFoodLog = async (dateOrId, mealType, foodId) => {
  if (mealType && foodId) {
    return (await api.delete(`/food/item/${dateOrId}/${mealType}/${foodId}`)).data;
  }
  return (await api.delete(`/food/${dateOrId}`)).data;
};

// AI Nutrition lookup endpoints
export const fetchNutrition = async (query) => (await api.get('/nutrition', { params: { query } })).data;

// Custom food endpoints
export const fetchCustomFoods = async () => (await api.get('/custom-food')).data;
export const saveCustomFood = async (data) => (await api.post('/custom-food', data)).data;
export const deleteCustomFood = async (id) => (await api.delete(`/custom-food/${id}`)).data;

// Weight log endpoints
export const fetchWeightLogs = async () => (await api.get('/weight')).data;
export const saveWeightLog = async (data) => (await api.post('/weight', data)).data;
export const updateWeightLog = async (id, data) => (await api.put(`/weight/${id}`, data)).data;
export const deleteWeightLog = async (id) => (await api.delete(`/weight/${id}`)).data;

// Cardio log endpoints
export const fetchCardioLogs = async (date) => (await api.get('/cardio', { params: date ? { date } : {} })).data;
export const saveCardioLog = async (data) => (await api.post('/cardio', data)).data;
export const deleteCardioLog = async (id) => (await api.delete(`/cardio/${id}`)).data;

export default api;

