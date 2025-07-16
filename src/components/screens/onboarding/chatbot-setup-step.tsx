"use client";

import { useState } from "react";
import { Button, Input, Select, Upload, Typography, Card,Flex } from "antd";
import { UserOutlined, MessageOutlined, FileTextOutlined } from "@ant-design/icons";
import { ColorConfigurator} from "@/components/common";

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;
const { Dragger } = Upload;

interface ChatbotSetupStepProps {
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: any;
}

const getPreviewText = ({ tone, formality, length }: { tone?: string; formality?: string; length?: string }) => {
  const toneMap = {
    friendly: "Hi there! 😊",
    professional: "Hello,",
    casual: "Hey!",
    formal: "Good day,",
  };

  const formalityMap = {
    very_casual: "I'm here to help you out with anything you need!",
    casual: "I'm here to help with any questions you might have.",
    neutral: "I'm here to assist you with your inquiries.",
    formal: "I am here to assist you with your medical inquiries.",
    very_formal: "I am at your service to address your medical consultation needs.",
  };

  const lengthMap = {
    short: "How can I help?",
    medium: "How can I help you today? I can answer questions about our services and help you book appointments.",
    long: "How may I assist you today? I'm equipped to answer questions about our medical services, help you schedule appointments, provide information about our treatments, and guide you through any concerns you might have about your healthcare needs.",
  };

  const greeting = toneMap[tone as keyof typeof toneMap] || "Hello,";
  const style = formalityMap[formality as keyof typeof formalityMap] || "I'm here to assist you.";
  const detail = lengthMap[length as keyof typeof lengthMap] || "How can I help?";

  return `${greeting} ${style} ${detail}`;
};

export default function ChatbotSetupStep({ onNext, onPrev, initialData = {} }: ChatbotSetupStepProps) {
  const [formData, setFormData] = useState({
    chatbotName: initialData.chatbotName || "",
    greeting: initialData.greeting || "",
    primaryColor: initialData.primaryColor || "#2563EB",
    fontColor: initialData.fontColor || "#000000",
    toneSelector: initialData.toneSelector || "",
    sentenceLength: initialData.sentenceLength || "",
    formalityLevel: initialData.formalityLevel || "",
    logo: initialData.logo || [],
    chatbotAvatar: initialData.chatbotAvatar || [],
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileUpload = (field: string, info: any) => {
    const { fileList } = info;
    setFormData(prev => ({
      ...prev,
      [field]: fileList,
    }));
  };

  const handleNext = () => {
    console.log(formData);
    onNext(formData);
  };

  const isFormValid = () => {
    return (
      formData.chatbotName.trim() && formData.greeting.trim() && formData.toneSelector && formData.sentenceLength && formData.formalityLevel
    );
  };

  return (
    <div className="max-w-4xl">
      <Title level={1} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight" style={{ margin: 0, marginBottom: "21px" }}>
        Configure Your AI Chatbot
      </Title>

      <Text className="text-gray-600 text-lg block mb-8">Let's set up your intelligent chatbot to handle patient inquiries 24/7</Text>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Configuration */}
        <div className="space-y-6">
          {/* Chatbot Name */}
          <div>
            <Text className="block text-base font-medium text-gray-700 mb-2">Chatbot Name</Text>
            <Input
              placeholder="Enter your chatbot's name (e.g., Dr. Smith Assistant, MedBot)"
              value={formData.chatbotName}
              onChange={e => handleInputChange("chatbotName", e.target.value)}
              prefix={<UserOutlined className="text-gray-400" />}
              className="rounded-lg"
              size="large"
            />
          </div>

          {/* Greeting Message */}
          <div>
            <Text className="block text-base font-medium text-gray-700 mb-2">Greeting Message</Text>
            <TextArea
              rows={4}
              placeholder="Enter a friendly greeting message for visitors"
              value={formData.greeting}
              onChange={e => handleInputChange("greeting", e.target.value)}
              className="rounded-lg"
            />
          </div>

          {/* Tone Selector */}
          <div>
            <Text className="block text-base font-medium text-gray-700 mb-2">Tone</Text>
            <Text className="text-xs text-gray-500 mb-2">How warm and approachable should your assistant sound?</Text>
            <Select
              placeholder="Select Tone"
              value={formData.toneSelector}
              onChange={value => handleInputChange("toneSelector", value)}
              className="w-full"
              size="large"
            >
              <Option value="friendly">Friendly - Warm and welcoming</Option>
              <Option value="professional">Professional - Competent and reliable</Option>
              <Option value="casual">Casual - Relaxed and conversational</Option>
              <Option value="formal">Formal - Respectful and structured</Option>
            </Select>
          </div>

          {/* Sentence Length */}
          <div>
            <Text className="block text-base font-medium text-gray-700 mb-2">Response Detail</Text>
            <Text className="text-xs text-gray-500 mb-2">How detailed should responses be?</Text>
            <Select
              placeholder="Select Response Detail"
              value={formData.sentenceLength}
              onChange={value => handleInputChange("sentenceLength", value)}
              className="w-full"
              size="large"
            >
              <Option value="short">Short - Quick and concise</Option>
              <Option value="medium">Medium - Balanced detail</Option>
              <Option value="long">Long - Comprehensive explanations</Option>
            </Select>
          </div>

          {/* Formality Level */}
          <div>
            <Text className="block text-base font-medium text-gray-700 mb-2">Formality Level</Text>
            <Text className="text-xs text-gray-500 mb-2">How formal should the language be?</Text>
            <Select
              placeholder="Select Formality Level"
              value={formData.formalityLevel}
              onChange={value => handleInputChange("formalityLevel", value)}
              className="w-full"
              size="large"
            >
              <Option value="very_casual">Very Casual - Like talking to a friend</Option>
              <Option value="casual">Casual - Relaxed but respectful</Option>
              <Option value="neutral">Neutral - Balanced approach</Option>
              <Option value="formal">Formal - Professional courtesy</Option>
              <Option value="very_formal">Very Formal - Traditional business style</Option>
            </Select>
          </div>

          {/* Color Configuration */}
          <div >
            <Flex wrap="wrap" gap="middle">
              <ColorConfigurator
                fieldName="primaryColor"
                heading="Primary color"
                value={formData.primaryColor}
                onChange={value => handleInputChange("primaryColor", value)}
              />
              
              <ColorConfigurator
                fieldName="fontColor"
                heading="Font color"
                value={formData.fontColor}
                onChange={value => handleInputChange("fontColor", value)}
              />
            </Flex>
          </div>
        </div>

        {/* Right Column - Uploads and Preview */}
        <div className="space-y-6">
          {/* Chatbot Avatar Upload */}
          <div>
            <Text className="block text-base font-medium text-gray-700 mb-2">Chatbot Avatar</Text>
            <Dragger
              fileList={formData.chatbotAvatar}
              onChange={info => handleFileUpload("chatbotAvatar", info)}
              accept=".jpg,.jpeg,.png,.svg"
              beforeUpload={() => false}
              maxCount={1}
              className="rounded-lg"
            >
              <p className="flex justify-center mb-2">
                <UserOutlined className="text-gray-400 text-2xl" />
              </p>
              <p className="text-center mb-1">Upload chatbot avatar</p>
              <p className="text-center text-xs text-gray-500">JPG, PNG, SVG (recommended: square image)</p>
            </Dragger>
          </div>

          {/* Logo Upload */}
          <div>
            <Text className="block text-base font-medium text-gray-700 mb-2">Chatbot Logo</Text>
            <Dragger
              fileList={formData.logo}
              onChange={info => handleFileUpload("logo", info)}
              accept=".jpg,.jpeg,.png,.svg"
              beforeUpload={() => false}
              maxCount={1}
              className="rounded-lg"
            >
              <p className="flex justify-center mb-2">
                <FileTextOutlined className="text-gray-400 text-2xl" />
              </p>
              <p className="text-center mb-1">Upload chatbot logo</p>
              <p className="text-center text-xs text-gray-500">JPG, PNG, SVG</p>
            </Dragger>
          </div>

          {/* Live Preview */}
          {(formData.toneSelector || formData.sentenceLength || formData.formalityLevel) && (
            <Card className="bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <MessageOutlined className="text-blue-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <Text className="text-sm font-medium text-blue-900 block mb-2">Preview: How your assistant will greet patients</Text>
                  <div className="bg-white p-3 rounded border border-blue-200">
                    <Text className="text-gray-800 italic">
                      "
                      {getPreviewText({
                        tone: formData.toneSelector,
                        formality: formData.formalityLevel,
                        length: formData.sentenceLength,
                      })}
                      "
                    </Text>
                  </div>
                  <Text className="text-xs text-blue-700 mt-2">This preview updates as you change your settings above</Text>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button onClick={onPrev} className="bg-white border border-gray-300 text-gray-700 rounded-lg px-6 py-2 h-auto">
          Previous
        </Button>

        <Button
          type="primary"
          onClick={handleNext}
          disabled={!isFormValid()}
          className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
        >
          Complete Onboarding
        </Button>
      </div>
    </div>
  );
}
