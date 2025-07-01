"use client";
import { useState, useEffect } from "react";
import { Input, Select } from "antd";
import { Button } from "@/components/elements";
import { PlusOutlined, EyeOutlined } from "@ant-design/icons";
import { SuccessToast, ErrorToast } from "@/helpers/toast";
import { createClient } from "@/utils/supabase/config/client";
import { useRouter } from "next/navigation";
import { getLocalClinicData } from "@/helpers/storage-helper";

const { TextArea } = Input;

type FormField = {
  id: string;
  field_id: string;
  field_name: string;
  field_type: string;
  is_required: boolean;
  field_options?: string[];
  field_order: number;
};

const LeadCapturingForm = () => {
  const [loading, setLoading] = useState(false);
  const clinicData = getLocalClinicData();

  console.log("clinic data is ", clinicData);

  const router = useRouter();
  const [fields, setFields] = useState<FormField[]>([
    {
      id: "1",
      field_id: "name",
      field_name: "Name",
      field_type: "text",
      is_required: true,
      field_order: 1,
    },
    {
      id: "2",
      field_id: "email",
      field_name: "Email",
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
    {
      id: "4",
      field_id: "gender",
      field_name: "Gender",
      field_type: "select",
      is_required: false,
      field_options: ["Male", "Female", "Other"],
      field_order: 4,
    },
    {
      id: "5",
      field_id: "age",
      field_name: "Age",
      field_type: "number",
      is_required: false,
      field_order: 5,
    },
    {
      id: "6",
      field_id: "medical_domain",
      field_name: "Medical Domain",
      field_type: "select",
      is_required: false,
      field_options: ["General", "Dental", "Orthopedic", "Pediatric", "Other"],
      field_order: 6,
    },
    {
      id: "7",
      field_id: "notes",
      field_name: "Notes",
      field_type: "textarea",
      is_required: false,
      field_order: 7,
    },
  ]);

  useEffect(() => {
    const fetchFormFields = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
          .from("clinic_lead_form")
          .select("*")
          .eq("clinic_id", clinicData?.id)
          .order("field_order", { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          // Transform the data to match our component structure
          const transformedFields = data.map(field => ({
            id: field.id,
            field_id: field.field_id,
            field_name: field.field_name,
            field_type: field.field_type,
            is_required: field.is_required,
            field_options: field.field_options || [],
            field_order: field.field_order,
          }));
          setFields(transformedFields);
        }
      } catch (error: any) {
        console.error("Error fetching form fields:", error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFormFields();
  }, []);

  const handleSave = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const clinicId = clinicData?.id;

      // Delete existing fields
      await supabase.from("clinic_lead_form").delete().eq("clinic_id", clinicId);

      // Transform and insert new fields
      const fieldsToInsert = fields.map((field, index) => ({
        clinic_id: clinicId,
        field_id: field.field_id,
        field_name: field.field_name,
        field_type: field.field_type,
        is_required: field.is_required,
        field_options: field.field_options || null,
        field_order: index + 1,
      }));

      const { error } = await supabase.from("clinic_lead_form").insert(fieldsToInsert);

      if (error) throw error;
      SuccessToast("Form fields saved successfully");
    } catch (error: any) {
      ErrorToast(error.message || "Failed to save form fields");
    } finally {
      setLoading(false);
    }
  };

  const addNewField = () => {
    const newField: FormField = {
      id: `temp_${Date.now()}`, // Temporary ID for new fields
      field_id: `field_${Date.now()}`,
      field_name: "New Field",
      field_type: "text",
      is_required: false,
      field_order: fields.length + 1,
    };
    setFields([...fields, newField]);
  };

  const updateField = (index: number, fieldUpdate: Partial<FormField>) => {
    const updatedFields = [...fields];
    updatedFields[index] = { ...updatedFields[index], ...fieldUpdate };
    setFields(updatedFields);
  };

  const removeField = (index: number) => {
    const updatedFields = [...fields];
    updatedFields.splice(index, 1);
    // Update field_order for remaining fields
    updatedFields.forEach((field, idx) => {
      field.field_order = idx + 1;
    });
    setFields(updatedFields);
  };

  const handlePreviewForm = () => {
    // Navigate to the lead generation form page
    const clinicId = clinicData?.id;
    router.push(`/lead-form/${clinicId}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-danger p-4 text-white">Development In Progress</div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Lead Capturing Form Builder</h2>
        <div className="flex gap-3">
          <Button type="default" icon={<EyeOutlined />} onClick={handlePreviewForm}>
            Preview Form
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={addNewField}>
            Create a new field
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {fields.map((field, index) => (
          <div key={field.id} className="border rounded-lg p-4">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between">
                <Input
                  placeholder="Field name"
                  value={field.field_name}
                  onChange={e => updateField(index, { field_name: e.target.value })}
                  className="w-3/4"
                />
                <Select
                  value={field.is_required}
                  onChange={value => updateField(index, { is_required: value })}
                  options={[
                    { value: true, label: "Required" },
                    { value: false, label: "Optional" },
                  ]}
                  className="w-1/4"
                />
              </div>

              <Select
                value={field.field_type}
                onChange={value => updateField(index, { field_type: value })}
                options={[
                  { value: "text", label: "Text" },
                  { value: "email", label: "Email" },
                  { value: "tel", label: "Phone" },
                  { value: "number", label: "Number" },
                  { value: "select", label: "Dropdown" },
                  { value: "textarea", label: "Text Area" },
                ]}
              />

              {field.field_type === "select" && (
                <TextArea
                  placeholder="Enter options (one per line)"
                  value={field.field_options?.join("\n")}
                  onChange={e =>
                    updateField(index, {
                      field_options: e.target.value.split("\n").filter(opt => opt.trim() !== ""),
                    })
                  }
                  rows={3}
                />
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Order: {field.field_order}</span>
                <Button danger onClick={() => removeField(index)}>
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-4">
        <Button type="primary" loading={loading} onClick={handleSave}>
          Save Form Configuration
        </Button>
      </div>
    </div>
  );
};

export default LeadCapturingForm;
