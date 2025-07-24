"use client";
import type React from "react";
import { useState } from "react";
// import DashboardLayout from "@/components/layout/dashboard-layout";
import DashboardLayout from "@/layouts/DashboardLayout";
import SimpleBarChart from "@/components/common/charts/simple-bar-chart";
import { UserPlus, Calendar, TrendingUp, Users, Plus, X, CheckCircle, Upload } from "lucide-react";
import ConversionFunnel from "@/components/common/charts/conversion-funnel";
import LeadSourcesLineChart from "@/components/common/charts/lead-sources-line-chart";

export default function DashboardPage() {
  const [appointmentFilter, setAppointmentFilter] = useState("month");
  const [hubspotConnected, setHubspotConnected] = useState(false);
  const [csvUploaded, setCsvUploaded] = useState(false);
  const [zapierActive, setZapierActive] = useState(true);
  const [showZapierBanner, setShowZapierBanner] = useState(true);
  const [showHubspotBanner, setShowHubspotBanner] = useState(true);
  const [showCsvBanner, setShowCsvBanner] = useState(true);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  const [newTask, setNewTask] = useState({
    task: "",
    priority: "medium",
    time: "",
  });

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
  const leadsData = [
    {
      id: "1",
      name: "John Smith",
      email: "john.smith@email.com",
      phone: "+1 (555) 123-4567",
      source: "HubSpot",
      specialty: "Cardiology",
      score: 85,
      status: "booked",
      date: "2024-01-15",
    },
    {
      id: "2",
      name: "Sarah Johnson",
      email: "sarah.j@email.com",
      phone: "+1 (555) 234-5678",
      source: "Zapier",
      specialty: "Dermatology",
      score: 72,
      status: "attempted",
      date: "2024-01-14",
    },
    {
      id: "3",
      name: "Mike Wilson",
      email: "mike.w@email.com",
      phone: "+1 (555) 345-6789",
      source: "Email",
      specialty: "Orthopedics",
      score: 95,
      status: "booked",
      date: "2024-01-13",
    },
  ];

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

  const getConversionRate = () => {
    if (leadsData.length === 0) return 0;
    const bookedLeads = leadsData.filter((lead: any) => lead.status === "booked").length;
    return Math.round((bookedLeads / leadsData.length) * 100);
  };

  return (
    <DashboardLayout>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-2">Welcome back! Here&apos;s what&apos;s happening with your clinic today.</p>
        </div>

        {/* Integration Banners */}
        {showHubspotBanner && (
          <div className={`mb-4 p-4 rounded-lg border ${hubspotConnected ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-3 ${hubspotConnected ? "bg-green-400" : "bg-blue-400"}`}></div>
                <div>
                  <div className="font-semibold flex items-center">
                    HubSpot Integration
                    {hubspotConnected && <CheckCircle className="w-4 h-4 ml-2 text-green-500" />}
                  </div>
                  <div className="text-sm text-gray-600">
                    {hubspotConnected
                      ? "HubSpot is connected and syncing data successfully."
                      : "Connect your HubSpot account to sync leads and contacts automatically."}
                  </div>
                </div>
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
          </div>
        )}

        {showZapierBanner && (
          <div className="mb-4 p-4 rounded-lg border bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-3 ${zapierActive ? "bg-green-400" : "bg-yellow-400"}`}></div>
                <div>
                  <div className="font-semibold">Zapier Integration</div>
                  <div className="text-sm text-gray-600">
                    {zapierActive ? "Zapier integration is active and working properly." : "Zapier integration is currently inactive."}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
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
                </div>
                <button onClick={() => setShowZapierBanner(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {showCsvBanner && (
          <div className={`mb-6 p-4 rounded-lg border ${csvUploaded ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Upload className={`w-5 h-5 mr-3 ${csvUploaded ? "text-green-500" : "text-blue-500"}`} />
                <div>
                  <div className="font-semibold flex items-center">
                    CSV Upload
                    {csvUploaded && <CheckCircle className="w-4 h-4 ml-2 text-green-500" />}
                  </div>
                  <div className="text-sm text-gray-600">
                    {csvUploaded ? "CSV file uploaded successfully. Data has been processed." : "Upload your lead data to get started"}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="btn btn-secondary btn-sm">View Guide</button>
                <label className="btn btn-primary btn-sm cursor-pointer">
                  {csvUploaded ? "Upload New CSV" : "Upload CSV"}
                  <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <UserPlus className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Leads</p>
                <div className="flex items-center">
                  <p className="text-2xl font-semibold text-gray-900">{leadsData.length}</p>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  this month <span className="text-green-600">+12%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Appointments</p>
                <div className="flex items-center">
                  <p className="text-2xl font-semibold text-gray-900">{appointmentsData.length}</p>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  this month <span className="text-green-600">+8%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                <div className="flex items-center">
                  <p className="text-2xl font-semibold text-gray-900">{getConversionRate()}%</p>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  leads to appointments <span className="text-green-600">+5%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Patients</p>
                <div className="flex items-center">
                  <p className="text-2xl font-semibold text-gray-900">
                    {[...new Set(appointmentsData.map((apt: any) => apt.patient))].length}
                  </p>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  unique patients <span className="text-green-600">+2%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

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
            <ConversionFunnel leadsData={leadsData} appointmentsData={appointmentsData} />
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-6">Lead Sources Trends</h3>
            <LeadSourcesLineChart leadsData={leadsData} />
          </div>
        </div>

        {/* Demographics Charts - Small and Compact */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <div className="card">
            <h3 className="text-lg font-semibold mb-6">Patient Demographics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Small Gender Chart */}
              <div className="flex flex-col items-center">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Gender Distribution</h4>
                <div className="w-32 h-32 flex flex-col items-center justify-center">
                  <div className="relative w-24 h-24 mb-2">
                    <svg width="96" height="96" viewBox="0 0 42 42" className="transform -rotate-90">
                      <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e5e7eb" strokeWidth="3" />
                      {/* Male - Blue */}
                      <circle
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth="3"
                        strokeDasharray="50 50"
                        strokeDashoffset="0"
                      />
                      {/* Female - Pink */}
                      <circle
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="transparent"
                        stroke="#ec4899"
                        strokeWidth="3"
                        strokeDasharray="50 50"
                        strokeDashoffset="-50"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">12</div>
                        <div className="text-xs text-gray-500">Total</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between min-w-[120px]">
                      <div className="flex items-center">
                        <div className="w-2 h-2 mr-2 rounded-full bg-blue-500"></div>
                        <span>Male</span>
                      </div>
                      <span className="font-semibold">6</span>
                    </div>
                    <div className="flex items-center justify-between min-w-[120px]">
                      <div className="flex items-center">
                        <div className="w-2 h-2 mr-2 rounded-full bg-pink-500"></div>
                        <span>Female</span>
                      </div>
                      <span className="font-semibold">6</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Small Age Chart */}
              <div className="flex flex-col items-center">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Age Distribution</h4>
                <div className="w-32 h-32 flex flex-col items-center justify-center">
                  <div className="relative w-24 h-24 mb-2">
                    <svg width="96" height="96" viewBox="0 0 42 42" className="transform -rotate-90">
                      <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e5e7eb" strokeWidth="3" />
                      {/* 45-59 - Light teal */}
                      <circle
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="transparent"
                        stroke="#14b8a6"
                        strokeWidth="3"
                        strokeDasharray="25 75"
                        strokeDashoffset="0"
                      />
                      {/* 30-44 - Medium teal */}
                      <circle
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="transparent"
                        stroke="#0891b2"
                        strokeWidth="3"
                        strokeDasharray="50 50"
                        strokeDashoffset="-25"
                      />
                      {/* 18-29 - Dark teal */}
                      <circle
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="transparent"
                        stroke="#0e7490"
                        strokeWidth="3"
                        strokeDasharray="25 75"
                        strokeDashoffset="-75"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">12</div>
                        <div className="text-xs text-gray-500">Total</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between min-w-[120px]">
                      <div className="flex items-center">
                        <div className="w-2 h-2 mr-2 rounded-full bg-teal-500"></div>
                        <span>45-59</span>
                      </div>
                      <span className="font-semibold">3</span>
                    </div>
                    <div className="flex items-center justify-between min-w-[120px]">
                      <div className="flex items-center">
                        <div className="w-2 h-2 mr-2 rounded-full bg-cyan-600"></div>
                        <span>30-44</span>
                      </div>
                      <span className="font-semibold">6</span>
                    </div>
                    <div className="flex items-center justify-between min-w-[120px]">
                      <div className="flex items-center">
                        <div className="w-2 h-2 mr-2 rounded-full bg-cyan-700"></div>
                        <span>18-29</span>
                      </div>
                      <span className="font-semibold">3</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
