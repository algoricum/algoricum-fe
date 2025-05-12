'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ErrorToast, SuccessToast } from '@/helpers/toast';

export default function OAuthRedirectPage() {
  const router = useRouter();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const handleOAuthSignup = async () => {
      const supabase = createClient();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        ErrorToast('Failed to complete signup');
        return;
      }

      const user = session.user;
      const name = user.user_metadata.full_name || user.user_metadata.name || 'Unknown';
      const email = user.email;

      try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const now = new Date();
        const otpExpiresAt = new Date(now.getTime() + 120 * 60000);

        const { error: userError } = await supabase
          .from('user')
          .insert([{
            id: user.id,
            name,
            email,
            is_email_verified: true,
            otp,
            otp_expires_at: otpExpiresAt.toISOString()
          }])
          .select()
          .single();

        if (userError) throw userError;

        SuccessToast('Signup completed successfully');
        router.push('/onboarding');

      } catch (e: any) {
        console.error(e.message);
        ErrorToast('Failed to create user record');
      }
    };

    handleOAuthSignup();
  }, [router]);

  return <div className="text-center p-8">Setting up your account...</div>;
}
