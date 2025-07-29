"use client";
import type React from "react";
import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Calendar, CheckCircle, Clock, X, Search, Plus } from "lucide-react";
import {Header} from "@/components/common"
interface Appointment {
  id: string;
  patient: string;
  doctor: string;
  date: string;
  time: string;
  type: string;
  phone: string;
  gender: string;
  age: string;
  status: string;
}

interface DemographicData {
  name: string;
  value: number;
  color: string;
}

export default function AppointmentsPage() {
  const [appointmentsData, setAppointmentsData] = useState<Appointment[]>([
    {
      id: "1",
      patient: "John Doe",
      doctor: "Dr. Sarah Johnson",
      date: "2023-10-27",
      time: "10:00",
      type: "Consultation",
      phone: "123-456-7890",
      gender: "Male",
      age: "30",
      status: "completed",
    },
    {
      id: "2",
      patient: "Jane Smith",
      doctor: "Dr. Michael Wilson",
      date: "2023-10-28",
      time: "11:00",
      type: "Follow-up",
      phone: "987-654-3210",
      gender: "Female",
      age: "25",
      status: "pending",
    },
    {
      id: "3",
      patient: "Peter Brown",
      doctor: "Dr. Robert Chen",
      date: "2023-10-29",
      time: "14:00",
      type: "Treatment",
      phone: "112-358-4697",
      gender: "Male",
      age: "40",
      status: "cancelled",
    },
  ]);

  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    patient: "",
    doctor: "",
    date: "",
    time: "",
    type: "Consultation",
    phone: "",
    gender: "Male",
    age: "",
    status: "pending",
  });

  const [genderData, setGenderData] = useState<DemographicData[]>([]);
  const [ageGroupData, setAgeGroupData] = useState<DemographicData[]>([]);

  const handleAddAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const appointment = {
      id: (appointmentsData.length + 1).toString(),
      ...newAppointment,
    };
    setAppointmentsData([...appointmentsData, appointment]);
    setNewAppointment({
      patient: "",
      doctor: "",
      date: "",
      time: "",
      type: "Consultation",
      phone: "",
      gender: "Male",
      age: "",
      status: "pending",
    });
    setShowAddAppointmentModal(false);
  };

  useEffect(() => {
    const updateDemographics = () => {
      const genderCounts: { [key: string]: number } = {};
      const ageCounts: { [key: string]: number } = {};

      appointmentsData.forEach(apt => {
        genderCounts[apt.gender] = (genderCounts[apt.gender] || 0) + 1;
        const age = Number.parseInt(apt.age, 10);
        if (age >= 0 && age <= 10) ageCounts["0-10"] = (ageCounts["0-10"] || 0) + 1;
        else if (age >= 11 && age <= 20) ageCounts["11-20"] = (ageCounts["11-20"] || 0) + 1;
        else if (age >= 21 && age <= 30) ageCounts["21-30"] = (ageCounts["21-30"] || 0) + 1;
        else if (age >= 31 && age <= 40) ageCounts["31-40"] = (ageCounts["31-40"] || 0) + 1;
        else if (age >= 41 && age <= 50) ageCounts["41-50"] = (ageCounts["41-50"] || 0) + 1;
        else if (age >= 51 && age <= 60) ageCounts["51-60"] = (ageCounts["51-60"] || 0) + 1;
        else if (age >= 61 && age <= 70) ageCounts["61-70"] = (ageCounts["61-70"] || 0) + 1;
        else if (age >= 71 && age <= 80) ageCounts["71-80"] = (ageCounts["71-80"] || 0) + 1;
        else if (age >= 81 && age <= 90) ageCounts["81-90"] = (ageCounts["81-90"] || 0) + 1;
        else if (age >= 91 && age <= 100) ageCounts["91-100"] = (ageCounts["91-100"] || 0) + 1;
      });

      setGenderData(
        Object.entries(genderCounts).map(([name, value]) => ({
          name,
          value,
          color: name === "Male" ? "#3b82f6" : "#ec4899",
        })),
      );
      setAgeGroupData(
        Object.entries(ageCounts).map(([name, value]) => ({
          name,
          value,
          color: "#8b5cf6",
        })),
      );
    };
    updateDemographics();
  }, [appointmentsData]);

  return (
    <DashboardLayout header={<Header title="Appointments" description="Manage patient appointments and scheduling." />}>
      <div>

        {/* Appointment Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-semibold text-gray-900">{appointmentsData.length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">{appointmentsData.filter(apt => apt.status === "completed").length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-semibold text-gray-900">{appointmentsData.filter(apt => apt.status === "pending").length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cancelled</p>
                <p className="text-2xl font-semibold text-gray-900">{appointmentsData.filter(apt => apt.status === "cancelled").length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Demographics Charts */}
        <div className="card mb-8">
          <h3 className="text-lg font-semibold mb-6">Patient Demographics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Gender Chart */}
            <div className="flex flex-col items-center">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Gender Distribution</h4>
              <div className="w-32 h-32 flex flex-col items-center justify-center">
                <div className="relative w-24 h-24 mb-2">
                  <svg width="96" height="96" viewBox="0 0 42 42" className="transform -rotate-90">
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e5e7eb" strokeWidth="3" />
                    {genderData.map((item, index) => {
                      const total = genderData.reduce((sum, item) => sum + item.value, 0);
                      if (total === 0) return null;
                      const percentage = (item.value / total) * 100;
                      const strokeDasharray = `${percentage} ${100 - percentage}`;
                      const strokeDashoffset = -genderData.slice(0, index).reduce((sum, item) => sum + (item.value / total) * 100, 0);
                      return (
                        <circle
                          key={index}
                          cx="21"
                          cy="21"
                          r="15.915"
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="3"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{genderData.reduce((sum, item) => sum + item.value, 0)}</div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  {genderData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between min-w-[120px]">
                      <div className="flex items-center">
                        <div className="w-2 h-2 mr-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span>{item.name}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Age Chart */}
            <div className="flex flex-col items-center">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Age Distribution</h4>
              <div className="w-32 h-32 flex flex-col items-center justify-center">
                <div className="relative w-24 h-24 mb-2">
                  <svg width="96" height="96" viewBox="0 0 42 42" className="transform -rotate-90">
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e5e7eb" strokeWidth="3" />
                    {ageGroupData.map((item, index) => {
                      const total = ageGroupData.reduce((sum, item) => sum + item.value, 0);
                      if (total === 0) return null;
                      const percentage = (item.value / total) * 100;
                      const strokeDasharray = `${percentage} ${100 - percentage}`;
                      const strokeDashoffset = -ageGroupData.slice(0, index).reduce((sum, item) => sum + (item.value / total) * 100, 0);
                      return (
                        <circle
                          key={index}
                          cx="21"
                          cy="21"
                          r="15.915"
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="3"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{ageGroupData.reduce((sum, item) => sum + item.value, 0)}</div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  {ageGroupData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between min-w-[120px]">
                      <div className="flex items-center">
                        <div className="w-2 h-2 mr-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span>{item.name}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Appointments Table */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search appointments..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <select className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button onClick={() => setShowAddAppointmentModal(true)} className="btn btn-primary flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              New Appointment
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Patient</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Doctor</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date & Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Demographics</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointmentsData.map(appointment => (
                  <tr key={appointment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                          {appointment.patient
                            .split(" ")
                            .map(n => n[0])
                            .join("")}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">{appointment.patient}</p>
                          <p className="text-sm text-gray-500">{appointment.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{appointment.doctor}</td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-gray-900">{appointment.date}</p>
                        <p className="text-sm text-gray-500">{appointment.time}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{appointment.type}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`badge ${
                          appointment.status === "completed"
                            ? "badge-success"
                            : appointment.status === "confirmed"
                              ? "badge-info"
                              : appointment.status === "pending"
                                ? "badge-warning"
                                : "badge-error"
                        }`}
                      >
                        {appointment.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        {appointment.gender && <p>{appointment.gender}</p>}
                        {appointment.age && <p className="text-gray-500">{appointment.age} years</p>}
                      </div>
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

        {/* Add Appointment Modal */}
        {showAddAppointmentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add New Appointment</h3>
                <button onClick={() => setShowAddAppointmentModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddAppointment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
                  <input
                    type="text"
                    required
                    value={newAppointment.patient}
                    onChange={e => setNewAppointment({ ...newAppointment, patient: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
                  <select
                    required
                    value={newAppointment.doctor}
                    onChange={e => setNewAppointment({ ...newAppointment, doctor: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select Doctor</option>
                    <option value="Dr. Sarah Johnson">Dr. Sarah Johnson</option>
                    <option value="Dr. Michael Wilson">Dr. Michael Wilson</option>
                    <option value="Dr. Robert Chen">Dr. Robert Chen</option>
                    <option value="Dr. Lisa Anderson">Dr. Lisa Anderson</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={newAppointment.date}
                      onChange={e => setNewAppointment({ ...newAppointment, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      required
                      value={newAppointment.time}
                      onChange={e => setNewAppointment({ ...newAppointment, time: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={newAppointment.phone}
                    onChange={e => setNewAppointment({ ...newAppointment, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      required
                      value={newAppointment.gender}
                      onChange={e => setNewAppointment({ ...newAppointment, gender: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="120"
                      value={newAppointment.age}
                      onChange={e => setNewAppointment({ ...newAppointment, age: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    required
                    value={newAppointment.type}
                    onChange={e => setNewAppointment({ ...newAppointment, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Treatment">Treatment</option>
                    <option value="Check-up">Check-up</option>
                  </select>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowAddAppointmentModal(false)} className="flex-1 btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn btn-primary">
                    Add Appointment
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
