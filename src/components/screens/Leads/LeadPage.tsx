// components/LeadsPage.tsx - Fixed and optimized
import {
  ChannelStats,
  fetchLeadsForClinic,
  fetchMessagesForLead,
  formatStatus,
  getChannelStats,
  getCurrentUserClinic,
  getInterestColor,
  getStatusColor,
  getUrgencyColor,
  INTEREST_LEVELS,
  Lead,
  LEAD_STATUSES,
  LeadsFilters,
  sendMessageToLead,
  updateLeadStatus,
  URGENCY_LEVELS,
} from "@/utils/supabase/leads-helper";
import { useCallback, useEffect, useMemo, useState } from "react";

type Channel = "chatbot" | "form" | "email";

const LeadsPage = () => {
  // State management
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [interestFilter, setInterestFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [channelStats, setChannelStats] = useState<ChannelStats>({ chatbot: 0, form: 0, email: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get current user's clinic
        const currentClinicId = await getCurrentUserClinic();
        setClinicId(currentClinicId);

        // Fetch leads and channel stats
        const [leadsData, statsData] = await Promise.all([fetchLeadsForClinic(currentClinicId), getChannelStats(currentClinicId)]);

        setLeads(leadsData);
        setChannelStats(statsData);

        // Set first lead as selected if available
        if (leadsData.length > 0) {
          setSelectedLead(leadsData[0]);
        }
      } catch (err) {
        console.error("Error initializing leads data:", err);
        setError(err instanceof Error ? err.message : "Failed to load leads data");
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  // FIXED: Load messages for selected lead with proper dependency
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedLead?.id || !clinicId) return;

      // Don't reload messages if they're already loaded
      if (selectedLead.messages && selectedLead.messages.length > 0) return;

      try {
        setLoadingMessages(true);
        const messages = await fetchMessagesForLead(
          selectedLead.id,
          clinicId,
          selectedLead.thread_id, // Pass thread_id for optimization
        );

        setSelectedLead(prev => (prev ? { ...prev, messages } : null));
      } catch (err) {
        console.error("Error loading messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedLead?.id, clinicId, selectedLead?.messages, selectedLead?.thread_id]); // Fixed dependency array

  // OPTIMIZED: Refresh leads data with better filtering
  const refreshLeads = useCallback(async () => {
    if (!clinicId) return;

    try {
      const filters: LeadsFilters = {
        status: statusFilter !== "all" ? statusFilter : undefined,
        interest_level: interestFilter !== "all" ? interestFilter : undefined,
        urgency: urgencyFilter !== "all" ? urgencyFilter : undefined,
        channel: activeChannel !== "all" ? activeChannel : undefined,
        search: searchQuery || undefined,
      };

      const leadsData = await fetchLeadsForClinic(clinicId, filters);
      setLeads(leadsData);
    } catch (err) {
      console.error("Error refreshing leads:", err);
      setError("Failed to refresh leads");
    }
  }, [clinicId, statusFilter, interestFilter, urgencyFilter, activeChannel, searchQuery]);

  // Refresh when filters change
  useEffect(() => {
    refreshLeads();
  }, [refreshLeads]);

  // OPTIMIZED: Filter leads (now mostly server-side)
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesChannel = activeChannel === "all" || lead.channel === activeChannel;
      const matchesSearch =
        searchQuery === "" ||
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (lead.lastMessage && lead.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesChannel && matchesSearch;
    });
  }, [leads, activeChannel, searchQuery]);

  // Handle sending messages
  const handleSendMessage = async (content: string) => {
    if (!selectedLead || !content.trim() || !clinicId) return;

    try {
      setSendingMessage(true);

      // Send message to Supabase
      const newMessage = await sendMessageToLead(
        selectedLead.id,
        clinicId,
        content.trim(),
        false, // isFromUser = false (message from clinic staff)
      );

      // Update selected lead's messages
      setSelectedLead(prev =>
        prev
          ? {
              ...prev,
              messages: [...(prev.messages || []), newMessage],
              lastActivity: new Date(),
              lastMessage: content.trim(),
            }
          : null,
      );

      // Update the lead in the leads list
      setLeads(prev =>
        prev.map(lead => (lead.id === selectedLead.id ? { ...lead, lastActivity: new Date(), lastMessage: content.trim() } : lead)),
      );

      // Update lead status to 'responded' if it was 'new'
      if (selectedLead.status === "new") {
        await updateLeadStatus(selectedLead.id, { status: "responded" });
        setSelectedLead(prev => (prev ? { ...prev, status: "responded" } : null));
        setLeads(prev => prev.map(lead => (lead.id === selectedLead.id ? { ...lead, status: "responded" } : lead)));
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  // FIXED: Handle lead selection with proper message loading
  const handleSelectLead = async (lead: Lead) => {
    setSelectedLead({ ...lead, messages: [] }); // Clear messages first

    // Load messages for the selected lead
    if (clinicId) {
      try {
        setLoadingMessages(true);
        const messages = await fetchMessagesForLead(lead.id, clinicId, lead.thread_id);
        setSelectedLead(prev => (prev ? { ...prev, messages } : null));
      } catch (err) {
        console.error("Error loading messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    }
  };

  // ENHANCED: Handle comprehensive status updates
  const handleStatusUpdate = async (leadId: string, field: "status" | "interest_level" | "urgency", value: string) => {
    if (!clinicId) return;

    try {
      await updateLeadStatus(leadId, { [field]: value });

      // Update local state
      setLeads(prev => prev.map(lead => (lead.id === leadId ? { ...lead, [field]: value } : lead)));

      if (selectedLead?.id === leadId) {
        setSelectedLead(prev => (prev ? { ...prev, [field]: value } : null));
      }
    } catch (err) {
      console.error("Error updating lead:", err);
      setError(`Failed to update ${field}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leads...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              refreshLeads();
            }}
            className="bg-brand-primary text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with filters */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* ENHANCED: Filters for all three dimensions */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700">Status</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-44 border border-gray-300 rounded px-3 py-2"
              >
                <option value="all">All Statuses</option>
                {LEAD_STATUSES.map(status => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={interestFilter}
                onChange={e => setInterestFilter(e.target.value)}
                className="w-36 border border-gray-300 rounded px-3 py-2"
              >
                <option value="all">Interest Level</option>
                {INTEREST_LEVELS.map(level => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={urgencyFilter}
                onChange={e => setUrgencyFilter(e.target.value)}
                className="w-32 border border-gray-300 rounded px-3 py-2"
              >
                <option value="all">Urgency</option>
                {URGENCY_LEVELS.map(level => (
                  <option key={level} value={level}>
                    {level === "this_month" ? "This Month" : level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-48 border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Channel Tabs */}
          <div className="flex items-center">
            <div className="flex rounded-lg overflow-hidden border border-gray-200 p-3 bg-gray-100">
              <button
                onClick={() => setActiveChannel("all")}
                className={`px-4 py-1 text-sm font-medium transition-colors ${
                  activeChannel === "all" ? "border border-brand-primary rounded-lg bg-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="font-bold">All</span>
                <span className="ms-3 text-gray-600">{channelStats.chatbot + channelStats.form + channelStats.email}</span>
              </button>
              <button
                onClick={() => setActiveChannel("chatbot")}
                className={`px-4 py-1 text-sm font-medium transition-colors ${
                  activeChannel === "chatbot" ? "border border-brand-primary rounded-lg bg-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="font-bold">Chatbot</span>
                <span className="ms-3 text-gray-600">{channelStats.chatbot}</span>
              </button>
              <button
                onClick={() => setActiveChannel("form")}
                className={`px-4 py-1 text-sm font-medium transition-colors ${
                  activeChannel === "form" ? "border border-brand-primary rounded-lg bg-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="font-bold">Form</span>
                <span className="ms-3 text-gray-600">{channelStats.form}</span>
              </button>
              <button
                onClick={() => setActiveChannel("email")}
                className={`px-4 py-1 text-sm font-medium transition-colors ${
                  activeChannel === "email" ? "border border-brand-primary rounded-lg bg-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="font-bold">Email</span>
                <span className="ms-3 text-gray-600">{channelStats.email}</span>
              </button>
            </div>
            <button
              onClick={refreshLeads}
              className="bg-brand-primary ms-2 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Leads list */}
        <div className="w-1/3 border-r border-gray-200 overflow-y-auto hide-scrollbar">
          {filteredLeads.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No leads found matching your filters.</div>
          ) : (
            filteredLeads.map(lead => (
              <div
                key={lead.id}
                onClick={() => handleSelectLead(lead)}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                  selectedLead?.id === lead.id ? "bg-blue-50 border-l-4 border-l-brand-primary" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full mr-3 bg-brand-primary flex items-center justify-center text-white text-sm font-medium">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{lead.name}</h3>
                      <p className="text-sm text-gray-500">{lead.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {lead.interest_level && (
                      <span className={`px-2 py-1 text-xs rounded-full bg-gray-100 ${getInterestColor(lead.interest_level)}`}>
                        {lead.interest_level}
                      </span>
                    )}
                    {lead.urgency && (
                      <span className={`px-2 py-1 text-xs rounded-full bg-gray-100 ${getUrgencyColor(lead.urgency)}`}>
                        {lead.urgency === "this_month" ? "this month" : lead.urgency}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{lead.channel}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 truncate mb-1">{lead.lastMessage}</p>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(lead.status)}`}>{formatStatus(lead.status)}</span>
                  <span className="text-xs text-gray-500">{lead.lastActivity?.toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {selectedLead ? (
            <>
              {/* ENHANCED: Chat header with all status controls */}
              <div className="border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full mr-3 bg-brand-primary flex items-center justify-center text-white text-lg font-medium">
                      {selectedLead.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-medium text-gray-900">{selectedLead.name}</h2>
                      <p className="text-sm text-gray-500">{selectedLead.email}</p>
                    </div>
                  </div>

                  {/* Status controls */}
                  <div className="flex gap-2">
                    <select
                      value={selectedLead.status}
                      onChange={e => handleStatusUpdate(selectedLead.id, "status", e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm"
                    >
                      {LEAD_STATUSES.map(status => (
                        <option key={status} value={status}>
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedLead.interest_level || "low"}
                      onChange={e => handleStatusUpdate(selectedLead.id, "interest_level", e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm"
                    >
                      {INTEREST_LEVELS.map(level => (
                        <option key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedLead.urgency || "curious"}
                      onChange={e => handleStatusUpdate(selectedLead.id, "urgency", e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm"
                    >
                      {URGENCY_LEVELS.map(level => (
                        <option key={level} value={level}>
                          {level === "this_month" ? "This Month" : level.charAt(0).toUpperCase() + level.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div>
                  </div>
                ) : selectedLead.messages && selectedLead.messages.length > 0 ? (
                  selectedLead.messages.map((message: any) => (
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

              {/* Message input */}
              <div className="border-t border-gray-200 p-4">
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const input = form.querySelector("input") as HTMLInputElement;
                    if (input.value.trim()) {
                      handleSendMessage(input.value);
                      input.value = "";
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Type your message..."
                    disabled={sendingMessage}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage}
                    className="bg-brand-primary text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sendingMessage ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
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
                <p className="text-sm">Choose a lead from the list to view their conversation history and send messages.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadsPage;
