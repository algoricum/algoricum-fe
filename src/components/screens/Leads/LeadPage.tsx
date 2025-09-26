import { Lead, fetchMessagesForLead } from "@/utils/supabase/leads-helper";
import { useEffect, useState } from "react";

interface LeadPageProps {
  lead: Partial<Lead> | null;
  clinicId: string;
}

const LeadPage = ({ lead, clinicId }: LeadPageProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Load messages whenever lead changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!lead?.id || !clinicId) return;

      try {
        setLoadingMessages(true);
        const msgs = await fetchMessagesForLead(lead.id, clinicId, lead.thread_id);
        setMessages(msgs);
      } catch (err) {
        console.error("Error loading messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [lead?.id, lead?.thread_id, clinicId]);

  if (!lead) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-lg mb-2">Select a lead to start chatting</p>
          <p className="text-sm">Choose a lead to view their conversation history and send messages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full mr-3 bg-brand-primary flex items-center justify-center text-white text-lg font-medium">
            {lead?.first_name?.charAt(0).toUpperCase() ?? lead?.name?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div>
            <h2 className="font-medium text-gray-900">{lead?.name ?? "Unknown"}</h2>
            <p className="text-sm text-gray-500">{lead?.email ?? "No email"}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div>
          </div>
        ) : messages.length > 0 ? (
          messages.map((message: any) => (
            <div key={message.id} className={`flex ${message.isFromLead ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.isFromLead ? "bg-gray-100 text-gray-900" : "bg-brand-primary text-white"
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className={`text-xs mt-1 ${message.isFromLead ? "text-gray-500" : "text-blue-100"}`}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm">Start a conversation with this lead</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadPage;
