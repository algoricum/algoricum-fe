"use client";
import { createClient } from "@/utils/supabase/config/client";
import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

const supabase = createClient();

type ConversionData = {
  source_name: string;
  total_leads: number;
  converted_leads: number;
  conversion_rate: number;
};

interface ConversionFunnelProps {
  clinicId: string;
}

export default function ConversionFunnel({ clinicId }: ConversionFunnelProps) {
  const [data, setData] = useState<ConversionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConversionData() {
      if (!clinicId) {
        console.warn("❌ Missing clinicId for Conversion Funnel RPC");
        setError("Clinic ID is required.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Call the Supabase RPC function
        const { data: rpcData, error: rpcError } = await supabase.rpc("get_conversion_funnel", {
          clinic: clinicId,
        });

        if (rpcError) {
          console.error("Error fetching conversion funnel:", rpcError.message);
          setError("Failed to load conversion funnel.");
          return;
        }

        setData(rpcData || []);
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }

    fetchConversionData();
  }, [clinicId]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300 animate-spin" />
        <p className="text-gray-500">Loading conversion funnel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 text-red-300" />
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">No conversion data available</p>
        <p className="text-sm text-gray-400">Add leads to see the conversion funnel</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((row, index) => (
        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
          <div className="flex items-center flex-1">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mr-3">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900">{row.source_name}</span>
                <span className="font-bold text-lg text-purple-600">{row.conversion_rate}%</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">
                  {row.converted_leads} of {row.total_leads} leads converted
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300 bg-gradient-to-r from-purple-500 to-purple-600"
                  style={{
                    width: `${Math.min(row.conversion_rate, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
