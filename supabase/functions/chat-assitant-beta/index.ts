// supabase/functions/chat-assistant-beta/index.ts - Streaming Version with Document-Aware Instructions
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
// OpenAI will be imported dynamically with fallback strategy
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

// Cache for assistant data to avoid repeated DB calls (PERFORMANCE ADDITION)
const assistantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Response cache for common queries (SPEED OPTIMIZATION)
const responseCache = new Map();
const RESPONSE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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

    // Fetch thread data to get lead information and existing openai_thread_id
    console.log("🔍 Fetching thread data...");
    const { data: threadData, error: threadError } = await supabaseClient
      .from("threads")
      .select("lead_id, openai_thread_id, lead:lead_id(first_name, last_name, email, phone, status, interest_level, urgency)")
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

    // Import OpenAI (try different sources for better beta support)
    console.log("📦 Importing OpenAI SDK...");
    let OpenAI;
    try {
      // Use stable latest version with full beta support
      const module = await import("https://esm.sh/openai@4.67.3");
      OpenAI = module.default;
      console.log("✅ OpenAI SDK imported from esm.sh v4.67.3 (stable latest)");
    } catch (esmError) {
      console.error("❌ ESM latest import failed, trying fallback:", esmError.message);
      // Fallback to JSR version
      const module = await import("jsr:@openai/openai");
      OpenAI = module.default;
      console.log("✅ OpenAI SDK imported from JSR (fallback)");
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
      dangerouslyAllowBrowser: false,
      defaultHeaders: {
        "OpenAI-Beta": "assistants=v2",
      },
    });
    console.log("✅ OpenAI client initialized");

    // Verify beta features are available
    console.log("🔍 Checking OpenAI client beta features...", {
      hasBeta: !!openai.beta,
      hasVectorStores: !!openai.beta?.vectorStores,
      hasAssistants: !!openai.beta?.assistants,
      vectorStoresRetrieve: !!openai.beta?.vectorStores?.retrieve,
      clientVersion: openai.constructor.name,
    });

    // Skip API connectivity test to improve performance

    // Use stored openai_thread_id from database, or passed openai_thread_id, or create new
    let currentOpenaiThreadId = threadData.openai_thread_id || openai_thread_id;

    // If no OpenAI thread_id, create a new thread
    if (!currentOpenaiThreadId) {
      console.log("Creating new OpenAI thread...");
      const newThread = await openai.beta.threads.create();
      currentOpenaiThreadId = newThread.id;

      // Store the OpenAI thread ID in the database like reply-response.ts does
      console.log("💾 Storing OpenAI thread ID in database...");
      const { error: updateError } = await supabaseClient
        .from("threads")
        .update({
          openai_thread_id: currentOpenaiThreadId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", thread_id);

      if (updateError) {
        console.error("❌ Failed to store OpenAI thread ID:", updateError);
      } else {
        console.log("✅ Successfully stored OpenAI thread ID in database");
      }
    } else {
      console.log("Using existing OpenAI thread:", currentOpenaiThreadId);
    }

    // Debug: Verify thread ID before operations
    if (!currentOpenaiThreadId || typeof currentOpenaiThreadId !== "string" || !currentOpenaiThreadId.startsWith("thread_")) {
      throw new Error(`Invalid thread ID: ${currentOpenaiThreadId} - must be a non-empty string starting with 'thread_'`);
    }

    // Check response cache for common queries (SPEED OPTIMIZATION)
    const messageLower = message.toLowerCase().trim();
    const cacheKey = `${clinic_id}_${messageLower}`;
    const cached = responseCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < RESPONSE_CACHE_TTL) {
      console.log("✅ Returning cached response for:", messageLower.substring(0, 50));

      // Return cached response as streaming
      const cachedStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();

          // Send init
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "init",
                openai_thread_id: currentOpenaiThreadId,
                lead_assessment: { status: "", interest_level: "", urgency: "" },
              })}\n\n`,
            ),
          );

          // Send cached content
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "chunk",
                content: cached.response,
                run_id: "cached",
              })}\n\n`,
            ),
          );

          // Send completion
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "completed",
                full_message: cached.response,
                run_id: "cached",
                openai_thread_id: currentOpenaiThreadId,
                lead_assessment: { status: "", interest_level: "", urgency: "" },
              })}\n\n`,
            ),
          );

          controller.close();
        },
      });

      return new Response(cachedStream, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
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

    // Skip assistant configuration retrieval to improve performance

    console.log(`📊 File processing summary: ${vectorStoreFiles.length} files processed`);

    // Minimal instructions for faster processing
    const additionalInstructions = `Search clinic documents for pricing/service info. Keep responses under 30 words. Use exact info from documents only. If booking intent: ${clinicData?.calendly_link || "Contact us to book"}.`;

    // Use streaming for real-time responses
    console.log("Starting streaming assistant run...");

    const stream = openai.beta.threads.runs.stream(currentOpenaiThreadId, {
      assistant_id: assistantData.openai_assistant_id,
      additional_instructions: additionalInstructions,
      max_completion_tokens: 100,
      temperature: 0.0,
      tools: [{ type: "file_search" }],
      tool_choice: "required",
    });

    // Create streaming response
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullMessage = "";
        let runId = "";

        // Send init message
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "init",
              openai_thread_id: currentOpenaiThreadId,
              lead_assessment: { status: "", interest_level: "", urgency: "" },
            })}\n\n`,
          ),
        );

        try {
          // Handle streaming events
          for await (const event of stream) {
            switch (event.event) {
              case "thread.run.created":
                runId = event.data.id;
                console.log("🏃 Run started:", runId);
                break;

              case "thread.message.delta":
                if (event.data.delta.content) {
                  for (const content of event.data.delta.content) {
                    if (content.type === "text" && content.text?.value) {
                      const chunk = content.text.value;
                      fullMessage += chunk;

                      // Send chunk to client
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: "chunk",
                            content: chunk,
                            run_id: runId,
                          })}\n\n`,
                        ),
                      );
                    }
                  }
                }
                break;

              case "thread.message.created":
                console.log("💬 Message created");
                break;

              case "thread.message.in_progress":
                console.log("⏳ Message in progress");
                break;

              case "thread.message.completed":
                console.log("✅ Message completed");
                break;

              case "thread.run.completed": {
                console.log("✅ Run completed:", runId);

                // Clean citations from full message
                const cleanResponse = fullMessage.replace(/【\d+:\d+†[^】]*】/g, "").trim();

                // Cache the response
                if (cleanResponse && cleanResponse.length > 10) {
                  responseCache.set(cacheKey, {
                    response: cleanResponse,
                    timestamp: Date.now(),
                  });
                }

                // Send completion
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "completed",
                      full_message: cleanResponse,
                      run_id: runId,
                      openai_thread_id: currentOpenaiThreadId,
                      lead_assessment: { status: "", interest_level: "", urgency: "" },
                    })}\n\n`,
                  ),
                );

                controller.close();
                return;
              }

              case "thread.run.failed":
                console.error("❌ Run failed:", event.data.last_error);
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "error",
                      error: "Assistant run failed",
                      run_id: runId,
                    })}\n\n`,
                  ),
                );
                controller.close();
                return;

              case "thread.run.requires_action":
                console.log("🔧 Run requires action (tool calls)");
                break;

              case "thread.run.incomplete":
                console.log("⚠️ Run incomplete - timeout or error");
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "completed",
                      full_message:
                        fullMessage || "I'm having trouble accessing the documents right now. Let me connect you with our team.",
                      run_id: runId,
                      openai_thread_id: currentOpenaiThreadId,
                      lead_assessment: { status: "", interest_level: "", urgency: "" },
                    })}\n\n`,
                  ),
                );
                controller.close();
                return;

              default:
                // Log other events for debugging
                console.log("📡 Stream event:", event.event, event.data?.type || "");
            }
          }
        } catch (error) {
          console.error("❌ Streaming error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: error.message,
                run_id: runId,
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

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
