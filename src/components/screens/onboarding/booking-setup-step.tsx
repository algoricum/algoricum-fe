"use client";

import { useState, useEffect } from "react";
import { Button, Input, Radio, Card, Space, Typography } from "antd";
// import { forEach } from "lodash";
import { ONBOARDING_COMPLETED_STEPS_KEY } from "@/constants/localStorageKeys";

const { Title, Text } = Typography;

interface BookingSetupStepProps {
  // eslint-disable-next-line no-unused-vars
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: any;
}

const validateBookingUrl = (url: string) => {
  if (!url || !url.trim()) return { isValid: false, error: "Booking link is required" };

  // Basic URL regex pattern
  const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

  // Check if it's a valid URL format
  if (!urlRegex.test(url)) {
    return { isValid: false, error: "Please enter a valid URL (must start with http:// or https://)" };
  }

  // Check for booking-related keywords
  const bookingKeywords =
    /\b(calendly|acuity|booksy|square|meet|zoom|teams|appointy|setmore|simplybook|booknow|schedule|appointment|booking)\b/i;

  if (!bookingKeywords.test(url)) {
    return {
      isValid: false,
      error: "Please enter a valid booking link (should contain booking service keywords like calendly, meet, zoom, etc.)",
    };
  }

  return { isValid: true, error: null };
};

export default function BookingSetupStep({ onNext, onPrev, initialData = {} }: BookingSetupStepProps) {
  const [validationError, setValidationError] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formData, setFormData] = useState({
    hasBookingLink: initialData.hasBookingLink || "",
    bookingLinkUrl: initialData.bookingLinkUrl || "",
  });

  const questions = [
    {
      id: "hasBookingLink",
      type: "radio",
      question: "Do you already have an online booking link?",
      options: ["Yes, I have a booking link", "No, I don't have one"],
    },
    {
      id: "bookingLinkUrl",
      type: "text",
      question: "Please enter your booking link",
      placeholder: "https://your-booking-site.com",
      conditional: {
        dependsOn: "hasBookingLink",
        showWhen: "Yes, I have a booking link",
      },
    },
  ];

  useEffect(() => {
    if (JSON.parse(localStorage.getItem(ONBOARDING_COMPLETED_STEPS_KEY) || "[]").includes(4)) {
      if (formData.hasBookingLink === "Yes, I have a booking link") {
        setCurrentQuestionIndex(questions.length - 1);
      } else if (formData.hasBookingLink === "No, I don't have one") {
        setCurrentQuestionIndex(0);
      }
    }
  }, [formData.hasBookingLink, questions.length]);

  const currentQuestion = questions[currentQuestionIndex];
  const currentValue = formData[currentQuestion.id as keyof typeof formData];

  const handleInputChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentQuestion.id]: value,
    }));

    // Clear validation error when user starts typing
    if (currentQuestion.id === "bookingLinkUrl") {
      setValidationError("");
    }
  };

  const handleNext = () => {

    // Validate booking URL if it's the current question
    if (currentQuestion.id === "bookingLinkUrl") {
      const validation = validateBookingUrl(currentValue);
      if (!validation.isValid) {
        setValidationError(validation.error || "");
        return;
      }
    }
    
    // Check if we should skip the URL question
    if (currentQuestionIndex === 0 && formData.hasBookingLink === "No, I don't have one") {
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

  const renderPreviousQuestions = () => {
    return questions.slice(0, currentQuestionIndex).map(q => {
      const value = formData[q.id as keyof typeof formData];

      return (
        <div key={q.id} className="mb-8">
          <Text className="text-gray-500 text-sm font-normal block mb-2 leading-relaxed">{q.question}</Text>
          {q.type === "radio" ? (
            <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
              <Text className="text-gray-700 text-lg">{value}</Text>
            </div>
          ) : (
            <Input value={value} disabled className="text-xs p-3 rounded-xl border-2 border-gray-200 bg-gray-50 w-full text-gray-700" />
          )}
        </div>
      );
    });
  };

  const renderCurrentInput = () => {
    if (currentQuestion.type === "radio") {
      return (
        <div className="mb-6">
          <Radio.Group value={currentValue} onChange={e => handleInputChange(e.target.value)} className="w-full">
            <Space direction="vertical" size="middle" className="w-full">
              {currentQuestion.options?.map(option => (
                <Card
                  key={option}
                  hoverable
                  className={`rounded-xl border-2 cursor-pointer ${
                    currentValue === option ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white hover:border-purple-300"
                  }`}
                  styles={{ body: { padding: "16px" } }}
                  onClick={() => handleInputChange(option)}
                >
                  <Radio value={option} className="text-lg text-black">
                    <span className="text-black">{option}</span>
                  </Radio>
                </Card>
              ))}
            </Space>
          </Radio.Group>

          {/* Show info card for "No" option */}
          {currentValue === "No, I don't have one" && (
            <Card className="rounded-xl bg-blue-50 border-2 border-blue-500 mt-6" styles={{ body: { padding: "20px" } }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                  <Text className="text-white text-base">✓</Text>
                </div>
                <Text className="text-lg font-semibold text-blue-900">We&apos;ve got you covered!</Text>
              </div>
              <Text className="text-blue-900 text-base leading-6">
                No worries! You&apos;ll be able to use our integrated booking system. We&apos;ll help you set up a seamless appointment
                scheduling experience for your patients.
              </Text>
            </Card>
          )}
        </div>
      );
    }

    return (
      <div>
        <Input
          type="text"
          placeholder={currentQuestion.placeholder}
          value={currentValue}
          onChange={e => handleInputChange(e.target.value)}
          className={`w-full mb-2 ${validationError ? "border-red-500" : ""}`}
          size="large"
          autoFocus
        />
        {validationError && <p className="text-red-500 text-sm mb-4">{validationError}</p>}
      </div>
    );
  };

  return (
    <div className="max-w-4xl">
      {/* Previous Questions */}
      {renderPreviousQuestions()}

      {/* Current Question */}
      <div>
        <Title
          level={1}
          className="text-gray-800 mb-5 font-semibold leading-8"
          style={{ margin: 0, marginBottom: "21px", fontSize: "24px", lineHeight: "32px" }}
        >
          {currentQuestion.question}
        </Title>

        {renderCurrentInput()}

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
            disabled={!currentValue.trim()}
            className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
          >
            Complete Setup
          </Button>
        </div>
      </div>
    </div>
  );
}
