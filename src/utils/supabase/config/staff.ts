import { createClient } from "./client";

export const createStaffUser = async ({
  email,
  password,
  name,
  clinicId,
  roleId,
}: {
  email: string;
  password: string;
  name: string;
  clinicId: string;
  roleId: string;
}) => {
  const supabase = createClient();

  // 1️⃣ Sign up the user in Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }, // Save name in metadata
    },
  });

  if (authError) return { error: authError };

  // 2️⃣ Insert in `user` table
  const { error: userError } = await supabase.from("user").insert({
    id: authData.user?.id,
    email,
    name,
    user_id: authData.user?.id,
  });

  if (userError) return { error1: userError };

  // 3️⃣ Insert in `user_clinic`
  const { error: ucError } = await supabase.from("user_clinic").insert({
    user_id: authData.user?.id,
    clinic_id: clinicId,
    role_id: roleId,
  });

  if (ucError) return { error1: ucError };

  return { data: authData.user };
};
