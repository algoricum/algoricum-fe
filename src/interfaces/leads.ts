export type LeadStatus = "new" | "responded" | "needs-follow-up" | "converted" | "closed" |  ''
export type Priority = "high" | "medium" | "low" | ''
export type Channel = "chatbot" | "form" | "email" | ''

export interface Lead {
  id: string
  name: string
  email: string
  phone?: string
  avatar: string
  status: LeadStatus
  priority: Priority
  channel: Channel
  lastMessage: string
  lastActivity: Date
  messages: Message[]
}

export interface Message {
  id: string
  content: string
  timestamp: Date
  isFromLead: boolean
  leadId: string
}

export interface ChannelStats {
  chatbot: number
  form: number
  email: number
  '':any
}
