"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Modal } from "antd";
import { User, Mail, Phone } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { isValidPhoneNumber } from "libphonenumber-js";
import { LEAD_STATUSES } from "@/utils/supabase/leads-helper";
import { createClient } from "@/utils/supabase/config/client";
import { ErrorToast, SuccessToast } from "@/helpers/toast";

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  interest_level: string | null;
  urgency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface EditLeadModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
   
  onUpdate: (updatedLead: Lead) => void;
}

export function EditLeadModal({ lead, isOpen, onClose, onUpdate }: EditLeadModalProps) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    status: "",
    interest_level: "",
    urgency: "",
    notes: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const supabase = createClient();

  useEffect(() => {
    if (lead && isOpen) {
      setFormData({
        first_name: lead.first_name || "",
        last_name: lead.last_name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        status: lead.status || "",
        interest_level: lead.interest_level || "",
        urgency: lead.urgency || "",
        notes: lead.notes || "",
      });
      setErrors({});
    }
  }, [lead, isOpen]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = "Enter a valid email address";
      }
    }

    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !validateForm()) return;

    setLoading(true);
    try {
      // Update lead in database
      const { error } = await supabase
        .from("lead")
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          status: formData.status,
          // interest_level: formData.interest_level || "medium",
          // urgency: formData.urgency || "this_month",
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      if (error) throw error;

      const updatedLead: Lead = {
        ...lead,
        first_name: formData.first_name,
        last_name: formData.last_name,
        name: `${formData.first_name} ${formData.last_name}`.trim(),
        email: formData.email,
        phone: formData.phone,
        status: formData.status,
        interest_level: formData.interest_level,
        urgency: formData.urgency,
        notes: formData.notes,
        updated_at: new Date().toISOString(),
      };

      onUpdate(updatedLead);
      SuccessToast("Lead updated successfully");
      onClose();
    } catch (err) {
      console.error("Error updating lead:", err);
      ErrorToast("Failed to update lead");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handlePhoneChange = (value: string | undefined) => {

    setFormData(prev => ({ ...prev, phone: value || "" }));
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: "" }));
    }
  };

  if (!lead) return null;

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Lead</h2>
            <p className="text-sm text-gray-500">Update lead information</p>
          </div>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700">First Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.first_name}
                onChange={e => handleInputChange("first_name", e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-all duration-300 ${
                  errors.first_name ? "border-red-300 bg-red-50 focus:border-red-500" : "border-gray-200 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-100`}
                placeholder="Enter first name"
              />
            </div>
            {errors.first_name && <p className="text-red-500 text-sm">{errors.first_name}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700">Last Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.last_name}
                onChange={e => handleInputChange("last_name", e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-all duration-300 ${
                  errors.last_name ? "border-red-300 bg-red-50 focus:border-red-500" : "border-gray-200 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-100`}
                placeholder="Enter last name"
              />
            </div>
            {errors.last_name && <p className="text-red-500 text-sm">{errors.last_name}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold text-gray-700">Email *</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={formData.email}
              onChange={e => handleInputChange("email", e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-all duration-300 ${
                errors.email ? "border-red-300 bg-red-50 focus:border-red-500" : "border-gray-200 focus:border-blue-500"
              } focus:outline-none focus:ring-2 focus:ring-blue-100`}
              placeholder="Enter email address"
            />
          </div>
          {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold text-gray-700">Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
            <PhoneInput
              international
              countryCallingCodeEditable={false}
              defaultCountry="US"
              value={formData.phone}
              onChange={handlePhoneChange}
              placeholder="Enter phone number"
              style={{
                padding: "10px 16px 10px 40px",
                border: errors.phone ? "2px solid #ef4444" : "2px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "15px",
                backgroundColor: errors.phone ? "#fef2f2" : "#ffffff",
                transition: "all 0.3s",
                width: "100%",
              }}
            />
          </div>
          {errors.phone && <p className="text-red-500 text-sm">{errors.phone}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700">Status</label>
            <select
              value={formData.status}
              onChange={e => handleInputChange("status", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Select status</option>
              {LEAD_STATUSES.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
          >
            {loading ? "Updating..." : "Update Lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
