import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Modal 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { login, register } from '../api';
import ScreenWrapper from '../components/ScreenWrapper';
import ThouficSignature from '../components/ThouficSignature';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('male');
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();

  // Calendar Picker state
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date()); // Viewed Month/Year
  const [viewMode, setViewMode] = useState('day'); // 'day' or 'year'

  const calendarMonths = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ], []);
  
  const weekdays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);

  const handlePrevMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDay = (dayDate) => {
    const yyyy = dayDate.getFullYear();
    const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dayDate.getDate()).padStart(2, '0');
    setDob(`${yyyy}-${mm}-${dd}`);
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
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonthDays - i)
      });
    }
    
    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i)
      });
    }
    
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i)
      });
    }
    return days;
  }, [calendarDate]);

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= 1940; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const formattedSelectedDate = useMemo(() => {
    let dateObj = new Date();
    if (dob) {
      const parsed = new Date(dob);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }
    return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [dob]);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please fill out all fields.');
      return;
    }
    if (!isLogin) {
      if (!name || !weight || !height || !dob) {
        setError('Please fill out all fields to complete registration.');
        return;
      }
      if (isNaN(Number(weight)) || isNaN(Number(height))) {
        setError('Weight and Height must be valid numbers.');
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const userData = isLogin
        ? await login({ email, password })
        : await register({
            email,
            password,
            name,
            weight: Number(weight),
            height: Number(height),
            gender,
            dob
          });
          
      // Safety fallback: if registration succeeds but backend response misses fields, enrich them locally
      const enrichedUserData = isLogin ? userData : {
        ...userData,
        name: userData.name || name,
        weight: userData.weight || Number(weight),
        height: userData.height || Number(height),
        gender: userData.gender || gender,
        dob: userData.dob || dob
      };
      
      loginUser(enrichedUserData);
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
    setName('');
    setDob('');
    setWeight('');
    setHeight('');
    setGender('male');
  };

  return (
    <ScreenWrapper style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
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

          {/* Form Fields Card */}
          <View style={styles.formCard}>
            
            {!isLogin && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>FULL NAME</Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons name="account-outline" size={20} color="rgba(255, 255, 255, 0.3)" style={styles.fieldIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="John Doe" 
                    placeholderTextColor="rgba(255, 255, 255, 0.2)"
                    value={name}
                    onChangeText={setName}
                    autoComplete="off"
                    textContentType="none"
                  />
                </View>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="email-outline" size={20} color="rgba(255, 255, 255, 0.3)" style={styles.fieldIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="you@email.com" 
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="lock-outline" size={20} color="rgba(255, 255, 255, 0.3)" style={styles.fieldIcon} />
                <TextInput 
                  style={[styles.input, styles.passwordInput]} 
                  placeholder="••••••••" 
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                  <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={20} color="rgba(255, 255, 255, 0.3)" />
                </TouchableOpacity>
              </View>
            </View>

            {!isLogin && (
              <>
                {/* Custom DOB Trigger Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>DATE OF BIRTH</Text>
                  <TouchableOpacity
                    style={styles.inputWrapper}
                    activeOpacity={0.8}
                    onPress={() => {
                      let initialDate = new Date();
                      if (dob) {
                        const parsed = new Date(dob);
                        if (!isNaN(parsed.getTime())) initialDate = parsed;
                      }
                      setCalendarDate(initialDate);
                      setIsCalendarVisible(true);
                      setViewMode('day');
                    }}
                  >
                    <MaterialCommunityIcons name="cake-variant-outline" size={20} color="rgba(255, 255, 255, 0.3)" style={styles.fieldIcon} />
                    <Text style={[styles.dateText, !dob && styles.datePlaceholder]}>
                      {dob || 'Select Birthday'}
                    </Text>
                    <MaterialCommunityIcons name="calendar-month" size={20} color="#7c3aed" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                </View>

                {/* Weight & Height Row */}
                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                    <Text style={styles.label}>WEIGHT (KG)</Text>
                    <View style={styles.inputWrapper}>
                      <MaterialCommunityIcons name="scale-bathroom" size={20} color="rgba(255, 255, 255, 0.3)" style={styles.fieldIcon} />
                      <TextInput 
                        style={styles.input} 
                        placeholder="78.5" 
                        placeholderTextColor="rgba(255, 255, 255, 0.2)"
                        keyboardType="numeric"
                        value={weight}
                        onChangeText={setWeight}
                        autoComplete="off"
                        textContentType="none"
                      />
                    </View>
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>HEIGHT (CM)</Text>
                    <View style={styles.inputWrapper}>
                      <MaterialCommunityIcons name="ruler" size={20} color="rgba(255, 255, 255, 0.3)" style={styles.fieldIcon} />
                      <TextInput 
                        style={styles.input} 
                        placeholder="178" 
                        placeholderTextColor="rgba(255, 255, 255, 0.2)"
                        keyboardType="numeric"
                        value={height}
                        onChangeText={setHeight}
                        autoComplete="off"
                        textContentType="none"
                      />
                    </View>
                  </View>
                </View>

                {/* Gender Select */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>GENDER</Text>
                  <View style={styles.genderContainer}>
                    {['male', 'female', 'other'].map((g) => (
                      <TouchableOpacity 
                        key={g} 
                        style={[styles.genderBtn, gender === g && styles.genderBtnActive]} 
                        onPress={() => setGender(g)}
                      >
                        <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                          {g.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

          </View>

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
            )}
          </TouchableOpacity>

          {/* Footer Action Hint */}
          <Text style={styles.footerHint}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <Text style={styles.footerAction} onPress={() => switchMode(!isLogin)}>
              {isLogin ? 'Sign Up' : 'Sign In'}
            </Text>
          </Text>

          <ThouficSignature />

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Calendar Picker Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isCalendarVisible}
        onRequestClose={() => setIsCalendarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Calendar Header */}
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarHeaderTitle}>Select Date of Birth</Text>
              <TouchableOpacity 
                onPress={() => setViewMode(viewMode === 'day' ? 'year' : 'day')} 
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' }}
              >
                <Text style={styles.calendarHeaderYear}>
                  {calendarDate.getFullYear()}
                </Text>
                <MaterialCommunityIcons name="menu-down" size={20} color="#a78bfa" />
              </TouchableOpacity>
              <Text style={styles.calendarHeaderDate}>
                {formattedSelectedDate}
              </Text>
            </View>

            {viewMode === 'day' ? (
              <>
                {/* Day Navigation */}
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

                {/* Weekday Labels */}
                <View style={styles.weekdaysRow}>
                  {weekdays.map((w, idx) => (
                    <Text key={idx} style={styles.weekdayLabel}>{w}</Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {daysGrid.map((cell, idx) => {
                    const isSelected = dob && 
                      new Date(dob).getFullYear() === cell.date.getFullYear() &&
                      new Date(dob).getMonth() === cell.date.getMonth() &&
                      new Date(dob).getDate() === cell.date.getDate();

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected
                        ]}
                        disabled={!cell.isCurrentMonth}
                        onPress={() => handleSelectDay(cell.date)}
                      >
                        <Text style={[
                          styles.dayText,
                          !cell.isCurrentMonth && styles.dayTextOutside
                        ]}>
                          {cell.day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                {/* Year Selector Grid */}
                <ScrollView style={styles.yearsScrollView} showsVerticalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingVertical: 8 }}>
                    {yearsList.map((y) => {
                      const isSelectedYear = calendarDate.getFullYear() === y;
                      return (
                        <TouchableOpacity
                          key={y}
                          style={[
                            styles.yearItem,
                            isSelectedYear && styles.yearItemActive,
                            { width: '30%', marginVertical: 4 }
                          ]}
                          onPress={() => handleSelectYear(y)}
                        >
                          <Text style={[
                            styles.yearItemText,
                            isSelectedYear && styles.yearItemTextActive
                          ]}>
                            {y}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalFooterBtn} 
                onPress={() => setIsCalendarVisible(false)}
              >
                <Text style={styles.modalFooterBtnText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 48 },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#151622', borderRadius: 12, padding: 4, marginBottom: 32, alignSelf: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 24, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: '#7c3aed' },
  toggleText: { color: '#a1a1aa', fontWeight: 'bold', fontSize: 13 },
  toggleTextActive: { color: '#ffffff' },
  headerTitle: { fontSize: 30, fontWeight: '900', color: '#ffffff', marginBottom: 8 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.4)', marginBottom: 28, fontWeight: '500' },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, padding: 14, borderRadius: 12, marginBottom: 20 },
  errorText: { color: '#f87171', fontSize: 13, fontWeight: 'bold' },
  
  // Card Container for fields
  formCard: {
    backgroundColor: '#151622',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20
  },
  formGroup: { marginBottom: 16 },
  label: { color: 'rgba(255, 255, 255, 0.3)', fontSize: 10, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    height: 48,
  },
  fieldIcon: {
    marginRight: 12
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    height: '100%'
  },
  passwordInput: { paddingRight: 40 },
  eyeIcon: { position: 'absolute', right: 16 },
  
  // Date Selector
  dateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  datePlaceholder: {
    color: 'rgba(255, 255, 255, 0.2)'
  },
  
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  genderContainer: { flexDirection: 'row', backgroundColor: '#0a0a0f', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  genderBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  genderBtnActive: { backgroundColor: '#7c3aed' },
  genderText: { color: '#a1a1aa', fontWeight: 'bold', fontSize: 11 },
  genderTextActive: { color: '#ffffff' },

  // Submit Button
  submitBtn: { 
    backgroundColor: '#7c3aed', 
    borderRadius: 16, 
    padding: 16, 
    alignItems: 'center', 
    marginTop: 10, 
  },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  footerHint: { textAlign: 'center', color: '#a1a1aa', marginTop: 24, fontSize: 13 },
  footerAction: { color: '#7c3aed', fontWeight: 'bold' },

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
