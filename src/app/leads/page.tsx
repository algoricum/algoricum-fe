// "use client"
// import { Header } from "@/components/common"
// import LeadsPage from "@/components/screens/Leads/LeadPage"
// import DashboardLayout from "@/layouts/DashboardLayout"

// const Page = () => {
//   return (
//     <DashboardLayout
//       header={
//         <Header
//           title="Leads"
//           description="Manage and track your leads from different channels."
//         //   action={
//         //     <button className="bg-brand-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-secondary transition-colors">
//         //       Complete Your Profile
//         //     </button>
//         //   }
//         />
//       }
//     >
//       <LeadsPage />
//     </DashboardLayout>
//   )
// }

// export default Page
"use client";
import type React from "react";
import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { UserPlus, CheckCircle, Clock, X, Search, Plus } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  specialty: string;
  score: number;
  status: string;
  date: string;
}

export default function LeadsPage() {
  const [leadsData, setLeadsData] = useState<Lead[]>([
    {
      id: "1",
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "+1 234 567 890",
      source: "Website",
      specialty: "General",
      score: 85,
      status: "booked",
      date: "2023-01-01",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      phone: "+1 987 654 321",
      source: "HubSpot",
      specialty: "Cardiology",
      score: 70,
      status: "attempted",
      date: "2023-02-15",
    },
    {
      id: "3",
      name: "Peter Jones",
      email: "peter.jones@example.com",
      phone: "+1 123 456 789",
      source: "Email",
      specialty: "Dermatology",
      score: 95,
      status: "booked",
      date: "2023-03-20",
    },
    {
      id: "4",
      name: "Mary Brown",
      email: "mary.brown@example.com",
      phone: "+1 789 012 345",
      source: "Widget",
      specialty: "Orthopedics",
      score: 60,
      status: "dropped",
      date: "2023-04-10",
    },
  ]);

  const [selectedLeadStatus, setSelectedLeadStatus] = useState("all");
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLead, setNewLead] = useState({
    name: "",
    email: "",
    phone: "",
    source: "Website",
    specialty: "General",
    score: 50,
    status: "new",
  });

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    const lead: Lead = {
      id: (leadsData.length + 1).toString(),
      ...newLead,
      date: new Date().toISOString().split("T")[0],
    };
    setLeadsData([...leadsData, lead]);
    setNewLead({
      name: "",
      email: "",
      phone: "",
      source: "Website",
      specialty: "General",
      score: 50,
      status: "new",
    });
    setShowAddLeadModal(false);
  };

  return (
    <DashboardLayout>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-600 mt-2">Manage and track your leads through the conversion process.</p>
        </div>

        {/* Lead Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <UserPlus className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Leads</p>
                <p className="text-2xl font-semibold text-gray-900">{leadsData.length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Booked</p>
                <p className="text-2xl font-semibold text-gray-900">{leadsData.filter(lead => lead.status === "booked").length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Attempted</p>
                <p className="text-2xl font-semibold text-gray-900">{leadsData.filter(lead => lead.status === "attempted").length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Dropped</p>
                <p className="text-2xl font-semibold text-gray-900">{leadsData.filter(lead => lead.status === "dropped").length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <select
                value={selectedLeadStatus}
                onChange={e => setSelectedLeadStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="attempted">Attempted</option>
                <option value="booked">Booked</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>
            <button onClick={() => setShowAddLeadModal(true)} className="btn btn-primary flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Lead</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Source</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Score</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Specialty</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(selectedLeadStatus === "all" ? leadsData : leadsData.filter(lead => lead.status === selectedLeadStatus)).map(lead => (
                  <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold">
                          {lead.name
                            .split(" ")
                            .map(n => n[0])
                            .join("")}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">{lead.name}</p>
                          <p className="text-sm text-gray-500">{lead.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{lead.phone}</td>
                    <td className="py-3 px-4">
                      <span className="badge badge-primary">{lead.source}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`badge ${
                          lead.status === "booked"
                            ? "badge-success"
                            : lead.status === "attempted"
                              ? "badge-warning"
                              : lead.status === "dropped"
                                ? "badge-error"
                                : "badge-info"
                        }`}
                      >
                        {lead.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <span className="font-semibold mr-2">{lead.score}</span>
                        <div className="w-16 h-2 bg-gray-200 rounded-full">
                          <div
                            className={`h-2 rounded-full ${
                              lead.score >= 80 ? "bg-green-500" : lead.score >= 60 ? "bg-yellow-500" : "bg-red-500"
                            }`}
                            style={{ width: `${lead.score}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{lead.specialty}</td>
                    <td className="py-3 px-4 text-gray-900">{lead.date}</td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                        <button className="text-green-600 hover:text-green-800 text-sm">Edit</button>
                        <button className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Lead Modal */}
        {showAddLeadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add New Lead</h3>
                <button onClick={() => setShowAddLeadModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddLead} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newLead.name}
                    onChange={e => setNewLead({ ...newLead, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newLead.email}
                    onChange={e => setNewLead({ ...newLead, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={newLead.phone}
                    onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select
                    required
                    value={newLead.source}
                    onChange={e => setNewLead({ ...newLead, source: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="Website">Website</option>
                    <option value="HubSpot">HubSpot</option>
                    <option value="Zapier">Zapier</option>
                    <option value="Email">Email</option>
                    <option value="Widget">Widget</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                  <select
                    required
                    value={newLead.specialty}
                    onChange={e => setNewLead({ ...newLead, specialty: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="General">General</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Psychiatry">Psychiatry</option>
                    <option value="Gynecology">Gynecology</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lead Score: {newLead.score}</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newLead.score}
                    onChange={e => setNewLead({ ...newLead, score: Number.parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowAddLeadModal(false)} className="flex-1 btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn btn-primary">
                    Add Lead
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
