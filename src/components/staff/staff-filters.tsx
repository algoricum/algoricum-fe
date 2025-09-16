"use client";
import { Button } from "antd";
import { Plus, Search, X } from "lucide-react";
import type React from "react";

interface StaffFiltersProps {
  searchTerm: string;
  selectedRole: string;
  selectedStatus: string;
  availableRoles: Array<{ value: string; label: string }>;
  totalStaff: number;
  filteredStaff: number;

  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  onRoleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;

  onStatusChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onClearSearch: () => void;
  onClearFilters: () => void;
  onAddStaff: () => void;
}

export function StaffFilters({
  searchTerm,
  selectedRole,
  selectedStatus,
  availableRoles,
  totalStaff,
  filteredStaff,
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onClearSearch,
  onClearFilters,
  onAddStaff,
}: StaffFiltersProps) {
  const hasFilters = searchTerm || selectedRole !== "all" || selectedStatus !== "all";

  return (
    <div className="mb-4 md:mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left group */}
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:gap-4 md:pr-4">
          {/* Search */}
          <div className="relative md:w-[256px] lg:w-[288px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={onSearchChange}
              className="w-full rounded-lg border border-gray-300 px-10 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
            />
            {searchTerm && (
              <button onClick={onClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Role */}
          <select
            value={selectedRole}
            onChange={onRoleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 md:w-[160px]"
          >
            <option value="all">All Roles</option>
            {availableRoles.map(role => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={onStatusChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 md:w-[160px]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Add button */}
        <Button
          type="primary"
          size="large"
          icon={<Plus className="h-4 w-4" />}
          onClick={onAddStaff}
          style={{
            backgroundColor: "#9333ea",
            borderColor: "#9333ea",
            boxShadow: "0 4px 12px rgba(149, 100, 233, 0.3)",
            borderRadius: 8,
            height: 44,
            fontWeight: 600,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          className="w-full transform transition-all duration-200 hover:!scale-105 hover:!border-[#8554d6] hover:!bg-[#8554d6] md:w-auto"
        >
          Add Staff Member
        </Button>
      </div>

      {hasFilters && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span>
            {filteredStaff} of {totalStaff} staff
          </span>
          <button onClick={onClearFilters} className="text-purple-600 underline hover:text-purple-800">
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
