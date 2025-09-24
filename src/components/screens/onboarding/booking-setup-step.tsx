"use client";
import { CalendlyModal } from "@/components/modals/CalendlyModal";
import { ONBOARDING_COMPLETED_STEPS_KEY } from "@/constants/localStorageKeys";
import { connectToCalendly, fetchCalendlyEventTypes, saveCalendlyEventType } from "@/utils/integration-utils";
import { Button, Card, Input, Radio, Space, Typography } from "antd";
import { useEffect, useState } from "react";

const { Title, Text } = Typography;

interface BookingSetupStepProps {
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
  const [state, setState] = useState({
    validationError: "",
    currentQuestionIndex: 0,
    showCalendlyModal: false,
    calendlyStatus: "disconnected" as "disconnected" | "connecting" | "connected",
    calendlyLoading: false,
    calendlyAccountInfo: null as any,
    showEventTypeSelection: false,
    availableEventTypes: [] as any[],
    selectedEventType: null as any,
    eventTypeSelectionLoading: false,
    formData: {
      hasBookingLink: initialData.hasBookingLink || "",
      bookingLinkUrl: initialData.bookingLinkUrl || "",
    },
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
      if (state.formData.hasBookingLink === "Yes, I have a booking link") {
        setState(prev => ({ ...prev, currentQuestionIndex: questions.length - 1 }));
      } else if (state.formData.hasBookingLink === "No, I don't have one") {
        setState(prev => ({ ...prev, currentQuestionIndex: 0 }));
      }
    }
  }, [state.formData.hasBookingLink, questions.length]);

  // Check for successful Calendly OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const calendlyStatus = urlParams.get("calendly_status");
    const integrationId = urlParams.get("integration_id");

    if (calendlyStatus === "success" && integrationId) {
      setState(prev => ({
        ...prev,
        calendlyStatus: "connected",
        calendlyAccountInfo: { integration_id: integrationId },
        showCalendlyModal: false,
        showEventTypeSelection: true,
      }));

      // Fetch available event types
      handleFetchEventTypes();

      // Clean up URL parameters
      window.history.replaceState({}, "", window.location.pathname);
    } else if (calendlyStatus === "error") {
      setState(prev => ({
        ...prev,
        calendlyStatus: "disconnected",
        calendlyLoading: false,
        showCalendlyModal: false,
      }));

      // Clean up URL parameters
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const currentQuestion = questions[state.currentQuestionIndex];
  const currentValue = state.formData[currentQuestion.id as keyof typeof state.formData];

  const handleInputChange = (value: string) => {
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        [currentQuestion.id]: value,
      },
      // Clear validation error when user starts typing
      validationError: currentQuestion.id === "bookingLinkUrl" ? "" : prev.validationError,
      // Show Calendly modal when user selects "No, I don't have one"
      showCalendlyModal: currentQuestion.id === "hasBookingLink" && value === "No, I don't have one",
    }));
  };

  const handleNext = () => {
    // Validate booking URL if it's the current question
    if (currentQuestion.id === "bookingLinkUrl") {
      const validation = validateBookingUrl(currentValue);
      if (!validation.isValid) {
        setState(prev => ({ ...prev, validationError: validation.error || "" }));
        return;
      }
    }

    // Check if we should skip the URL question and show Calendly modal
    if (state.currentQuestionIndex === 0 && state.formData.hasBookingLink === "No, I don't have one") {
      setState(prev => ({ ...prev, showCalendlyModal: true }));
      return;
    }

    if (state.currentQuestionIndex < questions.length - 1) {
      // Check if next question should be shown
      const nextQuestion = questions[state.currentQuestionIndex + 1];
      if (nextQuestion.conditional) {
        const dependentAnswer = state.formData[nextQuestion.conditional.dependsOn as keyof typeof state.formData];
        if (dependentAnswer !== nextQuestion.conditional.showWhen) {
          onNext(state.formData);
          return;
        }
      }
      setState(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1 }));
    } else {
      console.log("🔍 BookingSetupStep: Final form data being passed:", state.formData);
      onNext(state.formData);
    }
  };

  const handlePrevious = () => {
    if (state.currentQuestionIndex > 0) {
      setState(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex - 1 }));
    } else if (onPrev) {
      onPrev();
    }
  };

  const renderPreviousQuestions = () => {
    return questions.slice(0, state.currentQuestionIndex).map(q => {
      const value = state.formData[q.id as keyof typeof state.formData];

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
          className={`w-full mb-2 ${state.validationError ? "border-red-500" : ""}`}
          size="large"
          autoFocus
        />
        {state.validationError && <p className="text-red-500 text-sm mb-4">{state.validationError}</p>}
      </div>
    );
  };

  // Calendly modal handlers
  const handleCalendlyConnect = async () => {
    setState(prev => ({ ...prev, calendlyStatus: "connecting", calendlyLoading: true }));

    const setButtonLoading = (loading: boolean) => {
      setState(prev => ({ ...prev, calendlyLoading: loading }));
    };

    try {
      await connectToCalendly(setButtonLoading);
    } catch (error) {
      console.error("Error initiating Calendly OAuth:", error);
      setState(prev => ({
        ...prev,
        calendlyStatus: "disconnected",
        calendlyLoading: false,
      }));
    }
  };

  const handleCalendlyModalOk = () => {
    setState(prev => ({ ...prev, showCalendlyModal: false }));
    if (state.calendlyStatus === "connected") {
      onNext(state.formData);
    } else {
      onNext(state.formData); // Skip and continue without Calendly
    }
  };

  const handleCalendlyModalCancel = () => {
    setState(prev => ({ ...prev, showCalendlyModal: false }));
  };

  // Fetch available Calendly event types
  const handleFetchEventTypes = async () => {
    setState(prev => ({ ...prev, eventTypeSelectionLoading: true }));

    try {
      const eventTypes = await fetchCalendlyEventTypes();
      setState(prev => ({
        ...prev,
        availableEventTypes: eventTypes,
        eventTypeSelectionLoading: false,
      }));
    } catch (error) {
      console.log("booking setup error is ", error);
      setState(prev => ({
        ...prev,
        eventTypeSelectionLoading: false,
        showEventTypeSelection: false,
      }));
    }
  };

  // Handle event type selection
  const handleEventTypeSelect = (eventType: any) => {
    setState(prev => ({ ...prev, selectedEventType: eventType }));
  };

  // Save selected event type and complete onboarding
  const handleSaveEventType = async () => {
    if (!state.selectedEventType) return;

    setState(prev => ({ ...prev, eventTypeSelectionLoading: true }));

    try {
      await saveCalendlyEventType(state.selectedEventType.uri);

      // Update form data with the selected booking link
      const updatedFormData = {
        ...state.formData,
        bookingLinkUrl: state.selectedEventType.scheduling_url,
        hasBookingLink: "Yes, I have a booking link",
      };

      setState(prev => ({
        ...prev,
        formData: updatedFormData,
        showEventTypeSelection: false,
        eventTypeSelectionLoading: false,
      }));

      // Complete onboarding
      onNext(updatedFormData);
    } catch (error) {
      console.log("booking setup error is ", error);
      setState(prev => ({ ...prev, eventTypeSelectionLoading: false }));
    }
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
            disabled={state.currentQuestionIndex === 0 && !onPrev}
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

      {/* Calendly OAuth Modal */}
      <CalendlyModal
        open={state.showCalendlyModal}
        status={state.calendlyStatus}
        accountInfo={state.calendlyAccountInfo}
        availableEventTypes={state.availableEventTypes}
        buttonLoading={state.calendlyLoading}
        onConnect={handleCalendlyConnect}
        onOk={handleCalendlyModalOk}
        onCancel={handleCalendlyModalCancel}
      />

      {/* Event Type Selection Overlay */}
      {state.showEventTypeSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <Title level={2} className="text-gray-800 mb-2">
                🎉 Calendly Connected Successfully!
              </Title>
              <Text className="text-gray-600 text-lg">Choose which booking service you'd like to offer to your patients:</Text>
            </div>

            {state.eventTypeSelectionLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <Text>Loading your available services...</Text>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {state.availableEventTypes.map((eventType: any) => (
                  <Card
                    key={eventType.uri}
                    hoverable
                    className={`cursor-pointer transition-all ${
                      state.selectedEventType?.uri === eventType.uri
                        ? "border-purple-500 bg-purple-50 border-2"
                        : "border-gray-200 hover:border-purple-300 border-2"
                    }`}
                    onClick={() => handleEventTypeSelect(eventType)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Title level={4} className="mb-1">
                          {eventType.name}
                        </Title>
                        <Text className="text-gray-600">
                          {eventType.duration} minutes • {eventType.kind === "solo" ? "One-on-one" : eventType.kind}
                        </Text>
                      </div>
                      <div className="ml-4">
                        {state.selectedEventType?.uri === eventType.uri && (
                          <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm">✓</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}

                {state.availableEventTypes.length === 0 && !state.eventTypeSelectionLoading && (
                  <div className="text-center py-8">
                    <Text className="text-gray-500">No event types found. You can set this up later in your Calendly account.</Text>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              <Button
                type="primary"
                onClick={handleSaveEventType}
                loading={state.eventTypeSelectionLoading}
                disabled={!state.selectedEventType}
                className="bg-purple-500 border-purple-500 hover:!bg-purple-600 px-8"
              >
                Save & Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
