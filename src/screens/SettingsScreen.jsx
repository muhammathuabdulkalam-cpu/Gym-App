import React, { useState, useEffect, useMemo } from 'react';
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
  Image,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { updateProfile, fetchUserProfile } from '../api';
import ScreenWrapper from '../components/ScreenWrapper';
import ThouficSignature from '../components/ThouficSignature';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';

export default function SettingsScreen() {
  const { user, updateUserProfile, logoutUser } = useAuth();
  
  const [name, setName] = useState(user?.name || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [weight, setWeight] = useState(user?.weight ? String(user.weight) : '');
  const [height, setHeight] = useState(user?.height ? String(user.height) : '');
  const [gender, setGender] = useState(user?.gender || 'male');
  const [dob, setDob] = useState(user?.dob || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || DEFAULT_AVATAR);
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  // Sync state if user changes in context
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAge(user.age ? String(user.age) : '');
      setWeight(user.weight ? String(user.weight) : '');
      setHeight(user.height ? String(user.height) : '');
      setGender(user.gender || 'male');
      if (user.dob) setDob(user.dob);
      if (user.profileImage) setProfileImage(user.profileImage);
    }
  }, [user]);

  // Handle profile image picking from gallery
  const handlePickImage = async () => {
    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to change your profile picture.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7, // compress for performance
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setUploadingImage(true);
        // Save the image URI locally immediately
        setProfileImage(uri);
        await updateUserProfile({ profileImage: uri });
        // Also sync to server (profileImage field)
        try {
          await updateProfile({ profileImage: uri });
        } catch (e) {
          // Server sync failed — image still saved locally
          console.log('Image server sync failed:', e?.message);
        }
        setUploadingImage(false);
        Alert.alert('Success', 'Profile photo updated! ✓');
      }
    } catch (error) {
      setUploadingImage(false);
      Alert.alert('Error', 'Could not open image library. ' + error.message);
    }
  };




  // Auto-calculate age from DOB
  const calcAgeFromDob = (dobStr) => {
    if (!dobStr) return null;
    const birth = new Date(dobStr);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age > 0 ? age : null;
  };

  const computedAge = useMemo(() => calcAgeFromDob(dob), [dob]);
  // For display: use computed age from DOB, fallback to manually stored age
  const displayAge = computedAge ?? (age ? Number(age) : null);

  // Dynamic BMI Calculation for the Profile Card
  const bmiData = useMemo(() => {
    const wtNum = Number(weight) || 87.7;
    const htNum = Number(height) || 178;
    const heightM = htNum / 100;
    const score = wtNum / (heightM * heightM);

    let status = 'OVER';
    let color = '#fb923c';
    if (score < 18.5) { status = 'UNDER'; color = '#60a5fa'; }
    else if (score >= 18.5 && score < 25) { status = 'NORM'; color = '#34d399'; }
    else if (score >= 30) { status = 'OBESE'; color = '#f87171'; }

    return { score: score ? score.toFixed(1) : '27.7', status, color };
  }, [weight, height]);

  const handleSave = async () => {
    setSaving(true);
    // Auto-compute age from DOB if available
    const ageToSave = computedAge ?? (age ? Number(age) : user?.age);

    // Step 1: Always persist locally first
    const localUpdates = {
      name,
      age: ageToSave,
      weight: weight ? Number(weight) : user?.weight,
      height: height ? Number(height) : user?.height,
      gender,
      dob,
    };
    await updateUserProfile(localUpdates);

    try {
      // Step 2: Sync to server
      const updated = await updateProfile({
        name,
        age: ageToSave,
        weight: weight ? Number(weight) : undefined,
        height: height ? Number(height) : undefined,
        gender,
        dob,
      });
      // Step 3: Merge server response but ALWAYS keep local dob (server may not support it yet)
      await updateUserProfile({ ...updated, dob });
      Alert.alert('Success', 'Profile updated successfully! ✓');
    } catch (err) {
      // Even if server sync fails, local data is already saved (step 1)
      console.log('Server sync failed (local data saved):', err?.message);
      Alert.alert(
        'Saved Locally',
        'Profile saved on your device. Server sync will retry next time.'
      );
    }
    setSaving(false);
  };

  return (
    <ScreenWrapper>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            
            {/* Top Profile Card matching screenshots */}
            <View style={styles.profileCard}>
              <TouchableOpacity
                style={styles.avatarWrapper}
                activeOpacity={0.85}
                onPress={handlePickImage}
                disabled={uploadingImage}
              >
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatarImage}
                />
                <View style={styles.cameraBtn}>
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialCommunityIcons name="camera" size={16} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>

              <Text style={styles.userName}>{name}</Text>
              <Text style={styles.userEmail}>{user?.email || 'test@gmail.com'}</Text>

              {/* Stats Inline Grid */}
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statVal}>{weight || '87.7'} <Text style={styles.statUnit}>kg</Text></Text>
                  <Text style={styles.statLabel}>WEIGHT</Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={styles.statVal}>{height || '178'} <Text style={styles.statUnit}>cm</Text></Text>
                  <Text style={styles.statLabel}>HEIGHT</Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={styles.statVal}>{displayAge ?? '—'}</Text>
                  <Text style={styles.statLabel}>AGE</Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={[styles.statVal, { color: bmiData.color }]}>{bmiData.score}</Text>
                  <Text style={[styles.statLabel, { color: bmiData.color }]}>BMI ({bmiData.status})</Text>
                </View>
              </View>
            </View>

            {/* Edit Profile Form Card matching screenshots */}
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Edit Profile</Text>

              {/* Full Name field */}
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="account-outline" size={20} color="rgba(255, 255, 255, 0.3)" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full Name"
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                />
              </View>

              {/* Date of Birth + Age combined field */}
              <Text style={styles.fieldLabel}>Date of Birth</Text>
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
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.dateText, !dob && styles.datePlaceholder]}>
                    {dob || 'Select Birthday'}
                  </Text>
                  {computedAge !== null && (
                    <Text style={styles.ageComputedText}>Age: {computedAge} yrs</Text>
                  )}
                </View>
                <MaterialCommunityIcons name="calendar-month" size={18} color="#7c3aed" />
              </TouchableOpacity>

              {/* Weight field */}
              <Text style={styles.fieldLabel}>Weight</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="scale-bathroom" size={20} color="rgba(255, 255, 255, 0.3)" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="87.7"
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                  keyboardType="numeric"
                />
                <Text style={styles.unitText}>kg</Text>
              </View>

              {/* Height field */}
              <Text style={styles.fieldLabel}>Height</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="ruler" size={20} color="rgba(255, 255, 255, 0.3)" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="178"
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                  keyboardType="numeric"
                />
                <Text style={styles.unitText}>cm</Text>
              </View>
            </View>

            {/* Save Changes Button */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            {/* Log Out Button */}
            <TouchableOpacity style={styles.logoutBtn} onPress={logoutUser}>
              <MaterialCommunityIcons name="logout" size={20} color="#f87171" style={{ marginRight: 8 }} />
              <Text style={styles.logoutBtnText}>Log Out</Text>
            </TouchableOpacity>

            {/* Thoufic Signature Footer */}
            <ThouficSignature />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

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
  safeArea: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  
  // Profile Card styles
  profileCard: {
    backgroundColor: '#151622',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10
  },
  avatarWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1c1d29',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5
  },
  userEmail: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.35)',
    marginTop: 4,
    fontWeight: 'bold'
  },
  
  // Stats row inside card
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 20
  },
  statCol: {
    alignItems: 'center'
  },
  statVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff'
  },
  statUnit: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
    fontWeight: 'bold'
  },
  statLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.3)',
    marginTop: 6,
    letterSpacing: 0.5
  },

  // Edit Profile Form Card
  formCard: {
    backgroundColor: '#151622',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    marginBottom: 20
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 18
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 8,
    marginTop: 10
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 14
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
  unitText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8
  },
  
  // Date Selector field
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0a0f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 14
  },
  dateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  datePlaceholder: {
    color: 'rgba(255, 255, 255, 0.2)'
  },
  ageComputedText: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
    marginRight: 10,
  },

  // Save changes and logout button
  saveBtn: {
    backgroundColor: '#7c3aed',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.2)'
  },
  logoutBtnText: {
    color: '#f87171',
    fontWeight: 'bold',
    fontSize: 16
  },

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
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
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
