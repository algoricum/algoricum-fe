"use client";
import { ColorConfigurator } from "@/components/common";
import { ONBOARDING_COMPLETED_STEPS_KEY } from "@/constants/localStorageKeys";
import { FileTextOutlined, MessageOutlined, RobotOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Input, Modal, Radio, Select, Space, Spin, Typography, Upload } from "antd";
import { useEffect, useRef, useState } from "react";

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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formData, setFormData] = useState({
    hasChatbot: initialData.hasChatbot || "",
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
  const [isModalVisible, setIsModalVisible] = useState(false); // State for modal visibility
  const [isBuffering, setIsBuffering] = useState(true);

  const questions = [
    {
      id: "hasChatbot",
      type: "radio",
      question: "Are you already using a chatbot?",
      options: ["Yes", "No"],
    },
    {
      id: "configuration",
      type: "configuration",
      question: "",
      subtitle: "Let's set up your intelligent chatbot to handle patient inquiries 24/7",
      conditional: {
        dependsOn: "hasChatbot",
        showWhen: "No",
      },
    },
  ];

  useEffect(() => {
    if (JSON.parse(localStorage.getItem(ONBOARDING_COMPLETED_STEPS_KEY) || "[]").includes(5)) {
      if (formData.hasChatbot === "Yes") {
        setCurrentQuestionIndex(0);
      } else if (formData.hasChatbot === "No") {
        setCurrentQuestionIndex(questions.length - 1);
      }
    }
  }, [formData.hasChatbot, questions.length]);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 1.5;
    }
  }, [isModalVisible]);

  const currentQuestion = questions[currentQuestionIndex];

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
    // Check if we should skip the configuration
    if (currentQuestionIndex === 0 && formData.hasChatbot === "Yes") {
      onNext(formData);
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      // Check if next question should be shown
      const nextQuestion = questions[currentQuestionIndex + 1];
      if (nextQuestion.conditional) {
        const dependentAnswer = formData[nextQuestion.conditional.dependsOn as keyof typeof formData];
        if (dependentAnswer !== nextQuestion.conditional.showWhen) {
          onNext(formData);
          return;
        }
      }
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onNext(formData);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (onPrev) {
      onPrev();
    }
  };

  const isFormValid = () => {
    if (currentQuestion.id === "hasChatbot") {
      return formData.hasChatbot.trim();
    }
    if (currentQuestion.id === "configuration") {
      return (
        formData.chatbotName.trim() &&
        formData.greeting.trim() &&
        formData.toneSelector &&
        formData.sentenceLength &&
        formData.formalityLevel
      );
    }
    return true;
  };

  const renderPreviousQuestions = () => {
    return questions.slice(0, currentQuestionIndex).map(q => {
      if (q.id === "hasChatbot") {
        const value = formData[q.id as keyof typeof formData];
        return (
          <div key={q.id} className="mb-8">
            <Text className="text-gray-500 text-sm font-normal block mb-2 leading-relaxed">{q.question}</Text>
            <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
              <Text className="text-gray-700 text-lg">{value}</Text>
            </div>
          </div>
        );
      }
      return null;
    });
  };

  const renderCurrentInput = () => {
    if (currentQuestion.type === "radio") {
      const currentValue = formData[currentQuestion.id as keyof typeof formData];
      return (
        <div className="mb-6">
          <Radio.Group value={currentValue} onChange={e => handleInputChange(currentQuestion.id, e.target.value)} className="w-full">
            <Space direction="vertical" size="middle" className="w-full">
              {currentQuestion.options?.map(option => (
                <Card
                  key={option}
                  hoverable
                  className={`rounded-xl border-2 cursor-pointer ${currentValue === option ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white hover:border-purple-300"}`}
                  style={{ padding: "16px" }}
                  onClick={() => handleInputChange(currentQuestion.id, option)}
                >
                  <Radio value={option} className="text-lg text-black">
                    <span className="text-black">{option}</span>
                  </Radio>
                </Card>
              ))}
            </Space>
          </Radio.Group>
          {/* Show info card for "No" option */}
          {currentValue === "No" && (
            <Card className="rounded-xl bg-blue-50 border-2 border-blue-500 mt-6" style={{ padding: "20px" }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                  <Text className="text-white text-base">✓</Text>
                </div>
                <Text className="text-lg font-semibold text-blue-900">Great! We&apos;ll help you integrate it</Text>
              </div>
              <Text className="text-blue-900 text-base leading-6">
                Perfect! We&apos;ll help you integrate your existing chatbot solution with our platform for a seamless patient experience.
              </Text>
            </Card>
          )}
        </div>
      );
    }

    if (currentQuestion.type === "configuration") {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
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
            <div>
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
            {/* New Integrate Bot Button */}
            <div className="flex justify-end">
              <Button
                type="primary"
                icon={<RobotOutlined />}
                onClick={() => setIsModalVisible(true)}
                className=" h-15 text-base py-4 font-medium rounded-xl px-8 shadow-lg text-white" // Added shadow-lg and text-white
                style={{
                  backgroundColor: "#A068F1",
                  borderColor: "#A068F1",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Integrate Bot
              </Button>
            </div>
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
                        &quot;
                        {getPreviewText({
                          tone: formData.toneSelector,
                          formality: formData.formalityLevel,
                          length: formData.sentenceLength,
                        })}
                        &quot;
                      </Text>
                    </div>
                    <Text className="text-xs text-blue-700 mt-2">This preview updates as you change your settings above</Text>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-4xl">
      {/* Previous Questions */}
      {renderPreviousQuestions()}

      {/* Current Question */}
      <div>
        <Title level={1} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight" style={{ margin: 0, marginBottom: "21px" }}>
          {currentQuestion.question}
        </Title>
        {currentQuestion.subtitle && <Text className="text-gray-600 text-2xl block mb-8 font-bold">{currentQuestion.subtitle}</Text>}
        {renderCurrentInput()}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            onClick={handlePrevious}
            className="bg-white border border-gray-300 text-gray-700 rounded-lg px-6 py-2 h-auto"
            disabled={currentQuestionIndex === 0 && !onPrev}
          >
            Previous
          </Button>
          <Button
            type="primary"
            onClick={handleNext}
            disabled={!isFormValid()}
            className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
          >
            {currentQuestionIndex === questions.length - 1 ? "Next" : "Continue to Next Step"}
          </Button>
        </div>
      </div>

      {/* Chatbot Integration Guide Modal */}
      <Modal
        title="Chatbot Integration Guide"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="back" onClick={() => setIsModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={720} // Adjust modal width to better fit video
      >
        <Typography>
          <Title level={4}>Follow these steps to integrate your chatbot:</Title>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <Text strong>Complete Onboarding:</Text> Ensure you have finished all the onboarding steps.
            </li>
            <li>
              <Text strong>Go to Dashboard:</Text> Navigate to your main dashboard.
            </li>
            <li>
              <Text strong>Go to Profile Settings:</Text> Access your profile settings from the navigation menu.
            </li>
            <li>
              <Text strong>Go to Chatbot Settings:</Text> Find the dedicated &quot;Chatbot Settings&quot; section.
            </li>
            <li>
              <Text strong>Click &quot;Generate Script&quot; and Copy it:</Text> Generate the integration script and copy it to embed your
              chatbot on your website.
            </li>
          </ol>
          <Text className="mt-4 block text-gray-600">
            This script will allow your intelligent chatbot to handle patient inquiries 24/7.
          </Text>
        </Typography>
        {/* Video at the end of the modal */}
        <div className="mt-6 relative">
          <Title level={5}>Watch the integration guide:</Title>
          <div className="relative w-full">
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              controls
              className="w-full rounded-lg shadow-md"
              onCanPlay={() => setIsBuffering(false)}
              onPlaying={() => setIsBuffering(false)}
              onWaiting={() => setIsBuffering(true)}
            >
              <source src="/videos/chatbot-setup-video.webm" type="video/webm" />
              <source src="/videos/chatbot-setup-video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            {isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 z-10">
                <Spin size="large" />
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
