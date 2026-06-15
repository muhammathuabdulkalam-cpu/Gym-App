import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import {
  fetchFitnessData,
  saveFitnessData,
  fetchFoodLogs,
  fetchCardioLogs,
  fetchWorkouts
} from '../api';
import { getCachedData, isCacheFresh, prefetchDashboardData } from '../utils/dataCache';
import ScreenWrapper from '../components/ScreenWrapper';
import ThouficSignature from '../components/ThouficSignature';

const { width: screenWidth } = Dimensions.get('window');
const FILTERS = ['7 Days', '30 Days', '3 Months'];

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const today = new Date().toISOString().split('T')[0];
  const hasLoadedOnce = useRef(false);

  const [loading, setLoading] = useState(!isCacheFresh());
  const [allData, setAllData] = useState([]);
  const [filter, setFilter] = useState('7 Days');
  const [quickWeight, setQuickWeight] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  const mergeAnalyticsData = (fitnessData, foodLogs, cardioLogs, workouts) => {
    const map = new Map();
    const ensure = (date) => {
      if (!map.has(date)) {
        map.set(date, {
          date,
          fitnessCalories: 0,
          foodCalories: 0,
          cardioCalories: 0,
          fitnessSteps: 0,
          cardioSteps: 0,
          weight: 0,
          workoutCount: 0,
          workoutVolume: 0,
        });
      }
      return map.get(date);
    };

    (Array.isArray(fitnessData) ? fitnessData : []).forEach((item) => {
      const row = ensure(item.date);
      row.fitnessCalories += Number(item.calories) || 0;
      row.fitnessSteps += Number(item.steps) || 0;
      if (item.weight !== undefined && item.weight !== null) row.weight = item.weight;
    });

    (Array.isArray(foodLogs) ? foodLogs : []).forEach((log) => {
      const row = ensure(log.date);
      row.foodCalories += Number(log.totalCalories) || 0;
    });

    (Array.isArray(cardioLogs) ? cardioLogs : []).forEach((log) => {
      const row = ensure(log.date);
      row.cardioCalories += Number(log.caloriesBurned) || 0;
      row.cardioSteps += Number(log.steps) || 0;
    });

    (Array.isArray(workouts) ? workouts : []).forEach((workout) => {
      const row = ensure(workout.date);
      row.workoutCount += 1;
      row.workoutVolume = (row.workoutVolume || 0) + (workout.exercises || []).reduce((sum, exercise) => {
        return sum + (exercise.sets || []).reduce((setSum, set) => setSum + ((Number(set.reps) || 0) * (Number(set.weight) || 0)), 0);
      }, 0);
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        calories: (row.foodCalories || row.fitnessCalories || 0) + (row.cardioCalories || 0),
        steps: (row.fitnessSteps || 0) + (row.cardioSteps || 0),
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const loadData = async (background = false) => {
    if (!background) setLoading(true);
    try {
      // Always fetch fresh data (this may be a re-fetch after cache was already shown)
      const [fitnessData, foodLogs, cardioLogs, workoutsData] = await Promise.all([
        fetchFitnessData(),
        fetchFoodLogs(),
        fetchCardioLogs(),
        fetchWorkouts(),
      ]);
      const merged = mergeAnalyticsData(fitnessData, foodLogs, cardioLogs, workoutsData);
      setAllData(merged);
    } catch (err) {
      console.error('Dashboard analytics fetch failed:', err);
      // Don't wipe existing data on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFocused || !user) return;
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      if (isCacheFresh()) {
        // Cache is warm — render instantly from cache, then silently refresh in background
        const c = getCachedData();
        const merged = mergeAnalyticsData(c.fitnessData, c.foodLogs, c.cardioLogs, c.workouts);
        setAllData(merged);
        setLoading(false);
        loadData(true); // background refresh (no spinner)
      } else {
        // No cache yet — fetch with spinner (prefetch may still be in flight from RootNavigator)
        loadData(false);
      }
    } else {
      // Tab re-focused — silent background refresh, no spinner
      loadData(true);
    }
  }, [isFocused, user]);

  const applyFilter = useCallback((data, f) => {
    const now = new Date();
    const days = f === '7 Days' ? 7 : f === '30 Days' ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 86400000);
    
    const filteredSorted = data
      .filter(d => new Date(d.date) >= cutoff)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let lastWeight = 0;
    for (let i = 0; i < filteredSorted.length; i++) {
      if (filteredSorted[i].weight > 0) {
        lastWeight = filteredSorted[i].weight;
        break;
      }
    }

    return filteredSorted.map(d => {
      if (d.weight > 0) {
        lastWeight = d.weight;
      }
      return {
        ...d,
        weight: d.weight > 0 ? d.weight : lastWeight,
        label: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      };
    });
  }, []);

  const displayData = useMemo(() => {
    return applyFilter(allData, filter);
  }, [allData, filter, applyFilter]);

  const latest = useMemo(() => {
    if (!displayData.length) return null;
    return displayData[displayData.length - 1];
  }, [displayData]);

  const bmiData = useMemo(() => {
    const height = Number(user?.height) || 178;
    const weight = Number(user?.weight || latest?.weight || 87.7);
    const heightM = height / 100;
    const score = weight / (heightM * heightM);
    
    let status = 'Normal';
    let color = '#34d399';
    if (score < 18.5) { status = 'Underweight'; color = '#60a5fa'; }
    else if (score >= 25 && score < 30) { status = 'Overweight'; color = '#fb923c'; }
    else if (score >= 30) { status = 'Obese'; color = '#f87171'; }
    
    return { score: score ? score.toFixed(1) : '27.7', status: score ? status : 'Overweight', color };
  }, [user, latest]);

  // Auto-calculate age from DOB
  const computedAge = useMemo(() => {
    const dobStr = user?.dob;
    if (!dobStr) return user?.age || null;
    const birth = new Date(dobStr);
    if (isNaN(birth.getTime())) return user?.age || null;
    const today = new Date();
    let a = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
    return a > 0 ? a : (user?.age || null);
  }, [user?.dob, user?.age]);

  const handleQuickWeightSave = async () => {
    if (!quickWeight || isNaN(quickWeight)) return;
    setSavingWeight(true);
    try {
      await saveFitnessData({ date: today, weight: Number(quickWeight) });
      setQuickWeight('');
      await loadData();
    } catch (e) {
      console.error('Failed to save weight', e);
    } finally {
      setSavingWeight(false);
    }
  };

  const chartLabels = useMemo(() => {
    if (displayData.length === 0) return [];
    return displayData.map((d, index) => {
      if (displayData.length <= 5) return d.label;
      if (index === 0 || index === displayData.length - 1 || index === Math.floor(displayData.length / 2)) {
        return d.label;
      }
      return '';
    });
  }, [displayData]);

  const calorieChartData = useMemo(() => {
    if (displayData.length === 0) return null;
    return { labels: chartLabels, datasets: [{ data: displayData.map(d => d.calories || 0) }] };
  }, [displayData, chartLabels]);

  const weightChartData = useMemo(() => {
    const nonZeroWeights = displayData.filter(d => d.weight > 0);
    if (nonZeroWeights.length === 0) return null;
    return { labels: chartLabels, datasets: [{ data: displayData.map(d => d.weight || 0) }] };
  }, [displayData, chartLabels]);

  const stepsChartData = useMemo(() => {
    if (displayData.length === 0) return null;
    return { labels: chartLabels, datasets: [{ data: displayData.map(d => d.steps || 0) }] };
  }, [displayData, chartLabels]);

  const createChartConfig = (colorHex) => ({
    backgroundColor: 'transparent',
    backgroundGradientFrom: '#151622',
    backgroundGradientTo: '#151622',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(${colorHex}, ${opacity})`,
    labelColor: () => 'rgba(161, 161, 170, 0.7)',
    style: { borderRadius: 16 },
    propsForDots: { r: '4', strokeWidth: '2', stroke: `rgb(${colorHex})` },
    propsForBackgroundLines: { strokeDasharray: '', stroke: 'rgba(255, 255, 255, 0.02)' }
  });

  // Determine profile image source
  const profileImageUri = user?.profileImage || DEFAULT_AVATAR;

  const statCards = [
    {
      icon: 'fire',
      color: '#f97316',
      bgColor: '#f97316',
      label: 'Calories',
      value: `${latest?.calories || 0}`,
      unit: 'kcal',
      sub: 'Today',
    },
    {
      icon: 'shoe-print',
      color: '#6366f1',
      bgColor: '#6366f1',
      label: 'Steps',
      value: `${latest?.steps || 0}`,
      unit: '',
      sub: 'Today',
    },
    {
      icon: 'scale-bathroom',
      color: '#a855f7',
      bgColor: '#a855f7',
      label: 'Weight',
      value: `${user?.weight || latest?.weight || 87.7}`,
      unit: 'kg',
      sub: 'Latest Log',
    },
    {
      icon: 'heart-pulse',
      color: bmiData.color,
      bgColor: bmiData.color,
      label: 'BMI Score',
      value: `${bmiData.score}`,
      unit: '',
      sub: bmiData.status,
      subColor: bmiData.color,
    },
  ];

  return (
    <ScreenWrapper>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <View style={styles.nameRow}>
                <Text style={styles.greetingName}>{user?.name || 'Afzal'}!</Text>
                <View style={styles.ageBadge}>
                  <Text style={styles.ageBadgeText}>{computedAge ?? user?.age ?? '—'} yrs</Text>
                </View>
              </View>
              <Text style={styles.dashboardSubtitle}>Tranzio Fitness Dashboard</Text>
            </View>
            <TouchableOpacity style={styles.profileAvatarContainer} onPress={() => navigation.navigate('Profile')}>
              <Image source={{ uri: profileImageUri }} style={styles.profileAvatar} />
            </TouchableOpacity>
          </View>

          {/* Premium 2x2 Stat Cards Grid */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a78bfa" />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              {statCards.map((card, index) => (
                <View
                  key={index}
                  style={[
                    styles.statCard,
                    { borderColor: `${card.bgColor}22` }
                  ]}
                >
                  {/* Subtle color tint in top-right corner */}
                  <View style={[styles.cardCornerGlow, { backgroundColor: card.bgColor }]} />

                  {/* Floating icon — no box, no container */}
                  <MaterialCommunityIcons
                    name={card.icon}
                    size={28}
                    color={card.color}
                    style={styles.cardIcon}
                  />

                  {/* Value */}
                  <View style={styles.cardValueRow}>
                    <Text style={styles.cardValue}>{card.value}</Text>
                    {card.unit ? <Text style={styles.cardUnit}> {card.unit}</Text> : null}
                  </View>

                  {/* Label */}
                  <Text style={styles.cardLabel}>{card.label}</Text>

                  {/* Sub/status */}
                  <Text style={[
                    styles.cardSub,
                    card.subColor ? { color: card.subColor, fontWeight: 'bold' } : {}
                  ]}>
                    {card.sub}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Quick Log Weight Card */}
          <View style={styles.quickLogCard}>
            <View style={styles.quickLogHeader}>
              <MaterialCommunityIcons name="weight-kilogram" size={18} color="#a78bfa" />
              <Text style={styles.quickLogTitle}>Quick Log Weight</Text>
            </View>
            <View style={styles.quickLogInputRow}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.quickLogInput}
                  keyboardType="numeric"
                  placeholder="e.g. 72.5"
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                  value={quickWeight}
                  onChangeText={setQuickWeight}
                />
                <Text style={styles.unitText}>kg</Text>
              </View>
              <TouchableOpacity
                style={[styles.quickLogBtn, (!quickWeight || savingWeight) && styles.quickLogBtnDisabled]}
                onPress={handleQuickWeightSave}
                disabled={savingWeight || !quickWeight}
              >
                {savingWeight ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.quickLogBtnText}>Log</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Charts Section */}
          {!loading && displayData.length > 0 && (
            <View style={styles.chartsContainer}>
              {calorieChartData && (
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <MaterialCommunityIcons name="fire" size={20} color="#f97316" />
                    <Text style={styles.chartTitle}>Calorie Trend</Text>
                  </View>
                  <LineChart
                    data={calorieChartData}
                    width={screenWidth - 40}
                    height={180}
                    chartConfig={createChartConfig('249, 115, 22')}
                    bezier
                    style={styles.chart}
                  />
                </View>
              )}

              {weightChartData && (
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <MaterialCommunityIcons name="scale-bathroom" size={20} color="#a855f7" />
                    <Text style={styles.chartTitle}>Weight Progress</Text>
                  </View>
                  <LineChart
                    data={weightChartData}
                    width={screenWidth - 40}
                    height={180}
                    chartConfig={createChartConfig('168, 85, 247')}
                    bezier
                    style={styles.chart}
                  />
                </View>
              )}

              {stepsChartData && (
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <MaterialCommunityIcons name="shoe-print" size={20} color="#6366f1" />
                    <Text style={styles.chartTitle}>Steps — {filter}</Text>
                  </View>
                  <BarChart
                    data={stepsChartData}
                    width={screenWidth - 40}
                    height={180}
                    chartConfig={createChartConfig('99, 102, 241')}
                    style={styles.chart}
                    yAxisLabel=""
                    yAxisSuffix=""
                  />
                </View>
              )}
            </View>
          )}

          {/* Filter Buttons */}
          <View style={styles.filterContainer}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Thoufic Signature */}
          <ThouficSignature />
        </ScrollView>
      </SafeAreaView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  
  // Header styles
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 24,
    marginTop: 10
  },
  headerTextContainer: { flex: 1 },
  welcomeText: { fontSize: 15, color: 'rgba(255, 255, 255, 0.4)', fontWeight: '500' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  greetingName: { fontSize: 28, fontWeight: '900', color: '#fff' },
  ageBadge: { 
    backgroundColor: 'rgba(124, 58, 237, 0.2)', 
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 
  },
  ageBadgeText: { color: '#a78bfa', fontSize: 11, fontWeight: 'bold' },
  dashboardSubtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.3)', marginTop: 6, fontWeight: 'bold' },
  profileAvatarContainer: { 
    width: 48, height: 48, borderRadius: 24, 
    borderWidth: 2, borderColor: 'rgba(167, 139, 250, 0.4)',
    overflow: 'hidden'
  },
  profileAvatar: { width: '100%', height: '100%' },

  // 2x2 Premium stat grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: (screenWidth - 52) / 2,
    backgroundColor: '#151622',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  cardCornerGlow: {
    position: 'absolute',
    top: -18,
    right: -18,
    width: 64,
    height: 64,
    borderRadius: 32,
    opacity: 0.12,
  },
  cardIcon: {
    marginBottom: 14,
  },
  cardValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  cardUnit: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.35)',
  },
  cardLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  cardSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.22)',
    marginTop: 3,
  },

  loadingContainer: { height: 180, justifyContent: 'center', alignItems: 'center' },

  // Quick Log Weight Card styles
  quickLogCard: { 
    backgroundColor: '#151622', 
    padding: 20, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 24 
  },
  quickLogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  quickLogTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
  quickLogInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputWrapper: { 
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0a0a0f', borderRadius: 12, 
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16, height: 48
  },
  quickLogInput: { flex: 1, color: '#fff', fontSize: 15, fontWeight: 'bold', height: '100%' },
  unitText: { color: 'rgba(255, 255, 255, 0.3)', fontSize: 13, fontWeight: 'bold' },
  quickLogBtn: { 
    backgroundColor: '#7c3aed', borderRadius: 12, height: 48, 
    paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' 
  },
  quickLogBtnDisabled: { opacity: 0.5 },
  quickLogBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // Charts styles
  chartsContainer: { gap: 20, marginBottom: 24 },
  chartCard: { 
    backgroundColor: '#151622', padding: 16, borderRadius: 24, 
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' 
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  chartTitle: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  chart: { marginVertical: 8, borderRadius: 16, marginLeft: -16 },

  // Filters styles
  filterContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 10 },
  filterBtn: { 
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, 
    backgroundColor: '#151622', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' 
  },
  filterBtnActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  filterText: { color: 'rgba(255, 255, 255, 0.4)', fontSize: 12, fontWeight: 'bold' },
  filterTextActive: { color: '#fff' },
});
