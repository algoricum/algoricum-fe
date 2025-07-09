"use client";

import { useState } from "react";
import { Typography } from "antd";
import ClinicInfoStep from "./clinic-info-step";
import StaffHoursStep from "./staff-hours-step";
import ToneIdentityStep from "./tone-identity-step";
import AiAssistantStep from "./ai-assistant-step";
import BookingSetupStep from "./booking-setup-step";
import IntegrationsStep from "./integrations-step";

const { Text } = Typography;

const STEPS = [
  { id: "clinic-info", title: "Clinic Info", description: "Basic details", icon: "📋" },
  { id: "staff-hours", title: "Hours", description: "Schedule", icon: "👥" },
  { id: "tone-identity", title: "Tone", description: "Style", icon: "🎨" },
  { id: "ai-assistant", title: "AI Setup", description: "Documents", icon: "💬" },
  { id: "booking-setup", title: "Booking", description: "Appointments", icon: "⚙️" },
  { id: "integrations", title: "Integrations", description: "Tools", icon: "⚡" },
];

export default function MainOnboarding() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [allData, setAllData] = useState<Record<string, any>>({});
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const currentStep = STEPS[currentStepIndex];

  const handleStepComplete = (stepData: any) => {
    // Save step data
    setAllData(prev => ({
      ...prev,
      [currentStep.id]: stepData,
    }));

    // Mark step as completed
    if (!completedSteps.includes(currentStepIndex)) {
      setCompletedSteps(prev => [...prev, currentStepIndex]);
    }

    // Move to next step
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Onboarding complete
      console.log("Onboarding complete!", allData);
      alert("Onboarding Complete! Check console for data.");
    }
  };

  const handleStepPrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    if (completedSteps.includes(stepIndex) || stepIndex === currentStepIndex) {
      setCurrentStepIndex(stepIndex);
    }
  };

  const handleLogout = () => {
    console.log("Logout clicked");
    // Add logout logic here
  };

  const renderCurrentStep = () => {
    const stepData = allData[currentStep.id] || {};

    switch (currentStep.id) {
      case "clinic-info":
        return (
          <ClinicInfoStep
            onNext={handleStepComplete}
            onPrev={currentStepIndex > 0 ? handleStepPrevious : undefined}
            initialData={stepData}
          />
        );
      case "staff-hours":
        return <StaffHoursStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "tone-identity":
        return <ToneIdentityStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "ai-assistant":
        return <AiAssistantStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "booking-setup":
        return <BookingSetupStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "integrations":
        return <IntegrationsStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-72 bg-gradient-to-b from-purple-500 to-purple-600 p-5 h-screen overflow-hidden">
        {/* Logo */}
        <div className="flex items-center mb-5">
          <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center mr-2">
            <Text className="text-purple-500 text-sm font-bold">A</Text>
          </div>
          <Text className="text-white text-lg font-semibold">Algoricum</Text>
        </div>

        {/* Steps */}
        <div className="relative">
          {STEPS.map((step, index) => {
            const isCurrent = currentStepIndex === index;
            const isCompleted = completedSteps.includes(index);
            const isAccessible = index <= currentStepIndex || isCompleted;

            return (
              <div key={step.id} className={`relative ${index === STEPS.length - 1 ? "" : "mb-3"}`}>
                {/* Vertical connecting line */}
                {index < STEPS.length - 1 && <div className="absolute left-3 top-5 w-px h-3 bg-white bg-opacity-30 z-10" />}

                <div
                  className={`flex items-start cursor-pointer opacity-100 ${isAccessible ? "cursor-pointer" : "cursor-default opacity-70"}`}
                  onClick={() => isAccessible && handleStepClick(index)}
                >
                  {/* Icon Circle */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 flex-shrink-0 z-20 relative ${
                      isCurrent ? "bg-white bg-opacity-90" : "bg-white bg-opacity-20"
                    }`}
                  >
                    <Text className={`text-xs ${isCurrent ? "text-purple-500" : "text-white text-opacity-80"}`}>
                      {isCompleted ? "✓" : step.icon}
                    </Text>
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 pt-0">
                    <Text className="text-white text-opacity-80 text-xs font-normal block mb-0 tracking-wide">{index + 1}/6</Text>
                    <Text className="text-white text-sm font-semibold block mb-0 leading-none">{step.title}</Text>
                    <Text className="text-white text-opacity-70 text-xs leading-tight block">{step.description}</Text>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Logout Button */}
        <div className="absolute bottom-5 left-5 right-5">
          <button
            onClick={handleLogout}
            className="w-auto bg-white bg-opacity-20 border border-white border-opacity-30 text-white rounded-lg px-4 py-2 h-auto text-sm hover:bg-white hover:bg-opacity-30 transition-all flex items-center"
          >
            <span className="mr-2">→</span>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-screen overflow-hidden relative">
        <div className="h-full overflow-y-auto py-11 px-8">{renderCurrentStep()}</div>
      </div>
    </div>
  );
}
