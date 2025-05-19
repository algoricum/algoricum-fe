// utils/supabase/clinic-uploads.ts
import { createClient } from './config/client';

const supabase = createClient();

/**
 * Upload clinic logo
 */
export const uploadClinicLogo = async (userId: string, file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('clinic-logos')
    .upload(fileName, file);

  if (uploadError) {
    throw uploadError;
  }

  // Get public URL for the uploaded logo
  const { data: publicUrlData } = supabase.storage
    .from('clinic-logos')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};

/**
 * Upload widget logo
 */
export const uploadWidgetLogo = async (userId: string, file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `widget-${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('clinic-logos')
    .upload(fileName, file);

  if (uploadError) {
    throw uploadError;
  }

  // Get public URL for the uploaded logo
  const { data: publicUrlData } = supabase.storage
    .from('clinic-logos')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};