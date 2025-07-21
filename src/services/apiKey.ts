// services/apiKey.ts
import { createClient } from '@/utils/supabase/config/client';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabase = createClient();
const STORAGE_PREFIX = 'algoricum_';
const CLINIC_API_KEY = `${STORAGE_PREFIX}clinic_api_key`;
// Interface for creating an API key
interface CreateAPIKeyProps {
  name: string;
  clinicId: string;
}

// Interface for API key response
interface APIKeyResponse {
  api_key: string;
  expires_at: string;
}

// API key expiration duration in days
const API_KEY_EXPIRATION_DAYS = 365;

const apiKeyService = {
  /**
   * Create a new API key for a clinic
   * @param data API key creation data
   * @returns Promise with API key details
   */
  create: async (data: CreateAPIKeyProps): Promise<APIKeyResponse> => {
    try {
      // Check if API key with this name already exists for the clinic
      const { data: existingKey, error: checkError } = await supabase
        .from('api_key')
        .select('*')
        .eq('name', data.name)
        .eq('clinic_id', data.clinicId)
        .maybeSingle();

      if (checkError) {
        throw new Error(checkError.message);
      }

      if (existingKey) {
        throw new Error('API Key already exists with this name');
      }

      // Generate a secure random API key
      const unhashed_key = self.crypto.randomUUID().replace(/-/g, '');
      const unhashed_key_with_clinic = `${data.clinicId}.${unhashed_key}`;
      
      // Hash the API key for storage
      const encoder = new TextEncoder();
      const data_to_hash = encoder.encode(unhashed_key);
      const hash_buffer = await self.crypto.subtle.digest('SHA-256', data_to_hash);
      
      // Convert hash to hex string
      const hashed_api_key = Array.from(new Uint8Array(hash_buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Calculate expiration date
      const now = new Date();
      const key_expires_at = new Date(now);
      key_expires_at.setDate(now.getDate() + API_KEY_EXPIRATION_DAYS);

      // Insert the API key record
      const { error } = await supabase
        .from('api_key')
        .insert({
          id: uuidv4(),
          name: data.name,
          api_key: hashed_api_key,
          key_expires_at: key_expires_at.toISOString(),
          clinic_id: data.clinicId,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      localStorage.setItem(CLINIC_API_KEY, unhashed_key_with_clinic);
      // Return the unhashed key and expiration (only time this will be available)
      return {
        api_key: unhashed_key_with_clinic,
        expires_at: key_expires_at.toISOString()
      };
    } catch (error: any) {
      throw new Error(`Failed to create API key: ${error.message}`);
    }
  },

  /**
   * Validate an API key
   * @param apiKey The API key to validate
   * @returns Promise with validation result
   */
  validate: async (apiKey: string): Promise<boolean> => {
    try {
      // Extract clinic ID and key
      const parts = apiKey.split('.');
      if (parts.length !== 2) {
        return false;
      }

      const [clinicId, unhashed_key] = parts;
      
      // Hash the provided key
      const encoder = new TextEncoder();
      const data_to_hash = encoder.encode(unhashed_key);
      const hash_buffer = await self.crypto.subtle.digest('SHA-256', data_to_hash);
      
      // Convert hash to hex string
      const hashed_key = Array.from(new Uint8Array(hash_buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Look up the API key
      const { data: apiKeyData, error } = await supabase
        .from('api_key')
        .select('*')
        .eq('api_key', hashed_key)
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (error || !apiKeyData) {
        return false;
      }

      // Check if the key has expired
      const now = new Date();
      if (new Date(apiKeyData.key_expires_at) < now) {
        return false;
      }

      // Update last used timestamp
      await supabase
        .from('api_key')
        .update({ 
          last_used_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', apiKeyData.id);

      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get all API keys for a clinic
   * @param clinicId The clinic ID
   * @returns Promise with API keys
   */
  getClinicApiKeys: async (clinicId: string) => {
    try {
      const { data, error } = await supabase
        .from('api_key')
        .select('id, name, created_at, last_used_at, key_expires_at')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error: any) {
      throw new Error(`Failed to fetch API keys: ${error.message}`);
    }
  },

  /**
   * Delete an API key
   * @param id The API key ID
   * @returns Promise with success status
   */
  delete: async (id: string) => {
    try {
      const { error } = await supabase
        .from('api_key')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to delete API key: ${error.message}`);
    }
  }
};

export default apiKeyService;