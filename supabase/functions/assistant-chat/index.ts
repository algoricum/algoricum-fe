// supabase/functions/assistant-chat/index.js - Performance Optimized with ALL Original Logic Preserved
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import OpenAI from "jsr:@openai/openai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache for assistant data to avoid repeated DB calls (PERFORMANCE ADDITION)
const assistantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// PERFORMANCE ADDITION: Get cached assistant data or fetch from DB
const getAssistantData = async (supabaseClient, clinicId) => {
  const cacheKey = `assistant_${clinicId}`;
  const cached = assistantCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("🔍 Using cached assistant data for clinic:", clinicId);
    return cached.data;
  }

  console.log("🔍 Fetching assistant data from DB for clinic:", clinicId);
  const { data: assistantData, error: assistantError } = await supabaseClient
    .from("assistants")
    .select("id, openai_assistant_id")
    .eq("clinic_id", clinicId)
    .single();

  if (assistantError || !assistantData) {
    console.error("❌ No assistant configured for clinic:", clinicId, "Error:", assistantError);
    throw new Error("No assistant configured for this clinic");
  }

  // Cache the result
  assistantCache.set(cacheKey, {
    data: assistantData,
    timestamp: Date.now(),
  });

  console.log("✅ Assistant data fetched and cached:", assistantData);
  return assistantData;
};

// Your original parseLeadAssessment function - COMPLETELY PRESERVED
const parseLeadAssessment = message => {
  const assessmentRegex = /\[LEAD_ASSESSMENT\]([\s\S]*?)\[\/LEAD_ASSESSMENT\]/i;
  const match = message.match(assessmentRegex);
  if (!match) {
    console.warn("❌ No LEAD_ASSESSMENT block found in AI response");
    console.warn("🔍 AI Response was:", message);
    return {
      status: null,
      interest_level: null,
      urgency: null,
      cleanMessage: message,
      hasValidAssessment: false,
    };
  }
  console.log("✅ LEAD_ASSESSMENT block found!");
  const assessmentBlock = match[1];
  const cleanMessage = message.replace(match[0], "").trim();
  console.log("📊 Assessment block content:", assessmentBlock);

  // Extract individual values with more strict validation
  const statusMatch = assessmentBlock.match(/STATUS:\s*(\w+)/i);
  const interestMatch = assessmentBlock.match(/INTEREST:\s*(\w+)/i);
  const urgencyMatch = assessmentBlock.match(/URGENCY:\s*([\w-]+)/i);
  const status = statusMatch ? statusMatch[1].toLowerCase() : null;
  const interest_level = interestMatch ? interestMatch[1].toLowerCase() : null;
  const urgency = urgencyMatch ? urgencyMatch[1].toLowerCase().replace("-", "_") : null;

  console.log("🔧 Extracted values:", {
    status,
    interest_level,
    urgency,
  });

  // Validate all required fields are present
  const hasValidAssessment = status && interest_level && urgency;
  if (!hasValidAssessment) {
    console.warn("⚠️ Incomplete LEAD_ASSESSMENT found:", {
      status: !!status,
      interest_level: !!interest_level,
      urgency: !!urgency,
      assessmentBlock,
    });
  }

  // Validate values are from allowed lists - YOUR EXACT VALIDATION LOGIC
  const validStatuses = ["New", "Engaged", "Booked", "Converted", "Cold"];
  const validInterestLevels = ["high", "medium", "low"];
  const validUrgencies = ["asap", "this_month", "curious"];

  const isValidStatus = status && validStatuses.includes(status);
  const isValidInterest = interest_level && validInterestLevels.includes(interest_level);
  const isValidUrgency = urgency && validUrgencies.includes(urgency);

  if (!isValidStatus) console.warn("❌ Invalid status:", status, "| Valid options:", validStatuses);
  if (!isValidInterest) console.warn("❌ Invalid interest_level:", interest_level, "| Valid options:", validInterestLevels);
  if (!isValidUrgency) console.warn("❌ Invalid urgency:", urgency, "| Valid options:", validUrgencies);

  const finalValidation = hasValidAssessment && isValidStatus && isValidInterest && isValidUrgency;
  console.log(finalValidation ? "✅ Assessment validation PASSED" : "❌ Assessment validation FAILED");

  return {
    status: isValidStatus ? status : null,
    interest_level: isValidInterest ? interest_level : null,
    urgency: isValidUrgency ? urgency : null,
    cleanMessage: cleanMessage,
    hasValidAssessment: finalValidation,
  };
};

// Your original updateLeadStatusAsync function - COMPLETELY PRESERVED
const updateLeadStatusAsync = async (supabaseClient, leadId, assessmentData) => {
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
        console.log(
          `✅ Lead status updated - Status: ${status || "unchanged"}, Interest: ${interest_level || "unchanged"}, Urgency: ${urgency || "unchanged"}`,
        );
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

// PERFORMANCE ADDITION: Optimized function to wait for run completion with exponential backoff
const waitForRunCompletion = async (openai, threadId, runId, maxWaitTime = 25000) => {
  console.log("⏳ Waiting for run completion...");
  console.log("🔍 waitForRunCompletion called with:", {
    threadId: threadId,
    threadIdType: typeof threadId,
    runId: runId,
    runIdType: typeof runId,
  });

  // Safety checks
  if (!threadId || typeof threadId !== "string" || threadId.trim() === "") {
    console.error("❌ Invalid threadId:", threadId);
    throw new Error(`Thread ID is ${threadId} - must be a non-empty string`);
  }
  if (!runId || typeof runId !== "string" || runId.trim() === "") {
    console.error("❌ Invalid runId:", runId);
    throw new Error(`Run ID is ${runId} - must be a non-empty string`);
  }

  const threadIdStr = String(threadId).trim();
  const runIdStr = String(runId).trim();

  // Additional format validation
  if (!threadIdStr.startsWith("thread_")) {
    console.error("❌ Invalid thread ID format:", threadIdStr);
    throw new Error(`Invalid thread ID format: ${threadIdStr} - must start with 'thread_'`);
  }
  if (!runIdStr.startsWith("run_")) {
    console.error("❌ Invalid run ID format:", runIdStr);
    throw new Error(`Invalid run ID format: ${runIdStr} - must start with 'run_'`);
  }

  const startTime = Date.now();
  let delay = 200; // Start with 200ms
  const maxDelay = 2000; // Cap at 2 seconds

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Log parameters immediately before the API call
      console.log("🔄 Preparing to call openai.beta.threads.runs.retrieve with:", {
        threadId: threadIdStr,
        threadIdType: typeof threadIdStr,
        runId: runIdStr,
        runIdType: typeof runIdStr,
      });

      // Try object-based parameter format to avoid library bug
      let runStatus;
      try {
        runStatus = await openai.beta.threads.runs.retrieve({
          thread_id: threadIdStr,
          run_id: runIdStr,
        });
        console.log("🔄 Run status (object-based call):", runStatus.status);
      } catch (objectError) {
        console.warn("⚠️ Object-based retrieve failed:", objectError.message);
        console.log("🔄 Falling back to positional parameter call...");
        runStatus = await openai.beta.threads.runs.retrieve(threadIdStr, runIdStr);
        console.log("🔄 Run status (positional call):", runStatus.status);
      }

      if (runStatus.status === "completed") {
        console.log("✅ Run completed successfully");
        return runStatus;
      }

      if (runStatus.status === "failed" || runStatus.status === "cancelled" || runStatus.status === "expired") {
        console.error("❌ Run failed with status:", runStatus.status);
        throw new Error(`Assistant run ${runStatus.status}. Status: ${runStatus.status}`);
      }

      // Exponential backoff with jitter
      await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 100));
      delay = Math.min(delay * 1.5, maxDelay);
    } catch (error) {
      console.error("❌ Error in waitForRunCompletion:", error.message);
      console.error("❌ Full error details:", error);
      console.error("❌ Parameters at time of error:", { threadId: threadIdStr, runId: runIdStr });

      // Fallback to manual HTTP request if library call fails
      if (error.message.includes("Path parameters result in path with invalid segments")) {
        console.log("🔄 Attempting manual HTTP request to OpenAI API...");
        try {
          const response = await fetch(`https://api.openai.com/v1/threads/${threadIdStr}/runs/${runIdStr}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
              "Content-Type": "application/json",
              "OpenAI-Beta": "assistants=v2",
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Manual API request failed: ${JSON.stringify(errorData)}`);
          }

          const runStatus = await response.json();
          console.log("🔄 Run status (manual API call):", runStatus.status);

          if (runStatus.status === "completed") {
            console.log("✅ Run completed successfully via manual API call");
            return runStatus;
          }

          if (runStatus.status === "failed" || runStatus.status === "cancelled" || runStatus.status === "expired") {
            console.error("❌ Run failed with status (manual API call):", runStatus.status);
            throw new Error(`Assistant run ${runStatus.status}. Status: ${runStatus.status}`);
          }

          // If not completed, continue polling
          await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 100));
          delay = Math.min(delay * 1.5, maxDelay);
        } catch (manualError) {
          console.error("❌ Manual API request failed:", manualError.message);
          throw manualError;
        }
      } else {
        throw error;
      }
    }
  }

  console.error("❌ Run did not complete within max wait time:", maxWaitTime, "ms");
  throw new Error("Assistant run did not complete in time");
};

serve(async req => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Get request data - now expects thread_id which is the internal thread ID
    const { clinic_id, thread_id, openai_thread_id = null, message } = await req.json();
    console.log("📥 Incoming user message:", message);

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

    // PERFORMANCE IMPROVEMENT: Parallel data fetching
    console.log("🔍 Fetching assistant and thread data...");
    const [assistantData, threadData] = await Promise.all([
      getAssistantData(supabaseClient, clinic_id), // Uses caching
      supabaseClient
        .from("threads")
        .select("lead_id, lead:lead_id(first_name, last_name, email, phone, status, interest_level, urgency)")
        .eq("id", thread_id)
        .single(),
    ]);
    console.log("✅ Data fetching completed - Assistant ID:", assistantData.openai_assistant_id, "| Lead ID:", threadData.data?.lead_id);

    if (threadData.error || !threadData.data) {
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

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });
    let currentOpenaiThreadId = openai_thread_id;

    // If no OpenAI thread_id, create a new thread
    if (!currentOpenaiThreadId) {
      console.log("🆕 Creating new OpenAI thread...");
      const newThread = await openai.beta.threads.create();
      currentOpenaiThreadId = newThread.id;
      console.log("✅ New thread created:", currentOpenaiThreadId);
    } else {
      console.log("🔄 Using existing thread:", currentOpenaiThreadId);
    }

    // Debug: Verify thread ID before operations
    console.log("🔍 Thread ID before operations:", currentOpenaiThreadId, typeof currentOpenaiThreadId);

    if (!currentOpenaiThreadId || typeof currentOpenaiThreadId !== "string" || !currentOpenaiThreadId.startsWith("thread_")) {
      throw new Error(`Invalid thread ID: ${currentOpenaiThreadId} - must be a non-empty string starting with 'thread_'`);
    }

    // Add message to thread
    console.log("💬 Adding message to thread:", currentOpenaiThreadId);
    await openai.beta.threads.messages.create(currentOpenaiThreadId, {
      role: "user",
      content: message,
    });

    // Start the assistant run
    console.log("🚀 Starting assistant run on thread:", currentOpenaiThreadId);
    const run = await openai.beta.threads.runs.create(currentOpenaiThreadId, {
      assistant_id: assistantData.openai_assistant_id,
    });
    console.log("✅ Run initiated with ID:", run.id);

    // Wait for run completion
    console.log("🔍 Thread ID before run completion:", currentOpenaiThreadId, typeof currentOpenaiThreadId);
    const completedRun = await waitForRunCompletion(openai, currentOpenaiThreadId, run.id);
    console.log("✅ Run completed with status:", completedRun.status);

    // PERFORMANCE IMPROVEMENT: Limit message retrieval and use more efficient filtering
    console.log("📨 Retrieving assistant messages...");
    const messages = await openai.beta.threads.messages.list(currentOpenaiThreadId, {
      limit: 10, // Limit to reduce data transfer
      order: "desc",
    });

    // Get the latest assistant message
    const latestMessage = messages.data.find(msg => msg.role === "assistant");
    console.log("📥 Retrieved", messages.data.length, "messages, found assistant message:", !!latestMessage);

    if (!latestMessage) {
      return new Response(
        JSON.stringify({
          error: "No assistant response found",
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

    // Format the message content - YOUR EXACT ORIGINAL LOGIC
    const messageContent = latestMessage.content
      .map(content => {
        if (content.type === "text") {
          return content.text.value;
        }
        return null;
      })
      .filter(Boolean)
      .join("\n");

    // 🔍 LOG THE RAW ASSISTANT RESPONSE HERE - YOUR EXACT LOGGING
    console.log("🤖 RAW ASSISTANT RESPONSE:", messageContent);
    console.log("📏 Response length:", messageContent.length);
    console.log("🔤 Response preview (first 200 chars):", messageContent.substring(0, 200));

    // Check if it contains the old format - YOUR EXACT CHECKS
    if (messageContent.includes("[STATUS_UPDATE:")) {
      console.warn("🚨 DETECTED OLD FORMAT: [STATUS_UPDATE:] found in response!");
    }

    // Check if it contains the new format - YOUR EXACT CHECKS
    if (messageContent.includes("[LEAD_ASSESSMENT]")) {
      console.log("✅ NEW FORMAT DETECTED: [LEAD_ASSESSMENT] found in response!");
    } else {
      console.warn("❌ NEW FORMAT NOT FOUND: No [LEAD_ASSESSMENT] block detected!");
    }

    // Parse lead assessment from the AI response - YOUR EXACT FUNCTION
    const assessmentData = parseLeadAssessment(messageContent);

    // Use the clean message (without assessment block) for the response
    const cleanMessage = assessmentData.cleanMessage;

    // Update lead status asynchronously (non-blocking) - YOUR EXACT LOGIC
    queueMicrotask(() => {
      updateLeadStatusAsync(supabaseClient, threadData.data.lead_id, assessmentData);
    });

    console.log(
      "📤 Sending final response - Clean message length:",
      cleanMessage.length,
      "| Assessment valid:",
      assessmentData.hasValidAssessment,
    );
    return new Response(
      JSON.stringify({
        openai_thread_id: currentOpenaiThreadId,
        message: cleanMessage,
        role: "assistant",
        run_id: run.id,
        // Include assessment data for frontend if needed - YOUR EXACT RESPONSE FORMAT
        lead_assessment: {
          status: assessmentData.status,
          interest_level: assessmentData.interest_level,
          urgency: assessmentData.urgency,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
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
