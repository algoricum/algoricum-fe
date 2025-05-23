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
    .upload(fileName, file, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    throw uploadError;
  }

  return fileName;
};

/**
 * Upload widget logo
 */
export const uploadWidgetLogo = async (userId: string, file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  // Upload the file
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('clinic-logos')
    .upload(fileName, file, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    throw uploadError;
  }

  // Create signed URL with max expiry of 7 days (604800 seconds)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('clinic-logos')
    .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days in seconds

  if (signedUrlError) {
    throw signedUrlError;
  }

  return signedUrlData.signedUrl;
};
