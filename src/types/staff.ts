import type React from "react";

export interface Staff {
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

export interface NewStaff {
  email: string;
  name: string;
}

export interface EditStaff {
  id: string;
  name: string;
  status: string;
}

export interface StaffRole {
  value: string;
  label: string;
}

export interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: number;
}

export interface StaffTableProps {
  readonly staffData: Staff[];
  readonly searchTerm: string;
  readonly selectedRole: string;
  readonly selectedStatus: string;
  readonly onEdit: (staff: Staff) => void;
  readonly onDelete: (staff: Staff) => void;
  readonly onClearFilters: () => void;
}

export interface StatConfig {
  key: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  getValue: (statusStats: Array<{ status: string; count: number }>) => number;
}

export interface StaffFiltersProps {
  readonly searchTerm: string;
  readonly selectedRole: string;
  readonly selectedStatus: string;
  readonly availableRoles: StaffRole[];
  readonly totalStaff: number;
  readonly filteredStaff: number;
  readonly onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onRoleChange: (value: string) => void;
  readonly onStatusChange: (value: string) => void;
  readonly onClearSearch: () => void;
  readonly onClearFilters: () => void;
  readonly onAddStaff: () => void;
}

export interface AddStaffModalProps {
  readonly isOpen: boolean;
  readonly isSubmitting: boolean;
  readonly newStaff: NewStaff;
  readonly onClose: () => void;
  readonly onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  readonly onInputChange: (field: keyof NewStaff, value: string) => void;
}

export interface EditStaffModalProps {
  readonly isOpen: boolean;
  readonly isSubmitting: boolean;
  readonly selectedStaff: Staff | null;
  readonly editStaff: EditStaff;
  readonly onClose: () => void;
  readonly onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  readonly onInputChange: (field: keyof EditStaff, value: string) => void;
}

export interface DeleteConfirmModalProps {
  readonly isOpen: boolean;
  readonly isDeleting: boolean;
  readonly selectedStaff: Staff | null;
  readonly onClose: () => void;
  readonly onConfirm: () => Promise<void>;
}
