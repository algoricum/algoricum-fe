"use client"

import { Lead } from "@/interfaces/leads"
import { formatDistanceToNow } from "date-fns"
import Image from "next/image"

interface LeadCardProps {
  lead: Lead
  isSelected: boolean
  onClick: () => void
}

const LeadCard = ({ lead, isSelected, onClick }: LeadCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-800"
      case "responded":
        return "bg-green-100 text-green-800"
      case "needs-follow-up":
        return "bg-yellow-100 text-yellow-800"
      case "converted":
        return "bg-purple-100 text-purple-800"
      case "closed":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600"
      case "medium":
        return "text-yellow-600"
      case "low":
        return "text-green-600"
      default:
        return "text-gray-600"
    }
  }

  const formatStatus = (status: string) => {
    return status
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
        isSelected ? "bg-blue-50 border-l-4 border-l-brand-primary" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <Image
            src={lead.avatar || "/placeholder.svg"}
            alt={lead.name}
            width={40}
            height={40}
            className="rounded-full object-cover"
          />
          <div
            className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
              lead.status === "new" ? "bg-green-500" : "bg-gray-400"
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-900 truncate">{lead.name}</h3>
            <span className="text-xs text-gray-500">{formatDistanceToNow(lead.lastActivity, { addSuffix: true })}</span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
              {formatStatus(lead.status)}
            </span>
            <span className={`text-xs font-medium ${getPriorityColor(lead.priority)}`}>
              {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}
            </span>
          </div>

          <p className="text-sm text-gray-600 line-clamp-2">{lead.lastMessage}</p>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500 capitalize">{lead.channel}</span>
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(lead.lastActivity, { addSuffix: false })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeadCard
