"use client"
import { useState, useEffect } from "react"
import { Form, Input, Divider } from "antd"
import { Button } from "@/components/elements"
import { EyeInvisibleOutlined, EyeTwoTone } from "@ant-design/icons"
import { SuccessToast, ErrorToast } from "@/helpers/toast"
import { createClient } from "@/utils/supabase/config/client"

const EmailConfiguration = () => {
  const [smtpForm] = Form.useForm()
  const [popForm] = Form.useForm()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchEmailSettings = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        const { data, error } = await supabase
          .from("email_settings")
          .select("*")
          .eq("clinic_id", localStorage.getItem("clinic_id"))
          .single()

        if (error && error.code !== "PGRST116") throw error
        if (data) {
          smtpForm.setFieldsValue({
            smtp_host: data.smtp_host,
            smtp_user: data.smtp_user,
            smtp_password: data.smtp_password,
            smtp_sender_name: data.smtp_sender_name,
            smtp_sender_email: data.smtp_sender_email,
          })

          popForm.setFieldsValue({
            pop_server: data.pop_server,
            pop_port: data.pop_port,
            pop_user: data.pop_user,
            pop_password: data.pop_password,
          })
        }
      } catch (error: any) {
        console.error("Error fetching email settings:", error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchEmailSettings()
  }, [smtpForm, popForm])

  const handleSaveSMTP = async (values: any) => {
    try {
      setLoading(true)
      const supabase = createClient()

      const { error } = await supabase.from("email_settings").upsert({
        clinic_id: localStorage.getItem("clinic_id"),
        smtp_host: values.smtp_host,
        smtp_user: values.smtp_user,
        smtp_password: values.smtp_password,
        smtp_sender_name: values.smtp_sender_name,
        smtp_sender_email: values.smtp_sender_email,
      })

      if (error) throw error
      SuccessToast("SMTP settings saved successfully")
    } catch (error: any) {
      ErrorToast(error.message || "Failed to save SMTP settings")
    } finally {
      setLoading(false)
    }
  }

  const handleSavePOP = async (values: any) => {
    try {
      setLoading(true)
      const supabase = createClient()

      const { error } = await supabase.from("email_settings").upsert({
        clinic_id: localStorage.getItem("clinic_id"),
        pop_server: values.pop_server,
        pop_port: values.pop_port,
        pop_user: values.pop_user,
        pop_password: values.pop_password,
      })

      if (error) throw error
      SuccessToast("POP settings saved successfully")
    } catch (error: any) {
      ErrorToast(error.message || "Failed to save POP settings")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold mb-6">SMTP Settings</h2>
        <Form form={smtpForm} layout="vertical" onFinish={handleSaveSMTP}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item label="Host" name="smtp_host" rules={[{ required: true, message: "Please enter SMTP host" }]}>
              <Input placeholder="e.g., smtp.gmail.com" />
            </Form.Item>

            <Form.Item label="User" name="smtp_user" rules={[{ required: true, message: "Please enter SMTP user" }]}>
              <Input placeholder="e.g., username@gmail.com" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              label="Send Name"
              name="smtp_sender_name"
              rules={[{ required: true, message: "Please enter sender name" }]}
            >
              <Input placeholder="e.g., Clinic Support" />
            </Form.Item>

            <Form.Item
              label="Send Email"
              name="smtp_sender_email"
              rules={[
                { required: true, message: "Please enter sender email" },
                { type: "email", message: "Please enter a valid email" },
              ]}
            >
              <Input placeholder="e.g., support@yourclinic.com" />
            </Form.Item>
          </div>

          <Form.Item
            label="Password"
            name="smtp_password"
            rules={[{ required: true, message: "Please enter SMTP password" }]}
          >
            <Input.Password
              placeholder="Enter SMTP password"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Save
            </Button>
          </Form.Item>
        </Form>
      </div>

      <Divider />

      <div>
        <h2 className="text-xl font-semibold mb-6">POP</h2>
        <Form form={popForm} layout="vertical" onFinish={handleSavePOP}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              label="Server"
              name="pop_server"
              rules={[{ required: true, message: "Please enter POP server" }]}
            >
              <Input placeholder="e.g., pop.gmail.com" />
            </Form.Item>

            <Form.Item label="Port" name="pop_port" rules={[{ required: true, message: "Please enter POP port" }]}>
              <Input placeholder="e.g., 995" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item label="User" name="pop_user" rules={[{ required: true, message: "Please enter POP user" }]}>
              <Input placeholder="e.g., username@gmail.com" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="pop_password"
              rules={[{ required: true, message: "Please enter POP password" }]}
            >
              <Input.Password
                placeholder="Enter POP password"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Save
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default EmailConfiguration
