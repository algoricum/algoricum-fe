import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { saveUser, clearUser } from '@/redux/accessors/user.accessors';

// Custom hook for managing Supabase authentication
export function useSupabaseAuth() {
  const router = useRouter();
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up the auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setLoading(true);
        if (currentSession) {
          // Fetch the user data from our custom user table
          const { data: userData, error } = await supabase
            .from('user')
            .select('*')
            .eq('id', currentSession.user.id)
            .single();
          if (!error && userData) {
            setUser(userData);
            saveUser(userData);
          } else {
            // If there's an error or no user data, but we have a session,
            // it might be a social login where we need to create a profile
            if (event === 'SIGNED_IN') {
              router.refresh();
            }
          }
        } else {
          setUser(null);
          clearUser();
          
          if (event === 'SIGNED_OUT') {
            router.push('/login');
          }
        }
        
        setLoading(false);
      }
    );

    // Initial session check
    const initializeAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      
      if (initialSession) {
        setSession(initialSession);
        
        // Fetch user data from our custom table
        const { data: userData, error } = await supabase
          .from('user')
          .select('*')
          .eq('id', initialSession.user.id)
          .single();

        if (!error && userData) {
          setUser(userData);
          saveUser(userData);
        }
      }
      
      setLoading(false);
    };

    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Sign out function
  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    clearUser();
    setLoading(false);
  };

  return {
    session,
    user,
    loading,
    signOut,
    supabase
  };
}

// Hook for accessing clinic data for the current user
export function useClinic() {
  const { user, supabase } = useSupabaseAuth();
  const [clinics, setClinics] = useState<any[]>([]);
  const [currentClinic, setCurrentClinic] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClinics = async () => {
      if (!user) {
        setClinics([]);
        setCurrentClinic(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Get all clinics this user belongs to
        const { data, error } = await supabase
          .from('user_clinic')
          .select(`
            clinic_id,
            role,
            position,
            is_active,
            clinic (*)
          `)
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (error) throw error;

        if (data && data.length > 0) {
          // Format clinic data
          const formattedClinics = data.map(item => ({
            ...item.clinic,
            role: item.role,
            position: item.position
          }));
          
          setClinics(formattedClinics);
          
          // Set the first clinic as current by default
          if (!currentClinic) {
            setCurrentClinic(formattedClinics[0]);
          }
        } else {
          setClinics([]);
          setCurrentClinic(null);
        }
      } catch (error) {
        console.error('Error fetching clinics:', error);
        setClinics([]);
        setCurrentClinic(null);
      } finally {
        setLoading(false);
      }
    };

    fetchClinics();
  }, [user, supabase]);

  // Function to switch between clinics
  const switchClinic = (clinicId: string) => {
    const clinic = clinics.find(c => c.id === clinicId);
    if (clinic) {
      setCurrentClinic(clinic);
      return true;
    }
    return false;
  };

  return {
    clinics,
    currentClinic,
    loading,
    switchClinic
  };
}