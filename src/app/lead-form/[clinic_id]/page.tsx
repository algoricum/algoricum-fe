"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/config/client";

type FormField = {
  id: string;
  field_id: string;
  field_name: string;
  field_type: string;
  is_required: boolean;
  field_options?: string[];
  field_order: number;
};

type FormData = {
  [key: string]: string | number;
};

const LeadGenerationForm = () => {
  const params = useParams();
  const clinicId = params.clinic_id as string;

  const [fields, setFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<FormData>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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

        if (data && data.length > 0) {
          setFields(data);
        } else {
          // If no custom fields, show default form
          setFields([
            {
              id: "1",
              field_id: "name",
              field_name: "Full Name",
              field_type: "text",
              is_required: true,
              field_order: 1,
            },
            {
              id: "2",
              field_id: "email",
              field_name: "Email Address",
              field_type: "email",
              is_required: true,
              field_order: 2,
            },
            {
              id: "3",
              field_id: "phone",
              field_name: "Phone Number",
              field_type: "tel",
              is_required: false,
              field_order: 3,
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching form fields:", error);
      } finally {
        setLoading(false);
      }
    };

    if (clinicId) {
      fetchFormFields();
    }
  }, [clinicId]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    fields.forEach(field => {
      if (field.is_required && (!formData[field.field_id] || formData[field.field_id].toString().trim() === "")) {
        newErrors[field.field_id] = `${field.field_name} is required`;
      }

      // Email validation
      if (field.field_type === "email" && formData[field.field_id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[field.field_id].toString())) {
          newErrors[field.field_id] = "Please enter a valid email address";
        }
      }

      // Phone validation
      if (field.field_type === "tel" && formData[field.field_id]) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(formData[field.field_id].toString().replace(/[\s\-\(\)]/g, ""))) {
          newErrors[field.field_id] = "Please enter a valid phone number";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (fieldId: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value,
    }));

    // Clear error when user starts typing
    if (errors[fieldId]) {
      setErrors(prev => ({
        ...prev,
        [fieldId]: "",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();

      // Step 1: Fetch the source_id where name is "Phone"
      const { data: sourceData, error: sourceError } = await supabase.from("lead_source").select("id").eq("name", "Phone").single();

      if (sourceError) {
        console.error("Error fetching lead source:", sourceError);
        throw new Error("Could not find lead source 'Phone'");
      }

      // Step 2: Prepare submission data for leads table
      const submissionData = {
        clinic_id: clinicId,
        source_id: sourceData.id,
        email: formData.email || null,
        phone: formData.phone || null,
        form_data: formData,
        interest_level: "high",
        urgency: "curious",
        status: "new",
      };

      console.log("Submitting lead data:", submissionData);

      // Step 3: Insert into leads table
      const { error: insertError } = await supabase.from("lead").insert([submissionData]);

      if (insertError) {
        console.error("Error inserting lead:", insertError);
        throw insertError;
      }

      setSubmitted(true);
    } catch (error: any) {
      console.error("Error submitting form:", error);
      alert(`There was an error submitting your information: ${error.message}. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const fieldId = field.field_id;
    const hasError = !!errors[fieldId];

    const baseInputClasses = `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
      hasError ? "border-red-500" : "border-gray-300"
    }`;

    switch (field.field_type) {
      case "text":
      case "email":
      case "tel":
      case "number":
        return (
          <input
            type={field.field_type}
            value={formData[fieldId] || ""}
            onChange={e => handleInputChange(fieldId, e.target.value)}
            className={baseInputClasses}
            placeholder={`Enter your ${field.field_name.toLowerCase()}`}
            required={field.is_required}
          />
        );

      case "textarea":
        return (
          <textarea
            value={formData[fieldId] || ""}
            onChange={e => handleInputChange(fieldId, e.target.value)}
            className={`${baseInputClasses} resize-none`}
            rows={4}
            placeholder={`Enter your ${field.field_name.toLowerCase()}`}
            required={field.is_required}
          />
        );

      case "select":
        return (
          <select
            value={formData[fieldId] || ""}
            onChange={e => handleInputChange(fieldId, e.target.value)}
            className={baseInputClasses}
            required={field.is_required}
          >
            <option value="">Select {field.field_name}</option>
            {field.field_options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">Your information has been submitted successfully. We&apos;ll get back to you soon!</p>
          <button
            onClick={() => {
              setSubmitted(false);
              setFormData({});
              setErrors({});
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Get In Touch</h1>
            <p className="text-gray-600">Please fill out the form below and we&apos;ll get back to you as soon as possible.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {fields.map(field => (
              <div key={field.field_id}>
                <label htmlFor={field.field_id} className="block text-sm font-medium text-gray-700 mb-2">
                  {field.field_name}
                  {field.is_required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderField(field)}
                {errors[field.field_id] && <p className="mt-1 text-sm text-red-600">{errors[field.field_id]}</p>}
              </div>
            ))}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Submitting...
                </span>
              ) : (
                "Submit"
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Your information is secure and will never be shared with third parties.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadGenerationForm;
