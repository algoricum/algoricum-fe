"use client";

import { useEffect, useState } from "react";
import { Button, Upload, message, Typography } from "antd";
import { ONBOARDING_COMPLETED_STEPS_KEY } from "@/constants/localStorageKeys";

const { Dragger } = Upload;
const { Title, Text } = Typography;

interface AiAssistantStepProps {
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: any;
}

export default function AiAssistantStep({ onNext, onPrev, initialData = {} }: AiAssistantStepProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState({
    logoUpload: initialData.logoUpload || [],
    clinicDetailsUpload: initialData.clinicDetailsUpload || [],
  });

  const questions = [
    {
      id: "logoUpload",
      question: "Upload Logo",
      title: "Clinic Logo",
      acceptedFormats: ["image/jpeg", "image/png", "image/svg+xml"],
      acceptedExtensions: "JPG, PNG, SVG",
      description: "Drag and drop files here or click to upload",
      required: false,
    },
    {
      id: "clinicDetailsUpload",
      question: "Upload Clinic Details Document",
      title: "Services and details document for AI processing (PDF, DOC, DOCX)",
      acceptedFormats: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      acceptedExtensions: "PDF, DOC, DOCX",
      description: "Drag and drop files here or click to upload",
      note: "This will be used by the AI to answer questions about your clinic",
      required: true,
    },
  ];
   
  useEffect(() => {
    // Check if localStorage is available (for SSR compatibility)
    if (typeof window !== "undefined") {
      const onboardingCompleted = localStorage.getItem(ONBOARDING_COMPLETED_STEPS_KEY)
      if (onboardingCompleted && JSON.parse(onboardingCompleted).includes(3)) {
        // If the key exists, set the current question index to the last one
        setCurrentQuestionIndex(questions.length - 1)
      }
    }
  }, [questions.length]) // Empty dependency array ensures this runs only once on mount 
  const currentQuestion = questions[currentQuestionIndex];

  const handleFileUpload = (info: any, questionId: string) => {
    const { fileList, file } = info;

    if (file.status === "done") {
      message.success(`${file.name} file uploaded successfully`);
    } else if (file.status === "error") {
      message.error(`${file.name} file upload failed.`);
    }

    setUploadedFiles(prev => ({
      ...prev,
      [questionId]: fileList,
    }));
  };

  const isCurrentStepValid = () => {
    const currentFiles = uploadedFiles[currentQuestion.id as keyof typeof uploadedFiles] || [];

    // If current question is required, check if files are uploaded
    if (currentQuestion.required) {
      return currentFiles.length > 0;
    }

    // If not required, always valid
    return true;
  };

  const handleNext = () => {
    // Validate current step before proceeding
    if (!isCurrentStepValid()) {
      message.error(`Please upload ${currentQuestion.title.toLowerCase()} to continue`);
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onNext(uploadedFiles);
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
      const files = uploadedFiles[q.id as keyof typeof uploadedFiles] || [];
      return (
        <div key={q.id} className="mb-8">
          <Text className="text-gray-500 text-sm font-normal block mb-2 leading-relaxed">
            {q.question}
            {q.required && <span className="text-red-500 ml-1">*</span>}
          </Text>
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Text className="text-gray-700 text-lg">{files.length > 0 ? `${files.length} file(s) uploaded` : "No files uploaded"}</Text>
            {files.map((file: any, idx: number) => (
              <div key={idx} className="mt-1">
                <Text className="text-gray-500 text-sm">• {file.name}</Text>
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  const renderCurrentUpload = () => {
    const uploadProps = {
      name: "file",
      multiple: false,
      accept: currentQuestion.acceptedFormats?.join(","),
      fileList: uploadedFiles[currentQuestion.id as keyof typeof uploadedFiles] || [],
      onChange: (info: any) => handleFileUpload(info, currentQuestion.id),
      beforeUpload: (file: any) => {
        const isValidType = currentQuestion.acceptedFormats?.includes(file.type);
        if (!isValidType) {
          message.error(`You can only upload ${currentQuestion.acceptedExtensions} files!`);
          return false;
        }
        const isValidSize = file.size / 1024 / 1024 < 10;
        if (!isValidSize) {
          message.error("File must be smaller than 10MB!");
          return false;
        }
        return false;
      },
    };

    const files = uploadedFiles[currentQuestion.id as keyof typeof uploadedFiles] || [];
    const isValid = isCurrentStepValid();

    return (
      <div className="mb-8">
        {/* Title and Description */}
        <div className="mb-4">
          <Text className="text-lg font-medium text-gray-700 block mb-2">
            {currentQuestion.title}
            {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
          </Text>
          {currentQuestion.note && <Text className="text-sm text-gray-500 block">{currentQuestion.note}</Text>}
          {currentQuestion.required && <Text className="text-sm text-red-500 block mt-1">This document is required to proceed</Text>}
        </div>

        {/* Upload Area */}
        <Dragger
          {...uploadProps}
          className={`rounded-xl border-2 border-dashed transition-colors ${
            !isValid && currentQuestion.required
              ? "border-red-300 bg-red-50 hover:border-red-400"
              : "border-gray-300 bg-gray-50 hover:border-purple-400"
          }`}
        >
          <div className="p-8">
            {/* Upload Icon */}
            <div className="flex justify-center mb-4">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke={!isValid && currentQuestion.required ? "#ef4444" : "#9ca3af"}
                strokeWidth="1.5"
                className="mx-auto"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
            </div>

            {/* Upload Text */}
            <div className="text-center">
              <Text className={`text-base block mb-2 ${!isValid && currentQuestion.required ? "text-red-700" : "text-gray-700"}`}>
                {currentQuestion.description}
              </Text>
              <Text className="text-sm text-gray-400">Supported formats: {currentQuestion.acceptedExtensions}</Text>
              <Text className="text-xs text-gray-400 block mt-1">Maximum file size: 10MB</Text>
            </div>
          </div>
        </Dragger>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
            <Text className="text-sm font-medium text-green-800 block mb-2">Uploaded Files:</Text>
            {files.map((file: any, idx: number) => (
              <div key={idx} className="flex items-center text-sm text-green-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
                {file.name}
              </div>
            ))}
          </div>
        )}

        {/* Validation Error Message */}
        {!isValid && currentQuestion.required && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <Text className="text-sm text-red-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              Please upload the required clinic details document to continue
            </Text>
          </div>
        )}
      </div>
    );
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

        {renderCurrentUpload()}

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
            disabled={!isCurrentStepValid()}
            className={`h-13 text-base font-medium rounded-xl px-8 ${
              isCurrentStepValid() ? "bg-purple-500 border-purple-500" : "bg-gray-300 border-gray-300 cursor-not-allowed"
            }`}
          >
            {currentQuestionIndex === questions.length - 1 ? "Continue to Next Step" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
