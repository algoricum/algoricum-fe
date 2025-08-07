"use client";
import type React from "react";
import { useEffect, useState } from "react";
import { Input, Button, Typography } from "antd";
import PhoneInput, { isValidPhoneNumber, parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { ONBOARDING_COMPLETED_STEPS_KEY } from "@/constants/localStorageKeys";

const { TextArea } = Input;
const { Title, Text } = Typography;

interface ClinicInfoStepProps {
  // eslint-disable-next-line no-unused-vars
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: any;
  showAllQuestions?: boolean;
}

const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhoneNumber = (phoneNumber: string) => {
  if (!phoneNumber || !phoneNumber.trim()) {
    return { isValid: false, error: "Phone number is required" };
  }

  try {
    const isValid = isValidPhoneNumber(phoneNumber);

    if (!isValid) {
      try {
        const parsedPhone = parsePhoneNumber(phoneNumber);
        if (parsedPhone) {
          return {
            isValid: false,
            error: `Please enter a complete phone number for ${parsedPhone.country || "the selected country"}`,
          };
        }
      } catch {
        return {
          isValid: false,
          error: "Please enter a valid phone number format",
        };
      }

      return {
        isValid: false,
        error: "Please enter a complete phone number for the selected country",
      };
    }

    return { isValid: true, error: null };
  } catch {
    return {
      isValid: false,
      error: "Please enter a valid phone number",
    };
  }
};

export default function ClinicInfoStep({ onNext, onPrev, initialData = {}, showAllQuestions = false }: ClinicInfoStepProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formData, setFormData] = useState({
    clinicName: initialData.clinicName || "",
    clinicType: initialData.clinicType || "",
    primaryContactName: initialData.primaryContactName || "",
    primaryContactEmail: initialData.primaryContactEmail || "",
    clinicPhone: initialData.clinicPhone || "",
    businessAddress: initialData.businessAddress || "",
  });

  // ✅ NEW: Consent checkboxes state
  const [consentData, setConsentData] = useState({
    acceptedBAA: initialData.acceptedBAA || false,
    acceptedLeadConsent: initialData.acceptedLeadConsent || false,
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
    {
      id: "primaryContactName",
      type: "text",
      question: "What's your primary contact name?",
      placeholder: "Enter your name",
      required: true,
    },
    {
      id: "primaryContactEmail",
      type: "email",
      question: "What's your email address?",
      placeholder: "Enter your email",
      required: true,
    },
  ];

  useEffect(() => {
    if (JSON.parse(localStorage.getItem(ONBOARDING_COMPLETED_STEPS_KEY) || "[]").includes(0)) {
      setCurrentQuestionIndex(questions.length - 1);
    }
  }, [questions.length]);

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

    if (currentQuestion.type === "phone" && currentQuestion.required) {
      const phoneValidation = validatePhoneNumber(currentValue);
      if (!phoneValidation.isValid) {
        return phoneValidation.error;
      }
    }

    return null;
  };

  const handleNext = () => {
    const error = getFieldError();

    if (error) {
      alert(error);
      return;
    }

    // ✅ NEW: prevent submit if consents not checked
    if (currentQuestionIndex === questions.length - 1 && (!consentData.acceptedBAA || !consentData.acceptedLeadConsent)) {
      alert("Please accept both BAA and data handling consent to continue.");
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onNext({ ...formData, ...consentData }); // ✅ Updated to include consentData
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
              type={q.type}
              value={value}
              disabled
              className="text-xs p-3 rounded-xl border-2 border-gray-200 bg-gray-50 w-full text-gray-700"
            />
          )}
        </div>
      );
    });
  };

  const renderConsentSection = () => (
    <div className="mt-6 mb-6 space-y-3">
      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={consentData.acceptedBAA}
            onChange={e => setConsentData(prev => ({ ...prev, acceptedBAA: e.target.checked }))}
          />
          <span className="text-sm text-gray-800">I accept the Business Associate Agreement (BAA).</span>
        </label>
      </div>
      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={consentData.acceptedLeadConsent}
            onChange={e => setConsentData(prev => ({ ...prev, acceptedLeadConsent: e.target.checked }))}
          />
          <span className="text-sm text-gray-800">I consent to Algoricum securely handling lead data.</span>
        </label>
      </div>
      {consentData.acceptedBAA && consentData.acceptedLeadConsent && (
        <a
          href="/documents/Algoricum_BAA.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 text-sm underline block"
        >
          Download the signed agreement (PDF)
        </a>
      )}
    </div>
  );

  const isCurrentFieldValid = () => {
    if (currentQuestionIndex === questions.length - 1) {
      return !getFieldError() && consentData.acceptedBAA && consentData.acceptedLeadConsent;
    }
    return !getFieldError();
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
          />
          {hasError && <p className="text-red-500 text-sm mt-2">{error}</p>}
          {currentValue && !hasError && <p className="text-green-600 text-sm mt-2">✓ Valid phone number</p>}
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

  return (
    <div className="max-w-4xl">
      <Title level={1} className="text-gray-900 mb-5 text-3xl font-bold leading-tight" style={{ marginBottom: "25px" }}>
        Clinic Profile
      </Title>
      <Title level={5} className="text-gray-900 mb-5 text-3xl font-bold leading-tight" style={{ marginBottom: "25px" }}>
        Welcome! Let’s set up your clinic so that we can start following up with leads right away.
      </Title>

      {showAllQuestions ? null : renderPreviousQuestions()}

      <div>
        <Title level={3} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight" style={{ marginBottom: "21px" }}>
          {currentQuestion.question}
          {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
        </Title>

        {renderCurrentInput()}

        {/* ✅ Consent section after last step */}
        {currentQuestionIndex === questions.length - 1 && renderConsentSection()}

        <div className="flex justify-between mt-6">
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
