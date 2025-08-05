"use client";
import type React from "react";
import { useEffect, useState } from "react";
// import DashboardLayout from "@/components/layout/dashboard-layout";
import DashboardLayout from "@/layouts/DashboardLayout";
import SimpleBarChart from "@/components/common/charts/simple-bar-chart";
import { Calendar, Plus, X, CheckCircle, Upload } from "lucide-react";
import ConversionFunnel from "@/components/common/charts/conversion-funnel";
import LeadSourcesLineChart from "@/components/common/charts/lead-sources-line-chart";
import { Header } from "@/components/common";
import StatsGrid from "./StatsGrid";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";
import { Button } from "antd";

export default function DashboardPage() {
  const [appointmentFilter, setAppointmentFilter] = useState("month");
  const [hubspotConnected, setHubspotConnected] = useState(false);
  const [csvUploaded, setCsvUploaded] = useState(false);
  // const [zapierActive, setZapierActive] = useState(true);
  // const [showZapierBanner, setShowZapierBanner] = useState(true);
  const [showHubspotBanner, setShowHubspotBanner] = useState(false);
  const [showCsvBanner, setShowCsvBanner] = useState(true);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [leadsData, setLeadsData] = useState<any[]>([]);
  const [clinicId, setClinicId] = useState<string>("");
  const supabase = createClient();

  useEffect(() => {
    async function fetchClinicId() {
      const data = await getClinicData();
      if (data?.id) {
        setClinicId(data.id);
      }
      if (data?.uses_hubspot) {
        setShowHubspotBanner(true);
      }
      // setLoading(false);
    }

    fetchClinicId();
  }, []);

  useEffect(() => {
    async function fetchLeads() {
      if (!clinicId) return; // 🛡️ Prevent running if clinicId is not ready

      const { data, error } = await supabase
        .from("lead")
        .select(
          `
        id,
        first_name,
        last_name,
        email,
        phone,
        status,
        created_at,
        source_id:source_id(id),
        source:source_id(name)
      `,
        )
        .eq("clinic_id", clinicId);

      if (error) {
        // setLoading(false);
        return;
      }

      const formatted = data.map((lead: any) => ({
        id: lead.id,
        name: `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim(),
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        date: lead.created_at,
        source_id: lead.source_id ?? "Unknown",
        sourceName: lead.source ?? "Unknown",
      }));

      setLeadsData(formatted);
      // setLoading(false);
    }

    fetchLeads();
  }, [clinicId]);

  const [newTask, setNewTask] = useState({
    task: "",
    priority: "medium",
    time: "",
  });
  // const [loading, setLoading] = useState(true);

  const [tasks, setTasks] = useState([
    {
      id: 1,
      task: "Follow up with John Smith about treatment plan",
      priority: "high",
      time: "09:00",
      completed: false,
    },
    {
      id: 2,
      task: "Review new patient applications",
      priority: "medium",
      time: "11:00",
      completed: false,
    },
    {
      id: 3,
      task: "Send appointment confirmations",
      priority: "low",
      time: "14:00",
      completed: true,
    },
    {
      id: 4,
      task: "Update patient records",
      priority: "medium",
      time: "16:00",
      completed: false,
    },
  ]);

  // Sample data

  const appointmentsData = [
    {
      id: "1",
      patient: "John Smith",
      doctor: "Dr. Sarah Johnson",
      date: "2024-01-15",
      time: "10:00",
      type: "Consultation",
      phone: "+1 (555) 123-4567",
      gender: "Male",
      age: "45",
      status: "confirmed",
    },
    {
      id: "2",
      patient: "Sarah Johnson",
      doctor: "Dr. Michael Wilson",
      date: "2024-01-16",
      time: "14:00",
      type: "Follow-up",
      phone: "+1 (555) 234-5678",
      gender: "Female",
      age: "32",
      status: "completed",
    },
  ];

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setTimeout(() => {
        setCsvUploaded(true);
        setShowCsvBanner(true);
        console.log("CSV file uploaded:", file.name);
      }, 1000);
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const task = {
      id: Date.now(),
      ...newTask,
      completed: false,
    };
    setTasks([...tasks, task]);
    setNewTask({ task: "", priority: "medium", time: "" });
    setShowAddTaskModal(false);
  };

  const toggleTask = (taskId: number) => {
    setTasks(tasks.map(task => (task.id === taskId ? { ...task, completed: !task.completed } : task)));
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      high: { class: "badge-error", label: "HIGH" },
      medium: { class: "badge-warning", label: "MEDIUM" },
      low: { class: "badge-success", label: "LOW" },
    };
    const config = priorityConfig[priority as keyof typeof priorityConfig] || {
      class: "badge-info",
      label: priority.toUpperCase(),
    };
    return <span className={`badge ${config.class}`}>{config.label}</span>;
  };

  return (
    <DashboardLayout
      header={<Header title="Dashboard Overview" description="Welcome back! Here's what's happening with your clinic today." />}
    >
      <div className="p-6 space-y-8">
        {/* Integration Banners */}
        <div className="flex flex-wrap gap-4">
          {showHubspotBanner && (
            <div
              className={`flex-1 min-w-[300px] p-4 rounded-lg border ${hubspotConnected ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center font-semibold">
                  <div className={`w-2 h-2 rounded-full mr-2 ${hubspotConnected ? "bg-green-400" : "bg-blue-400"}`} />
                  <span>HubSpot Integration</span>
                  {hubspotConnected && <CheckCircle className="w-4 h-4 ml-2 text-green-500" />}
                </div>
                <div className="flex items-center space-x-2">
                  {!hubspotConnected && (
                    <button onClick={() => setHubspotConnected(true)} className="btn btn-primary btn-sm">
                      Connect HubSpot
                    </button>
                  )}
                  <button onClick={() => setShowHubspotBanner(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {hubspotConnected
                  ? "HubSpot is connected and syncing data successfully."
                  : "Connect your HubSpot account to sync leads and contacts automatically."}
              </div>
            </div>
          )}

          {/* {showZapierBanner && (
            <div className="p-4 rounded-lg border bg-green-50 border-green-200">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center font-semibold">
                  <div className={`w-2 h-2 rounded-full mr-2 ${zapierActive ? "bg-green-400" : "bg-yellow-400"}`} />
                  <span>Zapier Integration</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{zapierActive ? "Active" : "Inactive"}</span>
                  <button
                    onClick={() => setZapierActive(!zapierActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      zapierActive ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                        zapierActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <button onClick={() => setShowZapierBanner(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {zapierActive ? "Zapier integration is active and working properly." : "Zapier integration is currently inactive."}
              </div>
            </div>
          )} */}

          {showCsvBanner && (
            <div
              className={`flex-1 min-w-[300px] p-4 rounded-lg border ${csvUploaded ? "bg-green-50 border-green-200" : "bg-purple-50 border-purple-200"}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center font-semibold">
                  <Upload className={`w-5 h-5 mr-2 ${csvUploaded ? "text-green-500" : "text-purple-500"}`} />
                  <span>CSV Upload</span>
                  {csvUploaded && <CheckCircle className="w-4 h-4 ml-2 text-green-500" />}
                </div>
                <div className="flex items-center space-x-2">
                  <button className="btn btn-secondary btn-sm">View Guide</button>
                  <label className="btn btn-primary btn-sm cursor-pointer">
                    {csvUploaded ? "Upload New CSV" : "Upload CSV"}
                    <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {csvUploaded ? "CSV file uploaded successfully. Data has been processed." : "Upload your lead data to get started"}
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}

        <StatsGrid clinicId={clinicId} />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Appointment Trends */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Appointment Trends</h3>
              <select
                className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                value={appointmentFilter}
                onChange={e => setAppointmentFilter(e.target.value)}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <SimpleBarChart appointmentsData={appointmentsData} filter={appointmentFilter} />
          </div>

          {/* Today's Tasks */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Today&apos;s Tasks</h3>
              <button onClick={() => setShowAddTaskModal(true)} className="btn btn-primary btn-sm flex items-center">
                <Plus className="w-4 h-4 mr-1" />
                Add Task
              </button>
            </div>
            <div className="space-y-4">
              {tasks.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No tasks for today</p>
                  <p className="text-sm">Add some tasks to get started</p>
                </div>
              ) : (
                tasks.map((task: any) => (
                  <div key={task.id} className="flex items-start space-x-3">
                    <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} className="mt-1 cursor-pointer" />
                    <div className="flex-1">
                      <p className={`text-sm ${task.completed ? "line-through text-gray-500" : "text-gray-900"}`}>{task.task}</p>
                      <div className="flex items-center mt-1 space-x-2">
                        {getPriorityBadge(task.priority)}
                        <span className="text-xs text-gray-500">{task.time}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Lead Sources and Status Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h3 className="text-lg font-semibold mb-6">Conversion Funnel</h3>
            <ConversionFunnel leadsData={leadsData} />
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-6">Lead Sources Trends</h3>
            <LeadSourcesLineChart leadsData={leadsData} />
          </div>
        </div>

        {/* AI Activity Log - Move to separate row */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <div className="card">
            <h3 className="text-lg font-semibold mb-6">AI Activity Log</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {[
                {
                  id: 1,
                  type: "analysis",
                  title: "Patient Risk Assessment",
                  description: "AI analyzed 12 patient records for cardiovascular risk factors",
                  time: "2 min ago",
                  status: "completed",
                  icon: "🤖",
                },
                {
                  id: 2,
                  type: "prediction",
                  title: "Appointment No-Show Prediction",
                  description: "Predicted 3 high-risk no-show appointments for tomorrow",
                  time: "15 min ago",
                  status: "completed",
                  icon: "📊",
                },
                {
                  id: 3,
                  type: "recommendation",
                  title: "Treatment Recommendation",
                  description: "Generated personalized treatment plan for Sarah Johnson",
                  time: "1 hour ago",
                  status: "completed",
                  icon: "💡",
                },
                {
                  id: 4,
                  type: "processing",
                  title: "Lead Scoring Update",
                  description: "Recalculating lead scores based on recent interactions",
                  time: "2 hours ago",
                  status: "processing",
                  icon: "⚡",
                },
                {
                  id: 5,
                  type: "alert",
                  title: "Anomaly Detection",
                  description: "Detected unusual pattern in appointment cancellations",
                  time: "3 hours ago",
                  status: "alert",
                  icon: "⚠️",
                },
                {
                  id: 6,
                  type: "analysis",
                  title: "Sentiment Analysis",
                  description: "Analyzed patient feedback from last week's appointments",
                  time: "4 hours ago",
                  status: "completed",
                  icon: "😊",
                },
              ].map(activity => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-sm">{activity.icon}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          activity.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : activity.status === "processing"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {activity.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{activity.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button className="w-full text-center text-sm text-purple-600 hover:text-purple-800 font-medium">
                View All AI Activities
              </button>
            </div>
          </div>
        </div>

        {/* Add Task Modal */}
        {showAddTaskModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add New Task</h3>
                <button onClick={() => setShowAddTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Task Description</label>
                  <input
                    type="text"
                    required
                    value={newTask.task}
                    onChange={e => setNewTask({ ...newTask, task: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    required
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={newTask.time}
                    onChange={e => setNewTask({ ...newTask, time: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowAddTaskModal(false)} className="flex-1 btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn btn-primary">
                    Add Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
