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
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  fetchFoodLogs,
  saveFoodLog,
  deleteFoodLog,
  fetchCustomFoods,
  saveCustomFood,
  fetchNutrition
} from '../api';
import { FOOD_DATABASE } from '../constants/foodDatabase';
import ScreenWrapper from '../components/ScreenWrapper';
import ThouficSignature from '../components/ThouficSignature';

const { width: screenWidth } = Dimensions.get('window');

const MEALS = [
  { id: 'breakfast', label: 'Breakfast', icon: 'weather-sunny', emoji: '🌅' },
  { id: 'lunch', label: 'Lunch', icon: 'weather-partly-cloudy', emoji: '☀️' },
  { id: 'dinner', label: 'Dinner', icon: 'weather-night', emoji: '🌙' },
  { id: 'snack', label: 'Snacks', icon: 'apple', emoji: '🍎' }
];

// Helper to normalize food structures
const normalizeFood = (food) => {
  const unitValue = Number(food.unitValue) || 100;
  let defaultUnit = String(food.defaultUnit || 'Grams').trim();
  if (['gram', 'grams'].includes(defaultUnit.toLowerCase())) defaultUnit = 'Grams';

  const normalizedUnits = food.units
    ? { ...food.units }
    : (defaultUnit === 'Grams'
      ? { Grams: 1 }
      : { [defaultUnit]: unitValue, Grams: 1 });

  return {
    ...food,
    name: food.name || 'Custom Food',
    cal: Number(food.calories ?? food.cal ?? 0),
    p: Number(food.protein ?? food.p ?? 0),
    c: Number(food.carbs ?? food.c ?? 0),
    defaultUnit,
    unitValue,
    base: defaultUnit === 'Grams' ? `${unitValue}g` : `1 ${defaultUnit}`,
    units: normalizedUnits
  };
};

// Custom ScrollPicker utilizing FlatList snapToInterval
const ScrollPicker = ({ items, value, onChange, label }) => {
  const itemHeight = 40;
  const listRef = useRef(null);
  const selectedIndex = items.indexOf(value);

  const data = useMemo(() => ['', ...items, ''], [items]);

  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      setTimeout(() => {
        listRef.current?.scrollToOffset({
          offset: selectedIndex * itemHeight,
          animated: false,
        });
      }, 60);
    }
  }, [value, selectedIndex, items]);

  const onMomentumScrollEnd = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / itemHeight);
    if (items[index] !== undefined && items[index] !== value) {
      onChange(items[index]);
    }
  };

  return (
    <View style={{ flex: 1, marginHorizontal: 2 }}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerWrapper}>
        <View style={styles.pickerHighlight} />
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(item, index) => index.toString()}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          onMomentumScrollEnd={onMomentumScrollEnd}
          renderItem={({ item, index }) => {
            const isActive = item === value;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => item && onChange(item)}
                style={styles.pickerItem}
              >
                <Text style={[styles.pickerItemText, isActive && styles.pickerItemTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
};

// Smart Food Adder Component
const SmartFoodAdder = ({ mealType, date, onFoodLogged, customFoods, refreshCustomFoods }) => {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState('Grams');
  const [logging, setLogging] = useState(false);

  // AI Lookup states
  const [searchingAI, setSearchingAI] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [aiMessage, setAiMessage] = useState('');

  // Custom food creator form state
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCal, setCustomCal] = useState('');
  const [customPro, setCustomPro] = useState('');
  const [customCar, setCustomCar] = useState('');
  const [customUnit, setCustomUnit] = useState('Grams');
  const [customUnitVal, setCustomUnitVal] = useState('100');
  const [savingCustom, setSavingCustom] = useState(false);

  // Suggestions Autocomplete
  useEffect(() => {
    if (!query.trim()) {
      setMatches([]);
      return;
    }
    const txt = query.toLowerCase();

    const dbNorm = FOOD_DATABASE.map(f => ({ ...normalizeFood(f), source: 'db' }));
    const custNorm = customFoods.map(f => ({ ...normalizeFood(f), source: 'custom' }));
    const combined = [...custNorm, ...dbNorm];

    const filtered = combined.filter(f => f.name.toLowerCase().includes(txt)).slice(0, 5);
    setMatches(filtered);
  }, [query, customFoods]);

  const handleAISearch = async () => {
    if (!query.trim()) return;
    setSearchingAI(true);
    setAiResults([]);
    setAiMessage('');
    try {
      const data = await fetchNutrition(query.trim());
      if (data.needs_key) {
        setAiMessage(data.message || 'Configure your free Gemini API key in Settings.');
      } else if (Array.isArray(data)) {
        if (data.length === 0) {
          setAiMessage('No suggestions from AI.');
        } else {
          setAiResults(data.map(normalizeFood));
        }
      } else {
        setAiMessage('Invalid AI response.');
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      setAiMessage(serverMsg || 'AI Lookup failed. Check API key.');
    } finally {
      setSearchingAI(false);
    }
  };

  const handleSelectFood = (food) => {
    const norm = normalizeFood(food);
    setSelectedFood(norm);
    setQuery('');
    setMatches([]);
    setAiResults([]);
    setAiMessage('');
    setQuantity(norm.defaultUnit === 'Grams' ? 100 : 1);
    setUnit(norm.defaultUnit);
  };

  const allSuggestions = useMemo(() => {
    const aiMapped = aiResults.map(f => ({ ...f, source: 'ai' }));
    return [...aiMapped, ...matches];
  }, [aiResults, matches]);

  const currentMacros = useMemo(() => {
    if (!selectedFood) return { calories: 0, protein: 0, carbs: 0 };
    const ratio = quantity / (selectedFood.units[unit] || 1);
    return {
      calories: Math.round(selectedFood.cal * ratio),
      protein: Number((selectedFood.p * ratio).toFixed(1)),
      carbs: Number((selectedFood.c * ratio).toFixed(1))
    };
  }, [selectedFood, quantity, unit]);

  const handleLogFood = async () => {
    if (!selectedFood) return;
    setLogging(true);
    try {
      await saveFoodLog({
        date,
        mealType,
        foodName: selectedFood.name,
        quantity,
        unit,
        calories: currentMacros.calories,
        protein: currentMacros.protein,
        carbs: currentMacros.carbs
      });
      setSelectedFood(null);
      onFoodLogged();
    } catch {
      Alert.alert('Error', 'Failed to log food.');
    } finally {
      setLogging(false);
    }
  };

  const handleSaveCustom = async () => {
    if (!customName.trim() || !customCal) {
      Alert.alert('Error', 'Name and calories are required.');
      return;
    }
    setSavingCustom(true);
    try {
      const payload = {
        name: customName,
        calories: Number(customCal) || 0,
        protein: Number(customPro) || 0,
        carbs: Number(customCar) || 0,
        defaultUnit: customUnit,
        unitValue: Number(customUnitVal) || 100
      };
      const saved = await saveCustomFood(payload);
      await refreshCustomFoods();
      setIsCreatingCustom(false);
      handleSelectFood(saved);
      // reset form
      setCustomName('');
      setCustomCal('');
      setCustomPro('');
      setCustomCar('');
      setCustomUnit('Grams');
      setCustomUnitVal('100');
    } catch {
      Alert.alert('Error', 'Failed to save custom food.');
    } finally {
      setSavingCustom(false);
    }
  };

  const quantityOptions = useMemo(() => {
    if (unit === 'Grams') {
      return Array.from({ length: 40 }, (_, i) => String((i + 1) * 25)); // 25g to 1000g
    }
    return Array.from({ length: 20 }, (_, i) => String(i + 1)); // 1 to 20 units
  }, [unit]);

  const unitOptions = useMemo(() => {
    if (!selectedFood) return ['Grams'];
    return Object.keys(selectedFood.units);
  }, [selectedFood]);

  if (isCreatingCustom) {
    return (
      <View style={styles.adderForm}>
        <View style={styles.formHeader}>
          <View>
            <Text style={styles.formTitle}>New Custom Food</Text>
            <Text style={styles.formSubtitle}>Create a reusable nutrition label</Text>
          </View>
          <TouchableOpacity onPress={() => setIsCreatingCustom(false)}>
            <Text style={styles.formBackBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.formInput}
          placeholder="Food Name (e.g. Protein shake)"
          placeholderTextColor="#52525b"
          value={customName}
          onChangeText={setCustomName}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.macroFormLabel}>Calories (kcal)</Text>
            <TextInput
              style={styles.formInput}
              keyboardType="numeric"
              placeholder="120"
              placeholderTextColor="#52525b"
              value={customCal}
              onChangeText={setCustomCal}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.macroFormLabel}>Protein (g)</Text>
            <TextInput
              style={styles.formInput}
              keyboardType="numeric"
              placeholder="15"
              placeholderTextColor="#52525b"
              value={customPro}
              onChangeText={setCustomPro}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.macroFormLabel}>Carbs (g)</Text>
            <TextInput
              style={styles.formInput}
              keyboardType="numeric"
              placeholder="8"
              placeholderTextColor="#52525b"
              value={customCar}
              onChangeText={setCustomCar}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1.5 }}>
            <Text style={styles.macroFormLabel}>Serving Unit</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Grams or Scoop"
              placeholderTextColor="#52525b"
              value={customUnit}
              onChangeText={setCustomUnit}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.macroFormLabel}>Unit Weight (g)</Text>
            <TextInput
              style={styles.formInput}
              keyboardType="numeric"
              placeholder="100"
              placeholderTextColor="#52525b"
              value={customUnitVal}
              onChangeText={setCustomUnitVal}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSaveCustom} disabled={savingCustom}>
          {savingCustom ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create & Select</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.adderContainer}>
      <Text style={styles.adderTitle}>ADD FOOD LOG</Text>
      
      {/* Autocomplete Input Search */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color="#71717a" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search food or ask AI (e.g. 3 eggs)..."
          placeholderTextColor="#71717a"
          value={query}
          onChangeText={(val) => {
            setQuery(val);
            if (aiResults.length > 0) setAiResults([]);
            if (aiMessage) setAiMessage('');
          }}
          onSubmitEditing={handleAISearch}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setAiResults([]); setAiMessage(''); }} style={styles.clearSearchBtn}>
            <MaterialCommunityIcons name="close" size={16} color="#71717a" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleAISearch}
          disabled={searchingAI || !query.trim()}
          style={styles.aiSearchBtn}
        >
          {searchingAI ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialCommunityIcons name="robot-outline" size={20} color="#a78bfa" />
          )}
        </TouchableOpacity>
      </View>

      {/* Matches suggestions dropdown */}
      {allSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {searchingAI && (
            <View style={{ padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' }}>
              <ActivityIndicator size="small" color="#a78bfa" />
            </View>
          )}
          {allSuggestions.map((food, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.suggestionItem, food.source === 'ai' && { backgroundColor: 'rgba(167, 139, 250, 0.06)' }]}
              onPress={() => handleSelectFood(food)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                {food.source === 'ai' && (
                  <View style={{ backgroundColor: 'rgba(167, 139, 250, 0.2)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: '#a78bfa', fontSize: 8, fontWeight: 'bold' }}>AI</Text>
                  </View>
                )}
                <Text style={styles.suggestionName} numberOfLines={1}>{food.name}</Text>
              </View>
              <Text style={styles.suggestionCalories}>{food.cal} kcal/{food.base}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {aiMessage.length > 0 && (
        <View style={styles.aiMessageContainer}>
          <Text style={styles.aiMessageText}>⚠️ {aiMessage}</Text>
        </View>
      )}

      {/* No matches fallback */}
      {query.trim().length > 0 && allSuggestions.length === 0 && !searchingAI && !aiMessage && (
        <View style={styles.noMatchesContainer}>
          <Text style={styles.noMatchesText}>No matching foods found.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.createCustomBtn} onPress={handleAISearch}>
              <Text style={styles.createCustomBtnText}>Search with AI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createCustomBtn} onPress={() => { setIsCreatingCustom(true); setCustomName(query); }}>
              <Text style={styles.createCustomBtnText}>+ Create Custom</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* If food selected, show macro calculator and scroll pickers */}
      {selectedFood && (
        <View style={{ marginTop: 16, gap: 14 }}>
          <View style={styles.previewBox}>
            <Text style={styles.previewTextLabel}>Selected</Text>
            <Text style={styles.previewTextValue}>{selectedFood.name}</Text>
          </View>

          {/* Scroll wheel selectors */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <ScrollPicker
              label="Quantity"
              items={quantityOptions}
              value={String(quantity)}
              onChange={(val) => setQuantity(Number(val))}
            />
            <ScrollPicker
              label="Unit"
              items={unitOptions}
              value={unit}
              onChange={setUnit}
            />
          </View>

          {/* Calculated macros display */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Calories</Text>
              <Text style={[styles.summaryVal, { color: '#f97316' }]}>{currentMacros.calories} kcal</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Protein</Text>
              <Text style={[styles.summaryVal, { color: '#a78bfa' }]}>{currentMacros.protein}g</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Carbs</Text>
              <Text style={[styles.summaryVal, { color: '#34d399' }]}>{currentMacros.carbs}g</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleLogFood} disabled={logging}>
            {logging ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add to {mealType}</Text>}
          </TouchableOpacity>
        </View>
      )}

      {!selectedFood && query.length === 0 && (
        <TouchableOpacity style={styles.fallbackCustomBtn} onPress={() => setIsCreatingCustom(true)}>
          <Text style={styles.fallbackCustomBtnText}>+ Or add custom food item</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Meal Section Collapsible Component
const MealSection = ({ meal, date, allLogs, onRefresh, customFoods, refreshCustomFoods }) => {
  const [expanded, setExpanded] = useState(false);
  const [editingLogId, setEditingLogId] = useState(null);
  
  // Inline edit state
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('Grams');
  const [editFoodObj, setEditFoodObj] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const mealLogs = useMemo(() => {
    return allLogs.find(l => l.date === date && l.mealType === meal.id)?.foods || [];
  }, [allLogs, date, meal.id]);

  const mealTotals = useMemo(() => {
    return mealLogs.reduce((sum, f) => {
      sum.cal += Number(f.calories) || 0;
      sum.pro += Number(f.protein) || 0;
      sum.car += Number(f.carbs) || 0;
      return sum;
    }, { cal: 0, pro: 0, car: 0 });
  }, [mealLogs]);

  const handleStartEdit = (food) => {
    setEditingLogId(food._id);
    setEditQty(String(food.quantity));
    setEditUnit(food.unit || 'Grams');

    // Retrieve database info
    const dbMatch = FOOD_DATABASE.find(f => f.name.toLowerCase() === food.foodName.toLowerCase());
    const customMatch = customFoods.find(f => f.name.toLowerCase() === food.foodName.toLowerCase());
    setEditFoodObj(normalizeFood(dbMatch || customMatch || {
      name: food.foodName,
      calories: (Number(food.calories) || 0) / ((Number(food.quantity) || 100) / 100),
      protein: (Number(food.protein) || 0) / ((Number(food.quantity) || 100) / 100),
      carbs: (Number(food.carbs) || 0) / ((Number(food.quantity) || 100) / 100),
      defaultUnit: food.unit || 'Grams',
      unitValue: 100
    }));
  };

  const currentEditMacros = useMemo(() => {
    if (!editFoodObj) return { calories: 0, protein: 0, carbs: 0 };
    const qtyNum = Number(editQty) || 0;
    const ratio = qtyNum / (editFoodObj.units[editUnit] || 1);
    return {
      calories: Math.round(editFoodObj.cal * ratio),
      protein: Number((editFoodObj.p * ratio).toFixed(1)),
      carbs: Number((editFoodObj.c * ratio).toFixed(1))
    };
  }, [editFoodObj, editQty, editUnit]);

  const handleSaveEdit = async () => {
    if (!editingLogId) return;
    setSavingEdit(true);
    try {
      await saveFoodLog({
        _id: editingLogId,
        date,
        mealType: meal.id,
        foodName: editFoodObj.name,
        quantity: Number(editQty) || 0,
        unit: editUnit,
        calories: currentEditMacros.calories,
        protein: currentEditMacros.protein,
        carbs: currentEditMacros.carbs
      });
      setEditingLogId(null);
      onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to update log.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteLog = async (logId) => {
    Alert.alert('Delete Log', 'Delete this food entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFoodLog(date, meal.id, logId);
            onRefresh();
          } catch {
            Alert.alert('Error', 'Failed to delete food log.');
          }
        }
      }
    ]);
  };

  const handleClearMeal = async () => {
    Alert.alert('Clear Meal', `Remove all items from ${meal.label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          try {
            for (const f of mealLogs) {
              await deleteFoodLog(date, meal.id, f._id);
            }
            onRefresh();
          } catch {
            Alert.alert('Error', 'Failed to clear meal.');
          }
        }
      }
    ]);
  };

  const editQtyOptions = useMemo(() => {
    if (editUnit === 'Grams') {
      return Array.from({ length: 40 }, (_, i) => String((i + 1) * 25));
    }
    return Array.from({ length: 20 }, (_, i) => String(i + 1));
  }, [editUnit]);

  const editUnitOptions = useMemo(() => {
    if (!editFoodObj) return ['Grams'];
    return Object.keys(editFoodObj.units);
  }, [editFoodObj]);

  return (
    <View style={styles.mealCard}>
      {/* Header */}
      <TouchableOpacity
        style={styles.mealHeader}
        activeOpacity={0.8}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.mealHeaderLeft}>
          <View style={styles.mealIconContainer}>
            <MaterialCommunityIcons name={meal.icon} size={24} color="#fff" />
          </View>
          <View>
            <Text style={styles.mealTitle}>{meal.label}</Text>
            {mealLogs.length > 0 ? (
              <Text style={styles.mealSubtitle}>{mealTotals.cal} kcal logged</Text>
            ) : (
              <Text style={styles.mealEmpty}>Nothing logged yet</Text>
            )}
          </View>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color="rgba(255, 255, 255, 0.4)"
        />
      </TouchableOpacity>

      {/* Expanded Log section */}
      {expanded && (
        <View style={styles.mealExpanded}>
          {mealLogs.length > 0 && (
            <View style={styles.foodList}>
              {mealLogs.map((food) => {
                const isEditing = editingLogId === food._id;

                if (isEditing) {
                  return (
                    <View key={food._id} style={styles.inlineEditForm}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                        Editing {food.foodName}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        <ScrollPicker
                          label="Qty"
                          items={editQtyOptions}
                          value={editQty}
                          onChange={setEditQty}
                        />
                        <ScrollPicker
                          label="Unit"
                          items={editUnitOptions}
                          value={editUnit}
                          onChange={setEditUnit}
                        />
                      </View>

                      {/* Live Calculator preview */}
                      <View style={[styles.summaryBar, { marginTop: 12 }]}>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Calories</Text>
                          <Text style={[styles.summaryVal, { color: '#f97316' }]}>{currentEditMacros.calories} kcal</Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Protein</Text>
                          <Text style={[styles.summaryVal, { color: '#a78bfa' }]}>{currentEditMacros.protein}g</Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Carbs</Text>
                          <Text style={[styles.summaryVal, { color: '#34d399' }]}>{currentEditMacros.carbs}g</Text>
                        </View>
                      </View>

                      <View style={styles.editActions}>
                        <TouchableOpacity style={[styles.editBtn, styles.cancelBtn]} onPress={() => setEditingLogId(null)}>
                          <Text style={styles.editBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.editBtn, styles.saveBtn]} onPress={handleSaveEdit} disabled={savingEdit}>
                          {savingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.editBtnText}>Save</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={food._id} style={styles.foodItem}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.foodName}>{food.foodName}</Text>
                      <Text style={[styles.foodMacrosText, { color: 'rgba(255, 255, 255, 0.3)' }]}>
                        {food.quantity}{food.unit} •{' '}
                        <Text style={{ color: '#a78bfa' }}>P: {food.protein}g</Text> •{' '}
                        <Text style={{ color: '#34d399' }}>C: {food.carbs}g</Text>
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: '#f97316', fontWeight: '900', fontSize: 14, marginRight: 8 }}>
                        {food.calories} kcal
                      </Text>
                      <TouchableOpacity onPress={() => handleStartEdit(food)} style={{ padding: 4 }}>
                        <MaterialCommunityIcons name="pencil-outline" size={18} color="rgba(255, 255, 255, 0.4)" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteLog(food._id)} style={{ padding: 4 }}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#f87171" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Add form inside collapsible */}
          <SmartFoodAdder
            mealType={meal.id}
            date={date}
            onFoodLogged={onRefresh}
            customFoods={customFoods}
            refreshCustomFoods={refreshCustomFoods}
          />

          {mealLogs.length > 0 && (
            <View style={styles.mealActions}>
              <TouchableOpacity style={styles.clearBtn} onPress={handleClearMeal}>
                <Text style={styles.clearBtnText}>Clear Meal Logs</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default function FoodScreen() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [logs, setLogs] = useState([]);
  const [customFoods, setCustomFoods] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    try {
      const data = await fetchFoodLogs(date);
      setLogs(data);
    } catch {
      setLogs([]);
    }
  };

  const loadCustomFoods = async () => {
    try {
      const data = await fetchCustomFoods();
      setCustomFoods(data);
    } catch {
      setCustomFoods([]);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadLogs(), loadCustomFoods()]).finally(() => setLoading(false));
  }, [date]);

  const totalDayCal = useMemo(() => {
    return logs.reduce((sum, log) => sum + log.foods.reduce((s, f) => s + (Number(f.calories) || 0), 0), 0);
  }, [logs]);

  const totalDayPro = useMemo(() => {
    return logs.reduce((sum, log) => sum + log.foods.reduce((s, f) => s + (Number(f.protein) || 0), 0), 0);
  }, [logs]);

  const totalDayCar = useMemo(() => {
    return logs.reduce((sum, log) => sum + log.foods.reduce((s, f) => s + (Number(f.carbs) || 0), 0), 0);
  }, [logs]);

  const changeDate = (days) => {
    const current = new Date(date);
    current.setDate(current.getDate() + days);
    setDate(current.toISOString().split('T')[0]);
  };

  return (
    <ScreenWrapper>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Header matching Food Tracker screenshot */}
            <View style={styles.header}>
              <View style={styles.headerIconContainer}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Food Tracker</Text>
                <Text style={styles.headerSubtitle}>Smart auto-tracking for meals.</Text>
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

            {/* Global Macros Status Card matching screenshots */}
            <View style={styles.macrosCard}>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Calories</Text>
                <Text style={[styles.macroValue, { color: '#f97316' }]}>{totalDayCal}</Text>
              </View>
              <View style={styles.macroDivider} />
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Protein</Text>
                <Text style={[styles.macroValue, { color: '#a78bfa' }]}>{totalDayPro.toFixed(1)}g</Text>
              </View>
              <View style={styles.macroDivider} />
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Carbs</Text>
                <Text style={[styles.macroValue, { color: '#34d399' }]}>{totalDayCar.toFixed(1)}g</Text>
              </View>
            </View>

            {/* Meals List (Breakfast, Lunch, Dinner, Snacks) */}
            <View style={styles.mealsContainer}>
              {loading ? (
                <ActivityIndicator size="large" color="#a78bfa" style={{ marginTop: 30 }} />
              ) : (
                MEALS.map(meal => (
                  <MealSection
                    key={meal.id}
                    meal={meal}
                    date={date}
                    allLogs={logs}
                    onRefresh={loadLogs}
                    customFoods={customFoods}
                    refreshCustomFoods={loadCustomFoods}
                  />
                ))
              )}
            </View>

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
    backgroundColor: '#f97316', 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }
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

  // Macro Summary Card styles
  macrosCard: { 
    flexDirection: 'row', 
    backgroundColor: '#151622', 
    padding: 16, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)', 
    marginBottom: 24, 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  macroItem: { alignItems: 'center', flex: 1 },
  macroLabel: { 
    fontSize: 10, 
    fontWeight: 'bold', 
    color: 'rgba(255, 255, 255, 0.3)', 
    textTransform: 'uppercase', 
    marginBottom: 6, 
    letterSpacing: 1 
  },
  macroValue: { fontSize: 20, fontWeight: '900' },
  macroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.06)' },
  
  // Meals styles
  mealsContainer: { gap: 16 },
  mealCard: { 
    backgroundColor: '#151622', 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)', 
    overflow: 'hidden' 
  },
  mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  mealHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mealIconContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 10, 
    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)'
  },
  mealTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  mealSubtitle: { fontSize: 12, color: '#f97316', fontWeight: 'bold', marginTop: 4 },
  mealEmpty: { fontSize: 12, color: 'rgba(255, 255, 255, 0.25)', marginTop: 4 },
  mealExpanded: { padding: 18, paddingTop: 0, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.05)' },
  
  // Logging items list
  foodList: { gap: 8, marginBottom: 16, marginTop: 16 },
  foodItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#0a0a0f', 
    padding: 12, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)' 
  },
  foodName: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  foodMacrosText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  // Adder container styles
  adderContainer: { 
    backgroundColor: '#0a0a0f', 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)', 
    marginTop: 16 
  },
  adderTitle: { color: 'rgba(255, 255, 255, 0.3)', fontSize: 11, fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 },
  
  searchContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#151622', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    height: 46 
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  clearSearchBtn: { padding: 4 },
  aiSearchBtn: {
    padding: 6,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  aiMessageContainer: {
    backgroundColor: '#151622',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.1)',
    marginTop: 8,
    alignItems: 'center'
  },
  aiMessageText: {
    color: '#fb923c',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  
  suggestionsContainer: { 
    backgroundColor: '#151622', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)', 
    marginTop: 8, 
    overflow: 'hidden' 
  },
  suggestionItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255, 255, 255, 0.03)' 
  },
  suggestionName: { color: '#e4e4e7', fontSize: 13, fontWeight: 'bold', flex: 1, marginRight: 8 },
  suggestionCalories: { color: 'rgba(255, 255, 255, 0.35)', fontSize: 11 },
  
  noMatchesContainer: { backgroundColor: '#151622', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  noMatchesText: { color: 'rgba(255, 255, 255, 0.35)', fontSize: 13, marginBottom: 10 },
  createCustomBtn: { 
    backgroundColor: 'rgba(124, 58, 237, 0.1)', 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: 'rgba(124, 58, 237, 0.3)' 
  },
  createCustomBtnText: { color: '#a78bfa', fontSize: 12, fontWeight: 'bold' },
  
  fallbackCustomBtn: { 
    marginTop: 12, 
    paddingVertical: 12, 
    borderStyle: 'dashed', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.08)', 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  fallbackCustomBtnText: { color: 'rgba(255, 255, 255, 0.25)', fontSize: 12, fontWeight: 'bold' },

  adderForm: { 
    backgroundColor: '#151622', 
    borderWidth: 1, 
    borderColor: 'rgba(249, 115, 22, 0.2)', 
    borderRadius: 16, 
    padding: 16, 
    gap: 12 
  },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  formTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff', flex: 1, marginRight: 8 },
  formSubtitle: { fontSize: 11, color: 'rgba(255, 255, 255, 0.35)', marginTop: 2 },
  formBackBtn: { color: '#a78bfa', fontSize: 13, fontWeight: 'bold' },
  formInput: { 
    backgroundColor: '#0a0a0f', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)', 
    padding: 12, 
    color: '#fff', 
    fontSize: 14, 
    height: 44 
  },
  
  previewBox: { 
    backgroundColor: '#0a0a0f', 
    padding: 12, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)' 
  },
  previewTextLabel: { fontSize: 9, color: 'rgba(255, 255, 255, 0.3)', fontWeight: 'bold', textTransform: 'uppercase' },
  previewTextValue: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  
  macroFormLabel: { fontSize: 10, color: 'rgba(255, 255, 255, 0.3)', fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase' },
  
  summaryBar: { 
    flexDirection: 'row', 
    backgroundColor: '#0a0a0f', 
    borderRadius: 12, 
    padding: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.03)', 
    justifyContent: 'space-around' 
  },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 9, color: 'rgba(255, 255, 255, 0.3)', textTransform: 'uppercase', fontWeight: 'bold' },
  summaryVal: { fontSize: 14, fontWeight: '900', marginTop: 4 },
  
  submitBtn: { 
    backgroundColor: '#7c3aed', 
    paddingVertical: 12, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 8,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // Picker styles
  pickerLabel: { 
    fontSize: 10, 
    color: 'rgba(255, 255, 255, 0.3)', 
    fontWeight: 'bold', 
    textTransform: 'uppercase', 
    marginBottom: 6, 
    textAlign: 'center' 
  },
  pickerWrapper: { 
    height: 120, 
    backgroundColor: '#0a0a0f', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)', 
    overflow: 'hidden' 
  },
  pickerHighlight: { 
    position: 'absolute', 
    top: 40, 
    left: 0, 
    right: 0, 
    height: 40, 
    backgroundColor: 'rgba(124, 58, 237, 0.08)', 
    borderTopWidth: 1, 
    borderBottomWidth: 1, 
    borderColor: 'rgba(124, 58, 237, 0.15)', 
    zIndex: 1
  },
  pickerItem: { height: 40, justifyContent: 'center', alignItems: 'center' },
  pickerItemText: { fontSize: 13, color: 'rgba(255, 255, 255, 0.25)' },
  pickerItemTextActive: { fontSize: 15, fontWeight: 'bold', color: '#fff', zIndex: 2 },

  // Editing forms
  inlineEditForm: { 
    backgroundColor: '#151622', 
    borderWidth: 1, 
    borderColor: 'rgba(124, 58, 237, 0.2)', 
    borderRadius: 16, 
    padding: 16, 
    gap: 10, 
    marginVertical: 8 
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  editBtn: { flex: 1, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  saveBtn: { backgroundColor: '#7c3aed' },
  cancelBtn: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  editBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  mealActions: { borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.05)', paddingVertical: 12, alignItems: 'flex-start' },
  clearBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.2)', backgroundColor: 'rgba(244, 63, 94, 0.05)' },
  clearBtnText: { color: '#f43f5e', fontSize: 11, fontWeight: 'bold' }
});
