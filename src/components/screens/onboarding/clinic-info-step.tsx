"use client";
import { ONBOARDING_COMPLETED_STEPS_KEY } from "@/constants/localStorageKeys";
import { ErrorToast, WarningToast } from "@/helpers/toast";
import { createClient } from "@/utils/supabase/config/client";
import { DollarCircleOutlined, FileTextOutlined, StarOutlined } from "@ant-design/icons";
import { Button, Input, Typography, Upload } from "antd";
import { useEffect, useState } from "react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input/max";
import "react-phone-number-input/style.css";
const { TextArea } = Input;
const { Title, Text } = Typography;
const supabase = createClient();

interface ClinicInfoStepProps {
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
    // primaryContactEmail: initialData.primaryContactEmail || "",
    clinicPhone: initialData.clinicPhone || "",
    businessAddress: initialData.businessAddress || "",
    // Three separate document arrays
    servicesDocument: initialData.servicesDocument || [],
    pricingDocument: initialData.pricingDocument || [],
    testimonialsDocument: initialData.testimonialsDocument || [],
  });

  // NEW: Track which fields have been touched/interacted with
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const [consentData, setConsentData] = useState({
    acceptedTermsandConditions: initialData.acceptedBAA || false,
    acceptedPrivacyPolicy: initialData.acceptedLeadConsent || false,
  });

  const handleConsentChange = (field: keyof typeof consentData, value: boolean) => {
    setConsentData(prev => ({ ...prev, [field]: value }));
  };

  // NEW: Function to mark a field as touched
  const markFieldAsTouched = (fieldId: string) => {
    setTouchedFields(prev => new Set([...prev, fieldId]));
  };

  // Updated questions array - file uploads are now handled as one step
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
    // Combined file upload step
    {
      id: "documents",
      type: "files",
      question: "Upload your clinic documents for AI processing",
      placeholder: "Upload services, pricing, and testimonials documents",
      required: true, // At least services document is required
    }
  ];

  // File upload configurations
  const fileUploadConfigs = [
    {
      id: "servicesDocument",
      question: "Services Document",
      placeholder: "Service information, procedures, FAQs",
      required: true,
      icon: FileTextOutlined,
      documentType: "services",
    },
    {
      id: "pricingDocument",
      question: "Pricing Information",
      placeholder: "Service costs, insurance details, payment options",
      required: false,
      icon: DollarCircleOutlined,
      documentType: "pricing",
    },
    {
      id: "testimonialsDocument",
      question: "Testimonials & Reviews",
      placeholder: "Patient reviews, success stories, case studies",
      required: false,
      icon: StarOutlined,
      documentType: "testimonials",
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

  // Enhanced handleFileChange to handle different document types
  const handleFileChange = async (info: any, documentType: string) => {
    // Mark documents field as touched when user interacts with file upload
    markFieldAsTouched("documents");

    const fileList = normFile(info);

    // Filter & validate
    const validatedList = fileList.filter((file: any) => {
      const fileObj = file.originFileObj || file;
      const sizeOk = typeof fileObj.size === "number" ? fileObj.size / 1024 / 1024 < 50 : true; // <50MB
      const type = fileObj.type || "";
      const isValidType =
        type === "application/pdf" ||
        type === "application/msword" ||
        type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        (file.name && /\.(pdf|docx?|DOCX?|PDF)$/.test(file.name));

      if (!isValidType) {
        ErrorToast(`Rejected file type: ${file.name}`);
        console.warn("Rejected file type:", file.name);
        return false;
      }
      if (!sizeOk) {
        console.warn("Rejected file size:", file.name);
        ErrorToast(`Rejected file size: ${file.name}`);
        return false;
      }
      return true;
    });

    const uploadedFiles: { name: any; path: string; signedUrl: string; documentType: string }[] = [];

    for (const file of validatedList) {
      const fileObj = file.originFileObj || file;

      // Use different storage paths for different document types
      const path = `${documentType}/${Date.now()}-${fileObj.name}`;

      // Upload to Supabase (private bucket)
      const { error: uploadError } = await supabase.storage.from("Assistant-File").upload(path, fileObj);

      if (uploadError) {
        console.error("Upload failed:", uploadError);
        ErrorToast(`Failed to upload: ${fileObj.name}`);
        continue;
      }

      // Generate a signed URL (1 hour expiry)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from("Assistant-File").createSignedUrl(path, 60 * 60);

      if (signedUrlError) {
        console.error("Signed URL failed:", signedUrlError);
        ErrorToast(`Failed to get URL for: ${fileObj.name}`);
        continue;
      }

      uploadedFiles.push({
        name: fileObj.name,
        path,
        signedUrl: signedUrlData.signedUrl,
        documentType: documentType,
      });
    }

    // Store in the appropriate state field based on document type
    const fieldName = `${documentType}Document` as keyof typeof formData;
    setFormData(prev => ({
      ...prev,
      [fieldName]: uploadedFiles,
    }));
  };

  const handleInputChange = (value: string) => {
    // Mark current field as touched when user types
    markFieldAsTouched(currentQuestion.id);

    setFormData(prev => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const handlePhoneChange = (value: string | undefined) => {
    // Mark phone field as touched when user interacts
    markFieldAsTouched("clinicPhone");

    setFormData(prev => ({
      ...prev,
      clinicPhone: value || "",
    }));
  };

  // NEW: Handle field blur (when user leaves a field)
  const handleFieldBlur = (fieldId: string) => {
    markFieldAsTouched(fieldId);
  };

  // UPDATED: Enhanced getFieldError function to only show errors for touched fields or after submit attempt
  const getFieldError = (showError: boolean = false) => {
    const fieldId = currentQuestion.id;

    // Only show error if field has been touched, submit was attempted, or explicitly requested
    const shouldShowError = showError || touchedFields.has(fieldId) || attemptedSubmit;

    if (!shouldShowError) {
      return null;
    }

    if (currentQuestion.type === "files") {
      // Check if at least services document is uploaded (required)
      const servicesFiles = formData.servicesDocument || [];
      if (servicesFiles.length === 0) {
        return "Services document is required";
      }
      return null;
    }

    const value = formData[currentQuestion.id as keyof typeof formData];

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
    // Mark that user attempted to submit
    setAttemptedSubmit(true);
    markFieldAsTouched(currentQuestion.id);

    const error = getFieldError(true); // Force show error

    if (error) {
      alert(error);
      return;
    }

    if (currentQuestionIndex === questions.length - 1 && (!consentData.acceptedTermsandConditions || !consentData.acceptedPrivacyPolicy)) {
      WarningToast("Please accept both Terms and Conditions and Privacy Policy to continue.");
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      // Reset submit attempt for next field
      setAttemptedSubmit(false);
    } else {
      onNext({ ...formData, ...consentData });
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      // Reset submit attempt when going back
      setAttemptedSubmit(false);
    } else if (onPrev) {
      onPrev();
    }
  };

  // Enhanced renderPreviousQuestions to handle file uploads
  const renderPreviousQuestions = () => {
    return questions.slice(0, currentQuestionIndex).map(q => {
      const value = formData[q.id as keyof typeof formData];

      if (q.type === "files") {
        return (
          <div key={q.id} className="mb-8">
            <Text className="text-gray-500 text-sm font-normal block mb-2 leading-relaxed">
              {q.question}
              <span className="text-red-500 ml-1">*</span>
            </Text>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fileUploadConfigs.map(config => {
                const files = formData[config.id as keyof typeof formData] as any[];
                return (
                  <div key={config.id} className="p-3 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-700 text-xs">
                    <div className="font-medium mb-1">{config.question}</div>
                    {Array.isArray(files) && files.length > 0 ? (
                      files.map((file: any, idx: number) => {
                        const name = file.name || (file.originFileObj && file.originFileObj.name) || `File ${idx + 1}`;
                        const url = file.signedUrl || file.url || file.response?.url;
                        return url ? (
                          <div key={idx} className="flex items-center gap-2 mb-1">
                            <span className="text-green-600">✓</span>
                            <a href={url} target="_blank" rel="noreferrer" className="text-purple-600 underline">
                              {name}
                            </a>
                          </div>
                        ) : (
                          <div key={idx} className="flex items-center gap-2 mb-1">
                            <span className="text-green-600">✓</span>
                            <span>{name}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-gray-400">No document uploaded</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

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

  // Updated consent section with modal triggers
  const renderConsentSection = () => (
    <div className="mt-6 mb-6 space-y-4">
      <div>
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentData.acceptedTermsandConditions}
            onChange={() => {
              handleConsentChange("acceptedTermsandConditions", !consentData.acceptedTermsandConditions);
            }}
            className="mt-1"
          />
          <div>
            <span className="text-sm text-gray-800 block">I accept the Terms and Conditions.</span>
            <button
              type="button"
              onClick={() => window.open("https://algoricum.com/termsofservice/", "_blank")}
              className="text-purple-600 text-xs underline hover:text-purple-800"
            >
              Click to read the Terms and Conditions
            </button>
          </div>
        </label>
      </div>

      <div>
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentData.acceptedPrivacyPolicy}
            onChange={() => {
              handleConsentChange("acceptedPrivacyPolicy", !consentData.acceptedPrivacyPolicy);
            }}
            className="mt-1"
          />
          <div>
            <span className="text-sm text-gray-800 block">I consent to Algoricum Privacy Policy.</span>
            <button
              type="button"
              onClick={() => window.open("https://algoricum.com/privacypolicy/", "_blank")}
              className="text-purple-600 text-xs underline hover:text-purple-800"
            >
              Click to read the Privacy Policy
            </button>
          </div>
        </label>
      </div>
    </div>
  );

  const isCurrentFieldValid = () => {
    if (currentQuestionIndex === questions.length - 1) {
      return !getFieldError(true) && consentData.acceptedPrivacyPolicy && consentData.acceptedTermsandConditions;
    }
    return !getFieldError(true);
  };

  // New function to render all three file uploads side by side
  const renderFileUploads = () => {
    const error = getFieldError();
    const hasError = !!error;

    return (
      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {fileUploadConfigs.map(config => {
            const Icon = config.icon;
            const files = formData[config.id as keyof typeof formData] as any[];

            return (
              <div key={config.id} className="flex flex-col">
                <div className="mb-3">
                  <Text className="text-gray-800 font-medium text-sm block mb-1">
                    {config.question}
                    {config.required && <span className="text-red-500 ml-1">*</span>}
                  </Text>
                  <Text className="text-gray-500 text-sm font-normal block mb-2 leading-relaxed">
                    {config.placeholder} (PDF, DOC, DOCX - Max 50MB)
                  </Text>
                </div>

                <Upload.Dragger
                  name={config.id}
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
                    const isValidSize = file.size / 1024 / 1024 < 50; // < 50MB
                    if (!isValidSize) {
                      alert("File must be smaller than 50MB!");
                      return Upload.LIST_IGNORE;
                    }
                    // prevent automatic upload; we'll manage fileList in state
                    return false;
                  }}
                  maxCount={1}
                  className="bg-white rounded-md"
                  fileList={files || []}
                  onChange={info => handleFileChange(info, config.documentType)}
                  showUploadList={false}
                >
                  <p className="flex justify-center mb-2">
                    <Icon className="text-gray-400" />
                  </p>
                  <p className="text-center mb-1">
                    Drag and drop files here or click to upload <span className="text-purple-600">Browse Files</span>
                  </p>
                  <p className="text-center text-xs text-gray-500">PDF, DOC, DOCX (Max 50MB)</p>
                </Upload.Dragger>

                {Array.isArray(files) && files.length > 0 && (
                  <div className="p-3 rounded-xl border-2 border-gray-200 bg-gray-50 w-full text-gray-700 text-xs mt-2">
                    {files.map((file: any, idx: number) => {
                      const name = file.name || (file.originFileObj && file.originFileObj.name) || `File ${idx + 1}`;
                      const url = file.signedUrl || file.url || file.response?.url;
                      return url ? (
                        <div key={idx} className="flex items-center gap-2 mb-1">
                          <span className="text-green-600">✓</span>
                          <a href={url} target="_blank" rel="noreferrer" className="text-purple-600 underline">
                            {name}
                          </a>
                          <span className="text-xs text-gray-500">({file.documentType || "document"})</span>
                        </div>
                      ) : (
                        <div key={idx} className="flex items-center gap-2 mb-1">
                          <span className="text-green-600">✓</span>
                          <span>{name}</span>
                          <span className="text-xs text-gray-500">({file.documentType || "document"})</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasError && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    );
  };

  // UPDATED: Enhanced renderCurrentInput to handle the new files type and add blur handlers
  const renderCurrentInput = () => {
    const error = getFieldError();
    const hasError = !!error;

    if (currentQuestion.type === "files") {
      return renderFileUploads();
    }

    if (currentQuestion.type === "textarea") {
      return (
        <>
          <TextArea
            placeholder={currentQuestion.placeholder}
            value={currentValue as string}
            onChange={e => handleInputChange(e.target.value)}
            onBlur={() => handleFieldBlur(currentQuestion.id)}
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
          <div onBlur={() => handleFieldBlur(currentQuestion.id)}>
            <PhoneInput
              placeholder={currentQuestion.placeholder}
              value={currentValue as string}
              onChange={handlePhoneChange}
              defaultCountry="US"
              international={true}
              countryCallingCodeEditable={false}
              className={`phone-input-custom ${hasError ? "phone-input-error" : ""} p-2 rounded-xl border-2 bg-white`}
            />
          </div>
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
          onBlur={() => handleFieldBlur(currentQuestion.id)}
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
