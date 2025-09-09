// _shared/reply-response.ts

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

interface LeadData {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status: string;
  clinic_id: string;
  notes?: string;
  form_data?: any;
}

interface ClinicData {
  id: string;
  name: string;
  phone_number?: string;
  calendly_link?: string;
  mailgun_email?: string;
}

interface GenerateAIResponseOptions {
  messageBody: string;
  subject?: string; // For email responses
  threadId?: string;
  isEmail?: boolean; // Optional - will be auto-detected if not provided
  callerService?: "sms-processor" | "test-email-connection"; // Auto-detect response type
}

// Enhanced logging
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] REPLY-RESPONSE: ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] REPLY-RESPONSE ERROR: ${message}`, error);
}

// Auto-detect response type based on caller or explicit flag
function detectResponseType(options: GenerateAIResponseOptions): boolean {
  if (options.isEmail !== undefined) {
    return options.isEmail;
  }

  // Auto-detect based on caller service
  if (options.callerService === "test-email-connection") {
    return true; // Email response
  } else if (options.callerService === "sms-processor") {
    return false; // SMS response
  }

  // Fallback: detect based on presence of subject (emails typically have subjects)
  return !!options.subject;
}

export async function generateAIResponse(
  leadData: LeadData,
  options: GenerateAIResponseOptions,
  supabaseClient: any,
  clinicData: ClinicData,
): Promise<{ success: boolean; response?: string; error?: string }> {
  // Auto-detect if this should be email or SMS response
  const isEmailResponse = detectResponseType(options);

  logInfo(`=== Starting generateAIResponse ===`);
  logInfo("Function parameters:", {
    leadId: leadData?.id,
    leadName: `${leadData?.first_name} ${leadData?.last_name}`,
    messageLength: options.messageBody?.length,
    clinicId: clinicData?.id,
    clinicName: clinicData?.name,
    threadId: options.threadId,
    isEmailResponse: isEmailResponse,
    callerService: options.callerService,
    hasSubject: !!options.subject,
  });

  try {
    logInfo("🤖 Calling OpenAI Assistants API for response generation...");

    // Get conversation history for context if threadId is provided
    let conversationContext = "";
    if (options.threadId) {
      logInfo("🔍 Fetching conversation history for threadId:", options.threadId);
      const { data: conversationHistory, error: historyError } = await supabaseClient
        .from("conversation")
        .select("message, sender_type, created_at")
        .eq("thread_id", options.threadId)
        .order("created_at", { ascending: true })
        .limit(10);

      if (historyError) {
        logError("❌ Error fetching conversation history:", historyError);
      } else {
        logInfo("✅ Conversation history fetched:", conversationHistory?.length || 0, "messages");
      }

      conversationContext = conversationHistory
        ? conversationHistory.map((c: any) => `${c.sender_type === "lead" ? "Patient" : "Clinic"}: ${c.message}`).join("\n\n")
        : "";
    } else {
      logInfo("ℹ️ No threadId provided, skipping conversation history");
    }

    // Extract phone from form_data or notes
    const phoneNumber =
      leadData.form_data?.phone_number ||
      leadData.notes?.match(/\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] ||
      leadData.phone ||
      "Not provided";
    logInfo("📱 Extracted phone number:", phoneNumber);

    // Check if user is asking about booking/scheduling
    const isBookingInquiry =
      options.messageBody.toLowerCase().includes("book") ||
      options.messageBody.toLowerCase().includes("schedule") ||
      options.messageBody.toLowerCase().includes("appointment") ||
      options.messageBody.toLowerCase().includes("meeting") ||
      options.messageBody.toLowerCase().includes("time") ||
      options.messageBody.toLowerCase().includes("available");

    const bookingLink = clinicData.calendly_link || "https://calendly.com/book";
    const unsubscribeLink = `${SUPABASE_URL}/functions/v1/unsubscribe-lead?lead_id=${leadData.id}&clinic_id=${clinicData.id}`;

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    logInfo("🔑 OpenAI API Key check:", {
      exists: !!openaiApiKey,
      length: openaiApiKey?.length || 0,
      prefix: openaiApiKey?.substring(0, 7) || "none",
    });

    if (!openaiApiKey) {
      logError("❌ OpenAI API key not found");
      const fallbackResponse = `Hey ${leadData.first_name || "there"}! Thanks for reaching out to ${clinicData.name}. Happy to help!`;
      return { success: true, response: fallbackResponse };
    }

    // Get the assistant ID and instructions for this clinic
    logInfo("🔍 Searching for assistant for clinic:", clinicData.id);
    const { data: assistantData, error: assistantError } = await supabaseClient
      .from("assistants")
      .select("openai_assistant_id, assistant_name, model, instructions")
      .eq("clinic_id", clinicData.id)
      .limit(1)
      .single();

    logInfo("🤖 Assistant query result:", {
      error: assistantError,
      assistantData: assistantData,
      assistantId: assistantData?.openai_assistant_id,
      assistantName: assistantData?.assistant_name,
      hasInstructions: !!assistantData?.instructions,
      instructionsLength: assistantData?.instructions?.length || 0,
    });

    if (assistantError || !assistantData?.openai_assistant_id) {
      logError("❌ No assistant found for clinic, falling back to Chat Completions API");
      logError("Assistant error details:", assistantError);
      logError("Assistant data:", assistantData);
      logError("❌ CRITICAL: Falling back to Chat Completions instead of using Assistant with data");
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }

    const assistantId = assistantData.openai_assistant_id;
    logInfo(`🤖 Using assistant: ${assistantId} (${assistantData.assistant_name})`);

    // Import OpenAI (dynamic import for Deno)
    logInfo("📦 Importing OpenAI SDK...");
    const { default: OpenAI } = await import("jsr:@openai/openai");
    logInfo("✅ OpenAI SDK imported successfully");

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });
    logInfo("✅ OpenAI client initialized");

    // Test basic API connectivity
    logInfo("🔌 Testing OpenAI API connectivity...");
    try {
      const models = await openai.models.list();
      logInfo("✅ OpenAI API accessible, models count:", models.data?.length || 0);
    } catch (apiError) {
      logError("❌ OpenAI API not accessible:", apiError);
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }

    // Verify assistant exists first
    logInfo("🔍 Verifying assistant exists...");
    try {
      const assistant = await openai.beta.assistants.retrieve(assistantId);
      logInfo(`✅ Assistant verified:`, {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model,
        tools: assistant.tools?.length || 0,
      });
    } catch (error) {
      logError("❌ Assistant not found or not accessible:", error.message);
      logError("Assistant verification error details:", error);
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }

    // Get clinic-specific instructions
    const clinicInstructions = assistantData?.instructions || "";

    // Create appropriate prompt based on communication type
    let userPrompt: string;
    let additionalInstructions: string;

    if (isEmailResponse) {
      // Email-specific prompt
      userPrompt = `Current Email Message:
Subject: ${options.subject || "No Subject"}
Message: ${options.messageBody}

Please generate a helpful email response that addresses their message.`;

      additionalInstructions = `${clinicInstructions}


      CRITICAL EMAIL FORMATTING RULES:
• End your email content naturally - do NOT add signatures, "Best regards," or closing lines
• Do NOT include clinic name, "[Your Name]" or any placeholder signatures at the end
• Do NOT include unsubscribe text (system handles this automatically)
• Simply end where your message naturally concludes
• Keep content focused and conversational without formal closings

CURRENT MESSAGE CONTEXT:
You are responding directly to this email from a patient: "${options.messageBody}"
Subject: ${options.subject || "No Subject"}

Patient: ${leadData.first_name || "Email Lead"} (${leadData.email || "No email"})
Context: ${conversationContext ? "Ongoing conversation - see history" : "First time contacting us"}

CLINIC INFORMATION (include when asked):
- Clinic Name: ${clinicData.name}
- Phone: ${clinicData.phone_number || "Contact us for phone number"}
${clinicData.mailgun_email ? `- Email: ${clinicData.mailgun_email}` : ""}

${
  isBookingInquiry
    ? `BOOKING INFORMATION:
- Booking link: ${bookingLink}
- For booking links in emails, use HTML format: <a href="${bookingLink}" style="color: #10b981; text-decoration: none; font-weight: bold;">Schedule your consultation</a>`
    : ""
}

UNSUBSCRIBE INFORMATION:
- Unsubscribe link: ${unsubscribeLink}
- Every email automatically includes unsubscribe footer - do not add manual unsubscribe text

RESPONSE FORMAT: Email response - be professional and comprehensive. End naturally without signatures or footers.`.trim();
    } else {
      // SMS-specific prompt
      userPrompt = `Current SMS Message: ${options.messageBody}

Please generate a helpful SMS response that addresses their message.`;

      additionalInstructions = `${clinicInstructions}

CURRENT MESSAGE CONTEXT:
You are responding directly to this SMS from a patient: "${options.messageBody}"

Patient: ${leadData.first_name || "SMS Lead"} (${phoneNumber})
Context: ${conversationContext ? "Ongoing conversation - see history" : "First time contacting us"}

${
  isBookingInquiry
    ? `Context Information (for your knowledge only):
- Booking is available at: ${bookingLink}
- DO NOT include this link in your response - provide helpful guidance about booking without the actual link`
    : ""
}

RESPONSE FORMAT: SMS response - Keep main message under 160 characters, be conversational and helpful, NO links or unsubscribe options.`.trim();
    }

    logInfo("📝 Prompts prepared:", {
      userPromptLength: userPrompt.length,
      additionalInstructionsLength: additionalInstructions.length,
      messageBody: options.messageBody,
      responseType: isEmailResponse ? "EMAIL" : "SMS",
    });

    // Create a thread for this conversation
    logInfo("🧵 Creating OpenAI thread...");
    let openaiThread;
    try {
      const threadRequest = {
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      };
      logInfo("📤 Thread creation request:", threadRequest);

      openaiThread = await openai.beta.threads.create(threadRequest);
      logInfo("✅ Thread creation response:", {
        id: openaiThread?.id,
        object: openaiThread?.object,
        created_at: openaiThread?.created_at,
        metadata: openaiThread?.metadata,
      });
    } catch (error) {
      logError("❌ Thread creation failed:", error.message);
      logError("Thread creation error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        response: error.response?.data || "No response data",
      });
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }

    // Validate thread creation
    if (!openaiThread || !openaiThread.id) {
      logError("❌ Thread created but no ID returned:", openaiThread);
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }

    const openaiThreadId = openaiThread.id;
    logInfo(`✅ Created thread with ID: ${openaiThreadId}`);

    // Additional validation to catch issues early
    if (typeof openaiThreadId !== "string" || openaiThreadId.trim() === "") {
      logError("❌ Invalid thread ID received:", {
        threadId: openaiThreadId,
        type: typeof openaiThreadId,
        threadObject: openaiThread,
      });
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }

    // Create a run with additional instructions
    logInfo("🏃 Creating run...");
    let openaiRun;
    try {
      const runRequest = {
        assistant_id: assistantId,
        additional_instructions: additionalInstructions,
        max_completion_tokens: isEmailResponse ? 800 : 500, // More tokens for email responses
        temperature: 0.8,
      };
      logInfo("📤 Run creation request:", runRequest);

      openaiRun = await openai.beta.threads.runs.create(openaiThreadId, runRequest);
      logInfo("✅ Run creation response:", {
        id: openaiRun?.id,
        object: openaiRun?.object,
        status: openaiRun?.status,
        assistant_id: openaiRun?.assistant_id,
        thread_id: openaiRun?.thread_id,
      });
    } catch (error) {
      logError("❌ Run creation failed:", error.message);
      logError("Run creation error details:", error);
      logError("❌ CRITICAL: Run creation failed, falling back to Chat Completions instead of using Assistant with data");
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }

    // Validate run creation
    if (!openaiRun || !openaiRun.id) {
      logError("❌ Run created but no ID returned:", openaiRun);
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }

    const openaiRunId = openaiRun.id;
    logInfo(`✅ Created run with ID: ${openaiRunId} for thread: ${openaiThreadId}`);

    // Additional validation for run ID
    if (typeof openaiRunId !== "string" || openaiRunId.trim() === "") {
      logError("❌ Invalid run ID received:", {
        runId: openaiRunId,
        type: typeof openaiRunId,
        runObject: openaiRun,
      });
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }

    // Store IDs in function-scoped variables to avoid any scope issues
    const threadIdForRetrieval = String(openaiThreadId);
    const runIdForRetrieval = String(openaiRunId);

    logInfo("🔒 Stored IDs for retrieval:", {
      threadIdForRetrieval,
      runIdForRetrieval,
    });

    // Wait for the run to complete
    logInfo("⏳ Waiting for run to complete...");
    logInfo(`🔍 Will check run ${runIdForRetrieval} in thread ${threadIdForRetrieval}`);

    let runStatus;
    try {
      // Double check IDs before making the call
      if (!threadIdForRetrieval || !runIdForRetrieval) {
        logError("❌ Missing IDs before run retrieve:", { threadId: threadIdForRetrieval, runId: runIdForRetrieval });
        return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
      }

      // Try the OpenAI SDK call with multiple approaches if needed
      logInfo("🔍 About to call retrieve with:", { threadId: threadIdForRetrieval, runId: runIdForRetrieval });

      try {
        // First attempt: standard signature
        runStatus = await openai.beta.threads.runs.retrieve(threadIdForRetrieval, runIdForRetrieval);
        logInfo("✅ Standard retrieve call succeeded");
      } catch (retrieveError) {
        logError("❌ Standard retrieve failed, trying alternative approach:", retrieveError.message);

        // Second attempt: try with explicit object parameter - fallback approach
        try {
          const altRunStatus = await openai.beta.threads.runs.list(threadIdForRetrieval);
          const targetRun = altRunStatus.data.find(run => run.id === runIdForRetrieval);
          if (targetRun) {
            runStatus = targetRun;
            logInfo("✅ Alternative retrieve via list succeeded");
          } else {
            throw new Error(`Run ${runIdForRetrieval} not found in thread ${threadIdForRetrieval}`);
          }
        } catch (altError) {
          logError("❌ Alternative retrieve also failed:", altError.message);
          throw retrieveError; // Re-throw the original error
        }
      }

      logInfo("🔄 Initial run status:", {
        status: runStatus.status,
        last_error: runStatus.last_error,
        started_at: runStatus.started_at,
        completed_at: runStatus.completed_at,
      });
    } catch (error) {
      logError("❌ Failed to get initial run status:", error);
      logError("❌ CRITICAL: Failed to get run status, falling back to Chat Completions instead of using Assistant with data");
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }

    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max wait to allow file search processing

    while ((runStatus.status === "in_progress" || runStatus.status === "queued") && attempts < maxAttempts) {
      logInfo(`⏳ Run attempt ${attempts + 1}/${maxAttempts}, status: ${runStatus.status}`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

      try {
        // Use the same fallback approach that worked in the initial call
        try {
          runStatus = await openai.beta.threads.runs.retrieve(threadIdForRetrieval, runIdForRetrieval);
          logInfo(`✅ Standard retry ${attempts + 1} retrieve succeeded`);
        } catch (retryRetrieveError) {
          logError(`❌ Standard retry ${attempts + 1} retrieve failed, using alternative:`, retryRetrieveError.message);

          // Use the working alternative approach
          const altRunStatus = await openai.beta.threads.runs.list(threadIdForRetrieval);
          const targetRun = altRunStatus.data.find(run => run.id === runIdForRetrieval);
          if (targetRun) {
            runStatus = targetRun;
            logInfo(`✅ Alternative retry ${attempts + 1} retrieve succeeded`);
          } else {
            throw new Error(`Run ${runIdForRetrieval} not found in thread ${threadIdForRetrieval} on retry ${attempts + 1}`);
          }
        }
        logInfo(`🔄 Status update ${attempts + 1}: ${runStatus.status}`);
      } catch (error) {
        logError(`❌ Error retrieving run status on attempt ${attempts + 1}:`, error);
        logError(
          "❌ CRITICAL: Run status retrieval failed during retry, falling back to Chat Completions instead of using Assistant with data",
        );
        return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
      }

      attempts++;
    }

    logInfo("🏁 Final run status:", {
      status: runStatus.status,
      last_error: runStatus.last_error,
      completed_at: runStatus.completed_at,
      attempts: attempts,
    });

    if (runStatus.status === "completed") {
      logInfo("✅ Run completed successfully, fetching messages...");
      logInfo(`📨 Fetching messages from thread: ${threadIdForRetrieval}`);

      // Get the assistant's response
      const messages = await openai.beta.threads.messages.list(threadIdForRetrieval);
      logInfo("📨 Messages retrieved:", {
        count: messages.data?.length || 0,
      });

      const assistantMessage = messages.data.find(msg => msg.role === "assistant");
      logInfo("🤖 Assistant message found:", {
        exists: !!assistantMessage,
        contentType: assistantMessage?.content?.[0]?.type,
        hasText: !!assistantMessage?.content?.[0]?.text?.value,
      });

      if (assistantMessage && assistantMessage.content[0]?.text?.value) {
        let aiResponse = assistantMessage.content[0].text.value.trim();
        logInfo("📝 Raw AI response:", aiResponse);

        // Clean up response
        aiResponse = aiResponse.replace(/【[^】]*】/g, "");
        aiResponse = aiResponse.replace(/\[LEAD_ASSESSMENT\][\s\S]*?\[\/LEAD_ASSESSMENT\]/gi, "");

        // For SMS booking inquiries, add booking link if missing
        if (!isEmailResponse && isBookingInquiry && !aiResponse.includes(bookingLink)) {
          aiResponse += `\n\nBook here: ${bookingLink}`;
        }

        aiResponse = aiResponse.trim();

        logInfo(`✅ AI ${isEmailResponse ? "email" : "SMS"} response generated successfully via Assistants API`);
        logInfo("📤 Final response length:", aiResponse.length);
        return { success: true, response: aiResponse };
      } else {
        logError("❌ No valid content in assistant message");
        return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
      }
    } else if (runStatus.status === "failed") {
      logError("❌ Assistant run failed:", runStatus.last_error);
      logError("❌ CRITICAL: Assistant run failed, falling back to Chat Completions instead of using Assistant with data");
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    } else if (runStatus.status === "incomplete") {
      logError("❌ Assistant run incomplete - likely file search timeout");
      logError("Run details:", {
        status: runStatus.status,
        last_error: runStatus.last_error,
        required_action: runStatus.required_action,
        incomplete_details: runStatus.incomplete_details,
      });
      logError(
        "❌ CRITICAL: Assistant run incomplete (file search timeout), falling back to Chat Completions instead of using Assistant with data",
      );
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    } else {
      logError("❌ Assistant run timed out or other status:", runStatus.status);
      logError("❌ CRITICAL: Assistant run timed out, falling back to Chat Completions instead of using Assistant with data");
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }
  } catch (error) {
    logError("❌ Error generating AI response via Assistants API:", error);
    logError("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    logError("❌ CRITICAL: Unexpected error in Assistants API flow, falling back to Chat Completions instead of using Assistant with data");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiApiKey) {
      return await generateFallbackResponse(leadData, options, clinicData, "", openaiApiKey, isEmailResponse);
    }

    // Final fallback
    const fallbackResponse = `Hey ${leadData.first_name || "there"}! Thanks for reaching out to ${clinicData.name}. Happy to help!`;
    return { success: true, response: fallbackResponse };
  } finally {
    logInfo("🏁 === Ending generateAIResponse ===");
  }
}

// Fallback function using Chat Completions API
async function generateFallbackResponse(
  leadData: LeadData,
  options: GenerateAIResponseOptions,
  clinicData: ClinicData,
  conversationContext: string,
  openaiApiKey: string,
  isEmailResponse: boolean,
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    logInfo(`🔄 Using fallback Chat Completions API for ${isEmailResponse ? "EMAIL" : "SMS"}...`);

    const phoneNumber =
      leadData.form_data?.phone_number ||
      leadData.notes?.match(/\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] ||
      leadData.phone ||
      "Not provided";

    // Check if user is asking about booking/scheduling
    const isBookingInquiry =
      options.messageBody.toLowerCase().includes("book") ||
      options.messageBody.toLowerCase().includes("schedule") ||
      options.messageBody.toLowerCase().includes("appointment") ||
      options.messageBody.toLowerCase().includes("meeting") ||
      options.messageBody.toLowerCase().includes("time") ||
      options.messageBody.toLowerCase().includes("available");

    const bookingLink = clinicData.calendly_link || "https://calendly.com/book";
    const unsubscribeLink = `${SUPABASE_URL}/functions/v1/unsubscribe-lead?lead_id=${leadData.id}&clinic_id=${clinicData.id}`;

    let prompt: string;

    if (isEmailResponse) {
      // Email fallback prompt
      prompt = `You are the AI assistant for ${clinicData.name}, a medical clinic responding via email. Generate a helpful, professional email response to this patient's message.

CRITICAL EMAIL FORMATTING RULES:
• End your email content naturally - do NOT add signatures, "Best regards," or closing lines
• Do NOT include clinic name, "[Your Name]" or any placeholder signatures at the end
• Do NOT include unsubscribe text (system handles this automatically)
• Simply end where your message naturally concludes
• Keep content focused and conversational without formal closings

Lead Information:
- Name: ${leadData.first_name || ""} ${leadData.last_name || ""}
- Email: ${leadData.email || "Not provided"}
- Phone: ${phoneNumber}
- Status: ${leadData.status || "unknown"}

CLINIC INFORMATION (include when asked):
- Clinic Name: ${clinicData.name}
- Phone: ${clinicData.phone_number || "Contact us for phone number"}
${clinicData.mailgun_email ? `- Email: ${clinicData.mailgun_email}` : ""}

Current Email:
Subject: ${options.subject || "No Subject"}
Message: ${options.messageBody}

Previous Conversation:
${conversationContext || "No previous conversation"}

${
  isBookingInquiry
    ? `BOOKING INFORMATION:
- Booking link: ${bookingLink}
- For booking links in emails, use HTML format: <a href="${bookingLink}" style="color: #10b981; text-decoration: none; font-weight: bold;">Schedule your consultation</a>`
    : ""
}

UNSUBSCRIBE INFORMATION:
- Unsubscribe link: ${unsubscribeLink}
- Every email automatically includes unsubscribe footer - do not add manual unsubscribe text

Generate a professional email response that answers their question and is helpful and informative. End naturally without signatures or footers.`;
    } else {
      // SMS fallback prompt
      prompt = `You are the virtual assistant for ${clinicData.name}, a medical clinic responding via SMS. Generate a helpful, conversational SMS response to this patient's message.

TONE REQUIREMENTS:
- Sound casual and friendly - like texting a knowledgeable friend
- Be helpful and informative about their specific question
- Keep main message under 160 characters
- Use personality when appropriate
- Avoid special characters that might not display well in SMS

Lead Information:
- Name: ${leadData.first_name || ""} ${leadData.last_name || ""}
- Phone: ${phoneNumber}
- Status: ${leadData.status || "unknown"}
- Clinic Name: ${clinicData.name}
- Clinic Phone: ${clinicData.phone_number || "Not provided"}

${
  isBookingInquiry
    ? `Context Information (for your knowledge only - DO NOT include in response):
- Booking available at: ${bookingLink}`
    : ""
}

Current SMS Message: ${options.messageBody}

Previous Conversation:
${conversationContext || "No previous conversation"}

IMPORTANT: Do NOT include any links, booking information, or unsubscribe options in your SMS response. Keep it conversational and helpful only.

Generate a helpful SMS response that answers their question and keeps the response conversational and under 160 characters.`;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful AI assistant for ${clinicData.name}. Respond professionally to patient ${isEmailResponse ? "email" : "SMS"} inquiries. ${isEmailResponse ? "Format as a proper email response." : "Keep responses concise, SMS-friendly, and include all required elements."}`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: isEmailResponse ? 500 : 150,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      logError("❌ OpenAI API error:", response.status, response.statusText);
      const fallbackResponse = `Hey ${leadData.first_name || "there"}! Thanks for reaching out to ${clinicData.name}. Happy to help!`;
      return { success: true, response: fallbackResponse };
    }

    const data = await response.json();
    let aiResponse = data.choices[0]?.message?.content?.trim();

    if (!aiResponse) {
      logError("❌ No response generated by AI");
      const fallbackResponse = `Hey ${leadData.first_name || "there"}! Thanks for reaching out to ${clinicData.name}. Happy to help!`;
      return { success: true, response: fallbackResponse };
    }

    // Clean up response
    aiResponse = aiResponse.replace(/【[^】]*】/g, "");
    aiResponse = aiResponse.replace(/\[LEAD_ASSESSMENT\][\s\S]*?\[\/LEAD_ASSESSMENT\]/gi, "");

    // For SMS booking inquiries, add booking link if missing
    if (!isEmailResponse && isBookingInquiry && !aiResponse.includes(bookingLink)) {
      aiResponse += `\n\nBook here: ${bookingLink}`;
    }

    aiResponse = aiResponse.trim();

    logInfo(`✅ AI ${isEmailResponse ? "email" : "SMS"} response generated successfully via fallback`);
    return { success: true, response: aiResponse };
  } catch (error) {
    logError("❌ Error in fallback response generation:", error);

    const fallbackResponse = `Hey ${leadData.first_name || "there"}! Thanks for reaching out to ${clinicData.name}. Happy to help!`;
    return { success: true, response: fallbackResponse };
  }
}

export async function saveAIResponseToConversation(
  threadId: string,
  aiResponse: string,
  originalMessageId: string,
  supabaseClient: any,
): Promise<void> {
  try {
    logInfo("💾 Saving AI response to conversation thread...");

    const aiConversationData = {
      thread_id: threadId,
      message: aiResponse,
      timestamp: new Date().toISOString(),
      is_from_user: true,
      sender_type: "ai_assistant",
      email_message_id: `reply_${originalMessageId}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: aiConversationRecord, error: aiConversationError } = await supabaseClient
      .from("conversation")
      .insert(aiConversationData)
      .select()
      .single();

    if (aiConversationError) {
      logError("❌ Error saving AI response to conversation:", aiConversationError);
    } else {
      logInfo("✅ AI response saved to conversation:", aiConversationRecord.id);
    }
  } catch (error) {
    logError("❌ Error saving AI response:", error);
  }
}

export type { ClinicData, GenerateAIResponseOptions, LeadData };
