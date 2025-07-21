"use client";
import { useState, useEffect } from "react";
import { Button, Select, Typography } from "antd";
import { ONBOARDING_COMPLETED_STEPS_KEY } from "@/constants/localStorageKeys";

const { Option } = Select;
const { Title, Text } = Typography;

interface ToneIdentityStepProps {
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: any;
}

export default function ToneIdentityStep({ onNext, onPrev, initialData = {} }: ToneIdentityStepProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formData, setFormData] = useState({
    toneSelector: initialData.toneSelector || "",
    sentenceLength: initialData.sentenceLength || "",
    formalityLevel: initialData.formalityLevel || "",
  });

  const questions = [
    {
      id: "toneSelector",
      question: "How warm and approachable should your AI assistant sound?",
      options: [
        { value: "friendly", label: "Warm and welcoming" },
        { value: "professional", label: "Competent and reliable" },
        { value: "casual", label: "Relaxed and conversational" },
        { value: "formal", label: "Respectful and structured" },
      ],
    },
    {
      id: "sentenceLength",
      question: "How detailed should responses be?",
      options: [
        { value: "short", label: "Quick and concise responses" },
        { value: "medium", label: "Balanced detail in responses" },
        { value: "long", label: "Comprehensive explanations" },
      ],
    },
    {
      id: "formalityLevel",
      question: "How formal should the language be?",
      options: [
        { value: "very_casual", label: "Like talking to a friend" },
        { value: "casual", label: "Relaxed but respectful" },
        { value: "neutral", label: "Balanced approach" },
        { value: "formal", label: "Professional courtesy" },
        { value: "very_formal", label: "Traditional business style" },
      ],
    },
  ];

   useEffect(() => {
    if (JSON.parse(localStorage.getItem(ONBOARDING_COMPLETED_STEPS_KEY) || "[]").includes(2)) {
      setCurrentQuestionIndex(questions.length - 1);
    }
  }, []);

  const currentQuestion = questions[currentQuestionIndex];
  const currentValue = formData[currentQuestion.id as keyof typeof formData];

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const handleNext = () => {
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (onPrev) {
      onPrev();
    }
  };

  const getSelectedLabel = (questionId: string, value: string) => {
    const question = questions.find(q => q.id === questionId);
    const option = question?.options.find(opt => opt.value === value);
    return option?.label || value;
  };

  const renderPreviousQuestions = () => {
    return questions.slice(0, currentQuestionIndex).map(q => {
      const value = formData[q.id as keyof typeof formData];
      return (
        <div key={q.id} className="mb-8">
          <Text className="text-gray-500 text-sm font-normal block mb-2 leading-relaxed">{q.question}</Text>
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Text className="text-gray-700 text-lg">{getSelectedLabel(q.id, value)}</Text>
          </div>
        </div>
      );
    });
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

        <Select
          placeholder="Select an option"
          value={currentValue || undefined}
          onChange={handleSelectChange}
          size="large"
          className="w-full text-lg mb-6"
          dropdownClassName="text-base"
        >
          {currentQuestion.options.map(option => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>

        <div className="flex justify-between">
          <Button
            onClick={handlePrevious}
            className="bg-white border border-gray-300 text-gray-700 rounded-lg px-6 py-2 h-auto"
            disabled={currentQuestionIndex === 0 && !onPrev}
          >
            Previous
          </Button>

          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              type="primary"
              onClick={handleNext}
              disabled={!currentValue}
              className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
            >
              Next
            </Button>
          ) : (
            <Button
              type="primary"
              onClick={() => onNext(formData)}
              disabled={!currentValue}
              className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
            >
              Continue to Next Step
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
