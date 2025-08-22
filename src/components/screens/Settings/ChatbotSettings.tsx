"use client";
import { useState, useEffect } from "react";
import { Flex, Form, Input, Select, Tooltip, Upload } from "antd";
import { Button } from "@/components/elements";
import { MessageOutlined, UserOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { SuccessToast, ErrorToast } from "@/helpers/toast";
import { ColorConfigurator } from "@/components/common";
import ChatbotConnectModal from "@/components/common/ChatbotConnectModal.jsx";
import { getClincApiKey, getClinicData, updateClinic } from "@/utils/supabase/clinic-helper";
import { uploadClinicLogo } from "@/utils/supabase/clinic-uploads";
import { getUserData } from "@/utils/supabase/user-helper";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
// import generateClinicInstructions from "@/utils/generateClinicInstructions";
// import { getSupabaseSession } from "@/utils/supabase/auth-helper";
import { getPreviewText } from "@/utils/getPreviewChatbot";
// import ChatbotPreview from "@/components/common/WidgetPreview/ChatbotPreview";

const { TextArea } = Input;

const ChatbotSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false); // Declare the variable

  const primaryColor = Form.useWatch("primary_color", form);
  const fontColor = Form.useWatch("font_color", form);
  const toneSelector = Form.useWatch("toneSelector", form);
  const sentenceLength = Form.useWatch("sentenceLength", form);
  const formalityLevel = Form.useWatch("formalityLevel", form);
  // const chatbotName = Form.useWatch("chatbotName", form);
  // const logo = Form.useWatch("logo", form);
  // const chatbotAvatar = Form.useWatch("chatbotAvatar", form);

  const [clinicData, setClinicData] = useState<any>();
  const [dataLoaded, setDataLoaded] = useState(false);

  const normalizeValue = (value: string | null | undefined, validOptions: string[]) => {
    if (!value) return validOptions[0]; // Return first option as default

    // Check if value exists in valid options (exact match)
    if (validOptions.includes(value)) {
      return value;
    }

    // Try to find a match (case-insensitive and handle underscores/hyphens)
    const normalizedValue = value.toLowerCase().replace(/[_-]/g, "");
    const match = validOptions.find(option => option.toLowerCase().replace(/[_-]/g, "") === normalizedValue);

    return match || validOptions[0]; // Return match or default to first option
  };

  useEffect(() => {
    const fetchChatbotSettings = async () => {
      try {
        setLoading(true);
        setDataLoaded(false); // Reset data loaded state

        const clinic = await getClinicData();
        setClinicData(clinic);

        if (clinic) {
          const clinicApiKey = await getClincApiKey(clinic.id);

          // Define valid options for each dropdown
          const validTones = ["friendly", "professional", "casual", "formal"];
          const validLengths = ["short", "medium", "long"];
          const validFormalities = ["very_casual", "casual", "neutral", "formal", "very_formal"];

          // Normalize the values to ensure they match dropdown options
          const normalizedTone = normalizeValue(clinic.tone_selector, validTones);
          const normalizedLength = normalizeValue(clinic.sentence_length, validLengths);
          const normalizedFormality = normalizeValue(clinic.formality_level, validFormalities);

          // Get colors from clinic data
          const primaryColor = clinic.widget_theme?.primary_color || "#2563EB";
          const fontColor = clinic.widget_theme?.font_color || "#000000";

          // Set form values with normalized data
          const formValues = {
            greeting: clinic.assistant_prompt || "",
            primary_color: primaryColor,
            font_color: fontColor,
            toneSelector: normalizedTone,
            sentenceLength: normalizedLength,
            formalityLevel: normalizedFormality,
            chatbotName: clinic.chatbot_name || "",
            chatbotAvatar: [], // Initialize as empty array
            logo: [], // Initialize as empty array
            // servicesDocument: [], // Initialize as empty array
          };

          console.log("Setting form values:", formValues); // Debug log

          // Set the form values
          form.setFieldsValue(formValues);

          // Force re-render to ensure dropdowns show the values
          setTimeout(() => {
            form.setFieldsValue(formValues);
            setDataLoaded(true); // Mark data as loaded
          }, 100);

          if (clinicApiKey) {
            setApiKey(String(clinicApiKey));
          }
        }
      } catch (error: any) {
        console.error("Error fetching chatbot settings:", error.message);
        ErrorToast("Failed to load chatbot settings");
      } finally {
        setLoading(false);
      }
    };

    fetchChatbotSettings();
  }, [form]);

  const handleSave = async (values: any) => {
    try {
      setLoading(true);
      const user = await getUserData();
      if (!user) {
        ErrorToast("User not found. Please logout and log in again.");
        setLoading(false);
        return;
      }
      // const assistantData = await getAssistantByClinicId(clinicData.id);
      let logoUrl;
      let avatarUrl;

      // Safe check for logo upload
      if (values.logo && Array.isArray(values.logo) && values.logo.length > 0 && values.logo[0].originFileObj) {
        logoUrl = await uploadClinicLogo(user.id, values.logo[0].originFileObj);
      }

      // Safe check for avatar upload
      if (
        values.chatbotAvatar &&
        Array.isArray(values.chatbotAvatar) &&
        values.chatbotAvatar.length > 0 &&
        values.chatbotAvatar[0].originFileObj
      ) {
        avatarUrl = await uploadClinicLogo(user.id, values.chatbotAvatar[0].originFileObj);
      }

      // Fix: Properly construct the widget_theme object with actual color values
      const widgetTheme = {
        primary_color: values.primary_color || "#2563EB", // Fallback to default if not set
        font_color: values.font_color || "#000000", // Fallback to default if not set
      };

      const clinic = await updateClinic({
        id: clinicData.id,
        assistant_prompt: values.greeting,
        widget_logo: logoUrl,
        chatbot_name: values.chatbotName,
        chatbot_avatar: avatarUrl,
        widget_theme: widgetTheme, // Use the properly constructed object
        tone_selector: values.toneSelector,
        sentence_length: values.sentenceLength,
        formality_level: values.formalityLevel,
      });

      // Below comment code is for assistant file upload.

      // const clinicInstructions = generateClinicInstructions({
      //   name: clinic.legal_business_name || "",
      //   address: clinic.address,
      //   phone: clinic.phone,
      //   email: clinic.email || user.email,
      //   business_hours: clinic.business_hours,
      //   calendly_link: clinic.calendly_link,
      //   tone_selector: values.toneSelector,
      //   sentence_length: values.sentenceLength,
      //   formality_level: values.formalityLevel,
      //   // has_uploaded_document: true,
      // });

      // const formDataToSend = new FormData();
      // const session = await getSupabaseSession();
      // formDataToSend.append("clinic_id", clinic.id);
      // formDataToSend.append("name", clinic.legal_business_name || "");
      // formDataToSend.append("instructions", clinicInstructions);
      // formDataToSend.append("assistant_id", assistantData.id);

      // // Add the services document file directly to form data for OpenAI processing
      // if (
      //   values.servicesDocument &&
      //   Array.isArray(values.servicesDocument) &&
      //   values.servicesDocument.length > 0 &&
      //   values.servicesDocument[0].originFileObj
      // ) {
      //   formDataToSend.append("clinic_document", values.servicesDocument[0].originFileObj);
      // }

      // try {
      //   // Call the combined edge function
      //   const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-assistant-with-file`, {
      //     method: "POST",
      //     headers: {
      //       Authorization: `Bearer ${session.access_token}`,
      //     },
      //     body: formDataToSend,
      //   });

      //   const result = await response.json();

      //   if (!response.ok) {
      //     console.error("Assistant creation error:", result.error);
      //     // We'll still continue with the onboarding process even if assistant creation fails
      //   }
      // } catch (assistantError) {
      //   console.error("Failed to create assistant:", assistantError);
      //   // Continue with onboarding even if assistant creation fails
      // }

      if (!clinic) throw { message: "Failed to save chatbot settings" };
      SuccessToast("Chatbot settings saved successfully");
    } catch (error: any) {
      ErrorToast(error.message || "Failed to save chatbot settings");
    } finally {
      setLoading(false);
    }
  };

  // Handle dropdown changes - using form instance to update values
  const handleToneChange = (value: any) => {
    form.setFieldsValue({ toneSelector: value });
  };

  const handleSentenceLengthChange = (value: any) => {
    form.setFieldsValue({ sentenceLength: value });
  };

  const handleFormalityLevelChange = (value: any) => {
    form.setFieldsValue({ formalityLevel: value });
  };

  // Fixed normFile function with proper validation
  const normFile = (e: any) => {
    console.log("Upload event:", e);

    if (Array.isArray(e)) {
      return e;
    }

    // Ensure fileList is always an array
    const fileList = e?.fileList || [];

    // Validate that fileList is not an array
    if (!Array.isArray(fileList)) {
      console.warn("fileList is not an array:", fileList);
      return [];
    }

    return fileList;
  };

  if (loading && !dataLoaded) {
    return <LoadingSpinner message="Loading Ai Assistant settings..." size="lg" />;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-center flex-col md:flex-row gap-6 w-full">
        <div className="flex-1 rounded-[20px] border border-gray-200 p-4 bg-Gray100 gap-4">
          <Form form={form} layout="vertical" onFinish={handleSave} name="themeForm">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Chatbot Settings</h2>
                <Tooltip title="Configure how your chatbot looks, behaves, and communicates with your website visitors.">
                  <InfoCircleOutlined className="text-gray-400 hover:text-gray-600 cursor-help" />
                </Tooltip>
              </div>
              <Tooltip title="This will let you connect the chatbot to your website">
                <Button
                  type="primary"
                  onClick={() => setIsConnectModalOpen(true)}
                  className="bg-brand-primary hover:!bg-brand-secondary !hover:text-white text-white py-2 rounded-md"
                >
                  Add Chatbot to Website
                </Button>
              </Tooltip>
            </div>

            <Form.Item
              label={
                <div className="flex items-center gap-2">
                  <span>Chatbot Name</span>
                  <Tooltip title="This is the name that will appear in your chatbot widget. Choose something friendly and professional that represents your practice.">
                    <InfoCircleOutlined className="text-gray-400 hover:text-gray-600 cursor-help" />
                  </Tooltip>
                </div>
              }
              name="chatbotName"
              rules={[{ required: true, message: "Please enter a chatbot name" }]}
            >
              <Input
                placeholder="Enter your chatbot's name (e.g., Dr. Smith Assistant, MedBot)"
                prefix={<UserOutlined className="text-gray-400" />}
              />
            </Form.Item>

            <Form.Item
              label={
                <div className="flex items-center gap-2">
                  <span>Chatbot Avatar</span>
                  <Tooltip title="Upload an image that will represent your chatbot. This could be your clinic logo, a professional avatar, or a friendly icon. Square images work best.">
                    <InfoCircleOutlined className="text-gray-400 hover:text-gray-600 cursor-help" />
                  </Tooltip>
                </div>
              }
              name="chatbotAvatar"
              valuePropName="fileList"
              getValueFromEvent={normFile}
            >
              <Upload.Dragger
                name="chatbotAvatar"
                accept=".jpg,.jpeg,.png,.svg"
                beforeUpload={file => {
                  const isJpgOrPngOrSvg = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/svg+xml";
                  if (!isJpgOrPngOrSvg) {
                    ErrorToast("You can only upload JPG, PNG, or SVG files!");
                  }
                  return false; // Prevent automatic upload
                }}
                maxCount={1}
                className="bg-white rounded-md"
                fileList={form.getFieldValue("chatbotAvatar") || []}
              >
                <p className="flex justify-center mb-2">
                  <UserOutlined className="text-gray-400" />
                </p>
                <p className="text-center mb-1">
                  Upload chatbot avatar or <span className="text-brand-primary">Browse Files</span>
                </p>
                <p className="text-center text-xs text-gray-500">JPG, PNG, SVG (recommended: square image)</p>
              </Upload.Dragger>
            </Form.Item>

            <Form.Item
              label={
                <div className="flex items-center gap-2">
                  <span>Greeting Message For Visitors</span>
                  <Tooltip title="This is the first message visitors will see when they open your chatbot. Make it welcoming and explain how you can help them.">
                    <InfoCircleOutlined className="text-gray-400 hover:text-gray-600 cursor-help" />
                  </Tooltip>
                </div>
              }
              name="greeting"
              rules={[{ required: true, message: "Please enter a greeting message" }]}
            >
              <TextArea rows={4} placeholder="Enter a friendly greeting message" />
            </Form.Item>

            {/* <Form.Item
            name="servicesDocument"
            label={
              <div className="flex items-center gap-2">
                <span>Services and details document for AI processing (PDF, DOC, DOCX)</span>
                <Tooltip title="Upload a document containing information about your services, procedures, pricing, or policies. The AI will use this to answer specific questions about your practice.">
                  <InfoCircleOutlined className="text-gray-400 hover:text-gray-600 cursor-help" />
                </Tooltip>
              </div>
            }
            valuePropName="fileList"
            getValueFromEvent={normFile}
          >
            <Upload.Dragger
              name="servicesDocument"
              accept=".pdf,.doc,.docx"
              beforeUpload={file => {
                const isValidDocument =
                  file.type === "application/pdf" ||
                  file.type === "application/msword" ||
                  file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                if (!isValidDocument) {
                  ErrorToast("You can only upload PDF, DOC, or DOCX files!");
                  return false;
                }
                const isValidSize = file.size / 1024 / 1024 < 65;
                if (!isValidSize) {
                  ErrorToast("File must be smaller than 65MB!");
                  return false;
                }
                return false; // Prevent automatic upload
              }}
              maxCount={1}
              className="bg-white rounded-md"
              fileList={form.getFieldValue("servicesDocument") || []}
            >
              <p className="flex justify-center mb-2">
                <FileTextOutlined className="text-gray-400" />
              </p>
              <p className="text-center mb-1">
                Drag and drop files here or click to upload <span className="text-brand-primary">Browse Files</span>
              </p>
              <p className="text-center text-xs text-gray-500">PDF, DOC, DOCX (Max 10MB)</p>
            </Upload.Dragger>
          </Form.Item> */}

            <Form.Item
              label={
                <div className="flex items-center gap-2">
                  <span>Chatbot Appearance</span>
                  <Tooltip title="Customize the colors of your chatbot to match your brand. Choose colors that provide good contrast for readability.">
                    <InfoCircleOutlined className="text-gray-400 hover:text-gray-600 cursor-help" />
                  </Tooltip>
                </div>
              }
            >
              <Flex wrap="wrap" gap="middle">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">Primary Color</span>
                    <Tooltip title="Choose the primary color for your chatbot. This will be used for buttons, headers, and accent elements.">
                      <InfoCircleOutlined className="text-gray-400 hover:text-gray-600 cursor-help text-xs" />
                    </Tooltip>
                  </div>
                  <ColorConfigurator
                    fieldName="primary_color"
                    heading=""
                    value={primaryColor || "#2563EB"}
                    onChange={value => {
                      form.setFieldValue("primary_color", value);
                      form.validateFields(["primary_color"]); // Trigger form update
                    }}
                  />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">Font Color</span>
                    <Tooltip title="Select the color for text in your chatbot. Make sure it contrasts well with your primary color for readability.">
                      <InfoCircleOutlined className="text-gray-400 hover:text-gray-600 cursor-help text-xs" />
                    </Tooltip>
                  </div>
                  <ColorConfigurator
                    fieldName="font_color"
                    heading=""
                    value={fontColor || "#000000"}
                    onChange={value => {
                      form.setFieldValue("font_color", value);
                      form.validateFields(["font_color"]); // Trigger form update
                    }}
                  />
                </div>
              </Flex>
            </Form.Item>

            {/* Hidden form fields to capture color values */}
            <Form.Item name="primary_color" hidden>
              <Input />
            </Form.Item>

            <Form.Item name="font_color" hidden>
              <Input />
            </Form.Item>

            <Form.Item
              label={
                <div className="flex items-center gap-2">
                  <span>Tone Selector</span>
                  <Tooltip title="The tone affects how your chatbot communicates. Friendly is warm and welcoming, Professional is competent and reliable, Casual is relaxed, and Formal is respectful and structured.">
                    <InfoCircleOutlined className="text-gray-400 hover:text-gray-600 cursor-help" />
                  </Tooltip>
                </div>
              }
              name="toneSelector"
              rules={[{ required: true, message: "Please select a tone" }]}
            >
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-2">How warm and approachable should your assistant sound?</p>
              </div>
              <Select
                placeholder="Select Tone"
                className="w-full"
                onChange={handleToneChange}
                value={toneSelector} // Explicitly set value
                options={[
                  { value: "friendly", label: "Friendly - Warm and welcoming" },
                  { value: "professional", label: "Professional - Competent and reliable" },
                  { value: "casual", label: "Casual - Relaxed and conversational" },
                  { value: "formal", label: "Formal - Respectful and structured" },
                ]}
              />
            </Form.Item>

            <Form.Item
              label={
                <div className="flex items-center gap-2">
                  <span>Sentence Length</span>
                  <Tooltip title="Control how detailed your chatbot's responses are. Short for quick answers, Medium for balanced responses, Long for comprehensive explanations.">
                    <InfoCircleOutlined className="text-gray-400 hover:text-gray-600 cursor-help" />
                  </Tooltip>
                </div>
              }
              name="sentenceLength"
              rules={[{ required: true, message: "Please select a sentence length" }]}
            >
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-2">How detailed should responses be?</p>
              </div>
              <Select
                placeholder="Select Sentence Length"
                className="w-full"
                onChange={handleSentenceLengthChange}
                value={sentenceLength} // Explicitly set value
                options={[
                  { value: "short", label: "Short - Quick and concise" },
                  { value: "medium", label: "Medium - Balanced detail" },
                  { value: "long", label: "Long - Comprehensive explanations" },
                ]}
              />
            </Form.Item>

            <Form.Item
              label={
                <div className="flex items-center gap-2">
                  <span>Formality Level</span>
                  <Tooltip title="Adjust how formal the language should be, from very casual (like talking to a friend) to very formal (traditional business style).">
                    <InfoCircleOutlined className="text-gray-400 hover:text-gray-600 cursor-help" />
                  </Tooltip>
                </div>
              }
              name="formalityLevel"
              rules={[{ required: true, message: "Please select a formality level" }]}
            >
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-2">How formal should the language be?</p>
              </div>
              <Select
                placeholder="Select Formality Level"
                className="w-full"
                onChange={handleFormalityLevelChange}
                value={formalityLevel} // Explicitly set value
                options={[
                  { value: "very_casual", label: "Very Casual - Like talking to a friend" },
                  { value: "casual", label: "Casual - Relaxed but respectful" },
                  { value: "neutral", label: "Neutral - Balanced approach" },
                  { value: "formal", label: "Formal - Professional courtesy" },
                  { value: "very_formal", label: "Very Formal - Traditional business style" },
                ]}
              />
            </Form.Item>

            {/* Live Preview Section */}
            {(toneSelector || sentenceLength || formalityLevel) && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <MessageOutlined className="text-blue-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-900 mb-2">Preview: How your assistant will greet patients</h3>
                    <div className="bg-white p-3 rounded border border-blue-200">
                      <p className="text-gray-800 italic">
                        &quot;
                        {getPreviewText({
                          tone: toneSelector,
                          formality: formalityLevel,
                          length: sentenceLength,
                        })}
                        &quot;
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Form.Item>
              <Button
                type="primary"
                className="bg-brand-primary hover:!bg-brand-secondary !hover:text-white text-white py-2 mt-3 rounded-md"
                htmlType="submit"
                loading={loading}
              >
                Save Changes
              </Button>
            </Form.Item>
          </Form>
        </div>

        <ChatbotConnectModal apiKey={apiKey} isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} />
      </div>
    </div>
  );
};

export default ChatbotSettings;
