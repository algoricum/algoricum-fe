"use client";
import type React from "react";
import { useEffect, useState } from "react";
import { Input, Button, Typography, notification, Spin } from "antd";
import PhoneInput, { isValidPhoneNumber, parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { ONBOARDING_COMPLETED_STEPS_KEY } from "@/constants/localStorageKeys";
import { getClinicData } from "@/utils/supabase/clinic-helper"; // Assuming this is your Supabase helper

const { TextArea } = Input;
const { Title, Text } = Typography;

interface ClinicInfoStepProps {
  // eslint-disable-next-line no-unused-vars
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: any;
  showAllQuestions?: boolean;
}

interface MailgunSetupResponse {
  success: boolean;
  message: string;
  data?: {
    clinic: {
      id: string;
      name: string;
      slug: string;
      domain: string;
      email: string;
    };
    mailgun: {
      domainVerified: boolean;
      domainState: string;
      dnsAutomated: boolean;
      routeCreated: boolean;
      requiredDNSRecords?: any;
      nextSteps: string[];
    };
    timing: {
      totalDuration: string;
      mailgunSetupDuration: string;
    };
  };
  error?: string;
  nextSteps?: string[];
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
      } catch (parseError) {
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
  } catch (error) {
    return {
      isValid: false,
      error: "Please enter a valid phone number",
    };
  }
};

export default function ClinicInfoStep({ onNext, onPrev, initialData = {}, showAllQuestions = false }: ClinicInfoStepProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clinicData, setClinicData] = useState<any>(null); // State to hold clinic data
  const [isLoadingClinic, setIsLoadingClinic] = useState(true); // Loading state for clinic data

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

  // Fetch clinic data on component mount
  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const data = await getClinicData();
        setClinicData(data);
        if (data) {
          // If a clinic exists, pre-fill form data and move to the last step
          setFormData({
            clinicName: data.name || "",
            clinicType: data.clinic_type || "",
            primaryContactEmail: data.email || "",
            clinicPhone: data.phone || "",
            businessAddress: data.address || "",
          });
          setCurrentQuestionIndex(questions.length - 1);
        }
      } catch (error) {
        console.error("Failed to fetch clinic data:", error);
      } finally {
        setIsLoadingClinic(false);
      }
    };

    fetchClinic();
  }, []);

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

  const setupMailgunDomain = async (): Promise<MailgunSetupResponse> => {
    console.log("🚀 Starting Mailgun domain setup...");
    if (!clinicData?.id) {
      throw new Error("Clinic ID not available. Cannot proceed with mailgun setup.");
    }

    try {
      const response = await fetch("/api/mailgun-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          clinicId: clinicData.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log("✅ Mailgun setup completed:", data);
      return data;
    } catch (error) {
      console.error("❌ Mailgun setup failed:", error);
      throw error;
    }
  };

  const handleNext = async () => {
    const error = getFieldError();

    if (error) {
      notification.error({
        message: "Validation Error",
        description: error,
        duration: 4,
      });
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Final step - setup clinic and mailgun domain
      setIsSubmitting(true);

      try {
        notification.info({
          message: "Setting up your clinic...",
          description: "Creating your clinic profile and email domain. This may take a moment.",
          duration: 6,
        });

        const mailgunResult = await setupMailgunDomain();

        if (mailgunResult.success) {
          notification.success({
            message: "Clinic Setup Complete!",
            description: (
              <div>
                <p>
                  <strong>✅ Clinic Created:</strong> {mailgunResult.data?.clinic.name}
                </p>
                <p>
                  <strong>📧 Email Domain:</strong> {mailgunResult.data?.clinic.email}
                </p>
                <p>
                  <strong>🌐 Domain Status:</strong> {mailgunResult.data?.mailgun.domainVerified ? "Verified" : "Pending verification"}
                </p>
                {!mailgunResult.data?.mailgun.dnsAutomated && (
                  <p>
                    <strong>⚠️ Action Required:</strong> Manual DNS setup needed
                  </p>
                )}
              </div>
            ),
            duration: 10,
          });

          const completeData = {
            ...formData,
            clinic: mailgunResult.data?.clinic,
            mailgun: mailgunResult.data?.mailgun,
            setupComplete: true,
          };

          onNext(completeData);
        } else {
          notification.warning({
            message: "Partial Setup Complete",
            description: (
              <div>
                <p>
                  <strong>✅ Clinic Created</strong>
                </p>
                <p>
                  <strong>❌ Email Setup Failed:</strong> {mailgunResult.error}
                </p>
                <p>You can continue and set up email later.</p>
              </div>
            ),
            duration: 8,
          });

          const partialData = {
            ...formData,
            clinic: mailgunResult.data?.clinic,
            setupComplete: false,
            setupError: mailgunResult.error,
          };

          onNext(partialData);
        }
      } catch (error: any) {
        console.error("Setup failed:", error);

        notification.error({
          message: "Setup Failed",
          description: (
            <div>
              <p>
                <strong>Error:</strong> {error.message}
              </p>
              <p>Please try again or contact support if the issue persists.</p>
            </div>
          ),
          duration: 8,
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handlePrevious = () => {
    if (isSubmitting) return;

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

  const renderAllQuestions = () => (
    <div className="mb-8">
      <Typography.Title level={4} className="mb-4">
        All Answers
      </Typography.Title>
      {questions.map(q => {
        const value = formData[q.id as keyof typeof formData];
        return (
          <div key={q.id} className="mb-4">
            <Text className="text-gray-700 font-medium block mb-1">{q.question}</Text>
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
              <Input value={value} disabled className="text-xs p-3 rounded-xl border-2 border-gray-200 bg-gray-50 w-full text-gray-700" />
            )}
          </div>
        );
      })}
    </div>
  );

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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
            className={`phone-input-custom ${hasError ? "phone-input-error" : ""} ${isSubmitting ? "phone-input-disabled" : ""}`}
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
          {currentValue && !hasError && <p className="text-green-600 text-sm mt-2">✓ Valid phone number</p>}
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
            :global(.phone-input-custom.phone-input-disabled) {
              background: #f9fafb;
              opacity: 0.7;
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
          disabled={isSubmitting}
        />
        {hasError && <p className="text-red-500 text-sm mb-4">{error}</p>}
      </>
    );
  };

  const isCurrentFieldValid = () => {
    return !getFieldError();
  };

  const renderSubmittingState = () => {
    if (!isSubmitting) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-xl max-w-md mx-4 text-center">
          <Spin size="large" />
          <h3 className="text-lg font-semibold mt-4 mb-2">Setting up your clinic...</h3>
          <p className="text-gray-600">
            We&apos;re creating your clinic profile and setting up your email domain. This may take up to 2 minutes.
          </p>
          <div className="mt-4 text-sm text-gray-500">
            <div>• Creating clinic profile ✓</div>
            <div>• Setting up email domain...</div>
            <div>• Configuring DNS records...</div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoadingClinic) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spin size="large" tip="Loading clinic data..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {renderSubmittingState()}

      {/* Show all questions/answers if requested */}
      {showAllQuestions && renderAllQuestions()}

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
            disabled={(currentQuestionIndex === 0 && !onPrev) || isSubmitting}
          >
            Previous
          </Button>

          <Button
            type="primary"
            onClick={handleNext}
            disabled={!isCurrentFieldValid() || isSubmitting}
            loading={isSubmitting}
            className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
          >
            {isSubmitting
              ? "Setting up clinic..."
              : currentQuestionIndex === questions.length - 1
                ? "Create Clinic & Setup Email"
                : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
