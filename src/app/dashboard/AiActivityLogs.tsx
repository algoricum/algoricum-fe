"use client";
import { createClient } from "@/utils/supabase/config/client";
import { useEffect, useState } from "react";

interface AiActivityLogProps {
  clinicId: string;
}

type LeadMetrics = {
  "Weekly Booked Leads Count": number;
  "Weekly New Leads Count": number;
  "Weekly Engaged Leads Count": number;
  "Weekly Closed Leads Count": number;
  "Newly Created Leads Count (Last 24 Hours)": number;
  "All Leads Count Per Source": { source_name: string; count: number }[];
};

export default function AiActivityLog({ clinicId }: AiActivityLogProps) {
  const supabase = createClient();
  const [leadMetrics, setLeadMetrics] = useState<LeadMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch lead metrics from Supabase
  useEffect(() => {
    const fetchLeadMetrics = async () => {
      if (!clinicId) return;

      try {
        setLoading(true);
        const { data, error } = await supabase.rpc("get_lead_metrics", { p_clinic_id: clinicId });

        if (error) {
          console.error("Error fetching lead metrics:", error);
          setError("Failed to load lead metrics.");
          return;
        }

        setLeadMetrics(data as LeadMetrics);
      } catch (e) {
        console.error("Unexpected error fetching lead metrics:", e);
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchLeadMetrics();
  }, [clinicId, supabase]);

  if (loading) {
    return (
      <div className="mb-8 grid grid-cols-1 gap-6">
        <div className="card">
          <h3 className="mb-6 text-lg font-semibold">Lead Metrics</h3>
          <div className="flex items-center justify-center py-4">
            <span className="text-sm text-gray-500">Loading metrics...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8 grid grid-cols-1 gap-6">
        <div className="card">
          <h3 className="mb-6 text-lg font-semibold">Lead Metrics</h3>
          <div className="flex items-center justify-center py-4">
            <span className="text-sm text-red-500">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 grid grid-cols-1 gap-6">
      <div className="card">
        <h3 className="mb-6 text-lg font-semibold">Lead Metrics</h3>
        <div className="max-h-96 space-y-4 overflow-y-auto">
          {/* Weekly Booked Leads Count */}
          <div className="flex items-start space-x-3 rounded-lg p-3 hover:bg-gray-50">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                <span className="text-sm">📅</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Weekly Booked Leads</p>
              <p className="mt-1 text-sm text-gray-500">
                {leadMetrics?.["Weekly Booked Leads Count"] ?? 0} {leadMetrics?.["Weekly Booked Leads Count"] === 1 ? "lead" : "leads"}{" "}
                booked in the last 7 days
              </p>
            </div>
          </div>

          {/* Weekly New Leads Count */}
          <div className="flex items-start space-x-3 rounded-lg p-3 hover:bg-gray-50">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                <span className="text-sm">🆕</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Weekly New Leads</p>
              <p className="mt-1 text-sm text-gray-500">
                {leadMetrics?.["Weekly New Leads Count"] ?? 0} {leadMetrics?.["Weekly New Leads Count"] === 1 ? "lead" : "leads"} created in
                the last 7 days
              </p>
            </div>
          </div>

          {/* Weekly Engaged Leads Count */}
          <div className="flex items-start space-x-3 rounded-lg p-3 hover:bg-gray-50">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                <span className="text-sm">🤝</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Weekly Engaged Leads</p>
              <p className="mt-1 text-sm text-gray-500">
                {leadMetrics?.["Weekly Engaged Leads Count"]} {leadMetrics?.["Weekly Engaged Leads Count"] === 1 ? "lead" : "leads"} engaged
                in the last 7 days
              </p>
            </div>
          </div>

          {/* Weekly Closed Leads Count */}
          <div className="flex items-start space-x-3 rounded-lg p-3 hover:bg-gray-50">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                <span className="text-sm">✅</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Weekly Closed Leads</p>
              <p className="mt-1 text-sm text-gray-500">
                {leadMetrics?.["Weekly Closed Leads Count"] ?? 0} {leadMetrics?.["Weekly Closed Leads Count"] === 1 ? "lead" : "leads"}{" "}
                closed in the last 7 days
              </p>
            </div>
          </div>

          {/* Newly Created Leads Count (Last 24 Hours) */}
          <div className="flex items-start space-x-3 rounded-lg p-3 hover:bg-gray-50">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                <span className="text-sm">🕒</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Newly Created Leads (Last 24 Hours)</p>
              <p className="mt-1 text-sm text-gray-500">
                {leadMetrics?.["Newly Created Leads Count (Last 24 Hours)"] ?? 0}{" "}
                {leadMetrics?.["Newly Created Leads Count (Last 24 Hours)"] === 1 ? "lead" : "leads"} created in the last 24 hours
              </p>
            </div>
          </div>

          {/* All Leads Count Per Source */}
          <div className="flex items-start space-x-3 rounded-lg p-3 hover:bg-gray-50">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                <span className="text-sm">📈</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">All Leads by Source</p>
              <div className="mt-1">
                {leadMetrics?.["All Leads Count Per Source"]?.length ? (
                  <ul className="space-y-2">
                    {leadMetrics["All Leads Count Per Source"].map((source, index) => (
                      <li key={index} className="text-sm text-gray-500">
                        {source.source_name}: {source.count} {source.count === 1 ? "lead" : "leads"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No leads by source</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
