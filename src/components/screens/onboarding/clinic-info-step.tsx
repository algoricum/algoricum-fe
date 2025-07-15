"use client";
import type React from "react";
import { useEffect, useState } from "react";
import { Input, Button, Typography } from "antd";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

const { TextArea } = Input;
const { Title, Text } = Typography;

interface ClinicInfoStepProps {
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: any;
}

const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function ClinicInfoStep({ onNext, onPrev, initialData = {} }: ClinicInfoStepProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formData, setFormData] = useState({
    clinicName: initialData.clinicName || "",
    clinicType: initialData.clinicType || "",
    primaryContactEmail: initialData.primaryContactEmail || "",
    clinicPhone: initialData.clinicPhone || "",
    businessAddress: initialData.businessAddress || "",
  });

  const questions = [
    {
      id: "clinicName",
      type: "text",
      question: "What's the name of your clinic?",
      placeholder: "Enter your clinic name",
      required: true,
    },
    {
      id: "clinicType",
      type: "text",
      question: "What type of clinic do you run?",
      placeholder: "e.g., Chiropractic, Medical Aesthetics, Dermatology",
      required: false,
    },
    {
      id: "primaryContactEmail",
      type: "email",
      question: "What's your email address?",
      placeholder: "Enter your email",
      required: true,
    },
    {
      id: "clinicPhone",
      type: "phone",
      question: "What's your clinic's phone number?",
      placeholder: "Enter your phone number",
      required: true,
    },
    {
      id: "businessAddress",
      type: "textarea",
      question: "What's your clinic's business address?",
      placeholder: "Enter your complete business address",
      required: true,
    },
  ];
     // Effect to check localStorage on component mount
  useEffect(() => {
    // Check if localStorage is available (for SSR compatibility)
    if (typeof window !== "undefined") {
      const onboardingCompleted = localStorage.getItem("clinic_onboarding_completed_steps_v2")
      if (onboardingCompleted) {
        // If the key exists, set the current question index to the last one
        setCurrentQuestionIndex(questions.length - 1)
      }
    }
  }, []) // Empty dependency array ensures this runs only once on mount

  const currentQuestion = questions[currentQuestionIndex];
  const currentValue = formData[currentQuestion.id as keyof typeof formData];

  const handleInputChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const handlePhoneChange = (value: string | undefined) => {
    setFormData(prev => ({
      ...prev,
      clinicPhone: value || "",
    }));
  };

  const getFieldError = () => {
    const currentValue = formData[currentQuestion.id as keyof typeof formData];

    if (currentQuestion.required && !currentValue?.trim()) {
      return "This field is required";
    }

    if (currentQuestion.type === "email" && currentValue?.trim() && !validateEmail(currentValue)) {
      return "Please enter a valid email address";
    }

    if (currentQuestion.type === "phone" && currentQuestion.required && !currentValue?.trim()) {
      return "Please enter a valid phone number";
    }

    return null;
  };

  const handleNext = () => {
    const error = getFieldError();

    if (error) {
      alert(error);
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
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
          <Text className="text-gray-500 text-sm font-normal block mb-2 leading-relaxed">
            {q.question}
            {q.required && <span className="text-red-500 ml-1">*</span>}
          </Text>
          {q.type === "textarea" ? (
            <TextArea
              value={value}
              disabled
              rows={3}
              className="text-xs p-3 rounded-xl border-2 border-gray-200 bg-gray-50 w-full text-gray-700"
            />
          ) : q.type === "phone" ? (
            <div className="p-3 rounded-xl border-2 border-gray-200 bg-gray-50 w-full text-gray-700 text-xs">
              {value || "No phone number entered"}
            </div>
          ) : (
            <Input
              type={q.type === "phone" ? "text" : q.type}
              value={value}
              disabled
              className="text-xs p-3 rounded-xl border-2 border-gray-200 bg-gray-50 w-full text-gray-700"
            />
          )}
        </div>
      );
    });
  };

  const renderCurrentInput = () => {
    const error = getFieldError();
    const hasError = !!error;

    if (currentQuestion.type === "textarea") {
      return (
        <>
          <TextArea
            placeholder={currentQuestion.placeholder}
            value={currentValue}
            onChange={e => handleInputChange(e.target.value)}
            rows={4}
            className={`text-xs p-3 rounded-xl border-2 bg-white w-full mb-2 ${hasError ? "border-red-500" : "border-gray-200"}`}
            autoFocus
          />
          {hasError && <p className="text-red-500 text-sm mb-4">{error}</p>}
        </>
      );
    }

    if (currentQuestion.type === "phone") {
      return (
        <div className="mb-6">
          <PhoneInput
            placeholder={currentQuestion.placeholder}
            value={currentValue}
            onChange={handlePhoneChange}
            defaultCountry="US"
            international
            countryCallingCodeEditable={false}
            className={`phone-input-custom ${hasError ? "phone-input-error" : ""}`}
            style={
              {
                "--PhoneInput-color--focus": hasError ? "#ef4444" : "#a855f7",
                "--PhoneInputInternationalIconPhone-opacity": "0.8",
                "--PhoneInputInternationalIconGlobe-opacity": "0.65",
                "--PhoneInputCountrySelect-marginRight": "0.5em",
                "--PhoneInputCountrySelectArrow-width": "0.3em",
                "--PhoneInputCountrySelectArrow-marginLeft": "0.35em",
              } as React.CSSProperties
            }
          />
          {hasError && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <style jsx>{`
            :global(.phone-input-custom) {
              display: flex;
              align-items: center;
              padding: 12px;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              background: white;
              font-size: 12px;
            }
            :global(.phone-input-custom.phone-input-error) {
              border-color: #ef4444;
            }
            :global(.phone-input-custom:focus-within) {
              border-color: #a855f7;
              outline: none;
              box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.1);
            }
            :global(.phone-input-custom.phone-input-error:focus-within) {
              border-color: #ef4444;
              box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
            }
            :global(.phone-input-custom .PhoneInputInput) {
              border: none;
              outline: none;
              font-size: 12px;
              background: transparent;
              flex: 1;
            }
            :global(.phone-input-custom .PhoneInputCountrySelect) {
              border: none;
              outline: none;
              background: transparent;
              margin-right: 8px;
            }
            :global(.phone-input-custom .PhoneInputCountryIcon) {
              width: 20px;
              height: 15px;
            }
          `}</style>
        </div>
      );
    }

    return (
      <>
        <Input
          type={currentQuestion.type}
          placeholder={currentQuestion.placeholder}
          value={currentValue}
          onChange={e => handleInputChange(e.target.value)}
          className={`text-xs p-3 rounded-xl border-2 bg-white w-full mb-2 ${hasError ? "border-red-500" : "border-gray-200"}`}
          autoFocus
        />
        {hasError && <p className="text-red-500 text-sm mb-4">{error}</p>}
      </>
    );
  };

  const isCurrentFieldValid = () => {
    return !getFieldError();
  };

  return (
    <div className="max-w-4xl">
      {/* Previous Questions */}
      {renderPreviousQuestions()}

      {/* Current Question */}
      <div>
        <Title level={1} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight" style={{ margin: 0, marginBottom: "21px" }}>
          {currentQuestion.question}
          {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
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
            disabled={!isCurrentFieldValid()}
            className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
          >
            {currentQuestionIndex === questions.length - 1 ? "Continue to Next Step" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
