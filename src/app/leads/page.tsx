"use client"
import { Header } from "@/components/common"
import LeadsPage from "@/components/screens/Leads/LeadPage"
import DashboardLayout from "@/layouts/DashboardLayout"

const Page = () => {
  return (
    <DashboardLayout
      header={
        <Header
          title="Leads"
          description="Manage and track your leads from different channels."
        //   action={
        //     <button className="bg-brand-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-secondary transition-colors">
        //       Complete Your Profile
        //     </button>
        //   }
        />
      }
    >
      <LeadsPage />
    </DashboardLayout>
  )
}

export default Page
