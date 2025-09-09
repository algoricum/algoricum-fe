// supabase/functions/email-processor/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import {
  generateAIResponse,
  saveAIResponseToConversation,
  type ClinicData,
  type GenerateAIResponseOptions,
  type LeadData,
} from "../_shared/reply-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface QueueMessage {
  id: string;
  webhookData: any;
  timestamp: string;
  attempts: number;
  maxAttempts: number;
  priority: number;
}

serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("🔄 Email processor started");
  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing environment variables",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Process one message from the queue
    const result = await processQueueBatch(supabaseClient);

    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Processor completed in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Queue processing completed",
        data: result,
        processing_time_ms: processingTime,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("❌ Processor error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processing_time_ms: processingTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function processQueueBatch(supabaseClient: any) {
  const results = {
    processed: 0,
    failed: 0,
    skipped: 0,
    queue_empty: false,
  };

  try {
    // Read one message from the queue (30 second visibility timeout)
    console.log("📥 Reading from email_processing queue...");

    const { data: messages, error } = await supabaseClient.rpc("read_email_from_queue", {
      queue_name: "email_processing",
      visibility_timeout: 30,
    });

    if (error) {
      console.error("❌ Error reading from queue:", error);
      results.failed = 1;
      return results;
    }

    if (!messages || messages.length === 0) {
      console.log("📭 Queue is empty");
      results.queue_empty = true;
      return results;
    }

    // Process the first message
    const queueMessage = messages[0];
    console.log(`📧 Processing message ${queueMessage.msg_id} (job ${queueMessage.message.id})`);

    // IMMEDIATELY DELETE MESSAGE FROM QUEUE AFTER READING
    console.log(`🗑️ Removing message ${queueMessage.msg_id} from queue immediately...`);
    const { error: deleteError } = await supabaseClient.rpc("delete_email_from_queue", {
      queue_name: "email_processing",
      msg_id: queueMessage.msg_id,
    });

    if (deleteError) {
      console.error("❌ Error deleting message from queue:", deleteError);
      results.failed = 1;
      return results;
    }

    console.log(`✅ Message ${queueMessage.msg_id} removed from queue`);

    // Process the email job (message already removed from main queue)
    try {
      const success = await processEmailJob(queueMessage, supabaseClient);

      if (success) {
        console.log(`✅ Message ${queueMessage.msg_id} processed successfully`);
        results.processed = 1;
      } else {
        throw new Error("Email processing returned false");
      }
    } catch (processingError) {
      console.error(`❌ Processing failed for message ${queueMessage.msg_id}:`, processingError);

      // Store in DLQ with detailed error info for investigation/manual retry
      const jobMessage = queueMessage.message as QueueMessage;
      jobMessage.attempts = (jobMessage.attempts || 0) + 1;

      await supabaseClient.rpc("send_email_to_queue", {
        queue_name: "email_processing_dlq",
        message: {
          ...jobMessage,
          failed_at: new Date().toISOString(),
          failure_reason: processingError.message,
          error_details: processingError.stack,
          original_msg_id: queueMessage.msg_id,
        },
      });

      results.failed = 1;
    }

    return results;
  } catch (error) {
    console.error("❌ Error in batch processing:", error);
    results.failed = 1;
    return results;
  }
}

async function processEmailJob(queueMessage: any, supabaseClient: any): Promise<boolean> {
  try {
    const jobData = queueMessage.message as QueueMessage;
    const webhookData = jobData.webhookData;

    console.log(`🔧 Processing email from ${webhookData.sender} to ${webhookData.recipient}`);

    // Use your existing processEmailReply function
    const result = await processEmailReply(webhookData, supabaseClient);

    if (result.success) {
      console.log(`✅ Email processed successfully: ${result.message}`);
      return true;
    } else {
      console.error(`❌ Email processing failed: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing email job:`, error);
    return false;
  }
}

// Your existing processEmailReply function (unchanged)
async function processEmailReply(webhookData: any, supabaseClient: any): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const senderEmail = webhookData.sender;
    const recipientEmail = webhookData.recipient;
    const messageBody = webhookData["body-plain"] || "";
    const subject = webhookData.subject || "";
    const timestamp = webhookData.timestamp;
    const messageId = webhookData["Message-Id"];

    if (!senderEmail || !messageBody || !recipientEmail) {
      return {
        success: false,
        message: "Missing required email data",
      };
    }

    console.log(`Processing reply from: ${senderEmail} to: ${recipientEmail}`);

    // Find the clinic by matching recipient email to mailgun_email
    const { data: clinicData, error: clinicError } = await supabaseClient
      .from("clinic")
      .select("id, name, mailgun_email")
      .eq("mailgun_email", recipientEmail.toLowerCase())
      .limit(1)
      .single();

    if (clinicError || !clinicData) {
      console.error("❌ Error finding clinic:", clinicError);
      return {
        success: false,
        message: `No clinic found for recipient email: ${recipientEmail}`,
      };
    }

    console.log(`✅ Found clinic: ${clinicData.id} - ${clinicData.name}`);

    // Check if sender email exists in lead table for this clinic
    const { data: existingLead, error: leadError } = await supabaseClient
      .from("lead")
      .select("id, email, first_name, last_name, status, clinic_id")
      .eq("email", senderEmail.toLowerCase())
      .eq("clinic_id", clinicData.id)
      .single();

    let leadData = existingLead;

    if (leadError && leadError.code !== "PGRST116") {
      console.error("❌ Error checking lead:", leadError);
      return {
        success: false,
        message: "Database error while checking lead",
      };
    }

    if (!leadData) {
      console.log(`⚠️ No lead found for email: ${senderEmail}`);
      console.log("🆕 Creating new lead for incoming email...");

      // Find or create default source for email leads
      let defaultSourceId: string;

      //This will not work as there will be no email column in lead_source
      const { data: existingSource } = await supabaseClient.from("lead_source").select("id").eq("name", "Email").limit(1).single();

      if (existingSource) {
        defaultSourceId = existingSource.id;
      } else {
        // Client requirement don't put name = Email Inbound
        const { data: newSource, error: createSourceError } = await supabaseClient
          .from("lead_source")
          .insert({
            name: "Email Inbound",
            description: "Leads created from inbound emails",
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (createSourceError) {
          console.error("❌ Error creating default source:", createSourceError);
          return {
            success: false,
            message: "Failed to create default lead source",
          };
        }

        defaultSourceId = newSource.id;
      }

      // Extract name from email
      const emailPrefix = senderEmail.split("@")[0];
      const nameFromEmail = emailPrefix.replace(/[._-]/g, " ").split(" ");

      const newLeadData = {
        email: senderEmail.toLowerCase(),
        first_name: nameFromEmail[0] || emailPrefix,
        last_name: nameFromEmail.length > 1 ? nameFromEmail.slice(1).join(" ") : null,
        clinic_id: clinicData.id,
        source_id: defaultSourceId,
        status: "New",
        interest_level: null,
        urgency: null,
        notes: `Auto-created from inbound email: ${subject}\n\nEmail content:\n${messageBody}`,
        form_data: { auto_created: true, from_email: true, initial_subject: subject },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: createdLead, error: createLeadError } = await supabaseClient
        .from("lead")
        .insert(newLeadData)
        .select("id, email, first_name, last_name, status, clinic_id")
        .single();

      if (createLeadError) {
        console.error("❌ Error creating new lead:", createLeadError);
        return {
          success: false,
          message: "Failed to create new lead",
        };
      }

      leadData = createdLead;
      console.log(`✅ Created new lead: ${leadData.id}`);

      // For new leads, just return success without creating conversation thread
      return {
        success: true,
        message: "New lead created successfully from email",
        data: {
          lead_id: leadData.id,
          clinic_id: clinicData.id,
          sender: senderEmail,
          lead_created: true,
          action: "lead_created_only",
        },
      };
    } else {
      console.log(`✅ Found existing lead: ${leadData.id}`);
    }

    // Check if this is a reply to a previous email
    const isReply = subject.toLowerCase().includes("re:") || webhookData["In-Reply-To"] || webhookData.References;

    // Find or create thread
    let threadId: string;

    if (isReply) {
      // Try to find existing thread
      const { data: existingThread } = await supabaseClient
        .from("conversation")
        .select("thread_id")
        .or(`email_message_id.eq.${webhookData["In-Reply-To"]},` + `email_message_id.in.(${webhookData.References?.split(" ").join(",")})`)
        .limit(1)
        .single();

      if (existingThread) {
        threadId = existingThread.thread_id;
      } else {
        // Create new thread
        const { data: newThread, error: threadError } = await supabaseClient
          .from("threads")
          .insert({
            lead_id: leadData.id,
            clinic_id: clinicData.id,
            status: "new",
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (threadError) {
          return {
            success: false,
            message: "Failed to create conversation thread",
          };
        }
        threadId = newThread.id;
      }
    } else {
      // Create new thread for new conversation
      const { data: newThread, error: threadError } = await supabaseClient
        .from("threads")
        .insert({
          lead_id: leadData.id,
          clinic_id: clinicData.id,
          status: "new",
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (threadError) {
        return {
          success: false,
          message: "Failed to create conversation thread",
        };
      }
      threadId = newThread.id;
    }

    // Save conversation record
    const conversationData = {
      thread_id: threadId,
      message: messageBody,
      timestamp: timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString(),
      is_from_user: false,
      sender_type: "lead",
      email_message_id: messageId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: conversationRecord, error: conversationError } = await supabaseClient
      .from("conversation")
      .insert(conversationData)
      .select()
      .single();

    if (conversationError) {
      return {
        success: false,
        message: "Failed to save conversation record",
      };
    }

    // Generate and send AI response
    console.log("🤖 Generating AI response...");
    const aiResponse = await generateAIResponse(
      leadData as LeadData,
      {
        messageBody: messageBody,
        subject: subject,
        threadId: threadId,
        callerService: "test-email-connection",
      } as GenerateAIResponseOptions,
      supabaseClient,
      clinicData as ClinicData,
    );

    if (aiResponse.success) {
      console.log("📧 Sending AI response via email...");
      const emailSent = await sendEmailResponse(
        senderEmail,
        recipientEmail,
        subject,
        aiResponse.response,
        conversationRecord.id,
        leadData,
        clinicData,
      );

      if (emailSent.success) {
        console.log("💾 Saving AI response to conversation...");
        await saveAIResponseToConversation(threadId, aiResponse.response, emailSent.messageId, supabaseClient);
      }
    }

    // Update lead's updated_at timestamp
    await supabaseClient
      .from("lead")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadData.id);

    return {
      success: true,
      message: "Reply processed and AI response sent successfully",
      data: {
        lead_id: leadData.id,
        conversation_id: conversationRecord.id,
        thread_id: threadId,
        clinic_id: clinicData.id,
        sender: senderEmail,
        lead_created: false,
        action: "conversation_created",
        ai_response_sent: aiResponse?.success || false,
      },
    };
  } catch (error) {
    console.error("Error processing email reply:", error);
    return {
      success: false,
      message: "Internal processing error: " + error.message,
    };
  }
}

// Your existing email sending function (unchanged)
async function sendEmailResponse(
  toEmail: string,
  fromEmail: string,
  originalSubject: string,
  responseMessage: string,
  conversationId: string,
  leadData?: any,
  clinicData?: any,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log("📧 Sending email via Mailgun...");

    const mailgunApiKey = Deno.env.get("MAILGUN_API_KEY");
    const mailgunDomain = Deno.env.get("MAILGUN_BASE_DOMAIN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    if (!mailgunApiKey || !mailgunDomain) {
      console.error("❌ Mailgun credentials not found");
      return { success: false, error: "Mailgun credentials not configured" };
    }

    const replySubject = originalSubject.toLowerCase().startsWith("re:") ? originalSubject : `Re: ${originalSubject}`;

    // Clean up response message - remove subject if it appears in body
    let cleanedMessage = responseMessage;
    if (cleanedMessage.toLowerCase().includes("subject:")) {
      cleanedMessage = cleanedMessage.replace(/^subject:.*?\n\n?/i, "").trim();
    }

    // Remove unwanted closing signatures and dynamic clinic name
    const clinicName = clinicData?.name || "";
    cleanedMessage = cleanedMessage
      .replace(/Looking forward to hearing from you!?\s*$/gi, "")
      .replace(/Looking forward to helping you.*?\s*$/gi, "")
      .replace(/Best,?\s*$/gi, "")
      .replace(/Sincerely,?\s*$/gi, "")
      .replace(/Best regards,?\s*$/gi, "")
      .trim();

    // Remove clinic name dynamically if it appears at the end
    if (clinicName) {
      const clinicNameRegex = new RegExp(`\\s*${clinicName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "gi");
      const clinicNameNewLineRegex = new RegExp(`\\n\\s*${clinicName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "gi");
      cleanedMessage = cleanedMessage.replace(clinicNameRegex, "").replace(clinicNameNewLineRegex, "");
    }

    // Remove any manual unsubscribe footer if AI included it
    cleanedMessage = cleanedMessage
      .replace(
        /\s*You're receiving this because you showed interest in our services\.\s*Not interested anymore\? Unsubscribe here\s*$/gi,
        "",
      )
      .trim();

    // Create professional HTML email template (same as nurturing-service.ts)
    const primaryColor = "#2563eb";
    const clinicDisplayName = clinicName || "Our Clinic";
    const logo_url =
      "https://ozmytbghfvrfhbjvabor.supabase.co/storage/v1/object/public/clinic-logos/39d699cb-f712-431c-ba38-9e718310e2bb-iy9cs5ln.png";

    const logoSection = logo_url
      ? `<img src="${logo_url}" alt="${clinicDisplayName} Logo" style="max-height: 60px; margin-bottom: 30px; display: block;">`
      : `<h1 style="color: ${primaryColor}; font-size: 28px; font-weight: bold; margin: 0 0 30px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${clinicDisplayName}</h1>`;

    // Convert message to HTML
    const contentBody = cleanedMessage.replace(/\n/g, "<br>");

    const professionalHtmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${replySubject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header with Logo -->
                        <tr>
                            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                                ${logoSection}
                            </td>
                        </tr>
                        
                        <!-- Main Content -->
                        <tr>
                            <td style="padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 16px; color: #334155;">
                                ${contentBody}
                            </td>
                        </tr>
                        
                        <!-- Contact Information -->
                        <tr>
                            <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                        <td style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #64748b; text-align: center;">
                                            <strong style="color: ${primaryColor}; font-size: 16px; display: block; margin-bottom: 10px;">${clinicDisplayName}</strong>
                                            ${clinicData?.address ? `<div style="margin-bottom: 8px;">${clinicData.address}</div>` : ""}
                                            ${clinicData?.phone ? `<div style="margin-bottom: 8px;">Phone: <a href="tel:${clinicData.phone}" style="color: ${primaryColor}; text-decoration: none;">${clinicData.phone}</a></div>` : ""}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Unsubscribe Footer -->
                        ${
                          leadData?.id && SUPABASE_URL
                            ? `
                        <tr>
                            <td style="padding: 20px 40px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; text-align: center;">
                                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #94a3b8;">
                                    <p style="margin: 0 0 10px 0;">You're receiving this because you showed interest in our services.</p>
                                    <p style="margin: 0;">
                                        Not interested anymore? 
                                        <a href="${SUPABASE_URL}/functions/v1/unsubscribe-lead?lead_id=${leadData.id}&clinic_id=${clinicData?.id}" 
                                           style="color: #64748b; text-decoration: underline;">
                                            Unsubscribe here
                                        </a>
                                    </p>
                                </div>
                            </td>
                        </tr>
                        `
                            : ""
                        }
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    const formData = new FormData();
    formData.append("from", fromEmail);
    formData.append("to", toEmail);
    formData.append("subject", replySubject);
    formData.append("text", cleanedMessage);
    formData.append("html", professionalHtmlTemplate);
    formData.append("h:X-Conversation-ID", conversationId);

    const response = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Mailgun API error:", response.status, errorText);
      return { success: false, error: "Failed to send email via Mailgun" };
    }

    const result = await response.json();
    console.log("✅ Email sent successfully via Mailgun");

    return {
      success: true,
      messageId: result.id,
    };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { success: false, error: error.message };
  }
}
