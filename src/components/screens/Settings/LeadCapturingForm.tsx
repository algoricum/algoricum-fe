"use client"
import { useState, useEffect } from "react"
import { Form, Input, Select } from "antd"
import { Button } from "@/components/elements"
import { PlusOutlined } from "@ant-design/icons"
import { SuccessToast, ErrorToast } from "@/helpers/toast"
import { createClient } from "@/utils/supabase/config/client"

const { TextArea } = Input

type FormField = {
  id: string
  name: string
  type: string
  required: boolean
  options?: string[]
}

const LeadCapturingForm = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [fields, setFields] = useState<FormField[]>([
    { id: "name", name: "Name", type: "text", required: true },
    { id: "email", name: "Email", type: "email", required: true },
    { id: "phone", name: "Phone Number", type: "tel", required: false },
    { id: "gender", name: "Gender", type: "select", required: false, options: ["Male", "Female", "Other"] },
    { id: "age", name: "Age", type: "number", required: false },
    {
      id: "medical_domain",
      name: "Medical Domain",
      type: "select",
      required: false,
      options: ["General", "Dental", "Orthopedic", "Pediatric", "Other"],
    },
    { id: "notes", name: "Notes", type: "textarea", required: false },
  ])

  useEffect(() => {
    const fetchFormFields = async () => {
      try {
        // setLoading(true)
        const supabase = createClient()
        const { data, error } = await supabase
          .from("lead_form_fields")
          .select("*")
          .eq("clinic_id", localStorage.getItem("clinic_id"))

        if (error) throw error
        if (data && data.length > 0) {
          setFields(data)
        }
      } catch (error: any) {
        console.error("Error fetching form fields:", error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchFormFields()
  }, [])

  const handleSave = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      // Delete existing fields
      await supabase.from("lead_form_fields").delete().eq("clinic_id", localStorage.getItem("clinic_id"))

      // Insert new fields
      const { error } = await supabase.from("lead_form_fields").insert(
        fields.map((field) => ({
          ...field,
          clinic_id: localStorage.getItem("clinic_id"),
        })),
      )

      if (error) throw error
      SuccessToast("Form fields saved successfully")
    } catch (error: any) {
      ErrorToast(error.message || "Failed to save form fields")
    } finally {
      setLoading(false)
    }
  }

  const addNewField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      name: "New Field",
      type: "text",
      required: false,
    }
    setFields([...fields, newField])
  }

  const updateField = (index: number, field: Partial<FormField>) => {
    const updatedFields = [...fields]
    updatedFields[index] = { ...updatedFields[index], ...field }
    setFields(updatedFields)
  }

  const removeField = (index: number) => {
    const updatedFields = [...fields]
    updatedFields.splice(index, 1)
    setFields(updatedFields)
  }

  return (
    <div className="flex flex-col gap-6">
            <div className="bg-danger p-4 text-white">Development In Progress</div>
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Lead Capturing Form</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={addNewField}>
          Create a new field
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {fields.map((field, index) => (
          <div key={field.id} className="border rounded-lg p-4">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between">
                <Input
                  placeholder="Field name"
                  value={field.name}
                  onChange={(e) => updateField(index, { name: e.target.value })}
                  className="w-3/4"
                />
                <Select
                  value={field.required}
                  onChange={(value) => updateField(index, { required: value })}
                  options={[
                    { value: true, label: "Required" },
                    { value: false, label: "Optional" },
                  ]}
                  className="w-1/4"
                />
              </div>

              <Select
                value={field.type}
                onChange={(value) => updateField(index, { type: value })}
                options={[
                  { value: "text", label: "Text" },
                  { value: "email", label: "Email" },
                  { value: "tel", label: "Phone" },
                  { value: "number", label: "Number" },
                  { value: "select", label: "Dropdown" },
                  { value: "textarea", label: "Text Area" },
                ]}
              />

              {field.type === "select" && (
                <TextArea
                  placeholder="Enter options (one per line)"
                  value={field.options?.join("\n")}
                  onChange={(e) =>
                    updateField(index, {
                      options: e.target.value.split("\n").filter((opt) => opt.trim() !== ""),
                    })
                  }
                  rows={3}
                />
              )}

              <div className="flex justify-end">
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
          Save
        </Button>
      </div>
    </div>
  )
}

export default LeadCapturingForm
