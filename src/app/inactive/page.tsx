import SystemAccessDenied from "@/components/common/System-access/system-access-denied";
export default function Page() {
  return (
    <SystemAccessDenied
      clinicName="Algoricum Clinic"
      contactEmail="admin@algoricum.com"
      contactPhone="+1 (555) 987-6543"
      supportHours="Monday - Friday, 8:00 AM - 6:00 PM"
    />
  );
}
