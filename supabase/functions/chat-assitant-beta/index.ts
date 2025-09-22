// supabase/functions/chat-assistant-beta/index.ts - Streaming Version with Document-Aware Instructions
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import OpenAI from "jsr:@openai/openai";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

// Cache for assistant data to avoid repeated DB calls (PERFORMANCE ADDITION)
const assistantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// PERFORMANCE ADDITION: Get cached assistant data or fetch from DB
const getAssistantData = async (clinicId: string) => {
  const cacheKey = `assistant_${clinicId}`;
  const cached = assistantCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const { data: assistantData, error: assistantError } = await supabaseClient
    .from("assistants")
    .select("id, openai_assistant_id, assistant_name")
    .eq("clinic_id", clinicId)
    .single();
  if (assistantError || !assistantData) {
    throw new Error("No assistant configured for this clinic");
  }
  // Cache the result
  assistantCache.set(cacheKey, {
    data: assistantData,
    timestamp: Date.now(),
  });
  return assistantData;
};

// Lead assessment function (currently unused but kept for future functionality)
/*
const updateLeadStatusAsync = async (leadId, assessmentData) => {
  try {
    const { status, interest_level, urgency, hasValidAssessment } = assessmentData;
    if (!leadId) {
      console.warn("No leadId provided for status update");
      return;
    }
    // If we don't have a complete assessment, log it but still update what we have
    if (!hasValidAssessment) {
      console.warn("Incomplete assessment data for lead:", leadId, assessmentData);
    }
    const updateData = {
      updated_at: new Date().toISOString(),
    };
    // Only update fields that were provided and are valid
    if (status) updateData.status = status;
    if (interest_level) updateData.interest_level = interest_level;
    if (urgency) updateData.urgency = urgency;
    // If we have at least one valid field, proceed with update
    if (Object.keys(updateData).length > 1) {
      const { error } = await supabaseClient.from("lead").update(updateData).eq("id", leadId);
      if (error) {
        console.error("Error updating lead status:", error);
      } else {
        // If assessment was incomplete, we should log this for monitoring
        if (!hasValidAssessment) {
          console.log("⚠️ AI provided incomplete assessment - may need prompt adjustment");
        }
      }
    } else {
      console.warn("No valid assessment data to update for lead:", leadId);
    }
  } catch (error) {
    console.error("Error in updateLeadStatusAsync:", error);
  }
};
*/
serve(async req => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }
  try {
    const { clinic_id, thread_id, openai_thread_id = null, message } = await req.json();
    if (!clinic_id || !thread_id || !message) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: clinic_id, thread_id, and message are required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Fetch thread data to get lead information
    console.log("🔍 Fetching thread data...");
    const { data: threadData, error: threadError } = await supabaseClient
      .from("threads")
      .select("lead_id, lead:lead_id(first_name, last_name, email, phone, status, interest_level, urgency)")
      .eq("id", thread_id)
      .single();

    if (threadError || !threadData) {
      return new Response(
        JSON.stringify({
          error: "Thread not found",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Use cached assistant data for streaming
    console.log("🤖 Setting up streaming bot response...");

    let assistantData;
    try {
      assistantData = await getAssistantData(clinic_id);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error.message,
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });

    let currentOpenaiThreadId = openai_thread_id;

    // If no OpenAI thread_id, create a new thread
    if (!currentOpenaiThreadId) {
      console.log("Creating new OpenAI thread...");
      const newThread = await openai.beta.threads.create();
      currentOpenaiThreadId = newThread.id;
    } else {
      console.log("Using existing thread:", currentOpenaiThreadId);
    }

    // Debug: Verify thread ID before operations
    if (!currentOpenaiThreadId || typeof currentOpenaiThreadId !== "string" || !currentOpenaiThreadId.startsWith("thread_")) {
      throw new Error(`Invalid thread ID: ${currentOpenaiThreadId} - must be a non-empty string starting with 'thread_'`);
    }

    // Add message to thread
    console.log("Adding message to thread:", currentOpenaiThreadId);
    await openai.beta.threads.messages.create(currentOpenaiThreadId, {
      role: "user",
      content: message,
    });

    // Get clinic data for additional instructions
    const { data: clinicData } = await supabaseClient
      .from("clinic")
      .select("name, phone_number, calendly_link, mailgun_email")
      .eq("id", clinic_id)
      .single();

    // Retrieve assistant details to get file_search configuration
    console.log("📚 Retrieving assistant and vector store information...");
    const vectorStoreFiles = [];
    let documentContent = "";

    try {
      const assistant = await openai.beta.assistants.retrieve(assistantData.openai_assistant_id);
      const hasFileSearch = assistant.tools?.some(tool => tool.type === "file_search") || false;

      console.log(`🔍 Assistant file_search enabled: ${hasFileSearch}`);

      if (hasFileSearch && assistant.tool_resources?.file_search?.vector_store_ids?.length > 0) {
        console.log(`📁 Found ${assistant.tool_resources.file_search.vector_store_ids.length} vector stores`);

        // Get files from all vector stores
        for (const vectorStoreId of assistant.tool_resources.file_search.vector_store_ids) {
          try {
            const vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreId);
            console.log(`📚 Vector store: ${vectorStore.name} (${vectorStore.file_counts?.total || 0} files)`);

            const files = await openai.beta.vectorStores.files.list(vectorStoreId);
            console.log(`📄 Retrieved ${files.data.length} files from vector store`);

            for (const file of files.data) {
              try {
                const fileDetails = await openai.files.retrieve(file.id);
                console.log(`📖 Reading file: ${fileDetails.filename} (${fileDetails.bytes} bytes)`);

                // Read file content
                const fileContent = await openai.files.content(file.id);
                const fileText = await fileContent.text();

                // Determine document type from filename
                let documentType = "DOCUMENT";
                const filename = fileDetails.filename?.toLowerCase() || "";
                if (filename.includes("pricing")) documentType = "PRICING";
                else if (filename.includes("service")) documentType = "SERVICE";
                else if (filename.includes("testimonial")) documentType = "TESTIMONIALS";

                vectorStoreFiles.push({
                  id: file.id,
                  filename: fileDetails.filename,
                  type: documentType,
                  content: fileText,
                  bytes: fileDetails.bytes,
                });

                documentContent += `\n\n=== ${documentType} DOCUMENT: ${fileDetails.filename} ===\n${fileText}`;

                console.log(`✅ Successfully read ${documentType} document: ${fileDetails.filename} (${fileText.length} characters)`);
              } catch (fileError) {
                console.warn(`⚠️ Failed to read file ${file.id}:`, fileError.message);
              }
            }
          } catch (vectorError) {
            console.warn(`⚠️ Failed to access vector store ${vectorStoreId}:`, vectorError.message);
          }
        }
      } else {
        console.log("📝 No file_search tool or vector stores configured");
      }
    } catch (assistantError) {
      console.warn("⚠️ Failed to retrieve assistant file configuration:", assistantError.message);
    }

    console.log(`📊 File reading summary: ${vectorStoreFiles.length} files loaded, ${documentContent.length} total characters`);

    // Create additional instructions with file content
    const additionalInstructions = `🚨 MANDATORY: You MUST use the clinic's uploaded documents ONLY. DO NOT use your general training knowledge about cosmetics/medical services.

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

When answering about PATIENT EXPERIENCES, RESULTS, or TESTIMONIALS:
1. ALWAYS search and reference the TESTIMONIALS DOCUMENT first
2. Use ONLY real patient stories and testimonials from the document
3. Quote specific patient experiences when relevant to the conversation
4. When patients ask "what results can I expect" or "do you have good reviews", reference specific testimonials
5. Use testimonials to build trust and showcase expertise
6. NEVER create fake testimonials or use generic patient stories

DOCUMENT PRIORITY ORDER:
- Pricing questions → Use PRICING DOCUMENT only
- Service listings/details → Use SERVICE DOCUMENT only  
- Patient experiences/reviews/results → Use TESTIMONIALS DOCUMENT only

CRITICAL: Never mix up services - if user asks about "Hydrafacial pricing", only provide Hydrafacial information from the pricing document, not Botox or any other service.

When you cannot find specific information in the uploaded documents, say: "Let me connect you with our team for that specific pricing detail."

CURRENT MESSAGE CONTEXT:
You are responding to this message from a patient: "${message}"

Patient: ${threadData?.lead?.first_name || "User"} (${threadData?.lead?.phone || "No phone"})
Context: Live chat conversation

🚨 INTELLIGENT RESPONSE GUIDELINES:
Analyze the conversation context and user intent intelligently. Use your knowledge base to provide accurate, helpful responses based on what the patient is genuinely asking for.

NATURAL CONVERSATION FLOW:
When patients show interest or ask questions, understand their intent from the conversation context and respond appropriately:

RESPOND TO USER INTENT:
• If they're ready to book → Provide booking link: "Awesome! Let's lock in your appointment: ${clinicData?.calendly_link || "Contact us to book"}"
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

CLINIC INFORMATION:
- Clinic Name: ${clinicData?.name || "Our Clinic"}
- Phone: ${clinicData?.phone_number || "Contact us for phone number"}
${clinicData?.mailgun_email ? `- Email: ${clinicData.mailgun_email}` : ""}

BOOKING INFORMATION:
${clinicData?.calendly_link ? `- When user shows booking intent, provide: ${clinicData.calendly_link}` : "- Booking available by calling the clinic"}

📄 UPLOADED DOCUMENT CONTENT:
${documentContent || "No documents found - please inform user to contact the clinic directly"}

RESPONSE GUIDELINES:
- Be conversational and helpful
- Use ONLY information from the document content above
- Reference specific document sections when providing information
- Keep responses professional yet friendly
- Make responses definitive and action-oriented
- When citing pricing, mention which document it came from
- Never use general cosmetic industry knowledge - only clinic-specific documents
- NEVER include citations like 【8:0†source】, 【26:0†source】, or ANY similar reference marks in responses
- Remove all citation formatting from your responses completely
- Provide information naturally as if you're speaking directly to the patient
- Do not reference document sources in brackets or with special formatting`;

    // Start streaming response with additional instructions
    console.log("Starting streaming assistant run...");
    const stream = openai.beta.threads.runs.stream(currentOpenaiThreadId, {
      assistant_id: assistantData.openai_assistant_id,
      additional_instructions: additionalInstructions,
      max_completion_tokens: 800,
      temperature: 0.8,
    });

    // Create a ReadableStream for Server-Sent Events
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullMessage = "";
        let runId = null;
        try {
          // Send initial event with thread info
          const initData = {
            type: "init",
            openai_thread_id: currentOpenaiThreadId,
            lead_assessment: {
              status: "",
              interest_level: "",
              urgency: "",
            },
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initData)}\n\n`));

          for await (const event of stream) {
            // Handle different event types
            if (event.event === "thread.run.created") {
              runId = event.data.id;
              console.log("🏃 Run created:", runId);
            }
            if (event.event === "thread.message.delta") {
              const delta = event.data.delta;
              if (delta.content && delta.content[0] && delta.content[0].text) {
                const chunk = delta.content[0].text.value;
                fullMessage += chunk;
                // Strip citations from chunk before sending
                const cleanChunk = chunk.replace(/【\d+:\d+†[^】]*】/g, "");
                // Send the cleaned chunk to client
                const chunkData = {
                  type: "chunk",
                  content: cleanChunk,
                  run_id: runId,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
              }
            }
            if (event.event === "thread.run.completed") {
              console.log("✅ Streaming run completed");

              // Strip citations from full message before sending
              const cleanFullMessage = fullMessage.replace(/【\d+:\d+†[^】]*】/g, "");

              // Send completion event
              const completionData = {
                type: "completed",
                full_message: cleanFullMessage,
                run_id: runId,
                openai_thread_id: currentOpenaiThreadId,
                lead_assessment: {
                  status: "",
                  interest_level: "",
                  urgency: "",
                },
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(completionData)}\n\n`));
              break;
            }
            if (event.event === "thread.run.failed" || event.event === "thread.run.cancelled" || event.event === "thread.run.expired") {
              console.error("❌ Run failed with event:", event.event);
              const errorData = {
                type: "error",
                error: `Run ${event.event.split(".").pop()}`,
                run_id: runId,
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
              break;
            }
          }
        } catch (error) {
          console.error("🚨 Streaming error:", error);
          const errorData = {
            type: "error",
            error: error.message,
            run_id: runId,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    // Return streaming response
    return new Response(readableStream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("🚨 Error in assistant chat:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
