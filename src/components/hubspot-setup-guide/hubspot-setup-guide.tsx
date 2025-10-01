"use client";

import { ArrowRightOutlined, CheckCircleOutlined, InfoCircleOutlined, LeftOutlined } from "@ant-design/icons";
import { Button, Card, Progress, Tag } from "antd";
import { useState } from "react";

const steps = [
  {
    id: 1,
    title: "Login to your account",
    description: "Access your Algoricum Healthcare AI dashboard",
    content: (
      <>
        <p className="text-foreground leading-relaxed mb-4">
          Start by logging into your Algoricum Healthcare AI account using your credentials.
        </p>
        <ul className="space-y-3 mb-4">
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">Navigate to your Algoricum Healthcare AI login page</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">Enter your email address and password</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">Click the login button to access your dashboard</span>
          </li>
        </ul>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
          <div className="flex gap-3">
            <InfoCircleOutlined className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-purple-900 mb-1">Helpful tip</p>
              <p className="text-sm text-purple-800 leading-relaxed">
                Make sure you're logged in with an account that has admin permissions to manage integrations.
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 2,
    title: "Navigate to Sidebar",
    description: "Access the main navigation menu",
    content: (
      <>
        <p className="text-foreground leading-relaxed mb-4">
          Once logged in, locate the sidebar navigation on the left side of your dashboard.
        </p>
        <ul className="space-y-3 mb-4">
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">Look for the navigation menu on the left side of the screen</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">
              You'll see options like Dashboard, Lead Management, Appointments, and more
            </span>
          </li>
        </ul>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
          <div className="flex gap-3">
            <InfoCircleOutlined className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-purple-900 mb-1">Helpful tip</p>
              <p className="text-sm text-purple-800 leading-relaxed">
                The sidebar contains all the main features of your application. Take a moment to familiarize yourself with the available
                options.
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 3,
    title: "Open Integrations",
    description: "Access the integrations management page",
    content: (
      <>
        <p className="text-foreground leading-relaxed mb-4">
          Find and click on the Integrations option in the sidebar to access the integrations page.
        </p>
        <ul className="space-y-3 mb-4">
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">Scroll through the sidebar menu to find "Integrations"</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">
              Click on the Integrations menu item (it will be highlighted in purple when selected)
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">The integrations page will display all available and connected services</span>
          </li>
        </ul>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
          <div className="flex gap-3">
            <InfoCircleOutlined className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-purple-900 mb-1">Helpful tip</p>
              <p className="text-sm text-purple-800 leading-relaxed">
                The Integrations page shows both connected services and available integrations you can add to enhance your workflow.
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 4,
    title: "Locate HubSpot",
    description: "Find HubSpot in the available integrations",
    content: (
      <>
        <p className="text-foreground leading-relaxed mb-4">
          On the Integrations page, scroll down to the "Available Integrations" section to find HubSpot.
        </p>
        <ul className="space-y-3 mb-4">
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">Look for the "Available Integrations" section on the page</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">Find the HubSpot card with the orange HubSpot logo</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">
              Read the description: "Connect HubSpot CRM to manage contacts, leads, and marketing workflows"
            </span>
          </li>
        </ul>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
          <div className="flex gap-3">
            <InfoCircleOutlined className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-purple-900 mb-1">Helpful tip</p>
              <p className="text-sm text-purple-800 leading-relaxed">
                HubSpot integration allows you to sync your CRM data, manage contacts, and automate marketing workflows directly from your
                dashboard.
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 5,
    title: "Click Connect",
    description: "Initiate the HubSpot connection process",
    content: (
      <>
        <p className="text-foreground leading-relaxed mb-4">
          Click the purple "Connect" button on the HubSpot card to start the integration process.
        </p>
        <ul className="space-y-3 mb-4">
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">Click the purple "Connect" button on the HubSpot integration card</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">You'll be redirected to HubSpot's authorization page</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">Log in to your HubSpot account if prompted</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">Review and approve the requested permissions</span>
          </li>
        </ul>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
          <div className="flex gap-3">
            <InfoCircleOutlined className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-purple-900 mb-1">Helpful tip</p>
              <p className="text-sm text-purple-800 leading-relaxed">
                Make sure you have a HubSpot account ready. If you don't have one, you'll need to create a HubSpot account first before
                connecting.
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 6,
    title: "Complete Authorization",
    description: "Finalize the HubSpot connection",
    content: (
      <>
        <p className="text-foreground leading-relaxed mb-4">
          Complete the authorization process and verify your HubSpot integration is active.
        </p>
        <ul className="space-y-3 mb-4">
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">
              After approving permissions, you'll be redirected back to your dashboard
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">HubSpot will now appear in your "Connected Services" section</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">
              You can now manage your HubSpot connection with "Edit" or "Disconnect" buttons
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-foreground leading-relaxed">Start syncing your contacts, leads, and marketing data</span>
          </li>
        </ul>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
          <div className="flex gap-3">
            <InfoCircleOutlined className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-purple-900 mb-1">Helpful tip</p>
              <p className="text-sm text-purple-800 leading-relaxed">
                Once connected, your HubSpot data will automatically sync with your Algoricum dashboard. You can configure sync settings in
                the Edit menu.
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },
];

export function SetupGuide() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const handleStepComplete = () => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleStepClick = (stepId: number) => {
    setCurrentStep(stepId);
  };

  const currentStepData = steps.find(step => step.id === currentStep);
  const progress = (completedSteps.length / steps.length) * 100;
  const allStepsCompleted = completedSteps.length === steps.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-purple-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">HubSpot Setup Guide</h1>
                <p className="text-xs text-muted-foreground">Algoricum Healthcare AI</p>
              </div>
            </div>
            <Tag color="purple">
              Step {currentStep} of {steps.length}
            </Tag>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-muted border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Progress</span>
            <div className="flex-1">
              <Progress percent={Math.round(progress)} strokeColor="#7c3aed" showInfo={false} />
            </div>
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[1fr_300px] gap-8">
          {/* Main Content */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground text-balance">Connect HubSpot to Your Dashboard</h2>
              <p className="text-muted-foreground leading-relaxed text-pretty">
                Follow these simple steps to integrate HubSpot CRM with your Algoricum Healthcare AI platform. This will enable you to
                manage contacts, leads, and marketing workflows seamlessly.
              </p>
            </div>

            {/* Value Proposition Card */}
            <Card className="bg-purple-50 border-purple-200">
              <p className="text-foreground leading-relaxed mb-4">
                <strong>Algoricum</strong> integrates HubSpot leads and accounts with AI-powered nurturing capabilities, which lets users:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircleOutlined className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
                  <span className="text-foreground leading-relaxed">
                    <strong>Automatically nurture HubSpot leads</strong> with intelligent, personalized SMS and email campaigns powered by
                    AI
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircleOutlined className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
                  <span className="text-foreground leading-relaxed">
                    <strong>Convert more leads into customers</strong> through timely, AI-driven engagement that increases reach and builds
                    meaningful connections
                  </span>
                </li>
              </ul>
            </Card>

            {/* Current Step Card */}
            {currentStepData && (
              <Card className="border-2 border-purple-200">
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                    {currentStepData.id}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-2 text-balance">{currentStepData.title}</h3>
                    <p className="text-muted-foreground text-base text-pretty">{currentStepData.description}</p>
                  </div>
                </div>

                <div className="pl-14 mb-6">{currentStepData.content}</div>

                <div className="flex items-center gap-3 pl-14">
                  {currentStep > 1 && (
                    <Button icon={<LeftOutlined />} onClick={() => setCurrentStep(currentStep - 1)}>
                      Previous Step
                    </Button>
                  )}
                  <Button
                    type="primary"
                    onClick={handleStepComplete}
                    icon={currentStep < steps.length ? <ArrowRightOutlined /> : <CheckCircleOutlined />}
                    className="bg-purple-600 hover:bg-purple-700"
                    iconPosition="end"
                  >
                    {currentStep < steps.length ? "Complete & Continue" : "Complete Setup"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Completion Card */}
            {allStepsCompleted && (
              <Card className="border-2 border-purple-600 bg-purple-50">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <CheckCircleOutlined className="text-purple-600 text-3xl" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">Setup Complete!</h3>
                    <p className="text-foreground leading-relaxed">
                      You've successfully completed all the steps to connect HubSpot to your Algoricum Healthcare AI dashboard. Your leads
                      and contacts will now be automatically synced and nurtured with AI-powered campaigns.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:sticky lg:top-24 h-fit space-y-4">
            <Card title="Setup Steps" className="p-0">
              <nav className="space-y-1">
                {steps.map(step => {
                  const isCompleted = completedSteps.includes(step.id);
                  const isCurrent = currentStep === step.id;

                  return (
                    <button
                      key={step.id}
                      onClick={() => handleStepClick(step.id)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-l-2 ${
                        isCurrent
                          ? "bg-purple-50 border-purple-600 text-foreground"
                          : isCompleted
                            ? "border-transparent hover:bg-muted text-muted-foreground"
                            : "border-transparent hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircleOutlined className="text-purple-600 text-lg flex-shrink-0 mt-0.5" />
                      ) : (
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                            isCurrent ? "border-purple-600" : "border-muted-foreground"
                          }`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium mb-0.5 ${isCurrent && "text-foreground"}`}>{step.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 text-pretty">{step.description}</div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </Card>

            <Card title="Need Help?" className="bg-purple-50 border-purple-200">
              <p className="text-sm text-purple-900 leading-relaxed mb-3">
                If you encounter any issues during the setup process, our support team is here to help.
              </p>
              <Button type="default" size="small" block className="border-purple-300 hover:bg-purple-100">
                Contact Support
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
