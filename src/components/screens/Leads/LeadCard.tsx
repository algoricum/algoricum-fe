// components/LeadCard.tsx - Updated for new schema
"use client";
import { Lead, formatStatus, getInterestColor, getStatusColor, getUrgencyColor } from "@/utils/supabase/leads-helper";
import { formatDistanceToNow } from "date-fns";

interface LeadCardProps {
  lead: Lead;
  isSelected: boolean;
  onClick: () => void;
}

const LeadCard = ({ lead, isSelected, onClick }: LeadCardProps) => {
  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
        isSelected ? "bg-blue-50 border-l-4 border-l-brand-primary" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white text-sm font-medium">
            {lead.name.charAt(0).toUpperCase()}
          </div>
          <div
            className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
              lead.status === "new"
                ? "bg-green-500"
                : lead.status === "responded"
                  ? "bg-blue-500"
                  : lead.status === "booked"
                    ? "bg-purple-500"
                    : "bg-gray-400"
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-900 truncate">{lead.name}</h3>
            <span className="text-xs text-gray-500">
              {lead.lastActivity && formatDistanceToNow(lead.lastActivity, { addSuffix: true })}
            </span>
          </div>

          {/* Status and indicators */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>{formatStatus(lead.status)}</span>

            {lead.interest_level && (
              <span className={`px-2 py-1 text-xs font-medium rounded-full bg-gray-100 ${getInterestColor(lead.interest_level)}`}>
                {lead.interest_level.charAt(0).toUpperCase() + lead.interest_level.slice(1)} Interest
              </span>
            )}

            {lead.urgency && (
              <span className={`px-2 py-1 text-xs font-medium rounded-full bg-gray-100 ${getUrgencyColor(lead.urgency)}`}>
                {lead.urgency === "this_month" ? "This Month" : lead.urgency.charAt(0).toUpperCase() + lead.urgency.slice(1)}
              </span>
            )}
          </div>

          {/* Last message preview */}
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">{lead.lastMessage}</p>

          {/* Footer info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 capitalize">{lead.channel}</span>
              {lead.email && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500 truncate max-w-[120px]">{lead.email}</span>
                </>
              )}
            </div>

            {lead.lastActivity && (
              <span className="text-xs text-gray-400">{formatDistanceToNow(lead.lastActivity, { addSuffix: false })}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadCard;
