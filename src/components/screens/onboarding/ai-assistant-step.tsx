"use client";

import { useState } from "react";
import { Button, Upload, message, Typography } from "antd";

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
    },
    {
      id: "clinicDetailsUpload",
      question: "Upload Clinic Details Document",
      title: "Services and details document for AI processing (PDF, DOC, DOCX)",
      acceptedFormats: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      acceptedExtensions: "PDF, DOC, DOCX",
      description: "Drag and drop files here or click to upload",
      note: "This will be used by the AI to answer questions about your clinic",
    },
  ];

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

  const handleNext = () => {
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
          <Text className="text-gray-500 text-sm font-normal block mb-2 leading-relaxed">{q.question}</Text>
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

    return (
      <div className="mb-8">
        <Text className="text-base font-medium text-gray-700 block mb-2">{currentQuestion.title}</Text>

        <Dragger {...uploadProps} className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12">
          <div className="mb-4">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10,9 9,9 8,9" />
            </svg>
          </div>

          <Text className="text-base text-gray-700 block mb-2">{currentQuestion.description}</Text>

          <Text className="text-sm text-gray-400">{currentQuestion.acceptedExtensions}</Text>
        </Dragger>

        {currentQuestion.note && <Text className="text-sm text-gray-400 text-center block mt-2">{currentQuestion.note}</Text>}
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
            className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
          >
            {currentQuestionIndex === questions.length - 1 ? "Continue to Next Step" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
