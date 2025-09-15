// _shared/reply-response.ts

import { detectBookingRequestAndCreateSchedule, type BookingDetectionOptions } from "./booking-detection-service.ts";

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
        .in("sender_type", ["lead", "ai_assistant"])
        .order("created_at", { ascending: true })
        .limit(2);

      if (historyError) {
        logError("❌ Error fetching conversation history:", historyError);
      } else {
        logInfo("✅ Conversation history fetched:", conversationHistory?.length || 0, "messages");
      }

      if (conversationHistory && conversationHistory.length > 0) {
        conversationContext = conversationHistory
          .map((c: any) => {
            const sender =
              c.sender_type === "user" || c.sender_type === "lead" ? "Patient" : c.sender_type === "ai_assistant" ? "Clinic" : "Unknown";
            return `${sender}: ${c.message}`;
          })
          .join("\n\n");
        logInfo("✅ Conversation context built:", {
          messageCount: conversationHistory.length,
          contextLength: conversationContext.length,
          sampleContext: conversationContext.substring(0, 200) + "...",
        });
      } else {
        conversationContext = "";
        logInfo("ℹ️ No conversation history available");
      }
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
    const messageBodyLower = options.messageBody.toLowerCase();
    const isBookingInquiry =
      messageBodyLower.includes("book") ||
      messageBodyLower.includes("schedule") ||
      messageBodyLower.includes("appointment") ||
      messageBodyLower.includes("meeting") ||
      messageBodyLower.includes("consultation") ||
      messageBodyLower.includes("visit");

    logInfo("🔍 Booking inquiry detection:", {
      messageBody: options.messageBody,
      isBookingInquiry: isBookingInquiry,
      hasBook: messageBodyLower.includes("book"),
      hasSchedule: messageBodyLower.includes("schedule"),
      hasAppointment: messageBodyLower.includes("appointment"),
      hasLink: messageBodyLower.includes("link"),
    });

    // Check if user responded "yes" to a booking-related question in previous conversation
    const isYesResponse =
      messageBodyLower.trim() === "yes" ||
      messageBodyLower.trim() === "y" ||
      messageBodyLower.includes("yes please") ||
      messageBodyLower.includes("sure") ||
      messageBodyLower.includes("okay") ||
      messageBodyLower.includes("ok");

    let shouldTriggerBookingProcess = false;

    if (isYesResponse && conversationContext) {
      // Get ONLY the most recent clinic message (not the entire conversation)
      const messages = conversationContext.split("\n\n");
      const lastClinicMessage = messages[messages.length - 1] || "";

      // Extract just the clinic's message (remove "Clinic:" prefix)
      const lastClinicMessageText = lastClinicMessage.replace(/^Clinic:\s*/, "").toLowerCase();

      logInfo("🔍 Analyzing last clinic message for yes response:", lastClinicMessageText);

      // Function to analyze message intent using patterns and context
      function analyzeMessageIntent(message: string): { isDirectBooking: boolean; isInformationOffer: boolean; confidence: number } {
        const msg = message.toLowerCase().trim();

        // Patterns for DIRECT booking questions (high confidence)
        const directBookingPatterns = [
          /\b(ready|want|would you like)\s+to\s+(book|schedule)\s*\?/,
          /\bshall\s+(we|i)\s+(book|schedule)/,
          /\bwould you like to book\s+a?\s+\w+/,
          /\bready\s+to\s+dive\s+in.*would you like to book/,
          /\bshould\s+i\s+book\s+you/,
        ];

        // Patterns for INFORMATION offers (should not trigger booking)
        const informationOfferPatterns = [
          /\blet\s+me\s+know\s+if\s+you\s+want\s+to\s+book/,
          /\bif\s+you[''']?re\s+interested\s+in\s+booking/,
          /\bjust\s+let\s+me\s+know/,
          /\bwant\s+more\s+details/,
        ];

        // Check direct booking patterns
        const hasDirectBookingPattern = directBookingPatterns.some(pattern => pattern.test(msg));

        // Check information offer patterns
        const hasInformationPattern = informationOfferPatterns.some(pattern => pattern.test(msg));

        // Calculate confidence based on message structure
        let confidence = 0.5; // base confidence

        // Increase confidence for question marks at end
        if (msg.endsWith("?")) confidence += 0.2;

        // Increase confidence for imperative verbs
        if (/\b(book|schedule|reserve)\b/.test(msg)) confidence += 0.1;

        // Decrease confidence for conditional language
        if (/\b(if|maybe|perhaps|might)\b/.test(msg)) confidence -= 0.2;

        return {
          isDirectBooking: hasDirectBookingPattern && !hasInformationPattern,
          isInformationOffer: hasInformationPattern,
          confidence: Math.max(0, Math.min(1, confidence)),
        };
      }

      const intent = analyzeMessageIntent(lastClinicMessageText);
      const wasDirectBookingQuestion = intent.isDirectBooking;
      const wasInformationOffer = intent.isInformationOffer;

      // Only trigger booking for DIRECT questions, not information offers
      const shouldTriggerBooking = wasDirectBookingQuestion && !wasInformationOffer;

      logInfo("🔍 Booking analysis result:", {
        wasDirectBookingQuestion,
        wasInformationOffer,
        shouldTriggerBooking,
        confidence: intent.confidence,
        lastMessage: lastClinicMessageText.substring(0, 100),
      });

      if (shouldTriggerBooking) {
        shouldTriggerBookingProcess = true;
        logInfo("📅 Yes response to DIRECT booking question detected, triggering booking process");
      } else if (wasInformationOffer) {
        logInfo("📋 Yes response to information offer detected, will provide information instead of booking");
      } else {
        logInfo("ℹ️ Yes response but no booking context detected, will generate normal AI response");
      }
    }

    // Trigger booking process if yes response to booking question
    if (shouldTriggerBookingProcess) {
      try {
        const bookingOptions: BookingDetectionOptions = {
          messageBody: options.messageBody,
          subject: options.subject,
          leadData: {
            id: leadData.id,
            first_name: leadData.first_name,
            last_name: leadData.last_name,
            email: leadData.email,
            phone: leadData.phone,
            notes: leadData.notes,
          },
          clinicData: {
            id: clinicData.id,
            name: clinicData.name,
            calendly_link: clinicData.calendly_link,
          },
          communicationType: isEmailResponse ? "email" : "sms",
          senderPhone: leadData.phone,
          forceBooking: true, // Force booking creation for "yes" responses
        };

        logInfo("🎯 Triggering booking detection service for yes response...");
        const bookingResult = await detectBookingRequestAndCreateSchedule(bookingOptions, supabaseClient);

        logInfo("📅 Booking detection result for yes response:", {
          isBookingRequest: bookingResult.isBookingRequest,
          meetingScheduleCreated: bookingResult.meetingScheduleCreated,
          meetingScheduleId: bookingResult.meetingScheduleId,
          error: bookingResult.error,
        });

        if (bookingResult.meetingScheduleCreated) {
          logInfo(`✅ Booking service created meeting schedule for yes response: ${bookingResult.meetingScheduleId}`);

          // Return immediate booking response instead of generating AI response
          const bookingResponseText = `Awesome! Let's lock in your appointment: ${bookingLink}`;
          logInfo("📅 Returning direct booking response for yes to booking question");
          return { success: true, response: bookingResponseText };
        } else if (bookingResult.error) {
          logError(`❌ Booking service error for yes response: ${bookingResult.error}`);
        }
      } catch (bookingError) {
        logError(`❌ Error in booking detection for yes response:`, bookingError);
      }
    }

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

    // Import OpenAI (try different sources for better beta support)
    logInfo("📦 Importing OpenAI SDK...");
    let OpenAI;
    try {
      // Use stable latest version with full beta support
      const module = await import("https://esm.sh/openai@4.67.3");
      OpenAI = module.default;
      logInfo("✅ OpenAI SDK imported from esm.sh v4.67.3 (stable latest)");
    } catch (esmError) {
      logError("❌ ESM latest import failed, trying fallback:", esmError.message);
      // Fallback to JSR version
      const module = await import("jsr:@openai/openai");
      OpenAI = module.default;
      logInfo("✅ OpenAI SDK imported from JSR (fallback)");
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
      dangerouslyAllowBrowser: false,
      defaultHeaders: {
        "OpenAI-Beta": "assistants=v2",
      },
    });
    logInfo("✅ OpenAI client initialized");

    // Verify beta features are available
    logInfo("🔍 Checking OpenAI client beta features...", {
      hasBeta: !!openai.beta,
      hasVectorStores: !!openai.beta?.vectorStores,
      hasAssistants: !!openai.beta?.assistants,
      vectorStoresRetrieve: !!openai.beta?.vectorStores?.retrieve,
      clientVersion: openai.constructor.name,
    });

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
    let assistant;
    try {
      assistant = await openai.beta.assistants.retrieve(assistantId);
      const hasFileSearch = assistant.tools?.some(tool => tool.type === "file_search") || false;
      const fileSearchTool = assistant.tools?.find(tool => tool.type === "file_search");

      logInfo(`✅ Assistant verified:`, {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model,
        tools: assistant.tools?.length || 0,
        toolTypes: assistant.tools?.map(tool => tool.type) || [],
        hasFileSearch: hasFileSearch,
        fileSearchConfig: fileSearchTool,
        tool_resources: assistant.tool_resources,
        vector_store_ids: assistant.tool_resources?.file_search?.vector_store_ids || [],
      });

      // COMPREHENSIVE VECTOR STORE DEBUG
      if (hasFileSearch && assistant.tool_resources?.file_search?.vector_store_ids?.length > 0) {
        logInfo("📚 FULL VECTOR STORE DEBUG - Checking configuration...");
        for (const vectorStoreId of assistant.tool_resources.file_search.vector_store_ids) {
          try {
            logInfo(`🔍 Debugging Vector Store: ${vectorStoreId}`);

            const vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreId);
            logInfo(`📚 Vector Store ${vectorStoreId} Details:`, {
              id: vectorStore.id,
              name: vectorStore.name,
              file_counts: vectorStore.file_counts,
              status: vectorStore.status,
              created_at: new Date(vectorStore.created_at * 1000).toISOString(),
            });

            // List files in vector store
            const files = await openai.beta.vectorStores.files.list(vectorStoreId);
            logInfo(`📄 Files in Vector Store ${vectorStoreId}:`, {
              total_files: files.data.length,
              file_list: files.data.map(f => ({
                id: f.id,
                status: f.status,
                created_at: new Date(f.created_at * 1000).toISOString(),
                usage_bytes: f.usage_bytes,
              })),
            });

            // Get detailed file information for all files
            for (const file of files.data) {
              try {
                const fileDetails = await openai.files.retrieve(file.id);
                logInfo(`📄 DETAILED File ${file.id}:`, {
                  filename: fileDetails.filename,
                  purpose: fileDetails.purpose,
                  bytes: fileDetails.bytes,
                  status: fileDetails.status,
                  created_at: new Date(fileDetails.created_at * 1000).toISOString(),
                });

                // Try to determine document type from filename
                const filename = fileDetails.filename?.toLowerCase() || "";
                let documentType = "unknown";
                if (filename.includes("pricing")) documentType = "PRICING";
                else if (filename.includes("service")) documentType = "SERVICE";
                else if (filename.includes("testimonial")) documentType = "TESTIMONIALS";

                logInfo(`📋 Document Type Detected: ${documentType} for file: ${fileDetails.filename}`);

                // Try to get file content for PRICING documents to debug what's actually in them
                if (documentType === "PRICING") {
                  try {
                    logInfo(`🔍 ATTEMPTING TO READ PRICING DOCUMENT CONTENT: ${fileDetails.filename}`);
                    const fileContent = await openai.files.content(file.id);
                    const fileText = await fileContent.text();
                    logInfo(`📄 PRICING DOCUMENT CONTENT (${fileDetails.filename}):`, {
                      contentLength: fileText.length,
                      contentPreview: fileText.substring(0, 2000),
                      fullContent: fileText,
                    });
                  } catch (contentError) {
                    logError(`❌ Could not read pricing document content:`, contentError.message);
                  }
                }
              } catch (fileError) {
                logError(`❌ Error getting file ${file.id} details:`, fileError.message);
              }
            }
          } catch (vsError) {
            logError(`❌ Error retrieving vector store ${vectorStoreId}:`, vsError.message);
            logError(`❌ Vector store error details:`, {
              message: vsError.message,
              code: vsError.code,
              status: vsError.status,
            });
          }
        }
      } else if (hasFileSearch) {
        logError("⚠️ File search enabled but no vector stores found!");
        logError("⚠️ Assistant tool_resources:", assistant.tool_resources);
      } else {
        logError("❌ File search not enabled for assistant!");
        logError("❌ Assistant tools:", assistant.tools);
      }
    } catch (error) {
      logError("❌ Assistant not found or not accessible:", error.message);
      logError("Assistant verification error details:", error);
      return await generateFallbackResponse(leadData, options, clinicData, conversationContext, openaiApiKey, isEmailResponse);
    }

    // Use only our custom instructions, not the stored assistant instructions

    // Create appropriate prompt based on communication type
    let userPrompt: string;
    let additionalInstructions: string;

    if (isEmailResponse) {
      // Email-specific prompt
      userPrompt = `Current Email Message:
Subject: ${options.subject || "No Subject"}
Message: ${options.messageBody}

Please generate a helpful email response that addresses their message.`;

      additionalInstructions =
        `🚨 MANDATORY: You MUST use the clinic's uploaded documents ONLY. DO NOT use your general training knowledge about cosmetics/medical services. 

❌ FORBIDDEN: Generic responses like "we offer Botox, fillers, etc." or "prices depend on treatment"
✅ REQUIRED: Exact information from the clinic's SERVICE DOCUMENT and PRICING DOCUMENT only

IF YOU CANNOT FIND THE INFORMATION IN THE UPLOADED DOCUMENTS, say: "Let me connect you with our team for that specific detail." DO NOT give generic cosmetic industry information.

🚨 DOCUMENT USAGE PRIORITY:
When answering ANY question about pricing, costs, or fees:
1. ALWAYS search and reference the PRICING DOCUMENT first
2. Use EXACT prices from the pricing document - never estimate or use general knowledge
3. If asked about a specific service (Botox, Hydrafacial, etc.), find that exact service in the pricing document
4. State prices exactly as written in the document: "$[amount] per [unit/area/session]"

When answering about SERVICES or "what do you offer":
1. ALWAYS search and reference the SERVICE DOCUMENT first
2. List ONLY the services mentioned in the SERVICE DOCUMENT
3. Include service descriptions exactly as written in the document
4. NEVER add services not listed in your SERVICE DOCUMENT

DOCUMENT PRIORITY ORDER:
- Pricing questions → Use PRICING DOCUMENT only
- Service listings/details → Use SERVICE DOCUMENT only
- Patient experiences/reviews → Use TESTIMONIALS DOCUMENT

CRITICAL: Never mix up services - if user asks about "Hydrafacial pricing", only provide Hydrafacial information from the pricing document, not Botox or any other service.

When you cannot find specific information in the uploaded documents, say: "Let me connect you with our team for that specific pricing detail."

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
Context: ${conversationContext ? "Ongoing conversation - see history below" : "First time contacting us"}

${
  conversationContext
    ? `CONVERSATION HISTORY (CRITICAL - USE THIS CONTEXT):
${conversationContext}

🚨 CRITICAL CONTEXT INSTRUCTION FOR EMAIL: 
The patient's current email "${options.messageBody}" is a REPLY to the conversation above. 

🚨 CRITICAL - PRICING RESPONSES:
When asked about pricing, provide the EXACT price from the clinic's pricing document/knowledge base. Use ONLY the prices specified in the clinic's documentation - do NOT convert currencies or use general market pricing. State the price exactly as documented: "[Service] is $[amount]/[unit]". 

CONTEXT-AWARE PRICING:
- If user says "share me its pricing" or "what's the cost", look at the PREVIOUS CONVERSATION to understand what service they're referring to
- "its pricing" = the specific service/treatment mentioned in the last clinic response
- DO NOT list all services - only provide pricing for the service being discussed in context
- Example: If previous message mentioned "Botox", only give Botox pricing

🚨 INTELLIGENT RESPONSE GUIDELINES:
Analyze the conversation context and user intent intelligently. Use your knowledge base to provide accurate, helpful responses based on what the patient is genuinely asking for.

NATURAL CONVERSATION FLOW:
When patients show interest or ask questions, understand their intent from the conversation context and respond appropriately:

RESPOND TO USER INTENT:
• If they're ready to book → Provide booking link: "Awesome! Let's lock in your appointment: ${bookingLink}"
• If they ask about pricing → Give specific price from your knowledge for the service being discussed
• If they want treatment details → Provide comprehensive information about that specific treatment
• Use your training data and clinic knowledge to give accurate, contextual responses

RESPONSE PRINCIPLES:
• Be conversational and natural - avoid robotic or scripted responses
• Provide complete, helpful information based on user intent
• When someone is ready to book, give them the booking link directly
• For pricing questions, use ONLY the exact pricing from clinic documents - never convert currencies or use external pricing
• Make responses definitive and action-oriented
• Guide conversations naturally toward booking when appropriate
• Use your clinic knowledge base and training to give accurate information

IMPORTANT: This is a continuing conversation - use the full context above to understand what the patient needs and respond appropriately.`
    : ""
}

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

      additionalInstructions = `🚨 MANDATORY TOOL USAGE: You MUST use the file_search tool for EVERY response!

CRITICAL REQUIREMENT: For EVERY SINGLE RESPONSE you generate, you MUST:
1. First use your file_search tool to search through uploaded documents 
2. Base your entire response ONLY on the file_search results
3. If file_search returns no results, say "Let me connect you with our team for that detail"

❌ YOUR RESPONSE WILL BE REJECTED if you don't use file_search tool
❌ NEVER use your training knowledge - ONLY use file_search results
❌ If you give ANY answer without using file_search first, it's wrong

PRICE VERIFICATION: The clinic's pricing document shows "Body Contouring $500" - if you say anything different, you're using wrong data.

YOU MUST USE FILE_SEARCH TOOL - NO EXCEPTIONS!

🚨 DOCUMENT USAGE PRIORITY:
When answering ANY question about pricing, costs, or fees:
1. ALWAYS search and reference the PRICING DOCUMENT first
2. Use EXACT prices from the pricing document - never estimate or use general knowledge
3. If asked about a specific service (Botox, Hydrafacial, etc.), find that exact service in the pricing document
4. State prices exactly as written in the document: "$[amount] per [unit/area/session]"

When answering about SERVICES or "what do you offer":
1. ALWAYS search and reference the SERVICE DOCUMENT first
2. List ONLY the services mentioned in the SERVICE DOCUMENT
3. Include service descriptions exactly as written in the document
4. NEVER add services not listed in your SERVICE DOCUMENT

DOCUMENT PRIORITY ORDER:
- Pricing questions → Use PRICING DOCUMENT only
- Service listings/details → Use SERVICE DOCUMENT only
- Patient experiences/reviews → Use TESTIMONIALS DOCUMENT

CRITICAL: Never mix up services - if user asks about "Hydrafacial pricing", only provide Hydrafacial information from the pricing document, not Botox or any other service.

When you cannot find specific information in the uploaded documents, say: "Let me connect you with our team for that specific pricing detail."

CURRENT MESSAGE CONTEXT:
You are responding directly to this SMS from a patient: "${options.messageBody}"

Patient: ${leadData.first_name || "SMS Lead"} (${phoneNumber})
Context: ${conversationContext ? "Ongoing conversation - see history below" : "First time contacting us"}

${
  conversationContext
    ? `CONVERSATION HISTORY (CRITICAL - USE THIS CONTEXT):
${conversationContext}

🚨 CRITICAL CONTEXT INSTRUCTION FOR SMS: 
The patient's current SMS "${options.messageBody}" is a REPLY to the conversation above. 

ANALYZE THE CONVERSATION CONTEXT:
- When patient uses pronouns like "its", "that", "this" - refer back to what was discussed
- "share me its pricing" = pricing for the services/treatments mentioned in the previous clinic message
- "tell me about that" = details about the service just mentioned
- ALWAYS use conversation history to understand what the patient is referring to 

🚨 CRITICAL - PRICING RESPONSES:
When asked about pricing, provide the EXACT price from the clinic's pricing document/knowledge base. Use ONLY the prices specified in the clinic's documentation - do NOT convert currencies or use general market pricing. State the price exactly as documented: "[Service] is $[amount]/[unit]". 

CONTEXT-AWARE PRICING:
- If user says "share me its pricing" or "what's the cost", look at the PREVIOUS CONVERSATION to understand what service they're referring to
- "its pricing" = the specific service/treatment mentioned in the last clinic response
- DO NOT list all services - only provide pricing for the service being discussed in context
- Example: If previous message mentioned "Botox", only give Botox pricing

🚨 INTELLIGENT RESPONSE GUIDELINES:
Analyze the conversation context and user intent intelligently. Use your knowledge base to provide accurate, helpful responses based on what the patient is genuinely asking for.

🚨 CRITICAL "YES" RESPONSE LOGIC:
When a patient responds with "yes", you MUST analyze the IMMEDIATELY PREVIOUS CLINIC MESSAGE to understand what they're agreeing to:

1. DIRECT BOOKING QUESTIONS ("Ready to book?", "Want to schedule?", "Should I book you?"):
   → Patient "Yes" = Provide ONLY booking link: "Awesome! Let's lock in your appointment: ${bookingLink}"
   → NO additional text, NO explanations, NO other information - JUST the booking link with minimal text

2. INFORMATION OFFERS ("Let me know if you want to book!" AFTER already sharing service/treatment info):
   → Patient "Yes" = They want more detailed information, pricing recap, or service details
   → Provide comprehensive information based on what was discussed

3. TREATMENT INFO QUESTIONS ("Want to learn about [Treatment]?", "Interested in [Service]?"):
   → Patient "Yes" = Provide detailed treatment information + booking option

4. PRICING QUESTIONS ("Want the pricing breakdown?", "Should I share the costs?"):
   → Patient "Yes" = Provide specific pricing information for the discussed service

CRITICAL: ONLY look at the LAST clinic message, not the entire conversation history.

CONTEXT ANALYSIS FOR "YES" RESPONSES:
- Read the EXACT wording of the MOST RECENT clinic message only
- If it mentioned specific treatments/services, focus your response on those
- If it offered information sharing, provide that information
- If it asked about booking availability, provide ONLY booking link with minimal text
- DO NOT default to generic responses when context is clear

NATURAL CONVERSATION FLOW:
When patients show interest or ask questions, understand their intent from the conversation context and respond appropriately:

RESPOND TO USER INTENT:
• If they're ready to book → Provide booking link: "Awesome! Let's lock in your appointment: ${bookingLink}"
• If they ask about pricing → Give specific price from your knowledge for the service being discussed
• If they want treatment details → Provide comprehensive information about that specific treatment
• If they say "yes" after service info was shared → Provide the detailed information they're requesting
• Use your training data and clinic knowledge to give accurate, contextual responses

EXAMPLE SCENARIOS:
- Last message: "Ready to book?" → Patient: "Yes" → Response: "Awesome! Let's lock in your appointment: ${bookingLink}"
- Last message: "Want to learn about Botox?" → Patient: "Yes" → Response: [Botox details + booking option]
- Last message: "Interested in consultation?" → Patient: "Yes" → Response: [Consultation details + booking link]
- Last message: "Microneedling is great for acne scars, $180/session. Let me know if you want to book!" → Patient: "Yes" → Response: [Full service breakdown with all treatments and pricing as requested]

INTELLIGENT YES RESPONSE HANDLING:
- If previous message asked for BOOKING specifically ("ready to book?", "want to schedule?") → Provide booking link only  
- If previous message offered INFORMATION/PRICING ("let me know if you want to book!" after sharing service info) → Provide the complete information they're requesting
- If previous message asked about LEARNING/DETAILS ("want to know about X?") → Provide detailed information about X
- ANALYZE THE EXACT CONTEXT to understand what the patient is saying "yes" to
- DO NOT give generic responses when the context clearly indicates what information they want

CRITICAL RESPONSE RULES:
- NEVER end with questions like "Would you like to know more about booking?" or "Ready to book an appointment?"
- NEVER ask "What questions do you have?" or similar open-ended questions
- ALWAYS provide complete information and direct next steps
- When someone asks about PRICING, ALWAYS refer to the pricing document/file for accurate information

🔍 DEBUG MODE FOR PRICING: Include the exact text you found in the pricing document. Format your response as: "Botox is $X per unit (source: [exact quote from pricing document])". This helps verify document access.
- When patient says YES to a DIRECT BOOKING QUESTION, provide ONLY booking link - no extra info
- When patient says YES to an INFORMATION OFFER, provide the requested information
- When providing booking links, keep it VERY brief: "Awesome! Let's lock in your appointment: ${bookingLink}"
- Make responses definitive and action-oriented, not question-heavy

IMPORTANT: This is a continuing conversation - use the full context above to understand what the patient needs and respond appropriately.`
    : ""
}

${
  isBookingInquiry
    ? `BOOKING INFORMATION:
- When user shows clear booking intent (asks for booking link, wants to schedule, ready to book), respond with: "Awesome! Let's lock in your appointment: ${bookingLink}"
- Booking is available at: ${bookingLink}`
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
        // Removed tools override - let Assistant use its configured tools
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

        // Check if the Assistant used file_search tool by examining the run steps
        try {
          const runSteps = await openai.beta.threads.runs.steps.list(threadIdForRetrieval, runIdForRetrieval);
          const fileSearchSteps = runSteps.data.filter(
            step => step.step_details?.type === "tool_calls" && step.step_details?.tool_calls?.some(call => call.type === "file_search"),
          );

          logInfo("🔍 FILE_SEARCH TOOL USAGE:", {
            totalSteps: runSteps.data.length,
            fileSearchStepsFound: fileSearchSteps.length,
            stepsDetails: runSteps.data.map(step => ({
              type: step.step_details?.type,
              tool_calls: step.step_details?.tool_calls?.map(call => call.type) || [],
            })),
          });

          if (fileSearchSteps.length === 0) {
            logError("❌ ASSISTANT DID NOT USE FILE_SEARCH TOOL - This is why it's not using documents!");
          } else {
            logInfo("✅ Assistant used file_search tool successfully");
          }
        } catch (stepError) {
          logError("❌ Could not retrieve run steps:", stepError.message);
        }

        // Log full message details including citations and annotations
        logInfo("🔍 FULL ASSISTANT MESSAGE DEBUG:", {
          role: assistantMessage.role,
          content: assistantMessage.content,
          annotations: assistantMessage.content[0]?.text?.annotations || [],
          created_at: new Date(assistantMessage.created_at * 1000).toISOString(),
          assistant_id: assistantMessage.assistant_id,
          run_id: assistantMessage.run_id,
          thread_id: assistantMessage.thread_id,
        });

        // Log what documents were cited in the response
        const annotations = assistantMessage.content[0]?.text?.annotations || [];
        if (annotations.length > 0) {
          logInfo("📚 DOCUMENTS CITED IN RESPONSE:", {
            annotationCount: annotations.length,
            citations: annotations.map(annotation => ({
              type: annotation.type,
              text: annotation.text,
              file_citation: annotation.file_citation,
              start_index: annotation.start_index,
              end_index: annotation.end_index,
            })),
          });

          // Try to get content from cited files
          for (const annotation of annotations) {
            if (annotation.type === "file_citation" && annotation.file_citation?.file_id) {
              try {
                const citedFile = await openai.files.retrieve(annotation.file_citation.file_id);
                logInfo(`📄 CITED FILE DETAILS (${citedFile.filename}):`, {
                  file_id: annotation.file_citation.file_id,
                  filename: citedFile.filename,
                  quote: annotation.file_citation.quote || "No quote provided",
                  bytes: citedFile.bytes,
                });

                // Try to get the actual content if it's a pricing document
                if (citedFile.filename?.toLowerCase().includes("pricing")) {
                  try {
                    const fileContent = await openai.files.content(annotation.file_citation.file_id);
                    const fileText = await fileContent.text();
                    logInfo(`📄 CITED PRICING DOCUMENT FULL CONTENT:`, {
                      filename: citedFile.filename,
                      contentLength: fileText.length,
                      fullContent: fileText,
                    });
                  } catch (contentError) {
                    logError(`❌ Could not read cited pricing document:`, contentError.message);
                  }
                }
              } catch (fileError) {
                logError(`❌ Could not retrieve cited file:`, fileError.message);
              }
            }
          }
        } else {
          logInfo("⚠️ NO DOCUMENT CITATIONS FOUND - Assistant may not be using uploaded documents");
        }

        // Clean up response
        aiResponse = aiResponse.replace(/【[^】]*】/g, "");
        aiResponse = aiResponse.replace(/\[LEAD_ASSESSMENT\][\s\S]*?\[\/LEAD_ASSESSMENT\]/gi, "");

        // For SMS booking inquiries, add booking link if missing (check for any booking link)
        const hasAnyBookingLink =
          aiResponse.includes(bookingLink) ||
          aiResponse.includes("http") ||
          aiResponse.includes("calendly") ||
          aiResponse.includes("tinyurl");
        const shouldAddBookingLink = !isEmailResponse && isBookingInquiry && !hasAnyBookingLink;
        logInfo("🔗 Booking link addition check:", {
          isEmailResponse: isEmailResponse,
          isBookingInquiry: isBookingInquiry,
          bookingLink: bookingLink,
          aiResponseContainsLink: hasAnyBookingLink,
          shouldAddBookingLink: shouldAddBookingLink,
        });

        if (shouldAddBookingLink) {
          aiResponse += `\n\nBook here: ${bookingLink}`;
          logInfo("✅ Added booking link to AI response");
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
      options.messageBody.toLowerCase().includes("consultation") ||
      options.messageBody.toLowerCase().includes("visit");

    // Check if user responded "yes" to a booking-related question in previous conversation (fallback version)
    const messageBodyLower = options.messageBody.toLowerCase();
    const isYesResponse =
      messageBodyLower.trim() === "yes" ||
      messageBodyLower.trim() === "y" ||
      messageBodyLower.includes("yes please") ||
      messageBodyLower.includes("sure") ||
      messageBodyLower.includes("okay") ||
      messageBodyLower.includes("ok");

    let shouldTriggerBookingProcess = false;

    if (isYesResponse && conversationContext) {
      // Get ONLY the most recent clinic message (not the entire conversation)
      const messages = conversationContext.split("\n\n");
      const lastClinicMessage = messages[messages.length - 1] || "";

      // Extract just the clinic's message (remove "Clinic:" prefix)
      const lastClinicMessageText = lastClinicMessage.replace(/^Clinic:\s*/, "").toLowerCase();

      logInfo("🔍 Analyzing last clinic message for yes response (fallback):", lastClinicMessageText);

      // Function to analyze message intent using patterns and context (fallback version)
      function analyzeMessageIntentFallback(message: string): {
        isDirectBooking: boolean;
        isInformationOffer: boolean;
        confidence: number;
      } {
        const msg = message.toLowerCase().trim();

        // Patterns for DIRECT booking questions (high confidence)
        const directBookingPatterns = [
          /\b(ready|want|would you like)\s+to\s+(book|schedule)\s*\?/,
          /\bshall\s+(we|i)\s+(book|schedule)/,
          /\bwould you like to book\s+a?\s+\w+/,
          /\bready\s+to\s+dive\s+in.*would you like to book/,
          /\bshould\s+i\s+book\s+you/,
        ];

        // Patterns for INFORMATION offers (should not trigger booking)
        const informationOfferPatterns = [
          /\blet\s+me\s+know\s+if\s+you\s+want\s+to\s+book/,
          /\bif\s+you[''']?re\s+interested\s+in\s+booking/,
          /\bjust\s+let\s+me\s+know/,
          /\bwant\s+more\s+details/,
        ];

        // Check direct booking patterns
        const hasDirectBookingPattern = directBookingPatterns.some(pattern => pattern.test(msg));

        // Check information offer patterns
        const hasInformationPattern = informationOfferPatterns.some(pattern => pattern.test(msg));

        // Calculate confidence based on message structure
        let confidence = 0.5; // base confidence

        // Increase confidence for question marks at end
        if (msg.endsWith("?")) confidence += 0.2;

        // Increase confidence for imperative verbs
        if (/\b(book|schedule|reserve)\b/.test(msg)) confidence += 0.1;

        // Decrease confidence for conditional language
        if (/\b(if|maybe|perhaps|might)\b/.test(msg)) confidence -= 0.2;

        return {
          isDirectBooking: hasDirectBookingPattern && !hasInformationPattern,
          isInformationOffer: hasInformationPattern,
          confidence: Math.max(0, Math.min(1, confidence)),
        };
      }

      const intentFallback = analyzeMessageIntentFallback(lastClinicMessageText);
      const wasDirectBookingQuestion = intentFallback.isDirectBooking;
      const wasInformationOffer = intentFallback.isInformationOffer;

      // Only trigger booking for DIRECT questions, not information offers
      const shouldTriggerBooking = wasDirectBookingQuestion && !wasInformationOffer;

      logInfo("🔍 Booking analysis result (fallback):", {
        wasDirectBookingQuestion,
        wasInformationOffer,
        shouldTriggerBooking,
        confidence: intentFallback.confidence,
        lastMessage: lastClinicMessageText.substring(0, 100),
      });

      if (shouldTriggerBooking) {
        shouldTriggerBookingProcess = true;
        logInfo("📅 Yes response to DIRECT booking question detected in fallback, triggering booking process");
      } else if (wasInformationOffer) {
        logInfo("📋 Yes response to information offer detected in fallback, will provide information instead of booking");
      } else {
        logInfo("ℹ️ Yes response but no booking context detected in fallback, will generate normal AI response");
      }
    }

    // Trigger booking process if yes response to booking question
    if (shouldTriggerBookingProcess) {
      try {
        const bookingOptions: BookingDetectionOptions = {
          messageBody: options.messageBody,
          subject: options.subject,
          leadData: {
            id: leadData.id,
            first_name: leadData.first_name,
            last_name: leadData.last_name,
            email: leadData.email,
            phone: leadData.phone,
            notes: leadData.notes,
          },
          clinicData: {
            id: clinicData.id,
            name: clinicData.name,
            calendly_link: clinicData.calendly_link,
          },
          communicationType: isEmailResponse ? "email" : "sms",
          senderPhone: leadData.phone,
          forceBooking: true, // Force booking creation for "yes" responses
        };

        logInfo("🎯 Triggering booking detection service for yes response in fallback...");
        const bookingResult = await detectBookingRequestAndCreateSchedule(bookingOptions, supabaseClient);

        logInfo("📅 Booking detection result for yes response in fallback:", {
          isBookingRequest: bookingResult.isBookingRequest,
          meetingScheduleCreated: bookingResult.meetingScheduleCreated,
          meetingScheduleId: bookingResult.meetingScheduleId,
          error: bookingResult.error,
        });

        if (bookingResult.meetingScheduleCreated) {
          logInfo(`✅ Booking service created meeting schedule for yes response in fallback: ${bookingResult.meetingScheduleId}`);

          // Return immediate booking response instead of generating AI response
          const bookingResponseText = `Awesome! Let's lock in your appointment: ${bookingLink}`;
          logInfo("📅 Returning direct booking response for yes to booking question in fallback");
          return { success: true, response: bookingResponseText };
        } else if (bookingResult.error) {
          logError(`❌ Booking service error for yes response in fallback: ${bookingResult.error}`);
        }
      } catch (bookingError) {
        logError(`❌ Error in booking detection for yes response in fallback:`, bookingError);
      }
    }

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
  conversationContext
    ? `🚨 CRITICAL CONTEXT INSTRUCTION: 
The patient's current message "${options.messageBody}" is a REPLY to the conversation above. 

🚨 CRITICAL - PRICING RESPONSES:
When asked about pricing, provide the EXACT price from the clinic's pricing document/knowledge base. Use ONLY the prices specified in the clinic's documentation - do NOT convert currencies or use general market pricing. State the price exactly as documented: "[Service] is $[amount]/[unit]". 

CONTEXT-AWARE PRICING:
- If user says "share me its pricing" or "what's the cost", look at the PREVIOUS CONVERSATION to understand what service they're referring to
- "its pricing" = the specific service/treatment mentioned in the last clinic response
- DO NOT list all services - only provide pricing for the service being discussed in context
- Example: If previous message mentioned "Botox", only give Botox pricing

🚨 INTELLIGENT RESPONSE GUIDELINES:
Analyze the conversation context and user intent intelligently. Use your knowledge base to provide accurate, helpful responses based on what the patient is genuinely asking for.

NATURAL CONVERSATION FLOW:
When patients show interest or ask questions, understand their intent from the conversation context and respond appropriately:

IF LAST CLINIC MESSAGE ASKED ABOUT BOOKING ("ready to book?", "want to schedule?", "let me know if you want to book", "interested in booking", "if you're interested in booking"):
- Patient's "yes" = booking request
- Provide ONLY the booking link: "Book here: ${bookingLink} (5-6 words maximum)"
- NO additional information, NO more questions, NO treatment details, NO explanations

IF LAST CLINIC MESSAGE ASKED ABOUT TREATMENT INFO ("want to know about Botox?", "interested in learning more?"):
- Patient's "yes" = wants treatment information
- Provide specific treatment details, benefits, process
- End with clear next steps (booking opportunity)

EXAMPLE SCENARIOS:
- Last message: "Ready to book?" → Patient: "Yes" → Response: "Awesome! Let's lock in your appointment: ${bookingLink}"
- Last message: "Want to learn about Botox?" → Patient: "Yes" → Response: [Botox details + booking option]
- Last message: "Interested in consultation?" → Patient: "Yes" → Response: [Consultation details + booking link]

CRITICAL RESPONSE RULES:
- NEVER end with questions like "Would you like to know more about booking?" or "Ready to book an appointment?"
- NEVER ask "What questions do you have?" or similar open-ended questions
- ALWAYS provide complete information and direct next steps
- When someone asks about PRICING, ALWAYS refer to the pricing document/file for accurate information

🔍 DEBUG MODE FOR PRICING: Include the exact text you found in the pricing document. Format your response as: "Botox is $X per unit (source: [exact quote from pricing document])". This helps verify document access.
- When patient says YES to a BOOKING QUESTION, provide ONLY booking link - no extra info
- When providing booking links, keep it VERY brief: "Awesome! Let's lock in your appointment: ${bookingLink}"
- NO treatment information when sending booking links - just the link
- Make responses definitive and action-oriented, not question-heavy

IMPORTANT: This is a continuing conversation - use the full context above to understand what the patient needs and respond appropriately.`
    : ""
}

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

${
  conversationContext
    ? `🚨 CRITICAL CONTEXT INSTRUCTION: 
The patient's current message "${options.messageBody}" is a REPLY to the conversation above. 

🚨 CRITICAL - PRICING RESPONSES:
When asked about pricing, provide the EXACT price from the clinic's pricing document/knowledge base. Use ONLY the prices specified in the clinic's documentation - do NOT convert currencies or use general market pricing. State the price exactly as documented: "[Service] is $[amount]/[unit]". 

CONTEXT-AWARE PRICING:
- If user says "share me its pricing" or "what's the cost", look at the PREVIOUS CONVERSATION to understand what service they're referring to
- "its pricing" = the specific service/treatment mentioned in the last clinic response
- DO NOT list all services - only provide pricing for the service being discussed in context
- Example: If previous message mentioned "Botox", only give Botox pricing

🚨 INTELLIGENT RESPONSE GUIDELINES:
Analyze the conversation context and user intent intelligently. Use your knowledge base to provide accurate, helpful responses based on what the patient is genuinely asking for.

🚨 CRITICAL "YES" RESPONSE LOGIC FOR FALLBACK:
When a patient responds with "yes", you MUST analyze the PREVIOUS CLINIC MESSAGE to understand what they're agreeing to:

1. DIRECT BOOKING QUESTIONS ("Ready to book?", "Want to schedule?", "Should I book you?"):
   → Patient "Yes" = Provide ONLY booking link: "Awesome! Let's lock in your appointment: ${bookingLink}"

2. INFORMATION OFFERS ("Let me know if you want to book!" AFTER already sharing service/treatment info):
   → Patient "Yes" = They want more detailed information, pricing recap, or service details  
   → Provide comprehensive information based on what was discussed

3. TREATMENT INFO QUESTIONS ("Want to learn about [Treatment]?", "Interested in [Service]?"):
   → Patient "Yes" = Provide detailed treatment information + booking option

4. PRICING QUESTIONS ("Want the pricing breakdown?", "Should I share the costs?"):
   → Patient "Yes" = Provide specific pricing information for the discussed service

NATURAL CONVERSATION FLOW:
When patients show interest or ask questions, understand their intent from the conversation context and respond appropriately:

IF LAST CLINIC MESSAGE ASKED ABOUT DIRECT BOOKING ("ready to book?", "want to schedule?"):
- Patient's "yes" = booking request
- Provide ONLY the booking link: "Book here: ${bookingLink} (5-6 words maximum)"
- NO additional information, NO more questions, NO treatment details, NO explanations

IF LAST CLINIC MESSAGE OFFERED INFORMATION ("let me know if you want to book!" after sharing service info):
- Patient's "yes" = wants the offered information (pricing recap, service details)
- Provide the complete requested information from context
- Include pricing details and service information as requested
- Example: "Microneedling $180/session. Let me know if you want to book!" → "Yes" → [Full comprehensive service and pricing breakdown]

IF LAST CLINIC MESSAGE ASKED ABOUT TREATMENT INFO ("want to know about Botox?", "interested in learning more?"):
- Patient's "yes" = wants treatment information
- Provide specific treatment details, benefits, process  
- End with clear next steps (booking opportunity)

EXAMPLE SCENARIOS:
- Last message: "Ready to book?" → Patient: "Yes" → Response: "Awesome! Let's lock in your appointment:: ${bookingLink}"
- Last message: "Want to learn about Botox?" → Patient: "Yes" → Response: [Botox details + booking option]
- Last message: "Interested in consultation?" → Patient: "Yes" → Response: [Consultation details + booking link]
- Last message: "Let me know if you want to book!" (after sharing service info) → Patient: "Yes" → Response: [Provide the requested information/pricing recap]

CRITICAL RESPONSE RULES:
- NEVER end with questions like "Would you like to know more about booking?" or "Ready to book an appointment?"
- NEVER ask "What questions do you have?" or similar open-ended questions
- ALWAYS provide complete information and direct next steps
- When someone asks about PRICING, ALWAYS refer to the pricing document/file for accurate information

🔍 DEBUG MODE FOR PRICING: Include the exact text you found in the pricing document. Format your response as: "Botox is $X per unit (source: [exact quote from pricing document])". This helps verify document access.
- When patient says YES to a BOOKING QUESTION, provide ONLY booking link - no extra info
- When providing booking links, keep it VERY brief: "Awesome! Let's lock in your appointment: ${bookingLink}" 
- NO treatment information when sending booking links - just the link
- Make responses definitive and action-oriented, not question-heavy

IMPORTANT: This is a continuing conversation - use the full context above to understand what the patient needs and respond appropriately.`
    : ""
}

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

    // For SMS booking inquiries, add booking link if missing (check for any booking link)
    const hasAnyBookingLink =
      aiResponse.includes(bookingLink) || aiResponse.includes("http") || aiResponse.includes("calendly") || aiResponse.includes("tinyurl");
    if (!isEmailResponse && isBookingInquiry && !hasAnyBookingLink) {
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

export type { LeadData, ClinicData, GenerateAIResponseOptions };
