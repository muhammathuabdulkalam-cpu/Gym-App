/**
 * dataCache.js
 * 
 * Module-level cache that prefetches all dashboard data during the splash screen.
 * DashboardScreen reads from this cache first (instant) then can re-fetch in background.
 */
import {
  fetchFitnessData,
  fetchFoodLogs,
  fetchCardioLogs,
  fetchWorkouts,
} from '../api';

const cache = {
  fitnessData: null,
  foodLogs: null,
  cardioLogs: null,
  workouts: null,
  fetching: false,
  ready: false,
  fetchedAt: null,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function isCacheFresh() {
  if (!cache.ready || !cache.fetchedAt) return false;
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

export function getCachedData() {
  return {
    fitnessData: cache.fitnessData ?? [],
    foodLogs: cache.foodLogs ?? [],
    cardioLogs: cache.cardioLogs ?? [],
    workouts: cache.workouts ?? [],
  };
}

export function clearCache() {
  cache.fitnessData = null;
  cache.foodLogs = null;
  cache.cardioLogs = null;
  cache.workouts = null;
  cache.ready = false;
  cache.fetchedAt = null;
}

export async function prefetchDashboardData() {
  if (cache.fetching || isCacheFresh()) return;
  cache.fetching = true;
  try {
    const [fitnessData, foodLogs, cardioLogs, workouts] = await Promise.all([
      fetchFitnessData(),
      fetchFoodLogs(),
      fetchCardioLogs(),
      fetchWorkouts(),
    ]);
    cache.fitnessData = fitnessData;
    cache.foodLogs = foodLogs;
    cache.cardioLogs = cardioLogs;
    cache.workouts = workouts;
    cache.ready = true;
    cache.fetchedAt = Date.now();
  } catch (err) {
    console.log('[DataCache] Prefetch failed:', err?.message);
  } finally {
    cache.fetching = false;
  }
}
