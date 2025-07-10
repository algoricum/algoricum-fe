"use client";

import type React from "react";

import { useState } from "react";
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
    },
    {
      id: "clinicType",
      type: "text",
      question: "What type of clinic do you run?",
      placeholder: "e.g., Chiropractic, Medical Aesthetics, Dermatology",
    },
    {
      id: "primaryContactEmail",
      type: "email",
      question: "What's your email address?",
      placeholder: "Enter your email",
    },
    {
      id: "clinicPhone",
      type: "phone",
      question: "What's your clinic's phone number?",
      placeholder: "Enter your phone number",
    },
    {
      id: "businessAddress",
      type: "textarea",
      question: "What's your clinic's business address?",
      placeholder: "Enter your complete business address",
    },
  ];

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

  const handleNext = () => {
    const currentValue = formData[currentQuestion.id as keyof typeof formData];

    // Validate current field
    if (currentQuestion.type === "email" && !validateEmail(currentValue)) {
      alert("Please enter a valid email address");
      return;
    }

    if (currentQuestion.type === "phone" && !currentValue) {
      alert("Please enter a valid phone number");
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
          <Text className="text-gray-500 text-sm font-normal block mb-2 leading-relaxed">{q.question}</Text>
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
    const isEmailInvalid = currentQuestion.type === "email" && currentValue && !validateEmail(currentValue);

    if (currentQuestion.type === "textarea") {
      return (
        <TextArea
          placeholder={currentQuestion.placeholder}
          value={currentValue}
          onChange={e => handleInputChange(e.target.value)}
          rows={4}
          className="text-xs p-3 rounded-xl border-2 border-gray-200 bg-white w-full mb-6"
          autoFocus
        />
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
            className="phone-input-custom"
            style={
              {
                "--PhoneInput-color--focus": "#a855f7",
                "--PhoneInputInternationalIconPhone-opacity": "0.8",
                "--PhoneInputInternationalIconGlobe-opacity": "0.65",
                "--PhoneInputCountrySelect-marginRight": "0.5em",
                "--PhoneInputCountrySelectArrow-width": "0.3em",
                "--PhoneInputCountrySelectArrow-marginLeft": "0.35em",
              } as React.CSSProperties
            }
          />
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
            :global(.phone-input-custom:focus-within) {
              border-color: #a855f7;
              outline: none;
              box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.1);
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
          className={`text-xs p-3 rounded-xl border-2 bg-white w-full mb-2 ${isEmailInvalid ? "border-red-500" : "border-gray-200"}`}
          autoFocus
        />
        {isEmailInvalid && <p className="text-red-500 text-sm mb-4">Please enter a valid email address</p>}
      </>
    );
  };

  const isCurrentFieldValid = () => {
    if (!currentValue?.trim()) return false;

    if (currentQuestion.type === "email") {
      return validateEmail(currentValue);
    }

    if (currentQuestion.type === "phone") {
      return currentValue.length > 0;
    }

    return true;
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
