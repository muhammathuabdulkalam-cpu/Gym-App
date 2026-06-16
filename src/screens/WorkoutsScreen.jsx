import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LineChart } from 'react-native-chart-kit';
import { Accelerometer } from 'expo-sensors';
import {
  fetchWorkouts,
  saveWorkout,
  fetchCardioLogs,
  saveCardioLog,
  deleteCardioLog,
  updateProfile
} from '../api';
import ScreenWrapper from '../components/ScreenWrapper';
import ThouficSignature from '../components/ThouficSignature';

const { width: screenWidth } = Dimensions.get('window');
const TABS = ['Strength', 'Cardio'];
const EMPTY_SET = { reps: 10, weight: 0 };

const CARDIO_ACTIVITIES = [
  { id: 'walking',      label: 'Walking',       icon: '🚶', met: 3.5 },
  { id: 'jogging',      label: 'Jogging',       icon: '🏃', met: 7.0 },
  { id: 'running',      label: 'Running',       icon: '💨', met: 11.0 },
];

const estimateCalories = (activityId, weightKg, durationMin) => {
  const act = CARDIO_ACTIVITIES.find(a => a.id === activityId);
  if (!act || !weightKg || !durationMin) return 0;
  return Math.round(act.met * weightKg * (durationMin / 60));
};

const estimateStepCalories = (steps, weightKg) => {
  if (!steps || !weightKg) return 0;
  return Math.round(steps * 0.00040 * weightKg);
};

// Custom pedometer hook utilizing expo-sensors' Accelerometer
function useAppPedometer() {
  const [isTracking, setIsTracking] = useState(false);
  const [hasStartedSession, setHasStartedSession] = useState(false);
  const [steps, setSteps] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const stepsRef = useRef(0);
  const elapsedRef = useRef(0);
  const timerRef = useRef(null);
  const subscriptionRef = useRef(null);

  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastZ = useRef(0);
  const stepCooldown = useRef(false);

  const startTracking = () => {
    setIsTracking(true);
    setHasStartedSession(true);

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSeconds(elapsedRef.current);
    }, 1000);

    Accelerometer.setUpdateInterval(100);
    subscriptionRef.current = Accelerometer.addListener(data => {
      const { x, y, z } = data;
      const jerk = Math.abs(x + y + z - lastX.current - lastY.current - lastZ.current) / 0.1;
      
      lastX.current = x;
      lastY.current = y;
      lastZ.current = z;

      if (jerk > 12 && !stepCooldown.current) {
        stepsRef.current += 1;
        setSteps(stepsRef.current);
        stepCooldown.current = true;
        setTimeout(() => { stepCooldown.current = false; }, 350);
      }
    });
  };

  const pauseTracking = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setIsTracking(false);
  };

  const resetTracking = () => {
    pauseTracking();
    setHasStartedSession(false);
    stepsRef.current = 0;
    elapsedRef.current = 0;
    setSteps(0);
    setElapsedSeconds(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (subscriptionRef.current) subscriptionRef.current.remove();
    };
  }, []);

  return {
    steps,
    elapsedSeconds,
    isTracking,
    hasStartedSession,
    startTracking,
    pauseTracking,
    resetTracking
  };
}

export default function WorkoutsScreen() {
  const { user, updateUserProfile } = useAuth();
  const splitsOrigin = useMemo(() => user?.splitConfig || ['Push', 'Pull', 'Legs'], [user?.splitConfig]);
  const today = new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState('Cardio'); // Set Cardio active by default to match screenshot
  const [date, setDate] = useState(today);

  // Strength State
  const [workouts, setWorkouts] = useState([]);
  const [selectedSplit, setSelectedSplit] = useState('');
  const [exercises, setExercises] = useState([]);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [savingStr, setSavingStr] = useState(false);
  const [loadingStr, setLoadingStr] = useState(true);

  // Splits configuration state
  const [isEditingSplits, setIsEditingSplits] = useState(false);
  const [newSplitName, setNewSplitName] = useState('');
  const [splitConfigList, setSplitConfigList] = useState(splitsOrigin);

  // Exercise history chart modal
  const [historyExercise, setHistoryExercise] = useState(null);

  // Cardio State
  const [cardioLogs, setCardioLogs] = useState([]);
  const [manualActivity, setManualActivity] = useState('walking');
  const [manualDuration, setManualDuration] = useState('');
  const [manualSteps, setManualSteps] = useState('');
  const [savingCar, setSavingCar] = useState(false);
  const [loadingCar, setLoadingCar] = useState(true);

  // Average week toggle config
  const [avgMetric, setAvgMetric] = useState('Steps');

  // Pedometer hook
  const pedometer = useAppPedometer();

  // Load strength workouts
  const loadWorkouts = async () => {
    try {
      const data = await fetchWorkouts();
      setWorkouts(data);
    } catch {
      setWorkouts([]);
    } finally {
      setLoadingStr(false);
    }
  };

  // Load cardio logs
  const loadCardioLogs = async () => {
    try {
      const data = await fetchCardioLogs();
      setCardioLogs(data);
    } catch {
      setCardioLogs([]);
    } finally {
      setLoadingCar(false);
    }
  };

  useEffect(() => {
    loadWorkouts();
    loadCardioLogs();
  }, []);

  // Sync selected split default
  useEffect(() => {
    if (splitsOrigin.length > 0 && !selectedSplit) {
      setSelectedSplit(splitsOrigin[0]);
    }
  }, [splitsOrigin, selectedSplit]);

  // Load exercises list when date/split changes
  useEffect(() => {
    if (!selectedSplit || workouts.length === 0) return;
    const match = workouts.find(w => w.date === date && w.splitName.toLowerCase() === selectedSplit.toLowerCase());
    if (match) {
      setExercises(match.exercises || []);
    } else {
      setExercises([]);
    }
  }, [date, selectedSplit, workouts]);

  // Live calories calculation
  const liveCalories = useMemo(() => {
    const userWeight = user?.weight || 70;
    const durationMin = pedometer.elapsedSeconds / 60;
    return estimateCalories('walking', userWeight, durationMin) + estimateStepCalories(pedometer.steps, userWeight);
  }, [pedometer.steps, pedometer.elapsedSeconds, user]);

  const changeDate = (days) => {
    const current = new Date(date);
    current.setDate(current.getDate() + days);
    setDate(current.toISOString().split('T')[0]);
  };

  const formatTimer = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Add exercise to strength
  const handleAddExercise = () => {
    if (!newExerciseName.trim()) return;
    setExercises(prev => [...prev, { name: newExerciseName, sets: [{ ...EMPTY_SET }] }]);
    setNewExerciseName('');
  };

  const handleRemoveExercise = (exIdx) => {
    setExercises(prev => prev.filter((_, idx) => idx !== exIdx));
  };

  const handleAddSet = (exIdx) => {
    setExercises(prev => prev.map((ex, idx) => {
      if (idx !== exIdx) return ex;
      return { ...ex, sets: [...ex.sets, { ...EMPTY_SET }] };
    }));
  };

  const handleRemoveSet = (exIdx, setIdx) => {
    setExercises(prev => prev.map((ex, idx) => {
      if (idx !== exIdx) return ex;
      return { ...ex, sets: ex.sets.filter((_, sIdx) => sIdx !== setIdx) };
    }));
  };

  const handleSetChange = (exIdx, setIdx, field, val) => {
    setExercises(prev => prev.map((ex, idx) => {
      if (idx !== exIdx) return ex;
      const updatedSets = ex.sets.map((set, sIdx) => {
        if (sIdx !== setIdx) return set;
        return { ...set, [field]: Number(val) || 0 };
      });
      return { ...ex, sets: updatedSets };
    }));
  };

  // Save strength routine
  const handleSaveWorkout = async () => {
    if (!selectedSplit) return;
    setSavingStr(true);
    try {
      await saveWorkout({
        date,
        splitName: selectedSplit,
        exercises
      });
      await loadWorkouts();
      Alert.alert('Success', 'Routine saved successfully!');
    } catch {
      Alert.alert('Error', 'Failed to save workout routine.');
    } finally {
      setSavingStr(false);
    }
  };

  // Save splits setup config
  const handleSaveSplitsConfig = async () => {
    try {
      const updated = await updateProfile({ splitConfig: splitConfigList });
      updateUserProfile(updated);
      setIsEditingSplits(false);
      Alert.alert('Success', 'Workout splits updated!');
    } catch {
      Alert.alert('Error', 'Failed to update splits config.');
    }
  };

  const handleAddSplitType = () => {
    if (!newSplitName.trim()) return;
    if (splitConfigList.includes(newSplitName)) return;
    setSplitConfigList(prev => [...prev, newSplitName]);
    setNewSplitName('');
  };

  const handleRemoveSplitType = (name) => {
    setSplitConfigList(prev => prev.filter(s => s !== name));
  };

  // Save pedometer logs
  const handleSavePedometer = async () => {
    if (pedometer.steps === 0 && pedometer.elapsedSeconds === 0) return;
    setSavingCar(true);
    try {
      const userWeight = user?.weight || 70;
      const durationMin = pedometer.elapsedSeconds / 60;
      const calories = liveCalories;
      
      await saveCardioLog({
        date,
        activity: 'walking',
        duration: Math.round(durationMin),
        steps: pedometer.steps,
        caloriesBurned: calories
      });
      pedometer.resetTracking();
      await loadCardioLogs();
      Alert.alert('Success', 'Pedometer session logged!');
    } catch {
      Alert.alert('Error', 'Failed to save session.');
    } finally {
      setSavingCar(false);
    }
  };

  // Save manual logs
  const handleSaveManualCardio = async () => {
    const durNum = Number(manualDuration) || 0;
    const stepNum = Number(manualSteps) || 0;
    if (durNum <= 0) {
      Alert.alert('Error', 'Please enter a valid duration.');
      return;
    }
    setSavingCar(true);
    try {
      const userWeight = user?.weight || 70;
      const calories = estimateCalories(manualActivity, userWeight, durNum) + estimateStepCalories(stepNum, userWeight);

      await saveCardioLog({
        date,
        activity: manualActivity,
        duration: durNum,
        steps: stepNum,
        caloriesBurned: calories
      });
      setManualDuration('');
      setManualSteps('');
      await loadCardioLogs();
      Alert.alert('Success', 'Cardio activity logged!');
    } catch {
      Alert.alert('Error', 'Failed to save log.');
    } finally {
      setSavingCar(false);
    }
  };

  const handleDeleteCardioLog = async (logId) => {
    Alert.alert('Delete Log', 'Delete this cardio activity?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCardioLog(date, logId);
            await loadCardioLogs();
          } catch {
            Alert.alert('Error', 'Failed to delete log.');
          }
        }
      }
    ]);
  };

  const filteredCardioLogs = useMemo(() => {
    return cardioLogs.filter(c => c.date === date);
  }, [cardioLogs, date]);

  // Average week calculation logic matching screenshots
  const averageMetrics = useMemo(() => {
    const past7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });

    const stepsMap = {};
    past7Days.forEach(d => { stepsMap[d] = 0; });
    
    cardioLogs.forEach(log => {
      if (stepsMap[log.date] !== undefined) {
        stepsMap[log.date] += log.steps || 0;
      }
    });

    const values = Object.values(stepsMap);
    const sum = values.reduce((s, v) => s + v, 0);
    const avg = values.length ? Math.round(sum / values.length) : 0;

    // Find best day of the week
    const weekdaySum = [0, 0, 0, 0, 0, 0, 0];
    cardioLogs.forEach(log => {
      const day = new Date(log.date).getDay();
      weekdaySum[day] += log.steps || 0;
    });

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDayIdx = 6; // default Saturday
    let maxSteps = -1;
    weekdaySum.forEach((val, idx) => {
      if (val > maxSteps) {
        maxSteps = val;
        bestDayIdx = idx;
      }
    });

    return {
      averageValue: sum > 0 ? avg : 0,
      bestDay: sum > 0 ? weekdays[bestDayIdx] : 'Saturday'
    };
  }, [cardioLogs]);

  // Exercise history chart data mapping
  const exerciseHistoryChartData = useMemo(() => {
    if (!historyExercise) return null;
    const points = workouts
      .map(w => {
        const ex = w.exercises.find(e => e.name.toLowerCase() === historyExercise.toLowerCase());
        if (!ex || !ex.sets.length) return null;
        const maxWt = Math.max(...ex.sets.map(s => Number(s.weight) || 0));
        return {
          date: new Date(w.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          rawDate: w.date,
          maxWt
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .slice(-6);

    if (points.length < 2) return null;
    return {
      labels: points.map(p => p.date),
      datasets: [{ data: points.map(p => p.maxWt) }]
    };
  }, [historyExercise, workouts]);

  return (
    <ScreenWrapper>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            
            {/* Header matching Workout & Cardio screenshot */}
            <View style={styles.header}>
              <View style={styles.headerIconContainer}>
                <MaterialCommunityIcons name="dumbbell" size={26} color="#fff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Workout & Cardio</Text>
                <Text style={styles.headerSubtitle}>Strength · Cardio Tracking</Text>
              </View>
            </View>

            {/* Date Selector */}
            <View style={styles.dateSelector}>
              <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateChevron}>
                <MaterialCommunityIcons name="chevron-left" size={20} color="rgba(255, 255, 255, 0.6)" />
              </TouchableOpacity>
              <View style={styles.dateTextContainer}>
                <MaterialCommunityIcons name="calendar-today" size={14} color="rgba(255, 255, 255, 0.4)" />
                <Text style={styles.dateText}>{date === today ? 'Today' : date}</Text>
              </View>
              <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateChevron}>
                <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255, 255, 255, 0.6)" />
              </TouchableOpacity>
            </View>

            {/* Tab Pill Selection matching screenshots */}
            <View style={styles.tabContainer}>
              {TABS.map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* STRENGTH ROUTINE TAB */}
            {activeTab === 'Strength' && (
              <View style={styles.tabContent}>
                {/* Splits Selector Header */}
                <View style={styles.splitsHeader}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.splitsChips}>
                    {splitsOrigin.map(split => (
                      <TouchableOpacity
                        key={split}
                        style={[styles.splitChip, selectedSplit === split && styles.splitChipActive]}
                        onPress={() => setSelectedSplit(split)}
                      >
                        <Text style={[styles.splitChipText, selectedSplit === split && styles.splitChipTextActive]}>
                          {split}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity style={styles.editSplitsBtn} onPress={() => setIsEditingSplits(true)}>
                    <MaterialCommunityIcons name="cog-outline" size={20} color="rgba(255, 255, 255, 0.4)" />
                  </TouchableOpacity>
                </View>

                {loadingStr ? (
                  <ActivityIndicator color="#a78bfa" size="large" style={{ marginTop: 30 }} />
                ) : (
                  <View style={styles.exercisesList}>
                    {exercises.map((ex, exIdx) => (
                      <View key={exIdx} style={styles.exerciseCard}>
                        <View style={styles.exerciseCardHeader}>
                          <Text style={styles.exerciseTitle}>{ex.name}</Text>
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={() => setHistoryExercise(ex.name)}>
                              <MaterialCommunityIcons name="trending-up" size={20} color="#a78bfa" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleRemoveExercise(exIdx)}>
                              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#f87171" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={styles.setsHeader}>
                          <Text style={[styles.setHeaderText, { flex: 0.5 }]}>Set</Text>
                          <Text style={[styles.setHeaderText, { flex: 1.2 }]}>Weight (kg)</Text>
                          <Text style={[styles.setHeaderText, { flex: 1.2 }]}>Reps</Text>
                          <Text style={[styles.setHeaderText, { flex: 0.5 }]}></Text>
                        </View>

                        {ex.sets.map((set, setIdx) => (
                          <View key={setIdx} style={styles.setRow}>
                            <Text style={styles.setIndex}>{setIdx + 1}</Text>
                            <TextInput
                              style={styles.setInput}
                              keyboardType="numeric"
                              value={String(set.weight)}
                              onChangeText={v => handleSetChange(exIdx, setIdx, 'weight', v)}
                            />
                            <TextInput
                              style={styles.setInput}
                              keyboardType="numeric"
                              value={String(set.reps)}
                              onChangeText={v => handleSetChange(exIdx, setIdx, 'reps', v)}
                            />
                            <TouchableOpacity style={styles.deleteSetBtn} onPress={() => handleRemoveSet(exIdx, setIdx)}>
                              <MaterialCommunityIcons name="close" size={16} color="rgba(255,255,255,0.3)" />
                            </TouchableOpacity>
                          </View>
                        ))}

                        <TouchableOpacity style={styles.addSetBtn} onPress={() => handleAddSet(exIdx)}>
                          <Text style={styles.addSetBtnText}>+ Add Set</Text>
                        </TouchableOpacity>
                      </View>
                    ))}

                    {/* Add Exercise Row */}
                    <View style={styles.addExRow}>
                      <TextInput
                        style={styles.addExInput}
                        placeholder="New Exercise Name"
                        placeholderTextColor="rgba(255, 255, 255, 0.2)"
                        value={newExerciseName}
                        onChangeText={setNewExerciseName}
                      />
                      <TouchableOpacity style={styles.addExBtn} onPress={handleAddExercise}>
                        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                      </TouchableOpacity>
                    </View>

                    {/* Save Split Routine */}
                    <TouchableOpacity style={styles.saveRoutineBtn} onPress={handleSaveWorkout} disabled={savingStr}>
                      {savingStr ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.saveRoutineBtnText}>Save Routine</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* CARDIO TRACKING TAB */}
            {activeTab === 'Cardio' && (
              <View style={styles.tabContent}>
                
                {/* Step Counter(Walking) Card matching screenshots */}
                <View style={styles.cardioCard}>
                  <View style={styles.cardioCardHeader}>
                    <Text style={styles.cardioSectionTitle}>Step Counter(Walking)</Text>
                    {/* Sensor Ready Badge */}
                    <View style={styles.sensorBadge}>
                      <View style={styles.sensorDot} />
                      <Text style={styles.sensorText}>Sensor Ready</Text>
                    </View>
                  </View>

                  {/* Live metrics values grid */}
                  <View style={styles.liveMetricsGrid}>
                    <View style={styles.liveMetricItem}>
                      <Text style={styles.liveMetricVal}>
                        {pedometer.hasStartedSession ? pedometer.steps : '—'}
                      </Text>
                      <Text style={styles.liveMetricLabel}>STEPS</Text>
                    </View>
                    <View style={styles.liveMetricItem}>
                      <Text style={styles.liveMetricVal}>
                        {pedometer.hasStartedSession ? liveCalories : '—'}
                      </Text>
                      <Text style={styles.liveMetricLabel}>CALORIES</Text>
                    </View>
                    <View style={styles.liveMetricItem}>
                      <Text style={[styles.liveMetricVal, { color: '#a78bfa' }]}>
                        {pedometer.hasStartedSession ? formatTimer(pedometer.elapsedSeconds) : '00:00'}
                      </Text>
                      <Text style={styles.liveMetricLabel}>TIME</Text>
                    </View>
                  </View>

                  {/* Large start play/pause controls */}
                  <TouchableOpacity
                    style={[styles.bigPlayBtn, pedometer.isTracking && styles.bigPlayBtnPause]}
                    activeOpacity={0.8}
                    onPress={pedometer.isTracking ? pedometer.pauseTracking : pedometer.startTracking}
                  >
                    <MaterialCommunityIcons
                      name={pedometer.isTracking ? "pause" : "play"}
                      size={28}
                      color="#fff"
                    />
                  </TouchableOpacity>

                  {/* Actions row for custom tracking */}
                  {pedometer.hasStartedSession && (
                    <View style={styles.trackingActionButtons}>
                      <TouchableOpacity style={[styles.miniCtrlBtn, styles.btnReset]} onPress={pedometer.resetTracking}>
                        <Text style={styles.btnTextReset}>Reset</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.miniCtrlBtn, styles.btnSave]} onPress={handleSavePedometer} disabled={savingCar}>
                        {savingCar ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnTextSave}>Save Session</Text>}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Average Week Card matching screenshots */}
                <View style={styles.averageWeekCard}>
                  <View style={styles.averageWeekHeader}>
                    <Text style={styles.averageWeekTitle}>Average Week</Text>
                    <View style={styles.bestDayBadge}>
                      <Text style={styles.bestDayLabel}>BEST DAY</Text>
                      <View style={styles.bestDayDivider} />
                      <Text style={styles.bestDayText}>{averageMetrics.bestDay}</Text>
                    </View>
                  </View>

                  <Text style={styles.averageStepsText}>{averageMetrics.averageValue}</Text>

                  {/* Toggle Chips */}
                  <View style={styles.avgChipsContainer}>
                    {['Steps', 'Calories', 'Time'].map(metric => (
                      <TouchableOpacity
                        key={metric}
                        style={[styles.avgChip, avgMetric === metric && styles.avgChipActive]}
                        onPress={() => setAvgMetric(metric)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.avgChipText, avgMetric === metric && styles.avgChipTextActive]}>
                          {metric}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Manual Log Cardio Section */}
                <View style={styles.manualCard}>
                  <Text style={styles.manualTitle}>Manual Cardio Entry</Text>
                  
                  {/* Select Activity */}
                  <View style={styles.activityChipsRow}>
                    {CARDIO_ACTIVITIES.map(a => (
                      <TouchableOpacity
                        key={a.id}
                        style={[styles.activityChip, manualActivity === a.id && styles.activityChipActive]}
                        onPress={() => setManualActivity(a.id)}
                      >
                        <Text style={styles.activityChipEmoji}>{a.icon}</Text>
                        <Text style={[styles.activityChipText, manualActivity === a.id && styles.activityChipTextActive]}>
                          {a.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={[styles.inputWrapper, { flex: 1.2 }]}>
                      <TextInput
                        style={styles.manualInput}
                        placeholder="Minutes"
                        placeholderTextColor="rgba(255, 255, 255, 0.2)"
                        keyboardType="numeric"
                        value={manualDuration}
                        onChangeText={setManualDuration}
                      />
                    </View>
                    <View style={[styles.inputWrapper, { flex: 1.5 }]}>
                      <TextInput
                        style={styles.manualInput}
                        placeholder="Steps (Optional)"
                        placeholderTextColor="rgba(255, 255, 255, 0.2)"
                        keyboardType="numeric"
                        value={manualSteps}
                        onChangeText={setManualSteps}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.manualPlusBtn}
                      onPress={handleSaveManualCardio}
                      disabled={savingCar || !manualDuration}
                    >
                      {savingCar ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="plus" size={24} color="#fff" />}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Cardio list history */}
                {filteredCardioLogs.length > 0 && (
                  <View style={styles.cardioHistoryContainer}>
                    <Text style={styles.manualTitle}>Cardio History</Text>
                    {filteredCardioLogs.map(log => (
                      <View key={log._id} style={styles.cardioHistoryItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardioHistoryName}>
                            {log.activity.charAt(0).toUpperCase() + log.activity.slice(1)}
                          </Text>
                          <Text style={styles.cardioHistoryDesc}>
                            {log.duration} mins • {log.steps || 0} steps
                          </Text>
                        </View>
                        <Text style={styles.cardioHistoryCal}>{log.caloriesBurned} kcal</Text>
                        <TouchableOpacity onPress={() => handleDeleteCardioLog(log._id)} style={styles.trashBtn}>
                          <MaterialCommunityIcons name="trash-can-outline" size={18} color="#f87171" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Splits Configuration Modal */}
            <Modal visible={isEditingSplits} animationType="slide" transparent>
              <View style={styles.modalBg}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Workout Splits Routine</Text>
                  
                  <View style={styles.splitsConfigList}>
                    {splitConfigList.map(s => (
                      <View key={s} style={styles.configItemRow}>
                        <Text style={styles.configItemText}>{s}</Text>
                        <TouchableOpacity onPress={() => handleRemoveSplitType(s)} style={styles.configRemoveBtn}>
                          <MaterialCommunityIcons name="close-circle" size={20} color="#f87171" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  <View style={styles.configAddRow}>
                    <TextInput
                      style={styles.configInput}
                      placeholder="Add split name (e.g. Chest)"
                      placeholderTextColor="rgba(255, 255, 255, 0.2)"
                      value={newSplitName}
                      onChangeText={setNewSplitName}
                    />
                    <TouchableOpacity style={styles.configAddBtn} onPress={handleAddSplitType}>
                      <Text style={styles.configAddBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setIsEditingSplits(false)}>
                      <Text style={styles.modalBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSaveSplitsConfig}>
                      <Text style={styles.modalBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Exercise history modal */}
            <Modal visible={!!historyExercise} animationType="fade" transparent>
              <View style={styles.modalBg}>
                <View style={styles.modalCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={styles.modalTitle} numberOfLines={1}>{historyExercise} History</Text>
                    <TouchableOpacity onPress={() => setHistoryExercise(null)}>
                      <MaterialCommunityIcons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {exerciseHistoryChartData ? (
                    <View style={{ alignItems: 'center' }}>
                      <LineChart
                        data={exerciseHistoryChartData}
                        width={screenWidth - 80}
                        height={180}
                        chartConfig={{
                          backgroundColor: 'transparent',
                          backgroundGradientFrom: '#151622',
                          backgroundGradientTo: '#151622',
                          decimalPlaces: 1,
                          color: (opacity = 1) => `rgba(167, 139, 250, ${opacity})`,
                          labelColor: () => 'rgba(255, 255, 255, 0.4)',
                          propsForDots: { r: '4', strokeWidth: '2', stroke: '#a78bfa' },
                          propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.02)' }
                        }}
                        bezier
                      />
                    </View>
                  ) : (
                    <Text style={styles.noHistoryText}>Log at least two strength sessions for this exercise to generate history.</Text>
                  )}
                </View>
              </View>
            </Modal>

            {/* Signature at bottom */}
            <ThouficSignature />
          </ScrollView>
        </KeyboardAvoidingView>
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
    alignItems: 'center', 
    marginBottom: 20, 
    gap: 14,
    marginTop: 10
  },
  headerIconContainer: { 
    width: 46, 
    height: 46, 
    borderRadius: 14, 
    backgroundColor: '#7c3aed', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', marginTop: 4 },

  // Date Selector styles
  dateSelector: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: '#151622', 
    padding: 8, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)', 
    marginBottom: 20, 
    maxWidth: 180 
  },
  dateChevron: { padding: 4 },
  dateTextContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  // Tab Selection styles (pill selector container)
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#101018', 
    borderRadius: 14, 
    padding: 4, 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    marginBottom: 24 
  },
  tab: { 
    flex: 1, 
    paddingVertical: 10, 
    borderRadius: 11, 
    alignItems: 'center' 
  },
  tabActive: { 
    backgroundColor: '#1c1d29' 
  },
  tabText: { 
    color: 'rgba(255, 255, 255, 0.4)', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  tabTextActive: { 
    color: '#ffffff' 
  },

  tabContent: { gap: 16 },

  // CARDIO TRACKING TAB STYLES
  // Step Counter Card
  cardioCard: { 
    backgroundColor: '#151622', 
    borderRadius: 24, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)', 
    padding: 20,
    marginBottom: 10
  },
  cardioCardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 24
  },
  cardioSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  sensorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 6
  },
  sensorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981'
  },
  sensorText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5
  },

  // Live Metrics Grid (3 columns)
  liveMetricsGrid: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    marginBottom: 28,
    width: '100%'
  },
  liveMetricItem: { 
    flex: 1, 
    alignItems: 'center' 
  },
  liveMetricVal: { 
    fontSize: 26, 
    fontWeight: '900', 
    color: '#fff' 
  },
  liveMetricLabel: { 
    fontSize: 9, 
    color: 'rgba(255, 255, 255, 0.3)', 
    fontWeight: 'bold',
    marginTop: 6,
    letterSpacing: 0.5
  },

  // Big Play Start controls
  bigPlayBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigPlayBtnPause: {
    backgroundColor: '#7c3aed',
  },

  // Mini controls inside cardio
  trackingActionButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  miniCtrlBtn: { flex: 1, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnReset: { backgroundColor: 'rgba(244, 63, 94, 0.08)', borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.2)' },
  btnSave: { backgroundColor: '#7c3aed' },
  btnTextReset: { color: '#f87171', fontWeight: 'bold', fontSize: 13 },
  btnTextSave: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Average Week Card matching screenshots
  averageWeekCard: {
    backgroundColor: '#151622',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    marginBottom: 10
  },
  averageWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  averageWeekTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff'
  },
  bestDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101018',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 6
  },
  bestDayLabel: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5
  },
  bestDayDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  bestDayText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold'
  },
  averageStepsText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 20
  },
  avgChipsContainer: {
    flexDirection: 'row',
    gap: 8
  },
  avgChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#101018',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)'
  },
  avgChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981'
  },
  avgChipText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontWeight: 'bold'
  },
  avgChipTextActive: {
    color: '#fff'
  },

  // Manual Log Cardio card
  manualCard: { 
    backgroundColor: '#151622', 
    padding: 20, 
    borderRadius: 24, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 10
  },
  manualTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff', marginBottom: 14 },
  activityChipsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  activityChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101018', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.04)', gap: 6 },
  activityChipActive: { backgroundColor: 'rgba(124, 58, 237, 0.15)', borderColor: '#7c3aed' },
  activityChipEmoji: { fontSize: 13 },
  activityChipText: { fontSize: 12, color: 'rgba(255, 255, 255, 0.4)', fontWeight: 'bold' },
  activityChipTextActive: { color: '#fff' },
  
  inputWrapper: { 
    height: 48, 
    backgroundColor: '#0a0a0f', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 14,
    justifyContent: 'center'
  },
  manualInput: { color: '#fff', fontSize: 14, fontWeight: 'bold', height: '100%' },
  manualPlusBtn: { 
    width: 48, 
    height: 48, 
    borderRadius: 12, 
    backgroundColor: '#7c3aed', 
    justifyContent: 'center', 
    alignItems: 'center',
  },

  // Cardio List items
  cardioHistoryContainer: { backgroundColor: '#151622', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', marginBottom: 10 },
  cardioHistoryItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0f', padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  cardioHistoryName: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  cardioHistoryDesc: { fontSize: 11, color: 'rgba(255, 255, 255, 0.3)', marginTop: 4, fontWeight: 'bold' },
  cardioHistoryCal: { color: '#f97316', fontWeight: '900', fontSize: 15, marginRight: 12 },
  trashBtn: { padding: 6, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 8 },

  // STRENGTH STYLES
  splitsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  splitsChips: { flex: 1, marginRight: 10 },
  splitChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#151622', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.04)', marginRight: 8 },
  splitChipActive: { backgroundColor: 'rgba(124, 58, 237, 0.15)', borderColor: '#7c3aed' },
  splitChipText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 'bold' },
  splitChipTextActive: { color: '#fff' },
  editSplitsBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#151622', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.04)', justifyContent: 'center', alignItems: 'center' },

  exercisesList: { gap: 14 },
  exerciseCard: { backgroundColor: '#151622', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', padding: 16 },
  exerciseCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  exerciseTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  setsHeader: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 8 },
  setHeaderText: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  setRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0f', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, borderHorizontalWidth: 1, borderColor: 'rgba(255,255,255,0.03)', marginBottom: 8 },
  setIndex: { flex: 0.5, color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  setInput: { flex: 1.2, backgroundColor: '#151622', borderRadius: 8, color: '#fff', padding: 8, fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginHorizontal: 4, height: 36, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.04)' },
  deleteSetBtn: { flex: 0.5, alignItems: 'center', padding: 4 },

  addSetBtn: { paddingVertical: 8, alignSelf: 'flex-start', marginTop: 6, marginLeft: 4 },
  addSetBtnText: { color: '#a78bfa', fontSize: 13, fontWeight: 'bold' },

  addExRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  addExInput: { flex: 1, backgroundColor: '#151622', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', color: '#fff', paddingHorizontal: 16, height: 46, fontSize: 14, fontWeight: 'bold' },
  addExBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },

  saveRoutineBtn: { backgroundColor: '#7c3aed', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 14 },
  saveRoutineBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // MODAL STYLES
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#151622', width: '100%', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', padding: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  noHistoryText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 18, textAlign: 'center', marginVertical: 32 },

  splitsConfigList: { gap: 8, marginBottom: 16 },
  configItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0f', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.04)' },
  configItemText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  configRemoveBtn: { padding: 2 },

  configAddRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  configInput: { flex: 1, backgroundColor: '#0a0a0f', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', color: '#fff', paddingHorizontal: 14, height: 44, fontSize: 13 },
  configAddBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center' },
  configAddBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalBtnCancel: { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  modalBtnSave: { backgroundColor: '#7c3aed' },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' }
});
