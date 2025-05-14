// utils/supabase/user-helper.ts
import { getLocalUserData, setLocalUserData } from '@/helpers/storage-helper';
import { createClient } from './config/client';
import type { User } from '@/interfaces/services_type';

const supabase = createClient();

/**
 * Set user data in both localStorage and Supabase
 */
export const setUserData = async (userData: User): Promise<void> => {
  // Update local storage
  setLocalUserData(userData);

  // Update in Supabase if this is an update operation
  try {
    if (userData.id) {
      const { error } = await supabase
        .from('user')
        .update({
          name: userData.name,
          email: userData.email,
          is_email_verified: userData.is_email_verified,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);

      if (error) {
        console.error('Error updating user data in Supabase:', error);
      }
    }
  } catch (error) {
    console.error('Error in Supabase user update operation:', error);
  }
};

/**
 * Get user data from localStorage or Supabase
 */
export const getUserData = async (): Promise<User | null> => {
  // First try localStorage
  const localUser = getLocalUserData();
  if (localUser) return localUser;

  // If not in localStorage, get from Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Get user profile data from user table
      const { data } = await supabase
        .from('user')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        const userData = data as User;
        setLocalUserData(userData);
        return userData;
      }
    }
  } catch (error) {
    console.error('Error fetching user data from Supabase:', error);
  }

  return null;
};

/**
 * Get current auth user from Supabase
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId: string, updateData: Partial<User>): Promise<User | null> => {
  try {
    const { data, error } = await supabase
      .from('user')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();
      
    if (error) throw error;
    
    if (data) {
      const updatedUser = data as User;
      setLocalUserData(updatedUser);
      return updatedUser;
    }
    
    return null;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};