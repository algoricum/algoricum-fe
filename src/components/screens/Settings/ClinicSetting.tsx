"use client";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { CLINIC_FIELDS, DAYS, TIME_OPTIONS } from "@/constants";
import { ErrorToast } from "@/helpers/toast";
import { useClinicSettings, useTwilioPhoneNumber, useUpdateClinicComplete } from "@/hooks/useSettings";
import { Button, Input, Select, Switch, Typography, Upload, message } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import Image from "next/image";
import { useEffect, useState } from "react";

const { Title } = Typography;
const { Option } = Select;

const ClinicSetting = () => {
  const [fileList, setFileList] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({
    legal_business_name: "",
    dba_name: "",
    email: "",
    phone: "",
    address: "",
    domain: "",
    calendly_link: "",
    clinic_type: "",
    logo: null,
    business_hours: {},
    mailgun_email: "", // Non-editable field
  });

  // React Query hooks
  const { data: clinic, isLoading: clinicLoading, error: clinicError } = useClinicSettings();
  const { data: twilioPhoneNumber = "", isLoading: twilioLoading } = useTwilioPhoneNumber(clinic?.id || "");
  const updateClinicMutation = useUpdateClinicComplete();

  // Combined loading state
  const loading = clinicLoading || twilioLoading || updateClinicMutation.isPending;

  // Handle React Query errors
  useEffect(() => {
    if (clinicError) {
      ErrorToast("Failed to load clinic data");
    }
  }, [clinicError]);

  // Copy to clipboard function
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${fieldName} copied to clipboard!`);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      message.success(`${fieldName} copied to clipboard!`);
      console.error("Failed to copy text: ", error);
    }
  };

  // Update form data when clinic data is loaded from React Query
  useEffect(() => {
    if (clinic) {
      let logoUrl = null;
      if (clinic.logo && /^https?:\/\//.test(clinic.logo)) {
        logoUrl = clinic.logo;
      } else if ("logoUrl" in clinic && clinic.logoUrl) {
        logoUrl = clinic.logoUrl;
      }

      const normalizedHours = Object.fromEntries(
        DAYS.map(day => {
          const entry = clinic.business_hours?.[day];
          return [
            day,
            entry
              ? { enabled: entry.isOpen, start: entry.openTime, end: entry.closeTime }
              : { enabled: day !== "Sunday", start: "9:00 AM", end: "5:00 PM" },
          ];
        }),
      );

      setFormData({
        legal_business_name: clinic.legal_business_name || "",
        dba_name: clinic.dba_name || "",
        email: clinic.email || "",
        phone: clinic.phone || "",
        address: clinic.address || "",
        domain: clinic.domain || "",
        calendly_link: clinic.calendly_link || "",
        clinic_type: clinic.clinic_type || "",
        logo: logoUrl,
        business_hours: normalizedHours,
        mailgun_email: clinic.mailgun_email || "",
      });

      if (clinic.logo && logoUrl) {
        setFileList([{ uid: "-1", name: "Clinic Logo", status: "done", url: logoUrl }]);
      }
    }
  }, [clinic]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: typeof formData) => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (info: any) => {
    const newFileList = info.fileList.slice(-1);
    setFileList(newFileList);
    const file = newFileList[0]?.originFileObj;
    if (file instanceof File) {
      const previewUrl = URL.createObjectURL(file);
      setFormData((prev: typeof formData) => ({ ...prev, logo: previewUrl }));
    }
  };

  const handleRemoveLogo = () => {
    setFormData((prev: any) => ({ ...prev, logo: null }));
    setFileList([]);
  };

  const handleDayToggle = (day: string, enabled: boolean) => {
    setFormData((prev: typeof formData) => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: { ...prev.business_hours?.[day], enabled },
      },
    }));
  };

  const handleTimeChange = (day: string, field: "start" | "end", value: string) => {
    setFormData((prev: typeof formData) => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: { ...prev.business_hours?.[day], [field]: value },
      },
    }));
  };

  const handleSubmit = async () => {
    if (!clinic?.id) return;

    const file = fileList[0]?.originFileObj;

    const updatedHours = Object.fromEntries(
      DAYS.map(day => {
        const entry = formData.business_hours?.[day];
        return [day, { isOpen: entry?.enabled, openTime: entry?.start, closeTime: entry?.end }];
      }),
    );

    const clinicUpdateData = {
      id: clinic.id,
      ...formData,
      business_hours: updatedHours,
    };

    try {
      await updateClinicMutation.mutateAsync({
        clinicData: clinicUpdateData,
        logoFile: file instanceof File ? file : undefined,
        userId: clinic.owner_id,
      });
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Update failed:", error);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading clinic settings..." size="lg" />;
  }

  return (
    <div className="flex flex-col gap-8 px-3">
      {/* Clinic Profile & Logo */}
      <div className="flex flex-col lg:flex-row gap-6 flex-wrap border border-gray-200 p-6 bg-Gray100 rounded-[20px]">
        <div className="flex-1 min-w-[280px] rounded-[20px]">
          <Title level={3}>Clinic Profile</Title>

          {/* Regular editable fields */}
          {CLINIC_FIELDS.map(([label, key]) => {
            // Skip DBA Name field (Primary Contact Name)
            if (key === "dba_name") return null;

            return (
              <div key={key}>
                <label className="font-medium">{label === "Legal Business Name" ? "Clinic Name" : label}</label>
                <Input
                  value={formData[key] ?? ""}
                  onChange={e => handleChange(key, e.target.value)}
                  placeholder={label === "Legal Business Name" ? "Clinic Name" : label}
                  className="mb-4"
                />
              </div>
            );
          })}

          {/* Non-editable fields with copy functionality */}
          <div className="space-y-4 mt-6 pt-6 border-t border-gray-200">
            <Title level={5} className="!text-gray-600 !mb-4">
              Nurturing Details
            </Title>

            {/* Mailgun Email Field */}
            <div>
              <label className="font-medium text-gray-700">Nurturing Email</label>
              <div className="relative">
                <Input
                  value={formData.mailgun_email || "Not configured"}
                  readOnly
                  className="mb-4 bg-gray-50 cursor-default"
                  suffix={
                    <Button
                      type="text"
                      icon={<CopyOutlined />}
                      size="small"
                      onClick={() => copyToClipboard(formData.mailgun_email, "Mailgun Email")}
                      className="text-brand-primary hover:!text-brand-secondary"
                      title="Copy Mailgun Email"
                      style={{
                        visibility: formData.mailgun_email ? "visible" : "hidden",
                        opacity: formData.mailgun_email ? 1 : 0,
                      }}
                      disabled={!formData.mailgun_email}
                    />
                  }
                />
              </div>
              <p className="text-xs text-gray-500 -mt-3 mb-4">This email is used for automated email communications</p>
            </div>

            {/* Twilio Phone Number Field */}
            <div>
              <label className="font-medium text-gray-700">Nurturing Phone Number</label>
              <div className="relative">
                <Input
                  value={twilioPhoneNumber || "Not configured"}
                  readOnly
                  className="mb-4 bg-gray-50 cursor-default"
                  suffix={
                    <Button
                      type="text"
                      icon={<CopyOutlined />}
                      size="small"
                      onClick={() => copyToClipboard(twilioPhoneNumber, "Twilio Phone Number")}
                      className="text-brand-primary hover:!text-brand-secondary"
                      title="Copy Twilio Phone Number"
                      style={{
                        visibility: twilioPhoneNumber ? "visible" : "hidden",
                        opacity: twilioPhoneNumber ? 1 : 0,
                      }}
                      disabled={!twilioPhoneNumber}
                    />
                  }
                />
              </div>
              <p className="text-xs text-gray-500 -mt-3 mb-4">This phone number is used for SMS communications</p>
            </div>
          </div>
        </div>

        {/* Improved Logo Upload Section */}
        <div className="w-full sm:w-full lg:w-2/5 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-[20px] p-6 bg-white hover:border-brand-primary hover:bg-gray-50 transition-all duration-200 min-h-[400px]">
          {formData.logo ? (
            // Logo preview state
            <div className="flex flex-col items-center justify-center w-full h-full">
              <div className="relative w-full max-w-xs">
                <div className="relative w-full h-[200px] mb-4">
                  <Image
                    src={formData.logo || "/placeholder.svg"}
                    alt="Clinic Logo"
                    fill
                    className="object-contain rounded-lg shadow-sm"
                    sizes="(max-width: 768px) 100vw, 320px"
                    loading="lazy" // Settings page loads after navigation
                  />
                </div>

                <div className="text-center space-y-4">
                  <p className="text-sm font-medium text-gray-700">Current Logo</p>

                  <div className="flex justify-center gap-3">
                    <Upload
                      accept="image/*"
                      showUploadList={false}
                      beforeUpload={() => false}
                      onChange={handleLogoUpload}
                      maxCount={1}
                      fileList={fileList}
                    >
                      <Button
                        type="default"
                        className="border-brand-primary text-brand-primary hover:!bg-brand-primary hover:!text-white transition-all duration-200"
                      >
                        Change Logo
                      </Button>
                    </Upload>

                    <Button
                      onClick={handleRemoveLogo}
                      className="border-red-500 text-red-500 hover:!bg-red-500 hover:!text-white transition-all duration-200"
                    >
                      Remove Logo
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Upload state
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={() => false}
              onChange={handleLogoUpload}
              maxCount={1}
              fileList={fileList}
              className="w-full h-full flex items-center justify-center"
            >
              <div className="flex flex-col items-center justify-center w-full h-full cursor-pointer group">
                {/* Upload Icon */}
                <div className="w-20 h-20 rounded-full bg-brand-primary/10 flex items-center justify-center mb-6 group-hover:bg-brand-primary/20 transition-colors duration-200">
                  <svg className="w-10 h-10 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>

                {/* Upload Text */}
                <div className="text-center space-y-3">
                  <p className="text-xl font-semibold text-gray-700 group-hover:text-brand-primary transition-colors duration-200">
                    Upload Clinic Logo
                  </p>
                  <p className="text-base text-gray-500">
                    Drag & drop your logo here, or <span className="text-brand-primary font-medium underline">click to browse</span>
                  </p>
                  <p className="text-sm text-gray-400">Supports: PNG, JPG, GIF (Max 5MB)</p>
                </div>

                {/* Visual Enhancement */}
                <div className="mt-8 flex space-x-2">
                  <div className="w-3 h-3 bg-brand-primary/30 rounded-full"></div>
                  <div className="w-3 h-3 bg-brand-primary/50 rounded-full"></div>
                  <div className="w-3 h-3 bg-brand-primary rounded-full"></div>
                </div>
              </div>
            </Upload>
          )}
        </div>
      </div>

      {/* Business Hours */}
      <div className="rounded-[20px] border border-gray-200 p-6 bg-Gray100">
        <Title level={4}>Business Hours</Title>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white mb-8">
          <div className="grid grid-cols-[1fr_120px_300px] bg-gray-50 p-4 border-b border-gray-200 font-medium text-gray-700">
            <div>Day</div>
            <div>Status</div>
            <div>Hours</div>
          </div>

          {DAYS.map(day => {
            const dayData = formData.business_hours?.[day] || {};
            return (
              <div key={day} className="grid grid-cols-[1fr_120px_300px] p-4 items-center border-b border-gray-100">
                <div className="text-gray-700 font-medium">{day}</div>
                <div>
                  <Switch
                    checked={dayData.enabled}
                    onChange={checked => handleDayToggle(day, checked)}
                    className={dayData.enabled ? "bg-purple-500" : "bg-gray-300"}
                  />
                </div>
                <div>
                  {dayData.enabled ? (
                    <div className="flex items-center gap-2">
                      <Select value={dayData.start ?? ""} onChange={val => handleTimeChange(day, "start", val)} className="w-28">
                        {TIME_OPTIONS.map(t => (
                          <Option key={t} value={t}>
                            {t}
                          </Option>
                        ))}
                      </Select>
                      <span className="text-gray-500">to</span>
                      <Select value={dayData.end ?? ""} onChange={val => handleTimeChange(day, "end", val)} className="w-28">
                        {TIME_OPTIONS.map(t => (
                          <Option key={t} value={t}>
                            {t}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <span className="text-gray-400">Closed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button type="primary" onClick={handleSubmit} className="bg-brand-primary hover:!bg-brand-secondary text-white mt-4">
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default ClinicSetting;
