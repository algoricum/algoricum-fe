"use client";
import type React from "react";
import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Users, UserPlus, Calendar, Search, Plus, X } from "lucide-react";
import { Header } from "@/components/common";
import { createClient } from "@/utils/supabase/config/client";
import { createStaffUser } from "@/utils/supabase/config/staff";
import { getCurrentUserClinic} from "@/utils/supabase/leads-helper"

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  createdBy: string;
  password: string;
  avatar: string;
}

export default function StaffPage() {
  const supabase = createClient();
  const [staffData, setStaffData] = useState<Staff[]>([
    {
      id: "1",
      name: "Dr. John Doe",
      email: "john.doe@example.com",
      role: "Doctor",
      createdBy: "Admin",
      password: "••••••••",
      avatar: "JD",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      role: "Nurse",
      createdBy: "Admin",
      password: "••••••••",
      avatar: "JS",
    },
    {
      id: "3",
      name: "Mike Johnson",
      email: "mike.johnson@example.com",
      role: "Receptionist",
      createdBy: "Admin",
      password: "••••••••",
      avatar: "MJ",
    },
  ]);

  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    email: "",
  });

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    const clinin_id=await getCurrentUserClinic()

    if (!newStaff.email) {
      alert("Please enter staff email");
      return;
    }
    
    const { data, error1 } = await createStaffUser({
      email: newStaff.email,
      password: "Temp1234", // you can generate random password
      name: "Receptionist 1",
      clinicId: clinin_id,
      roleId: "074a8cb5-03ea-422c-8786-da5ef8fd5d00",
    });

    if (error1) {
      console.error(error1.message);
    } else {
      console.log("Staff created:", data);
    }

    // 1️⃣ Send Magic Link to staff
    const { error } = await supabase.auth.signInWithOtp({
      email: newStaff.email,
      options: {
        shouldCreateUser: true, // Creates user if not exists
        emailRedirectTo: `http://localhost:3001/reset-password`, // Redirect to unified password setup page
      },
    });

    if (error) {
      alert("❌ Failed to send invite: " + error.message);
    } else {
      alert(`✅ Invitation sent to ${newStaff.email}`);

      // Reset form
      setNewStaff({ email: "" });
      setShowAddStaffModal(false);
    }
  };

  return (
    <DashboardLayout header={<Header title="Staff Management" description="Manage your healthcare team and staff information." />}>
      <div>
        {/* Staff Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-2xl font-semibold text-gray-900">{staffData.length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <UserPlus className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Doctors</p>
                <p className="text-2xl font-semibold text-gray-900">{staffData.filter(staff => staff.role === "Doctor").length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Nurses</p>
                <p className="text-2xl font-semibold text-gray-900">{staffData.filter(staff => staff.role === "Nurse").length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Support</p>
                <p className="text-2xl font-semibold text-gray-900">{staffData.filter(staff => staff.role === "Receptionist").length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Staff Table */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <select className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                <option value="all">All Roles</option>
                <option value="Doctor">Doctor</option>
                <option value="Nurse">Nurse</option>
                <option value="Receptionist">Receptionist</option>
              </select>
            </div>
            <button onClick={() => setShowAddStaffModal(true)} className="btn btn-primary flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Add Staff Member
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Staff Member</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Created By</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffData.map(staff => (
                  <tr key={staff.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                          {staff.avatar}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">{staff.name}</p>
                          <p className="text-sm text-gray-500">{staff.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{staff.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`badge ${
                          staff.role === "Doctor" ? "badge-info" : staff.role === "Nurse" ? "badge-success" : "badge-warning"
                        }`}
                      >
                        {staff.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{staff.createdBy}</td>
                    <td className="py-3 px-4">
                      <span className="badge badge-success">Active</span>
                    </td>
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

        {/* Add Staff Modal */}
        {showAddStaffModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add New Staff Member</h3>
                <button onClick={() => setShowAddStaffModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddStaff} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newStaff.email}
                    onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter email address"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowAddStaffModal(false)} className="flex-1 btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn btn-primary">
                    Invite Staff
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
