"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { MoreVertical, SearchIcon, Mail, User, Edit, Trash2 } from "lucide-react";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  createdBy: string;
  password: string;
  avatar: string;
  joinedDate: string;
  status?: string;
}

interface StaffTableProps {
  staffData: Staff[];
  searchTerm: string;
  selectedRole: string;
  selectedStatus: string;
   
  onEdit: (staff: Staff) => void;
   
  onDelete: (staff: Staff) => void;
  onClearFilters: () => void;
}

export function StaffTable({ staffData, searchTerm, selectedRole, selectedStatus, onEdit, onDelete, onClearFilters }: StaffTableProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const hasFilters = searchTerm || selectedRole !== "all" || selectedStatus !== "all";

  const toggleDropdown = (e: React.MouseEvent, staffId: string) => {
    e.stopPropagation();
    if (activeDropdown === staffId) {
      setActiveDropdown(null);
    } else {
      // Calculate position relative to viewport
      const rect = e.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // 8px gap below the button
        left: rect.right - 192, // 192px is the width of dropdown (w-48)
      });
      setActiveDropdown(staffId);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    if (activeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [activeDropdown]);

  const getRoleBadgeClass = (role: string) => {
    switch (role.toLowerCase()) {
      case "doctor":
        return "bg-blue-50 text-blue-700 ring-blue-600/20";
      case "nurse":
        return "bg-green-50 text-green-700 ring-green-600/20";
      case "admin":
        return "bg-purple-50 text-purple-700 ring-purple-600/20";
      default:
        return "bg-gray-50 text-gray-700 ring-gray-600/20";
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b-2 border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Staff Member</th>
              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Role</th>
              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Joined Date</th>
              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Created By</th>
              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staffData.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  {hasFilters ? (
                    <div className="flex flex-col items-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
                        <SearchIcon className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="mb-2 text-lg font-medium text-gray-700">No staff members match your filters</p>
                      <button
                        onClick={onClearFilters}
                        className="mt-2 text-sm font-medium text-purple-600 transition-colors hover:text-purple-800 underline underline-offset-2"
                      >
                        Clear filters to see all staff
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
                        <User className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="mb-2 text-lg font-medium text-gray-700">No staff members yet</p>
                      <p className="text-sm text-gray-500">Add your first staff member to get started</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              staffData.map((staff, index) => (
                <tr
                  key={staff.id}
                  className={`group transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 hover:shadow-sm ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                  }`}
                >
                  {/* Staff Member */}
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-green-100 to-blue-100 font-semibold text-green-700 shadow-sm ring-2 ring-white">
                        {staff.avatar}
                      </div>
                      <div className="ml-4">
                        <p className="font-medium text-gray-900 group-hover:text-gray-800">{staff.name}</p>
                        <p className="text-sm text-gray-500">{staff.role}</p>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 mr-3">
                        <Mail className="h-4 w-4 text-gray-500" />
                      </div>
                      <span className="truncate text-gray-700 font-medium max-w-[220px]">{staff.email}</span>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${getRoleBadgeClass(staff.role)}`}
                    >
                      <div className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"></div>
                      {staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}
                    </span>
                  </td>

                  {/* Joined Date */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-blue-500 mr-2"></div>
                        <p className="font-medium text-gray-900">{formatDate(staff.joinedDate)}</p>
                      </div>
                    </div>
                  </td>

                  {/* Created By */}
                  <td className="px-6 py-4">
                    <div className="max-w-[180px]">
                      <div className="rounded-lg bg-gray-50 px-3 py-2 border border-gray-200">
                        <p className="truncate text-sm text-gray-700" title={staff.createdBy}>
                          {staff.createdBy}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${
                        staff.status === "active"
                          ? "bg-green-50 text-green-700 ring-green-600/20"
                          : "bg-amber-50 text-amber-700 ring-amber-600/20"
                      }`}
                    >
                      <div
                        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${staff.status === "active" ? "bg-green-600" : "bg-amber-600"}`}
                      ></div>
                      {staff.status === "active" ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 static">
                    <div className="dropdown-container relative">
                      <button
                        onClick={e => toggleDropdown(e, staff.id)}
                        className="rounded-lg p-2.5 transition-all duration-200 hover:bg-gray-100 hover:shadow-sm border border-transparent hover:border-gray-200"
                        type="button"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activeDropdown && (
        <div className="fixed inset-0 z-[9999]">
          {staffData.map(staff => {
            if (staff.id !== activeDropdown) return null;

            return (
              <div
                key={staff.id}
                ref={dropdownRef}
                className="absolute w-48 rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5"
                style={{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                }}
              >
                <div className="py-2">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onEdit(staff);
                      setActiveDropdown(null);
                    }}
                    className="flex w-full items-center px-4 py-3 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-blue-50 hover:text-blue-700"
                    type="button"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 mr-3">
                      <Edit className="h-3 w-3 text-blue-600" />
                    </div>
                    Edit
                  </button>
                  <hr className="my-1 border-gray-100" />
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onDelete(staff);
                      setActiveDropdown(null);
                    }}
                    className="flex w-full items-center px-4 py-3 text-sm font-medium text-red-600 transition-colors duration-200 hover:bg-red-50"
                    type="button"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-100 mr-3">
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </div>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
