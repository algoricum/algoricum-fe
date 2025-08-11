"use client";
import type React from "react";
import { useEffect, useState } from "react";
import { Input, Button, Typography, Upload } from "antd";
import PhoneInput, { isValidPhoneNumber} from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { ONBOARDING_COMPLETED_STEPS_KEY } from "@/constants/localStorageKeys";
import { FileTextOutlined } from "@ant-design/icons";
import { ErrorToast } from "@/helpers/toast";


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

// FIXED PHONE VALIDATION FUNCTION
const validatePhoneNumber = (phoneNumber: string) => {
  console.log("Validating phone:", phoneNumber); // Debug log

  if (!phoneNumber || !phoneNumber.trim()) {
    return { isValid: false, error: "Phone number is required" };
  }

  try {
    // Use isValidPhoneNumber - this should work for +1 555 123 4567
    const isValid = isValidPhoneNumber(phoneNumber);
    console.log("Is valid result:", isValid);

    if (isValid) {
      return { isValid: true, error: null };
    }

    // If not valid, provide helpful error message
    return {
      isValid: false,
      error: "Please enter a complete phone number for the selected country",
    };
  } catch (error) {
    console.log("Validation error:", error);
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
    // servicesDocument will be antd fileList style array
    servicesDocument: initialData.servicesDocument || [],
  });

  const [consentData, setConsentData] = useState({
    acceptedBAA: initialData.acceptedBAA || false,
    acceptedLeadConsent: initialData.acceptedLeadConsent || false,
  });

  // Insert servicesDocument question right after businessAddress
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
    // <-- NEW required file question immediately after businessAddress
    {
      id: "servicesDocument",
      type: "file",
      question: "Upload services document for AI processing",
      placeholder: "PDF, DOC, DOCX (Max 60MB)",
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

  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e;
    }
    const fileList = e?.fileList || [];
    if (!Array.isArray(fileList)) {
      return [];
    }
    return fileList;
  };

  const handleFileChange = (info: any) => {
    const fileList = normFile(info);
    // perform safeguard validation here as well
    const validatedList = fileList.filter((file: any) => {
      // If file has originFileObj we can check size/type; otherwise accept (could be initialData)
      const fileObj = file.originFileObj || file;
      const sizeOk = typeof fileObj.size === "number" ? fileObj.size / 1024 / 1024 < 60 : true; // <60MB
      const type = fileObj.type || "";
      const isValidType =
        type === "application/pdf" ||
        type === "application/msword" ||
        type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        // allow fallback by extension if type is missing:
        (file.name && /\.(pdf|docx?|DOCX?|PDF)$/.test(file.name));
      if (!isValidType) {
        // remove invalid file from list and alert
        // eslint-disable-next-line no-console
        ErrorToast(`Rejected file type: ${file.name}`);
        console.warn("Rejected file type:", file.name);
        return false;
      }
      if (!sizeOk) {
        // eslint-disable-next-line no-console
        console.warn("Rejected file size:", file.name);
        ErrorToast(`Rejected file size: ${file.name}`);
        return false;
      }
      return true;
    });

    setFormData(prev => ({
      ...prev,
      servicesDocument: validatedList,
    }));
  };

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

  // FIXED getFieldError FUNCTION
  const getFieldError = () => {
    const value = formData[currentQuestion.id as keyof typeof formData];

    // File type handling
    if (currentQuestion.type === "file") {
      const fileList = (value as any[]) || [];
      if (currentQuestion.required && (!fileList || fileList.length === 0)) {
        return "This document is required";
      }

      // Validate each file's type/size defensively
      for (const file of fileList) {
        const fileObj = file.originFileObj || file;
        if (fileObj) {
          const sizeMB = typeof fileObj.size === "number" ? fileObj.size / 1024 / 1024 : 0;
          if (sizeMB >= 60) {
            return "File must be smaller than 60MB";
          }
          const type = fileObj.type || "";
          const isValidType =
            type === "application/pdf" ||
            type === "application/msword" ||
            type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            (file.name && /\.(pdf|docx?|DOCX?|PDF)$/.test(file.name));
          if (!isValidType) {
            return "You can only upload PDF, DOC, or DOCX files!";
          }
        }
      }
      return null;
    }

    // Required field check for all types
    if (currentQuestion.required && !value?.toString().trim()) {
      return "This field is required";
    }

    // Email validation - only if there's a value
    if (currentQuestion.type === "email" && value?.toString().trim() && !validateEmail(value as string)) {
      return "Please enter a valid email address";
    }

    // FIXED PHONE VALIDATION - Check format if there's a value
    if (currentQuestion.type === "phone" && value?.toString().trim()) {
      const phoneValidation = validatePhoneNumber(value as string);
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

    if (currentQuestionIndex === questions.length - 1 && (!consentData.acceptedBAA || !consentData.acceptedLeadConsent)) {
      alert("Please accept both BAA and data handling consent to continue.");
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onNext({ ...formData, ...consentData });
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
              value={value as string}
              disabled
              rows={3}
              className="text-xs p-3 rounded-xl border-2 border-gray-200 bg-gray-50 w-full text-gray-700"
            />
          ) : q.type === "phone" ? (
            <div className="p-3 rounded-xl border-2 border-gray-200 bg-gray-50 w-full text-gray-700 text-xs">
              {value || "No phone number entered"}
            </div>
          ) : q.type === "file" ? (
            <div className="p-3 rounded-xl border-2 border-gray-200 bg-gray-50 w-full text-gray-700 text-xs">
              {Array.isArray(value) && value.length > 0 ? (
                value.map((file: any, idx: number) => {
                  const name = file.name || (file.originFileObj && file.originFileObj.name) || `File ${idx + 1}`;
                  // if there's a url, show link; otherwise just show name
                  const url = file.url || file.response?.url;
                  return url ? (
                    <div key={idx}>
                      <a href={url} target="_blank" rel="noreferrer" className="text-purple-600 underline">
                        {name}
                      </a>
                    </div>
                  ) : (
                    <div key={idx}>{name}</div>
                  );
                })
              ) : (
                <div>No document uploaded</div>
              )}
            </div>
          ) : (
            <Input
              type={q.type as any}
              value={value as string}
              disabled
              className="text-xs p-3 rounded-xl border-2 border-gray-200 bg-gray-50 w-full text-gray-700"
            />
          )}
        </div>
      );
    });
  };

  // Update the renderConsentSection function to use the PDF generator
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
        href="/documents/baa-agreement.pdf"
        download="BAA-Agreement.pdf"
        className="text-purple-600 text-sm underline block hover:text-purple-800"
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
            value={currentValue as string}
            onChange={e => handleInputChange(e.target.value)}
            rows={4}
            className={`text-xs p-3 rounded-xl border-2 bg-white w-full mb-2 ${hasError ? "border-red-500" : "border-gray-200"}`}
            autoFocus
          />
          {hasError && <p className="text-red-500 text-sm mb-4">{error}</p>}
        </>
      );
    }

    if (currentQuestion.type === "file") {
      return (
        <div className="mb-8">
          <Text className="text-gray-500 text-sm font-normal block mb-2 leading-relaxed">
            {currentQuestion.placeholder || "PDF, DOC, DOCX (Max 60MB)"}
          </Text>
          <Upload.Dragger
            name="servicesDocument"
            accept=".pdf,.doc,.docx"
            beforeUpload={file => {
              const isValidDocument =
                file.type === "application/pdf" ||
                file.type === "application/msword" ||
                file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                /\.(pdf|docx?|PDF|DOCX?)$/.test(file.name || "");
              if (!isValidDocument) {
                alert("You can only upload PDF, DOC, or DOCX files!");
                return Upload.LIST_IGNORE;
              }
              const isValidSize = file.size / 1024 / 1024 < 60; // < 60MB
              if (!isValidSize) {
                alert("File must be smaller than 60MB!");
                return Upload.LIST_IGNORE;
              }
              // prevent automatic upload; we'll manage fileList in state
              return false;
            }}
            maxCount={1}
            className="bg-white rounded-md"
            fileList={formData.servicesDocument as any}
            onChange={handleFileChange}
          >
            <p className="flex justify-center mb-2">
              <FileTextOutlined className="text-gray-400" />
            </p>
            <p className="text-center mb-1">
              Drag and drop files here or click to upload <span className="text-purple-600">Browse Files</span>
            </p>
            <p className="text-center text-xs text-gray-500">PDF, DOC, DOCX (Max 60MB)</p>
          </Upload.Dragger>
          {hasError && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      );
    }

    if (currentQuestion.type === "phone") {
      return (
        <div className="mb-6">
          <PhoneInput
            placeholder={currentQuestion.placeholder}
            value={currentValue as string}
            onChange={handlePhoneChange}
            defaultCountry="US"
            international={true}
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
          type={currentQuestion.type as any}
          placeholder={currentQuestion.placeholder}
          value={currentValue as string}
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
      <Title level={1} className="text-gray-900 mb-5 text-3xl font-bold leading-tight">
        Clinic Profile
      </Title>
      <Title level={5} className="text-gray-900 mb-5 text-3xl font-bold leading-tight">
        Welcome! Let&apos;s set up your clinic so that we can start following up with leads right away.
      </Title>

      {showAllQuestions ? null : renderPreviousQuestions()}

      <div>
        <Title level={3} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight">
          {currentQuestion.question}
          {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
        </Title>

        {renderCurrentInput()}

        {currentQuestionIndex === questions.length - 1 && renderConsentSection()}

        <div className="flex justify-between mt-6">
          {(currentQuestionIndex > 0 || onPrev) && (
            <Button
              onClick={handlePrevious}
              className="bg-white border border-gray-300 text-gray-700 rounded-lg px-6 py-2 h-auto"
              disabled={currentQuestionIndex === 0 && !onPrev}
            >
              Previous
            </Button>
          )}
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
