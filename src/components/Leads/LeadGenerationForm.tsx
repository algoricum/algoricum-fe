"use client";
import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/config/client";
import { getCountries, getCountryCallingCode } from "react-phone-number-input/input";
import type { CountryCode } from "libphonenumber-js";

type FormField = {
  id: string;
  field_id: string;
  field_name: string;
  field_type: string;
  is_required: boolean;
  field_options?: string[];
  field_order: number;
};

type FormData = { [key: string]: string | number };

type Props = { clinicId: string };

const LeadGenerationForm: React.FC<Props> = ({ clinicId }) => {
  const [fields, setFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<FormData>({});
  const [countryCode, setCountryCode] = useState<CountryCode>("US");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const countries = getCountries();
  const countryOptions = countries.map(c => ({
    value: c,
    label: `${c} (+${getCountryCallingCode(c)})`,
  }));

  useEffect(() => {
    const fetchFormFields = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("clinic_lead_form")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("field_order", { ascending: true });

        if (error) throw error;

        setFields(
          data?.length
            ? data
            : [
                { id: "1", field_id: "name", field_name: "Full Name", field_type: "text", is_required: true, field_order: 1 },
                { id: "2", field_id: "email", field_name: "Email Address", field_type: "email", is_required: true, field_order: 2 },
                { id: "3", field_id: "phone", field_name: "Phone Number", field_type: "tel", is_required: false, field_order: 3 },
              ],
        );
      } catch (err) {
        console.error("Error fetching form fields:", err);
      } finally {
        setLoading(false);
      }
    };

    if (clinicId) fetchFormFields();
  }, [clinicId]);

  useEffect(() => {
    if (phoneNumber && countryCode) {
      setFormData(prev => ({ ...prev, phone: `+${getCountryCallingCode(countryCode)}${phoneNumber}` }));
    } else {
      setFormData(prev => ({ ...prev, phone: "" }));
    }
  }, [countryCode, phoneNumber]);

  const handleInputChange = (id: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors(prev => ({ ...prev, [id]: "" }));
  };

  const handleCountryChange = (value: string) => {
    setCountryCode(value as CountryCode);
  };

  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(value);
    if (errors.phone) setErrors(prev => ({ ...prev, phone: "" }));
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    fields.forEach(f => {
      if (f.is_required && !formData[f.field_id]) newErrors[f.field_id] = `${f.field_name} is required`;

      if (f.field_type === "email" && formData[f.field_id]) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(formData[f.field_id].toString())) newErrors[f.field_id] = "Enter a valid email";
      }

      if (f.field_type === "tel" && f.is_required && !phoneNumber) {
        newErrors[f.field_id] = "Enter a valid phone number";
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: sourceData, error: sourceError } = await supabase.from("lead_source").select("id").eq("name", "Phone").single();

      if (sourceError) throw sourceError;

      const submissionData = {
        clinic_id: clinicId,
        source_id: sourceData.id,
        email: formData.email || null,
        phone: formData.phone || null,
        form_data: { ...formData, country_code: countryCode, phone_number: phoneNumber },
        interest_level: "high",
        urgency: "curious",
        status: "new",
      };

      const { error: insertError } = await supabase.from("lead").insert([submissionData]);
      if (insertError) throw insertError;

      setSubmitted(true);
    } catch (err) {
      console.error("Submit error:", err);
      alert("Error submitting form. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (f: FormField) => {
    const error = errors[f.field_id];
    const baseCls = `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${error ? "border-red-500" : "border-gray-300"}`;

    if (f.field_type === "tel") {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Country</label>
            <select value={countryCode} onChange={e => handleCountryChange(e.target.value)} className={baseCls}>
              {countryOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Phone Number</label>
            <div className="flex">
              <div className="flex items-center px-3 bg-gray-50 border border-r-0 rounded-l-lg">+{getCountryCallingCode(countryCode)}</div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => handlePhoneNumberChange(e.target.value)}
                className={`flex-1 px-4 py-3 border rounded-r-lg focus:ring-2 focus:ring-blue-500 ${
                  error ? "border-red-500" : "border-gray-300"
                }`}
              />
            </div>
            {formData.phone && <p className="text-xs text-gray-500 mt-1">Complete: {formData.phone}</p>}
          </div>
        </div>
      );
    }

    if (f.field_type === "textarea") {
      return (
        <textarea
          value={formData[f.field_id] || ""}
          onChange={e => handleInputChange(f.field_id, e.target.value)}
          className={`${baseCls} resize-none`}
          rows={4}
        />
      );
    }

    if (f.field_type === "select") {
      return (
        <select value={formData[f.field_id] || ""} onChange={e => handleInputChange(f.field_id, e.target.value)} className={baseCls}>
          <option value="">Select {f.field_name}</option>
          {f.field_options?.map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={f.field_type}
        value={formData[f.field_id] || ""}
        onChange={e => handleInputChange(f.field_id, e.target.value)}
        className={baseCls}
        placeholder={`Enter ${f.field_name}`}
      />
    );
  };

  if (loading) return <div className="p-10 text-center">Loading form...</div>;

  if (submitted) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
        <p className="mb-4">Your info was submitted successfully.</p>
        <button
          onClick={() => {
            setSubmitted(false);
            setFormData({});
            setErrors({});
            setPhoneNumber("");
            setCountryCode("US");
          }}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg"
        >
          Submit Another Response
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center">Get In Touch</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {fields.map(f => (
            <div key={f.field_id}>
              <label className="block text-sm font-medium mb-2">
                {f.field_name} {f.is_required && <span className="text-red-500">*</span>}
              </label>
              {renderField(f)}
              {errors[f.field_id] && <p className="text-red-500 text-sm">{errors[f.field_id]}</p>}
            </div>
          ))}

          <button type="submit" disabled={submitting} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LeadGenerationForm;
