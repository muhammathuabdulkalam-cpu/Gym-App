import React, { createContext, useState, useEffect, useContext } from 'react';
import { getStorageItem, setStorageItem, deleteStorageItem } from '../utils/storage';
import { fetchUserProfile } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const loadUser = async () => {
      try {
        const storedUser = await getStorageItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          
          // Hydrate from backend to sync cross-device updates (like goal weight)
          try {
            const freshProfile = await fetchUserProfile();
            if (freshProfile) {
              const enriched = { 
                ...parsed, 
                ...freshProfile,
                goalWeight: freshProfile.goalWeight !== undefined ? freshProfile.goalWeight : parsed.goalWeight,
                goalType: freshProfile.goalType || parsed.goalType
              };
              setUser(enriched);
              await setStorageItem('user', JSON.stringify(enriched));
            }
          } catch (e) { console.log('Silently failing background hydration', e); }
        }
      } catch (error) {
        console.log('Failed to load user', error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const loginUser = async (userData) => {
    try {
      await setStorageItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.log('Failed to save user', error);
    }
  };

  const updateUserProfile = async (updatedData) => {
    if (!user) return;
    try {
      const newUser = { ...user, ...updatedData };
      await setStorageItem('user', JSON.stringify(newUser));
      setUser(newUser);
    } catch (error) {
      console.log('Failed to update user profile', error);
    }
  };

  const logoutUser = async () => {
    try {
      await deleteStorageItem('user');
      setUser(null);
    } catch (error) {
      console.log('Failed to delete user', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loginUser, logoutUser, updateUserProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
