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

    const handleOAuthCallback = async () => {
      const supabase = createClient();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        ErrorToast('Authentication failed');
        router.push('/login');
        return;
      }

      const user = session.user;
      
      try {
        // First check if this user exists in the auth.users table by ID 
        // (returning user on new device)
        const { data: existingUser, error: fetchError } = await supabase
          .from('user')
          .select('id, is_email_verified')
          .eq('id', user.id)
          .single();

        // If user exists in our user table, they're a returning user
        if (existingUser) {
          SuccessToast('Welcome back! You\'re now logged in.');
          router.push('/dashboard');
          return;
        }
        
        // Additional check: see if email already exists in the system
        // This handles the case where they previously signed up with a different method
        // but using the same email address
        const { data: emailUser, error: emailError } = await supabase
          .from('user')
          .select('id')
          .eq('email', user.email)
          .single();
          
        if (emailUser) {
          // This is a special case - user exists with this email but different auth provider
          // You might want to handle this differently or just log them in
          SuccessToast('Account found with this email. Logging you in.');
          router.push('/dashboard');
          return;
        }

        // No existing user found - this is a genuine new signup
        // Proceed with creating new user record
        const name = user.user_metadata.full_name || user.user_metadata.name || 'Unknown';
        const email = user.email;
        const { error: insertError } = await supabase
          .from('user')
          .insert([{
            id: user.id,
            name,
            email,
            is_email_verified: true,
          }]);

        if (insertError) {
          // Handle unique constraint violation - this shouldn't happen with our checks,
          // but good to have as a fallback
          if (insertError.code === '23505') {
            SuccessToast('Login successful!');
            router.push('/dashboard');
            return;
          }
          throw insertError;
        }

        SuccessToast('Account created successfully!');
        router.push('/onboarding');

      } catch (e) {
        console.error('Error during user creation:', e);
        ErrorToast('There was a problem setting up your account. Please try again.');
        
        // Clean up - sign out the user if we couldn't create their record
        await supabase.auth.signOut();
        router.push('/signup');
      }
    };

    handleOAuthCallback();
  }, [router]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="text-center p-8 animate-pulse">
        <div className="inline-block mx-auto mb-4">
          <div className="w-12 h-12 border-t-4 border-b-4 border-brand-primary rounded-full animate-spin"></div>
        </div>
        <p className="text-xl font-medium">Processing your authentication...</p>
        <p className="text-gray-500 mt-2">Please wait while we verify your account.</p>
      </div>
    </div>
  );
}