"use client"
import { useState, useEffect } from "react"
import { Flex, Form, Input, message, Select, Upload } from "antd"
import { Button } from "@/components/elements"
import { FileTextOutlined, MessageOutlined, UserOutlined } from "@ant-design/icons"
import { SuccessToast, ErrorToast } from "@/helpers/toast"
import { createClient } from "@/utils/supabase/config/client"
import { ColorConfigurator, WidgetPreview } from "@/components/common"
import ChatbotConnectModal from "@/components/common/ChatbotConnectModal.jsx"
import { getAssistantByClinicId, getClincApiKey, getClinicData, updateClinic } from "@/utils/supabase/clinic-helper"
import { uploadClinicLogo } from "@/utils/supabase/clinic-uploads"
import { getUserData } from "@/utils/supabase/user-helper"
import generateClinicInstructions from "@/utils/generateClinicInstructions"
import { getSupabaseSession } from "@/utils/supabase/auth-helper"
import { getPreviewText } from "@/utils/getPreviewChatbot"

const { TextArea } = Input

const ChatbotSettings = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState<string>("")
  const primaryColor = Form.useWatch("primary_color", form);
  const toneSelector = Form.useWatch("toneSelector", form);
  const sentenceLength = Form.useWatch("sentenceLength", form);
  const formalityLevel = Form.useWatch("formalityLevel", form);
  const [fileList, setFileList] = useState([])
  const [avatarFileList, setAvatarFileList] = useState([])
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const [clinicData, setClinicData] = useState<any>()
  const [dataLoaded, setDataLoaded] = useState(false) // Add this state

  // Helper function to normalize values from database to match dropdown options
  const normalizeValue = (value: string | null | undefined, validOptions: string[]) => {
    if (!value) return validOptions[0]; // Return first option as default
    
    // Check if value exists in valid options (exact match)
    if (validOptions.includes(value)) {
      return value;
    }
    
    // Try to find a match (case-insensitive and handle underscores/hyphens)
    const normalizedValue = value.toLowerCase().replace(/[_-]/g, '');
    const match = validOptions.find(option => 
      option.toLowerCase().replace(/[_-]/g, '') === normalizedValue
    );
    
    return match || validOptions[0]; // Return match or default to first option
  };

  useEffect(() => {
    const fetchChatbotSettings = async () => {
      try {
        setLoading(true)
        setDataLoaded(false) // Reset data loaded state
        
        const clinic = await getClinicData()
        setClinicData(clinic)
        
        if (clinic) {
          const clinicApiKey = await getClincApiKey(clinic.id)
          
          // Define valid options for each dropdown
          const validTones = ["friendly", "professional", "casual", "formal"];
          const validLengths = ["short", "medium", "long"];
          const validFormalities = ["very_casual", "casual", "neutral", "formal", "very_formal"];
          
          // Normalize the values to ensure they match dropdown options
          const normalizedTone = normalizeValue(clinic.tone_selector, validTones);
          const normalizedLength = normalizeValue(clinic.sentence_length, validLengths);
          const normalizedFormality = normalizeValue(clinic.formality_level, validFormalities);
          
          // Set form values with normalized data
          const formValues = {
            greeting: clinic.assistant_prompt || "",
            primary_color: clinic.widget_theme?.primary_color || "#2563EB",
            font_color: clinic.widget_theme?.font_color || "#000000",
            toneSelector: normalizedTone,
            sentenceLength: normalizedLength,
            formalityLevel: normalizedFormality,
            chatbotName: clinic.chatbot_name || "",
            chatbotAvatar: clinic.chatbot_avatar || null
          };
          
          console.log('Setting form values:', formValues); // Debug log
          
          // Set the form values
          form.setFieldsValue(formValues);
          
          // Force re-render to ensure dropdowns show the values
          setTimeout(() => {
            form.setFieldsValue(formValues);
            setDataLoaded(true); // Mark data as loaded
          }, 100);
          
          if (clinicApiKey) {
            setApiKey(String(clinicApiKey))
          }
        }
      } catch (error: any) {
        console.error("Error fetching chatbot settings:", error.message)
        ErrorToast("Failed to load chatbot settings")
      } finally {
        setLoading(false)
      }
    }

    fetchChatbotSettings()
  }, [form])

  const handleSave = async (values: any) => {
    try {
      setLoading(true)
      const user = await getUserData();
      if (!user) {
        ErrorToast("User not found. Please logout and log in again.");
        setLoading(false);
        return;
      }
      const assistantData = await getAssistantByClinicId(clinicData.id);
      let logoUrl
      let avatarUrl
      
      if (values.logo) {
        logoUrl = await uploadClinicLogo(user.id, values.logo[0].originFileObj);
      }

      if (values.chatbotAvatar) {
        // Using the same upload function for avatar, you might want to create a separate one
        avatarUrl = await uploadClinicLogo(user.id, values.chatbotAvatar[0].originFileObj);
      }

      const clinic = await updateClinic({
        id: clinicData.id,
        assistant_prompt: values.greeting,
        widget_logo: logoUrl,
        chatbot_name: values.chatbotName,
        chatbot_avatar: avatarUrl,
        widget_theme: { primary_color: values.primary_color, font_color: values.font_color },
        tone_selector: values.toneSelector,
        sentence_length: values.sentenceLength,
        formality_level: values.formalityLevel
      })
      const clinicInstructions = generateClinicInstructions({
        name: clinic.legal_business_name || "",
        address: clinic.address,
        phone: clinic.phone,
        email: clinic.email || user.email,
        business_hours: clinic.business_hours,
        calendly_link: clinic.calendly_link,
        tone_selector: values.toneSelector,
        sentence_length: values.sentenceLength,
        formality_level: values.formalityLevel,
        has_uploaded_document: true
      });
      const formDataToSend = new FormData();
      const session = await getSupabaseSession()
      formDataToSend.append('clinic_id', clinic.id);
      formDataToSend.append('name', clinic.legal_business_name || "");
      formDataToSend.append('instructions', clinicInstructions);
      formDataToSend.append('assistant_id', assistantData.id);
      try {
        // Call the combined edge function
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-assistant-with-file`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formDataToSend,
        });

        const result = await response.json();

        if (!response.ok) {
          console.error("Assistant creation error:", result.error);
          // We'll still continue with the onboarding process even if assistant creation fails
        }
      } catch (assistantError) {
        console.error("Failed to create assistant:", assistantError);
        // Continue with onboarding even if assistant creation fails
      }
      if (!clinic) throw { message: "Failed to save chatbot settings" }
      SuccessToast("Chatbot settings saved successfully")
    } catch (error: any) {
      ErrorToast(error.message || "Failed to save chatbot settings")
    } finally {
      setLoading(false)
    }
  }

  // Handle dropdown changes - using form instance to update values
  const handleToneChange = (value: any) => {
    form.setFieldsValue({ toneSelector: value });
  }

  const handleSentenceLengthChange = (value: any) => {
    form.setFieldsValue({ sentenceLength: value });
  }

  const handleFormalityLevelChange = (value: any) => {
    form.setFieldsValue({ formalityLevel: value });
  }

  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e
    }
    return e?.fileList
  }

  // Don't render the form until data is loaded to prevent empty dropdowns
  if (loading && !dataLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chatbot settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-1 rounded-[20px] border border-gray-200 p-4 bg-Gray100 gap-4">
        <Form form={form} layout="vertical" onFinish={handleSave} name="themeForm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Chatbot Settings</h2>
            <Button
              type="primary"
              onClick={() => setIsConnectModalOpen(true)}
              className="bg-brand-primary hover:!bg-brand-secondary !hover:text-white text-white py-2 rounded-md"
            >
              Generate Script
            </Button>
          </div>

          <Form.Item
            label="Chatbot Name"
            name="chatbotName"
            rules={[{ required: true, message: "Please enter a chatbot name" }]}
          >
            <Input 
              placeholder="Enter your chatbot's name (e.g., Dr. Smith Assistant, MedBot)" 
              prefix={<UserOutlined className="text-gray-400" />}
            />
          </Form.Item>

          <Form.Item
            label="Chatbot Avatar"
            valuePropName="fileList"
            getValueFromEvent={normFile}
          >
            <Upload.Dragger
              name="chatbotAvatar"
              fileList={avatarFileList}
              accept=".jpg,.jpeg,.png,.svg"
              beforeUpload={(file) => {
                const isJpgOrPngOrSvg =
                  file.type === 'image/jpeg' ||
                  file.type === 'image/png' ||
                  file.type === 'image/svg+xml';

                if (!isJpgOrPngOrSvg) {
                  ErrorToast('You can only upload JPG, PNG, or SVG files!');
                }

                return false; // Return false to prevent automatic upload
              }}
              maxCount={1}
              className="bg-white rounded-md"
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
            label="Greeting Message For Visitors"
            name="greeting"
            rules={[{ required: true, message: "Please enter a greeting message" }]}
          >
            <TextArea rows={4} placeholder="Enter a friendly greeting message" />
          </Form.Item>

          <Form.Item
            name="logo"
            label="Upload Chatbot Logo"
            valuePropName="fileList"
            getValueFromEvent={normFile}
          >
            <Upload.Dragger
              name="logo"
              fileList={fileList}
              accept=".jpg,.jpeg,.png,.svg"
              beforeUpload={(file) => {
                const isJpgOrPngOrSvg =
                  file.type === 'image/jpeg' ||
                  file.type === 'image/png' ||
                  file.type === 'image/svg+xml';

                if (!isJpgOrPngOrSvg) {
                  ErrorToast('You can only upload JPG, PNG, or SVG files!');
                }

                return false; // Return false to prevent automatic upload
              }}
              maxCount={1}
              className="bg-white rounded-md"
            >
              <p className="flex justify-center mb-2">
                <FileTextOutlined className="text-gray-400" />
              </p>
              <p className="text-center mb-1">
                Drag and drop files here or click to upload <span className="text-brand-primary">Browse Files</span>
              </p>
              <p className="text-center text-xs text-gray-500">JPG, PNG, SVG</p>
            </Upload.Dragger>
          </Form.Item>

          <Form.Item label="Widget Appearance">
            <Flex>
              <ColorConfigurator
                fieldName="primary_color"
                heading="Primary color"
              />
              <div className="me-3"></div>
              <ColorConfigurator
                fieldName="font_color"
                heading="Font color"
              />
            </Flex>
          </Form.Item>

          <Form.Item
            label="Tone Selector"
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
            label="Sentence Length"
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
            label="Formality Level"
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
                    <p className="text-gray-800 italic">"{getPreviewText({
                      tone: toneSelector,
                      formality: formalityLevel,
                      length: sentenceLength
                    })}"</p>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    This preview updates as you change your settings above
                  </p>
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

      <Flex flex={1} justify="center" className="max-sm:hidden">
        <WidgetPreview primaryColor={primaryColor} />
      </Flex>

      {/* Chatbot Connect Modal */}
      <ChatbotConnectModal
        apiKey={apiKey}
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  )
}

export default ChatbotSettings