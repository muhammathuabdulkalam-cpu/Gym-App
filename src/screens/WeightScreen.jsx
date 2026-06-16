import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LineChart } from 'react-native-chart-kit';
import {
  fetchWeightLogs,
  saveWeightLog,
  deleteWeightLog,
  updateProfile,
} from '../api';
import ScreenWrapper from '../components/ScreenWrapper';
import ThouficSignature from '../components/ThouficSignature';

const { width: screenWidth } = Dimensions.get('window');

// ─── Insight engine — only exact, data-driven messages ──────────────────────
function buildInsight(logs, goalWeight, goalType) {
  if (!logs || logs.length === 0) return null;

  const latest   = Number(logs[0]?.weight);
  const oldest   = Number(logs[logs.length - 1]?.weight);
  const totalDiff = Number((latest - oldest).toFixed(1));
  const goal      = goalWeight ? Number(goalWeight) : null;

  const result = {
    journey: null,
    goal: null,
    achieved: false,
    weekly: null,
    progress: null, // 0-1 progress toward goal
  };

  // ── 1. Journey summary (always shown if >1 log) ──────────────────────────
  if (logs.length > 1) {
    if (totalDiff < 0) {
      result.journey = `You have lost ${Math.abs(totalDiff)} kg since you started — outstanding discipline!`;
    } else if (totalDiff > 0) {
      result.journey = `You have gained ${totalDiff} kg since you started — building serious mass!`;
    } else {
      result.journey = `Your weight has stayed perfectly stable since you started tracking — great consistency!`;
    }
  }

  // ── 2. Goal-specific message (only if goal is set) ───────────────────────
  if (goal && latest) {
    const toGoal = Number((goal - latest).toFixed(1));

    if (goalType === 'loss') {
      const startDiff = oldest - latest; // how much lost so far
      result.progress = startDiff > 0 && oldest > goal
        ? Math.min(startDiff / (oldest - goal), 1)
        : latest <= goal ? 1 : 0;

      if (latest <= goal) {
        // GOAL ACHIEVED
        result.achieved = true;
        result.goal = `You have reached your target of ${goal} kg! Goal complete!`;
      } else {
        result.goal = `${toGoal} kg left to reach your goal of ${goal} kg. Stay consistent!`;
      }
    } else {
      // gain
      const startDiff = latest - oldest;
      result.progress = startDiff > 0 && goal > oldest
        ? Math.min(startDiff / (goal - oldest), 1)
        : latest >= goal ? 1 : 0;

      if (latest >= goal) {
        result.achieved = true;
        result.goal = `Bulk goal of ${goal} kg achieved! You crushed it!`;
      } else {
        const needed = Math.abs(toGoal);
        result.goal = `${needed} kg more to gain to hit your target of ${goal} kg. Keep fueling!`;
      }
    }
  }

  // ── 3. Weekly trend (only if 7+ logs) ────────────────────────────────────
  if (logs.length >= 7) {
    const weekDiff = Number((logs[0].weight - logs[6].weight).toFixed(1));
    if (weekDiff < 0) {
      result.weekly = `This week you are down ${Math.abs(weekDiff)} kg — excellent week!`;
    } else if (weekDiff > 0) {
      result.weekly = `This week you are up ${weekDiff} kg.${goalType === 'loss' ? ' Watch your intake.' : ' Great bulking progress!'}`;
    } else {
      result.weekly = `Your weight held steady this week — consistent and controlled.`;
    }
  }

  return result;
}

export default function WeightScreen() {
  const { user, updateUserProfile } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate]               = useState(today);
  const [inputWeight, setInputWeight] = useState('');
  const [weightLogs, setWeightLogs]   = useState([]);
  const [saving, setSaving]           = useState(false);
  const [loading, setLoading]         = useState(true);

  // ── Goal state (synced with user profile) ─────────────────────────────────
  const goalWeight = user?.goalWeight ? String(user.goalWeight) : '';
  const goalType = user?.goalType || 'loss';
  const [goalInput, setGoalInput]     = useState(goalWeight);
  const [goalTypeInput, setGoalTypeInput] = useState(goalType);
  const [showGoalInput, setShowGoalInput] = useState(false);

  // ── Calendar state ────────────────────────────────────────────────────────
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day');

  const calendarMonths = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ], []);
  
  const weekdays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);

  const handlePrevMonth = () => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const handleSelectDay = (dayDate) => {
    const yyyy = dayDate.getFullYear();
    const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dayDate.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
    setIsCalendarVisible(false);
  };
  const handleSelectYear = (year) => {
    setCalendarDate(prev => new Date(year, prev.getMonth(), 1));
    setViewMode('day');
  };

  const daysGrid = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startPadding = firstDay.getDay(); 
    const days = [];
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
    }
    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= totalDays; i++) {
      days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }
    return days;
  }, [calendarDate]);

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= 1940; y--) years.push(y);
    return years;
  }, []);

  // ── Animations ────────────────────────────────────────────────────────────
  const bannerOpacity    = useRef(new Animated.Value(0)).current;
  const bannerTranslateY = useRef(new Animated.Value(24)).current;
  const statScale        = useRef(new Animated.Value(0.8)).current;
  const insightOpacity   = useRef(new Animated.Value(0)).current;
  const progressWidth    = useRef(new Animated.Value(0)).current;
  const achievePulse     = useRef(new Animated.Value(1)).current;
  const achieveGlow      = useRef(new Animated.Value(0)).current;
  const logFlash         = useRef(new Animated.Value(0)).current;

  // Update goalInput when goalWeight from user changes
  useEffect(() => {
    setGoalInput(goalWeight);
    setGoalTypeInput(goalType);
  }, [goalWeight, goalType]);

  // ── Fetch logs ────────────────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    try {
      const data = await fetchWeightLogs();
      setWeightLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Weight logs fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, []);

  // ── Run animations when data + goal are ready ─────────────────────────────
  const insight = useMemo(
    () => buildInsight(weightLogs, goalWeight, goalType),
    [weightLogs, goalWeight, goalType]
  );

  useEffect(() => {
    if (loading || weightLogs.length === 0) return;

    // Banner + stats entrance
    Animated.parallel([
      Animated.timing(bannerOpacity,    { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.spring(bannerTranslateY, { toValue: 0, friction: 7, tension: 55, useNativeDriver: true }),
      Animated.spring(statScale,        { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.timing(insightOpacity,   { toValue: 1, duration: 700, delay: 300, useNativeDriver: true }),
    ]).start();

    // Progress bar (if goal set)
    if (insight?.progress !== null && insight?.progress !== undefined) {
      Animated.timing(progressWidth, {
        toValue: insight.progress,
        duration: 1200,
        delay: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // width can't use native driver
      }).start();
    }

    // Celebration pulse if achieved
    if (insight?.achieved) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(achievePulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
          Animated.timing(achievePulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(achieveGlow, { toValue: 1, duration: 900, useNativeDriver: false }),
          Animated.timing(achieveGlow, { toValue: 0, duration: 900, useNativeDriver: false }),
        ])
      ).start();
    }
  }, [loading, weightLogs.length, insight?.achieved, insight?.progress]);

  // ── Log weight ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!inputWeight || Number(inputWeight) <= 0) {
      Alert.alert('Invalid', 'Please enter a valid weight in kg.');
      return;
    }
    setSaving(true);
    try {
      await saveWeightLog({ date, weight: Number(inputWeight) });
      const updatedUser = await updateProfile({ weight: Number(inputWeight) });
      updateUserProfile(updatedUser);
      setInputWeight('');
      await loadLogs();

      // Flash animation on log card
      Animated.sequence([
        Animated.timing(logFlash, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(logFlash, { toValue: 0, duration: 400, useNativeDriver: false }),
      ]).start();

      Alert.alert('Logged! 💪', `${inputWeight} kg saved for ${date}.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to log weight. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Remove Entry', 'Delete this weight entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteWeightLog(id); await loadLogs(); }
          catch { Alert.alert('Error', 'Failed to delete.'); }
        }
      }
    ]);
  };

  const handleSetGoal = async () => {
    if (!goalInput || Number(goalInput) <= 0) {
      Alert.alert('Invalid', 'Enter a valid goal weight in kg.'); return;
    }
    setShowGoalInput(false);
    progressWidth.setValue(0);
    try {
      const serverUser = await updateProfile({ goalWeight: Number(goalInput), goalType: goalTypeInput });
      // Force local application of the goal to bypass production backend if it hasn't been deployed yet
      updateUserProfile({ ...serverUser, goalWeight: Number(goalInput), goalType: goalTypeInput });
    } catch (e) {
      Alert.alert('Error', 'Failed to save goal.');
    }
  };

  const handleClearGoal = () => {
    Alert.alert('Clear Goal', 'Remove your current weight goal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          progressWidth.setValue(0);
          setGoalInput('');
          try {
            const serverUser = await updateProfile({ goalWeight: null });
            updateUserProfile({ ...serverUser, goalWeight: null });
          } catch (e) {}
        }
      }
    ]);
  };

  const handleEdit = (log) => {
    setDate(log.date);
    setInputWeight(String(log.weight));
    Alert.alert('Edit Mode', `Editing entry for ${log.date}. You can now change the weight and tap the checkmark to save.`);
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const latestWeight = weightLogs[0]?.weight ?? user?.weight ?? null;
  const startWeight  = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : null;
  const totalChange  = (latestWeight && startWeight) ? Number((latestWeight - startWeight).toFixed(1)) : null;

  const chartData = useMemo(() =>
    [...weightLogs].sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
    [weightLogs]
  );
  const chartConfigData = useMemo(() => {
    if (chartData.length < 2) return null;
    const labels = chartData.map((d, i) => {
      const lbl = new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (chartData.length <= 5) return lbl;
      return (i === 0 || i === chartData.length - 1 || i === Math.floor(chartData.length / 2)) ? lbl : '';
    });
    return { labels, datasets: [{ data: chartData.map(d => d.weight) }] };
  }, [chartData]);

  // Animated glow border color
  const glowColor = achieveGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(52, 211, 153, 0.15)', 'rgba(52, 211, 153, 0.55)'],
  });
  const logFlashBg = logFlash.interpolate({
    inputRange: [0, 1],
    outputRange: ['#151622', 'rgba(124, 58, 237, 0.25)'],
  });

  return (
    <ScreenWrapper>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* ── Header ───────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerIconContainer}>
              <MaterialCommunityIcons name="scale-bathroom" size={26} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Weight Tracker</Text>
              <Text style={styles.headerSubtitle}>Track. Analyse. Achieve.</Text>
            </View>
          </View>

          {/* ── Log Weight Card ───────────────────────────────────────────── */}
          <Animated.View style={[styles.logCard, { backgroundColor: logFlashBg }]}>
            <Text style={styles.logTitle}>Log Today's Weight</Text>
            <View style={styles.logInputRow}>
              <View style={[styles.inputWrapper, { flex: 1.2 }]}>
                <TextInput
                  style={styles.logInput}
                  value={inputWeight}
                  onChangeText={setInputWeight}
                  placeholder="Weight (kg)"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity 
                style={[styles.inputWrapper, { flex: 1.5 }]}
                onPress={() => {
                  let initialDate = new Date();
                  if (date) {
                    const parsed = new Date(date);
                    if (!isNaN(parsed.getTime())) initialDate = parsed;
                  }
                  setCalendarDate(initialDate);
                  setIsCalendarVisible(true);
                  setViewMode('day');
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: date ? '#fff' : 'rgba(255,255,255,0.2)', fontSize: 16 }}>
                  {date || 'YYYY-MM-DD'}
                </Text>
                <MaterialCommunityIcons name="calendar-month" size={18} color="rgba(255, 255, 255, 0.3)" style={{ position: 'absolute', right: 12 }} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.plusBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialCommunityIcons name="check" size={22} color="#fff" />
                }
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── Animated Stats Banner ────────────────────────────────────── */}
          {!loading && weightLogs.length > 0 && (
            <Animated.View style={[
              styles.statsBanner,
              { opacity: bannerOpacity, transform: [{ translateY: bannerTranslateY }] }
            ]}>
              <Animated.View style={[styles.statBox, { transform: [{ scale: statScale }] }]}>
                <Text style={styles.statBoxLabel}>CURRENT</Text>
                <Text style={styles.statBoxValue}>{latestWeight}</Text>
                <Text style={styles.statBoxUnit}>kg</Text>
              </Animated.View>
              <View style={styles.statDivider} />
              <Animated.View style={[styles.statBox, { transform: [{ scale: statScale }] }]}>
                <Text style={styles.statBoxLabel}>STARTED AT</Text>
                <Text style={styles.statBoxValue}>{startWeight ?? '—'}</Text>
                <Text style={styles.statBoxUnit}>kg</Text>
              </Animated.View>
              <View style={styles.statDivider} />
              <Animated.View style={[styles.statBox, { transform: [{ scale: statScale }] }]}>
                <Text style={styles.statBoxLabel}>TOTAL CHANGE</Text>
                <Text style={[
                  styles.statBoxValue,
                  {
                    color: totalChange === null ? '#a78bfa'
                         : totalChange < 0 ? '#34d399'
                         : totalChange > 0 ? '#f87171'
                         : '#a78bfa'
                  }
                ]}>
                  {totalChange !== null ? (totalChange > 0 ? '+' : '') + totalChange : '—'}
                </Text>
                <Text style={styles.statBoxUnit}>kg</Text>
              </Animated.View>
            </Animated.View>
          )}

          {/* ── GOAL ACHIEVED Banner ─────────────────────────────────────── */}
          {insight?.achieved && (
            <Animated.View style={[
              styles.achievedBanner,
              {
                transform: [{ scale: achievePulse }],
                borderColor: glowColor,
              }
            ]}>
              <Text style={styles.achievedEmoji}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.achievedTitle}>Goal Achieved!</Text>
                <Text style={styles.achievedSubtitle}>{insight.goal}</Text>
              </View>
              <MaterialCommunityIcons name="star-circle" size={28} color="#fbbf24" />
            </Animated.View>
          )}

          {/* ── Goal Progress Bar ─────────────────────────────────────────── */}
          {goalWeight && insight && !insight.achieved && insight.progress !== null && (
            <Animated.View style={[styles.insightCard, { opacity: insightOpacity }]}>
              <View style={styles.progressHeader}>
                <Text style={styles.insightText}>{insight.goal}</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressWidth.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                      backgroundColor: goalType === 'loss' ? '#34d399' : '#f97316',
                    }
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>
                {insight.progress !== null ? `${Math.round(insight.progress * 100)}% of the way there` : ''}
              </Text>
            </Animated.View>
          )}

          {/* ── Journey + Weekly insights ─────────────────────────────────── */}
          {!loading && insight && (insight.journey || insight.weekly) && (
            <Animated.View style={[styles.journeyCard, { opacity: insightOpacity }]}>
              {insight.journey && (
                <View style={styles.insightRow}>
                  <MaterialCommunityIcons name="chart-line" size={16} color="#a78bfa" />
                  <Text style={styles.insightText}>{insight.journey}</Text>
                </View>
              )}
              {insight.weekly && (
                <View style={[styles.insightRow, insight.journey ? styles.insightRowBorder : {}]}>
                  <MaterialCommunityIcons name="calendar-week" size={16} color="#60a5fa" />
                  <Text style={styles.insightText}>{insight.weekly}</Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* ── Goal Card ─────────────────────────────────────────────────── */}
          <View style={styles.goalCard}>
            <TouchableOpacity
              style={styles.goalHeader}
              onPress={() => { setGoalInput(goalWeight); setShowGoalInput(!showGoalInput); }}
              activeOpacity={0.8}
            >
              <View style={styles.goalHeaderLeft}>
                <MaterialCommunityIcons name="flag-checkered" size={18} color="#a78bfa" />
                <Text style={styles.goalTitle}>
                  {goalWeight ? (goalType === 'loss' ? 'Weight Loss Goal' : 'Weight Gain Goal') : 'Set Your Goal'}
                </Text>
              </View>
              <View style={styles.goalHeaderRight}>
                {goalWeight ? (
                  <>
                    <Text style={styles.goalWeightDisplay}>{goalWeight} kg</Text>
                    <TouchableOpacity onPress={handleClearGoal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <MaterialCommunityIcons name="close-circle-outline" size={16} color="rgba(255,255,255,0.25)" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.goalSetTap}>Tap to set →</Text>
                )}
              </View>
            </TouchableOpacity>

            {showGoalInput && (
              <View style={styles.goalInputArea}>
                <View style={styles.goalTypeRow}>
                  <TouchableOpacity
                    style={[styles.goalTypeBtn, goalTypeInput === 'loss' && styles.goalTypeBtnLoss]}
                    onPress={() => setGoalTypeInput('loss')}
                  >
                    <MaterialCommunityIcons name="trending-down" size={14} color={goalTypeInput === 'loss' ? '#fff' : 'rgba(255,255,255,0.3)'} />
                    <Text style={[styles.goalTypeBtnText, goalTypeInput === 'loss' && { color: '#fff' }]}>
                      Weight Loss
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.goalTypeBtn, goalTypeInput === 'gain' && styles.goalTypeBtnGain]}
                    onPress={() => setGoalTypeInput('gain')}
                  >
                    <MaterialCommunityIcons name="trending-up" size={14} color={goalTypeInput === 'gain' ? '#fff' : 'rgba(255,255,255,0.3)'} />
                    <Text style={[styles.goalTypeBtnText, goalTypeInput === 'gain' && { color: '#fff' }]}>
                      Weight Gain
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.goalWeightInputRow}>
                  <TextInput
                    style={styles.goalWeightInput}
                    value={goalInput}
                    onChangeText={setGoalInput}
                    placeholder={goalTypeInput === 'loss' ? 'Target weight e.g. 75 kg' : 'Target weight e.g. 85 kg'}
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    keyboardType="numeric"
                  />
                  <TouchableOpacity style={styles.goalSetBtn} onPress={handleSetGoal}>
                    <Text style={styles.goalSetBtnText}>Set Goal</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* (Log Weight Card was moved up here) */}

          {/* ── History ───────────────────────────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>History</Text>
            {weightLogs.length > 0 && (
              <Text style={styles.sectionCount}>{weightLogs.length} entries</Text>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a78bfa" />
            </View>
          ) : weightLogs.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <MaterialCommunityIcons name="scale-bathroom" size={48} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyHistoryText}>No entries yet</Text>
              <Text style={styles.emptyHistorySubtext}>
                Log your first weight above to start your journey
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {weightLogs.map((l, idx) => {
                const prevWeight = weightLogs[idx + 1]?.weight;
                const diff = prevWeight ? Number((l.weight - prevWeight).toFixed(1)) : null;
                const isDown = diff !== null && diff < 0;
                const isUp   = diff !== null && diff > 0;
                return (
                  <View key={l._id || idx} style={styles.historyItem}>
                    <View style={[
                      styles.historyDot,
                      { backgroundColor: isDown ? '#34d399' : isUp ? '#f87171' : '#a78bfa' }
                    ]} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.historyDate}>
                        {new Date(l.date).toLocaleDateString('en-IN', {
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </Text>
                      {diff !== null && (
                        <Text style={[
                          styles.historyDiff,
                          { color: isDown ? '#34d399' : isUp ? '#f87171' : '#a1a1aa' }
                        ]}>
                          {isUp ? '+' : ''}{diff} kg {isDown ? '↓ lost' : isUp ? '↑ gained' : '→ same'} vs prev
                        </Text>
                      )}
                    </View>
                    <Text style={styles.historyWeight}>
                      {l.weight}{' '}
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>kg</Text>
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                      <TouchableOpacity onPress={() => handleEdit(l)} style={styles.actionBtn}>
                        <MaterialCommunityIcons name="pencil-outline" size={18} color="#60a5fa" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(l._id)} style={[styles.actionBtn, { marginLeft: 6 }]}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#f87171" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Chart ────────────────────────────────────────────────────── */}
          {!loading && chartConfigData && (
            <View style={styles.chartCard}>
              <Text style={styles.chartCardTitle}>Weight Trend — Last 30 Days</Text>
              <LineChart
                data={chartConfigData}
                width={screenWidth - 40}
                height={180}
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: '#151622',
                  backgroundGradientTo: '#151622',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(167, 139, 250, ${opacity})`,
                  labelColor: () => 'rgba(255,255,255,0.4)',
                  style: { borderRadius: 16 },
                  propsForDots: { r: '4', strokeWidth: '2', stroke: '#a78bfa' },
                  propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.03)' },
                }}
                bezier
                style={styles.chart}
              />
            </View>
          )}

          <ThouficSignature />
        </ScrollView>
      </SafeAreaView>

      {/* ── Calendar Modal ────────────────────────────────────────────── */}
      {isCalendarVisible && (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarHeaderTitle}>Select Date</Text>
                <TouchableOpacity 
                  onPress={() => setViewMode(viewMode === 'day' ? 'year' : 'day')} 
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' }}
                >
                  <Text style={styles.calendarHeaderYear}>{calendarDate.getFullYear()}</Text>
                  <MaterialCommunityIcons name="menu-down" size={20} color="#a78bfa" />
                </TouchableOpacity>
              </View>

              {viewMode === 'day' ? (
                <>
                  <View style={styles.calendarNav}>
                    <TouchableOpacity onPress={handlePrevMonth} style={{ padding: 6 }}>
                      <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.calendarMonthYear}>
                      {calendarMonths[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                    </Text>
                    <TouchableOpacity onPress={handleNextMonth} style={{ padding: 6 }}>
                      <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.weekdaysRow}>
                    {weekdays.map((w, idx) => (
                      <Text key={idx} style={styles.weekdayLabel}>{w}</Text>
                    ))}
                  </View>

                  <View style={styles.daysGrid}>
                    {daysGrid.map((cell, idx) => {
                      const isSelected = date && 
                        new Date(date).getFullYear() === cell.date.getFullYear() &&
                        new Date(date).getMonth() === cell.date.getMonth() &&
                        new Date(date).getDate() === cell.date.getDate();

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                          disabled={!cell.isCurrentMonth}
                          onPress={() => handleSelectDay(cell.date)}
                        >
                          <Text style={[styles.dayText, !cell.isCurrentMonth && styles.dayTextOutside]}>
                            {cell.day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : (
                <ScrollView style={styles.yearsScrollView} showsVerticalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingVertical: 8 }}>
                    {yearsList.map((y) => {
                      const isSelectedYear = calendarDate.getFullYear() === y;
                      return (
                        <TouchableOpacity
                          key={y}
                          style={[styles.yearItem, isSelectedYear && styles.yearItemActive, { width: '30%', marginVertical: 4 }]}
                          onPress={() => handleSelectYear(y)}
                        >
                          <Text style={[styles.yearItemText, isSelectedYear && styles.yearItemTextActive]}>
                            {y}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalFooterBtn} onPress={() => setIsCalendarVisible(false)}>
                  <Text style={styles.modalFooterBtnText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 14, marginTop: 10 },
  headerIconContainer: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: '#7c3aed',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 3 },

  // Stats Banner
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: '#151622',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 18,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statBoxLabel: {
    fontSize: 8, fontWeight: 'bold', color: 'rgba(255,255,255,0.28)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6,
  },
  statBoxValue: { fontSize: 24, fontWeight: '900', color: '#fff' },
  statBoxUnit: { fontSize: 11, color: 'rgba(255,255,255,0.28)', fontWeight: 'bold', marginTop: 2 },
  statDivider: { width: 1, height: 52, backgroundColor: 'rgba(255,255,255,0.07)' },

  // Goal Achieved Banner
  achievedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  achievedEmoji: { fontSize: 28 },
  achievedTitle: {
    fontSize: 16, fontWeight: '900', color: '#34d399', letterSpacing: 0.3,
  },
  achievedSubtitle: {
    fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2, lineHeight: 18,
  },

  // Insight / Progress card
  insightCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.18)',
    padding: 14,
    marginBottom: 12,
  },
  progressHeader: { marginBottom: 10 },
  progressBarTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 99 },
  progressPercent: {
    fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 'bold', marginTop: 6,
    letterSpacing: 0.3, textTransform: 'uppercase',
  },

  // Journey / weekly card
  journeyCard: {
    backgroundColor: '#151622',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  insightRowBorder: { paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  insightText: {
    flex: 1, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19, fontWeight: '500',
  },

  // Goal Card
  goalCard: {
    backgroundColor: '#151622', borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)', marginBottom: 14, overflow: 'hidden',
  },
  goalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16,
  },
  goalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalTitle: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  goalWeightDisplay: { fontSize: 14, color: '#a78bfa', fontWeight: '900' },
  goalSetTap: { fontSize: 12, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' },
  goalInputArea: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  goalTypeRow: { flexDirection: 'row', gap: 10 },
  goalTypeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0a0a0f',
  },
  goalTypeBtnLoss: { backgroundColor: '#10b981', borderColor: '#10b981' },
  goalTypeBtnGain: { backgroundColor: '#f97316', borderColor: '#f97316' },
  goalTypeBtnText: { fontSize: 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.35)' },
  goalWeightInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  goalWeightInput: {
    flex: 1, height: 46, backgroundColor: '#0a0a0f', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, color: '#fff', fontSize: 14, fontWeight: 'bold',
  },
  goalSetBtn: {
    backgroundColor: '#7c3aed', borderRadius: 12, height: 46,
    paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center',
  },
  goalSetBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Log card
  logCard: {
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    padding: 18, marginBottom: 24,
  },
  logTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff', marginBottom: 14 },
  logInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputWrapper: {
    height: 48, backgroundColor: '#0a0a0f', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, justifyContent: 'center',
  },
  logInput: { color: '#fff', fontSize: 14, fontWeight: 'bold', height: '100%', width: '100%' },
  plusBtn: {
    width: 48, height: 48, backgroundColor: '#7c3aed', borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },

  // History
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  sectionCount: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 'bold' },
  emptyHistoryCard: {
    backgroundColor: '#151622', borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)', paddingVertical: 52,
    justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 24,
  },
  emptyHistoryText: { fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: 'bold' },
  emptyHistorySubtext: { fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center', paddingHorizontal: 20 },
  loadingContainer: { height: 120, justifyContent: 'center', alignItems: 'center' },
  historyList: { gap: 10, marginBottom: 24 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0a0a0f', padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyDate: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  historyDiff: { fontSize: 11, fontWeight: 'bold', marginTop: 3 },
  historyWeight: { color: '#a78bfa', fontSize: 18, fontWeight: '900', marginRight: 14 },
  deleteBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 },

  // Chart
  chartCard: { marginTop: 10 },
  chartCardTitle: { fontSize: 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4, letterSpacing: 1 },
  chart: { borderRadius: 16 },

  // Calendar Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999
  },
  modalContent: {
    backgroundColor: '#151622',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    width: '90%',
    maxWidth: 340,
    padding: 20,
    alignItems: 'stretch',
  },
  calendarHeader: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 15,
  },
  calendarHeaderTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  calendarHeaderYear: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#a78bfa',
    marginBottom: 4,
  },
  calendarHeaderDate: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  calendarNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarMonthYear: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weekdayLabel: {
    width: 38,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 11,
    fontWeight: 'bold',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  dayCell: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
  },
  dayCellSelected: {
    backgroundColor: '#7c3aed',
  },
  dayText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  dayTextOutside: {
    color: 'rgba(255, 255, 255, 0.15)',
  },
  yearsScrollView: {
    height: 240,
  },
  yearItem: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)'
  },
  yearItemActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  yearItemText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: 'bold',
  },
  yearItemTextActive: {
    color: '#a78bfa',
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  modalFooterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalFooterBtnText: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5
  }
});
