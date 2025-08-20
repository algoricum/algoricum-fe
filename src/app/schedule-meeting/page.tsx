"use client";

import { createClient } from "@supabase/supabase-js";
import { Header } from "@/components/common";
import ScheduleMeetingLayout from "@/layouts/ScheduleMeetingLayout";
import { useSearchParams } from "next/navigation";
import ScheduleMeetingForm from "@/components/schedule-meetings/ScheduleMeetingForm";

const Page = () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const searchParams = useSearchParams();
  const clinicId = searchParams.get("clinic_id");

  return (
    <ScheduleMeetingLayout>
      <Header />
      <div className="max-w-2xl mx-auto p-6">
        <ScheduleMeetingForm supabase={supabase} clinicId={clinicId} />
      </div>
    </ScheduleMeetingLayout>
  );
};

export default Page;
