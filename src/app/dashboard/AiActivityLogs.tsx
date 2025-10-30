"use client";
import { createClient } from "@/utils/supabase/config/client";
import { useEffect, useState } from "react";

import { AiActivityLogProps, LeadMetrics, METRIC_CONFIG } from "./types";

// Helper functions
const formatLeadCount = (count: number | undefined): string => {
  const safeCount = count ?? 0;
  return `${safeCount} ${safeCount === 1 ? "lead" : "leads"}`;
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

  if (loading) return <StateDisplay message="Loading metrics..." />;
  if (error) return <StateDisplay message={error} isError />;
  if (!leadMetrics) return <StateDisplay message="No metrics available" />;

  return (
    <div className="mb-8 grid grid-cols-1 gap-6">
      <div className="card">
        <h3 className="mb-6 text-lg font-semibold">Lead Metrics</h3>
        <div className="max-h-96 space-y-4 overflow-y-auto">
          {METRIC_CONFIG.map(metric => (
            <MetricItem
              key={metric.key}
              icon={metric.icon}
              title={metric.title}
              count={leadMetrics[metric.key] as number}
              description={metric.description}
            />
          ))}

          <LeadsBySourceItem sources={leadMetrics["All Leads Count Per Source"]} />
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StateDisplay({ message, isError = false }: { message: string; isError?: boolean }) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-6">
      <div className="card">
        <h3 className="mb-6 text-lg font-semibold">Lead Metrics</h3>
        <div className="flex items-center justify-center py-4">
          <span className={`text-sm ${isError ? "text-red-500" : "text-gray-500"}`}>{message}</span>
        </div>
      </div>
    </div>
  );
}

function MetricItem({ icon, title, count, description }: { icon: string; title: string; count: number; description: string }) {
  return (
    <div className="flex items-start space-x-3 rounded-lg p-3 hover:bg-gray-50">
      <div className="flex-shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
          <span className="text-sm">{icon}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-500">
          {formatLeadCount(count)} {description}
        </p>
      </div>
    </div>
  );
}

function LeadsBySourceItem({ sources }: { sources: { source_name: string; count: number }[] | undefined }) {
  return (
    <div className="flex items-start space-x-3 rounded-lg p-3 hover:bg-gray-50">
      <div className="flex-shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
          <span className="text-sm">📈</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">All Leads by Source</p>
        <div className="mt-1">
          {sources?.length ? (
            <ul className="space-y-2">
              {sources.map((source, index) => (
                <li key={index} className="text-sm text-gray-500">
                  {source.source_name}: {formatLeadCount(source.count)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No leads by source</p>
          )}
        </div>
      </div>
    </div>
  );
}
