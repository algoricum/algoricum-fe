"use client";
import type React from "react";
import { useState } from "react";
import { createClient } from "@/utils/supabase/config/client";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";
import getLeadSourceId from "@/utils/lead_source";
import { User, Mail, Phone, Stethoscope, Users, Calendar } from "lucide-react";
import { ErrorToast, SuccessToast } from "@/helpers/toast";

type FormField = {
  id: string;
  field_id: string;
  field_name: string;
  field_type: string;
  is_required: boolean;
  field_order: number;
  field_options?: string[];
};

type FormData = { [key: string]: string | number };

// eslint-disable-next-line no-unused-vars
type Props = { clinicId: string; onSuccess?: (newLead?: any) => void };

const validatePhoneNumber = (phone: string | undefined): boolean => {
  if (!phone) {
    return false;
  }

  try {
    if (!isValidPhoneNumber(phone)) {
      return false;
    }

    const phoneNumberObj = parsePhoneNumber(phone);
    if (!phoneNumberObj || !phoneNumberObj.isValid()) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

const LeadGenerationForm: React.FC<Props> = ({ clinicId, onSuccess }) => {
  const staticFields: FormField[] = [
    {
      id: "1",
      field_id: "first_name",
      field_name: "First Name",
      field_type: "text",
      is_required: true,
      field_order: 1,
    },
    {
      id: "2",
      field_id: "last_name",
      field_name: "Last Name",
      field_type: "text",
      is_required: true,
      field_order: 2,
    },
    { id: "3", field_id: "email", field_name: "Email", field_type: "email", is_required: true, field_order: 3 },
    { id: "4", field_id: "phone", field_name: "Contact Number", field_type: "tel", is_required: true, field_order: 4 },
    {
      id: "5",
      field_id: "visit_reason",
      field_name: "Visit Reason",
      field_type: "textarea",
      is_required: false, // Changed from true to false
      field_order: 5,
    },
    {
      id: "6",
      field_id: "consultation_type",
      field_name: "Consultation Type",
      field_type: "textarea",
      is_required: false, // Changed from true to false
      field_order: 6,
    },
    {
      id: "7",
      field_id: "services_interest",
      field_name: "Service Interest",
      field_type: "textarea",
      is_required: false, // Changed from true to false
      field_order: 7,
    },
  ];

  const [formData, setFormData] = useState<FormData>({});
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const supabase = createClient();

  const handleInputChange = (id: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors(prev => ({ ...prev, [id]: "" }));
  };

  const handlePhoneChange = (value: string | undefined) => {
    setPhoneNumber(value || "");
    setFormData(prev => ({ ...prev, phone: value || "" }));
    if (errors.phone) setErrors(prev => ({ ...prev, phone: "" }));
  };

  const handlePhoneBlur = () => {
    if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
      setErrors(prev => ({ ...prev, phone: "Please enter a valid phone number" }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    staticFields.forEach(f => {
      const value = formData[f.field_id];

      if (f.is_required && !value) {
        newErrors[f.field_id] = `${f.field_name} is required`;
      }

      if (f.field_type === "email" && value) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(value.toString())) {
          newErrors[f.field_id] = "Enter a valid email address";
        }
      }

      if (f.field_type === "tel") {
        if (f.is_required && !phoneNumber) {
          newErrors[f.field_id] = "Phone number is required";
        } else if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
          newErrors[f.field_id] = "Please enter a valid phone number";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    const source_id = await getLeadSourceId("Others");

    try {
      const submissionData = {
        clinic_id: clinicId,
        source_id: source_id,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        email: formData.email || null,
        phone: phoneNumber || null,
        form_data: {
          service_interest: formData.services_interest || null,
          visit_reason: formData.visit_reason || null,
          consultation_type: formData.consultation_type || null,
        },
        interest_level: "medium",
        urgency: "curious",
        status: "New",
      };

      const { data, error: insertError } = await supabase.from("lead").insert([submissionData]).select().single();

      if (insertError?.code === "23505") {
        throw new Error("Lead with this email already registered in this clinic");
      }

      SuccessToast(" Lead created successfully ");

      onSuccess?.(data);
      setSubmitted(true);
    } catch (err) {
      const error = err as Error;
      ErrorToast(`${error}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getFieldIcon = (fieldId: string) => {
    switch (fieldId) {
      case "first_name":
      case "last_name":
        return <User className="w-5 h-5 text-purple-500" />;
      case "email":
        return <Mail className="w-5 h-5 text-purple-500" />;
      case "phone":
        return <Phone className="w-5 h-5 text-purple-500" />;
      case "visit_reason":
        return <Stethoscope className="w-5 h-5 text-purple-500" />;
      case "consultation_type":
        return <Users className="w-5 h-5 text-purple-500" />;
      case "services_interest":
        return <Calendar className="w-5 h-5 text-purple-500" />;
      default:
        return null;
    }
  };

  const renderField = (f: FormField) => {
    const error = errors[f.field_id];
    const baseCls = `w-full pl-12 pr-4 py-2.5 rounded-lg border-2 transition-all duration-300 bg-white
      ${
        error
          ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
          : "border-gray-200 hover:border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
      }
      focus:outline-none focus:shadow-lg`;

    if (f.field_type === "tel") {
      return (
        <div className="relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">{getFieldIcon(f.field_id)}</div>
          <PhoneInput
            international
            countryCallingCodeEditable={false}
            defaultCountry="US"
            value={phoneNumber}
            onChange={handlePhoneChange}
            onBlur={handlePhoneBlur}
            placeholder="Enter your phone number"
            style={{
              padding: "10px 16px 10px 48px",
              border: error ? "2px solid #ef4444" : "2px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "15px",
              lineHeight: "1.5",
              color: "rgba(0, 0, 0, 0.88)",
              backgroundColor: error ? "#fef2f2" : "#ffffff",
              transition: "all 0.3s",
              width: "100%",
            }}
          />
        </div>
      );
    }

    if (f.field_type === "textarea") {
      const isServiceOrConsultation = f.field_id === "consultation_type" || f.field_id === "services_interest";

      return (
        <div className="relative">
          <div className="absolute left-4 top-4 z-10">{getFieldIcon(f.field_id)}</div>
          <textarea
            value={formData[f.field_id] || ""}
            onChange={e => handleInputChange(f.field_id, e.target.value)}
            className={`${baseCls} resize-y ${isServiceOrConsultation ? "min-h-[196px]" : "min-h-[80px]"}`}
            rows={isServiceOrConsultation ? 8 : 3}
            style={isServiceOrConsultation ? { width: "360px", height: "196px" } : {}}
            placeholder={
              f.field_id === "visit_reason"
                ? "Please describe your health concern or reason for visit... (optional)"
                : f.field_id === "consultation_type"
                  ? "Describe your consultation preferences... (optional)"
                  : "Tell us about your service interests... (optional)"
            }
          />
        </div>
      );
    }

    return (
      <div className="relative">
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">{getFieldIcon(f.field_id)}</div>
        <input
          type={f.field_type}
          value={formData[f.field_id] || ""}
          onChange={e => handleInputChange(f.field_id, e.target.value)}
          className={baseCls}
          placeholder={`Enter your ${f.field_name.toLowerCase()}`}
        />
      </div>
    );
  };

  if (submitted) {
    return (
      <div className="w-full flex items-center justify-center py-6">
        <div className="w-full bg-white p-6 rounded-xl shadow-lg text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-gray-900">Thank You!</h2>
          <p className="text-gray-600 mb-6">Your information was submitted successfully.</p>
          <button
            onClick={() => {
              setSubmitted(false);
              setFormData({});
              setErrors({});
              setPhoneNumber("");
            }}
            className="bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-all duration-300 font-medium shadow-md hover:shadow-lg"
          >
            Submit Another Lead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full bg-white p-4 rounded-xl shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <User className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Get in Touch</h1>
            <p className="text-gray-500 text-sm">Fill out the form below to connect with our clinic</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staticFields.slice(0, 2).map(f => (
              <div key={f.field_id} className="space-y-1">
                <label className="block text-sm font-semibold text-gray-700">{f.field_name}</label>
                {renderField(f)}
                {errors[f.field_id] && <p className="text-red-500 text-sm font-medium">{errors[f.field_id]}</p>}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700">Email Address</label>
            {renderField(staticFields[2])}
            {errors.email && <p className="text-red-500 text-sm font-medium">{errors.email}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700">Contact Number</label>
            {renderField(staticFields[3])}
            {errors.phone && <p className="text-red-500 text-sm font-medium">{errors.phone}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700">
              What brings you to our clinic today? <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            {renderField(staticFields[4])}
            {errors.visit_reason && <p className="text-red-500 text-sm font-medium">{errors.visit_reason}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staticFields.slice(5, 7).map(f => (
              <div key={f.field_id} className="space-y-1">
                <label className="block text-sm font-semibold text-gray-700">
                  {f.field_name} <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                {renderField(f)}
                {errors[f.field_id] && <p className="text-red-500 text-sm font-medium">{errors[f.field_id]}</p>}
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full max-w-sm bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-300 font-semibold disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              {submitting ? "Submitting..." : "Submit Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeadGenerationForm;
