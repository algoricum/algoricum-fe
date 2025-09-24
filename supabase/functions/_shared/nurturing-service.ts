// _shared/nurturing-service.ts

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");

interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  email?: string;
  status: string;
  source_id: string;
  clinic_id: string;
  notes?: string;
  interest_level: string;
  urgency: string;
  created_at: string;
  updated_at: string;
}

interface Conversation {
  id?: string;
  thread_id: string;
  message: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
  is_from_user: boolean;
  sender_type: "user" | "assistant";
}

interface Clinic {
  id: string;
  name: string;
  mailgun_domain?: string;
  mailgun_email?: string;
  calendly_link?: string;
  clinic_type?: string;
  twilio_config?: Array<{
    twilio_account_sid: string;
    twilio_auth_token: string;
    twilio_phone_number: string;
    status: string;
  }>;
  assistants?: Array<{
    assistant_name?: string;
    instructions?: string;
  }>;
}

interface FollowUpRule {
  name: string;
  timeFromCreated: number; // milliseconds
  maxTimeFromCreated?: number; // milliseconds
  leadStatus?: string[]; // which lead statuses to target
  communicationType: "sms" | "email";
  onlyOnce: boolean;
  checkLastActivity?: boolean;
  toleranceWindow?: number; // For demo version scheduling
}

interface ProcessingResult {
  leadId: string;
  action: "sent" | "skipped" | "error";
  reason: string;
  followUpType: string;
  communicationType: "sms" | "email";
  error?: string;
}

// Enhanced logging
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] SHARED: ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] SHARED ERROR: ${message}`, error);
}

async function processAllLeads(supabase: any, communicationType?: "sms" | "email", followUpRules?: FollowUpRule[], clinicIds?: string[]) {
  logInfo(`=== Starting processAllLeads - Type: ${communicationType || "all"} ===`);
  logInfo(`Clinic filter: ${clinicIds ? `${clinicIds.length} specific clinics` : "all clinics"}`);

  const allResults: ProcessingResult[] = [];
  let totalProcessed = 0;
  let totalErrors = 0;

  try {
    // Get clinics with their settings - filter by clinicIds if provided
    let clinicQuery = supabase.from("clinic").select(`
        id,
        name,
        mailgun_domain,
        mailgun_email,
        calendly_link,
        clinic_type,
        twilio_config(
          twilio_account_sid,
          twilio_auth_token,
          twilio_phone_number,
          status
        ),
        assistants(*)
      `);

    // Apply clinic filter if provided
    if (clinicIds && clinicIds.length > 0) {
      clinicQuery = clinicQuery.in("id", clinicIds);
    }

    const { data: clinics, error: clinicError } = await clinicQuery;

    if (clinicError) {
      logError("Failed to fetch clinics", clinicError);
      return {
        success: false,
        error: "Failed to fetch clinics",
        results: [],
        summary: { sent: 0, skipped: 0, errors: 1 },
      };
    }

    if (!clinics || clinics.length === 0) {
      logInfo("No clinics found");
      return {
        success: true,
        results: [],
        summary: { sent: 0, skipped: 0, errors: 0 },
      };
    }

    logInfo(`Processing ${clinics.length} clinics`);

    // Process each clinic independently - errors in one don't affect others
    for (const clinic of clinics) {
      try {
        logInfo(`Processing clinic: ${clinic.name} (${clinic.id})`);

        // Get leads for this clinic
        const leads = await getLeadsForClinic(clinic.id, supabase, communicationType);

        if (leads.length === 0) {
          logInfo(`No leads found for clinic ${clinic.name}`);
          continue;
        }

        logInfo(`Found ${leads.length} leads for clinic ${clinic.name}`);

        // Process each lead
        for (const lead of leads) {
          try {
            const leadResults = await processLeadForClinic(lead, clinic, supabase, followUpRules);
            allResults.push(...leadResults);
            totalProcessed++;
          } catch (leadError) {
            logError(`Error processing lead ${lead.id}`, leadError);
            totalErrors++;
            allResults.push({
              leadId: lead.id,
              action: "error",
              reason: "Lead processing failed",
              followUpType: "unknown",
              communicationType: communicationType || "any",
              error: leadError.message,
            });
          }
        }
      } catch (clinicError) {
        logError(`Error processing clinic ${clinic.id}`, clinicError);
        totalErrors++;
        // Continue with next clinic - don't let one clinic's error stop everything
      }
    }

    // Calculate final summary
    const summary = {
      sent: allResults.filter(r => r.action === "sent").length,
      skipped: allResults.filter(r => r.action === "skipped").length,
      errors: allResults.filter(r => r.action === "error").length,
    };

    logInfo(`Processing completed: ${totalProcessed} leads processed, ${totalErrors} lead errors`);
    logInfo("Final summary", summary);

    return {
      success: true,
      results: allResults,
      summary,
      totalLeads: totalProcessed,
    };
  } catch (error: any) {
    logError("Error in processAllLeads", error);
    return {
      success: false,
      error: error.message,
      results: allResults,
      summary: { sent: 0, skipped: 0, errors: 1 },
    };
  }
}

// Get leads for a specific clinic
async function getLeadsForClinic(clinicId: string, supabase: any, communicationType?: "sms" | "email"): Promise<Lead[]> {
  try {
    let leadQuery = supabase.from("lead").select("*").eq("clinic_id", clinicId);

    // Filter by communication requirements
    if (communicationType === "sms") {
      leadQuery = leadQuery.not("phone", "is", null).neq("phone", "");
    } else if (communicationType === "email") {
      leadQuery = leadQuery.not("email", "is", null).neq("email", "");
    } else {
      // Need either phone or email
      leadQuery = leadQuery.or("phone.not.is.null,email.not.is.null");
    }

    const { data: leads, error } = await leadQuery;

    if (error) {
      logError(`Error fetching leads for clinic ${clinicId}`, error);
      return [];
    }

    return leads || [];
  } catch (error) {
    logError(`Error in getLeadsForClinic for ${clinicId}`, error);
    return [];
  }
}

async function processLeadForClinic(
  lead: Lead,
  clinic: Clinic,
  supabase: any,
  followUpRules?: FollowUpRule[],
): Promise<ProcessingResult[]> {
  const results: ProcessingResult[] = [];

  try {
    // Get applicable follow-up rules for this lead
    const applicableRules = await determineFollowUpsForLead(lead, supabase, followUpRules);

    if (applicableRules.length === 0) {
      return [
        {
          leadId: lead.id,
          action: "skipped",
          reason: "No applicable follow-up rules",
          followUpType: "none",
          communicationType: "any",
        },
      ];
    }

    // Check clinic capabilities
    const hasSMS = clinic.twilio_config && clinic.twilio_config.length > 0 && clinic.twilio_config[0]?.status === "active";

    const hasEmail = clinic.mailgun_domain && clinic.mailgun_email;

    // Process each rule
    for (const rule of applicableRules) {
      try {
        // Check clinic capabilities for this communication type
        if (rule.communicationType === "sms" && !hasSMS) {
          results.push({
            leadId: lead.id,
            action: "skipped",
            reason: "Clinic SMS not configured",
            followUpType: rule.name,
            communicationType: rule.communicationType,
          });
          continue;
        }

        if (rule.communicationType === "email" && !hasEmail) {
          results.push({
            leadId: lead.id,
            action: "skipped",
            reason: "Clinic email not configured",
            followUpType: rule.name,
            communicationType: rule.communicationType,
          });
          continue;
        }

        // Check lead has required contact info
        const hasRequiredContact = (rule.communicationType === "sms" && lead.phone) || (rule.communicationType === "email" && lead.email);

        if (!hasRequiredContact) {
          results.push({
            leadId: lead.id,
            action: "skipped",
            reason: `Lead missing ${rule.communicationType} contact`,
            followUpType: rule.name,
            communicationType: rule.communicationType,
          });
          continue;
        }

        // Process this rule
        const result = await processRuleForLead(lead, clinic, rule, supabase);
        results.push(result);
      } catch (ruleError) {
        logError(`Error processing rule ${rule.name} for lead ${lead.id}`, ruleError);
        results.push({
          leadId: lead.id,
          action: "error",
          reason: `Rule processing failed: ${ruleError.message}`,
          followUpType: rule.name,
          communicationType: rule.communicationType,
          error: ruleError.message,
        });
      }
    }
  } catch (error) {
    logError(`Error in processLeadForClinic for lead ${lead.id}`, error);
    results.push({
      leadId: lead.id,
      action: "error",
      reason: "Lead processing exception",
      followUpType: "unknown",
      communicationType: "any",
      error: error.message,
    });
  }

  return results;
}

async function processRuleForLead(lead: Lead, clinic: Clinic, rule: FollowUpRule, supabase: any): Promise<ProcessingResult> {
  try {
    // Get or create thread
    const threadId = await getOrCreateThread(lead, supabase);
    if (!threadId) {
      return {
        leadId: lead.id,
        action: "error",
        reason: "Failed to create thread",
        followUpType: rule.name,
        communicationType: rule.communicationType,
      };
    }

    // Get conversation history
    const conversationHistory = await getConversationHistory(threadId, supabase);

    // Generate message
    const messageContent = await generateIntelligentResponse(lead, clinic, conversationHistory, rule.communicationType === "email", rule);

    // Send message
    const sendResult = await sendMessage(lead, clinic, rule, messageContent, supabase);

    if (sendResult.success) {
      // Save to history
      await saveMessageToHistory(threadId, messageContent, rule.name, supabase);

      // Update lead status from "New" to "Engaged" for the first SMS rule only
      if (rule.name === "sms_5min_initial" && lead.status === "New") {
        try {
          await supabase
            .from("lead")
            .update({
              status: "Engaged",
              updated_at: new Date().toISOString(),
            })
            .eq("id", lead.id);

          logInfo(`Updated lead ${lead.id} status from "New" to "Engaged" after first SMS`);
        } catch (statusError) {
          logError(`Failed to update lead ${lead.id} status to "Engaged"`, statusError);
        }
      }

      return {
        leadId: lead.id,
        action: "sent",
        reason: `Successfully sent ${rule.name}`,
        followUpType: rule.name,
        communicationType: rule.communicationType,
      };
    } else {
      return {
        leadId: lead.id,
        action: "error",
        reason: `Send failed: ${sendResult.error}`,
        followUpType: rule.name,
        communicationType: rule.communicationType,
        error: sendResult.error,
      };
    }
  } catch (error) {
    return {
      leadId: lead.id,
      action: "error",
      reason: `Rule processing exception: ${error.message}`,
      followUpType: rule.name,
      communicationType: rule.communicationType,
      error: error.message,
    };
  }
}

async function determineFollowUpsForLead(lead: Lead, supabase: any, followUpRules?: FollowUpRule[]): Promise<FollowUpRule[]> {
  if (!followUpRules || followUpRules.length === 0) {
    return [];
  }

  if (lead.status === "Booked" || lead.status === "Cold" || lead.status === "Converted") {
    logInfo(`Lead ${lead.id}: Skipping follow-ups - status is "${lead.status}", only "Engaged" leads are valid for follow-ups`);
    return [];
  }

  const now = new Date();
  const leadCreatedAt = new Date(lead.created_at);
  const timeSinceCreated = now.getTime() - leadCreatedAt.getTime();

  // Sort rules by time ascending
  const sortedRules = followUpRules.sort((a, b) => a.timeFromCreated - b.timeFromCreated);

  logInfo(
    `Checking follow-ups for lead ${lead.id}, age: ${Math.round(timeSinceCreated / (24 * 60 * 60 * 1000))} days (${Math.round(timeSinceCreated / 1000)}s)`,
  );

  // Find the NEXT due follow-up (not all overdue ones)
  for (const rule of sortedRules) {
    // Check if enough time has passed since lead creation
    if (timeSinceCreated < rule.timeFromCreated) {
      logInfo(
        `Lead ${lead.id}: ${rule.name} not due yet (need ${Math.round(rule.timeFromCreated / 1000)}s, lead age: ${Math.round(timeSinceCreated / 1000)}s)`,
      );
      continue;
    }

    // Check if too much time has passed (if rule has max time)
    if (rule.maxTimeFromCreated && timeSinceCreated > rule.maxTimeFromCreated) {
      logInfo(`Lead ${lead.id}: ${rule.name} expired (max ${Math.round(rule.maxTimeFromCreated / (24 * 60 * 60 * 1000))} days)`);
      continue;
    }

    // Check if lead status matches (if rule specifies status requirements)
    if (rule.leadStatus && !rule.leadStatus.includes(lead.status)) {
      logInfo(`Lead ${lead.id}: ${rule.name} skipped due to status (${lead.status})`);
      continue;
    }

    // Skip SMS nurturing for "Responded" leads (but allow emails)
    if (lead.status === "Responded" && rule.communicationType === "sms") {
      logInfo(`Lead ${lead.id}: Skipping SMS rule ${rule.name} - lead has "Responded" status (emails still allowed)`);
      continue;
    }

    // Check if this follow-up has already been sent
    if (rule.onlyOnce && (await hasFollowUpBeenSent(lead.id, rule.name, supabase))) {
      logInfo(`Lead ${lead.id}: ${rule.name} already sent`);
      continue;
    }

    // Check if user has replied after last assistant message
    if (rule.checkLastActivity && (await hasUserRepliedToLastAssistantMessage(lead.id, supabase))) {
      logInfo(`Lead ${lead.id}: ${rule.name} skipped - user already replied`);
      continue;
    }

    // This is the NEXT due follow-up - return only this one
    logInfo(`Lead ${lead.id}: Found next due follow-up: ${rule.name}`);
    return [rule];
  }

  logInfo(`Lead ${lead.id}: No applicable follow-ups found`);
  return [];
}

async function hasFollowUpBeenSent(leadId: string, followUpName: string, supabase: any): Promise<boolean> {
  try {
    // Get thread for this lead
    const { data: thread } = await supabase.from("threads").select("id").eq("lead_id", leadId).single();

    if (!thread) return false;

    const searchPatterns = [`%${followUpName}%`, `%${followUpName.toUpperCase()}%`, `%${followUpName.toLowerCase()}%`];

    for (const pattern of searchPatterns) {
      const { data: conversations } = await supabase
        .from("conversation")
        .select("id, message")
        .eq("thread_id", thread.id)
        .eq("is_from_user", false)
        .eq("sender_type", "assistant")
        .ilike("message", pattern);

      if (conversations && conversations.length > 0) {
        logInfo(`Follow-up ${followUpName} already sent for lead ${leadId}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    logError(`Error checking if follow-up ${followUpName} was sent for lead ${leadId}`, error);
    return false; // If we can't check, assume it wasn't sent (safer for follow-ups)
  }
}

async function hasUserRepliedToLastAssistantMessage(leadId: string, supabase: any): Promise<boolean> {
  try {
    const { data: thread } = await supabase.from("threads").select("id").eq("lead_id", leadId).single();

    if (!thread) return false;

    // Get last assistant message
    const { data: lastAssistantMessage } = await supabase
      .from("conversation")
      .select("created_at")
      .eq("thread_id", thread.id)
      .eq("is_from_user", false)
      .eq("sender_type", "assistant")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!lastAssistantMessage) return false;

    // Check if there are user messages after the last assistant message
    const { data: userReplies } = await supabase
      .from("conversation")
      .select("id")
      .eq("thread_id", thread.id)
      .eq("is_from_user", true)
      .eq("sender_type", "user")
      .gt("created_at", lastAssistantMessage.created_at);

    return userReplies && userReplies.length > 0;
  } catch (error) {
    logError(`Error checking user replies for lead ${leadId}`, error);
    return false;
  }
}

async function getOrCreateThread(lead: Lead, supabase: any): Promise<string | null> {
  try {
    // Try to get existing thread
    const { data: existingThread } = await supabase
      .from("threads")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("clinic_id", lead.clinic_id)
      .single();

    if (existingThread) {
      return existingThread.id;
    }

    // Create new thread
    const { data: newThread, error: threadError } = await supabase
      .from("threads")
      .insert({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        status: "new",
      })
      .select("id")
      .single();

    if (threadError) {
      logError(`Error creating thread for lead ${lead.id}`, threadError);
      return null;
    }

    logInfo(`Created new thread ${newThread.id} for lead ${lead.id}`);
    return newThread.id;
  } catch (error) {
    logError(`Error in getOrCreateThread for lead ${lead.id}`, error);
    return null;
  }
}

async function getConversationHistory(threadId: string, supabase: any): Promise<Conversation[]> {
  try {
    const { data: conversations, error } = await supabase
      .from("conversation")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      logError(`Error fetching conversation history for thread ${threadId}`, error);
      return [];
    }

    return conversations || [];
  } catch (error) {
    logError(`Error in getConversationHistory for thread ${threadId}`, error);
    return [];
  }
}

async function generateIntelligentResponse(
  lead: Lead,
  clinic: Clinic,
  conversationHistory: Conversation[],
  isEmail: boolean = false,
  rule?: FollowUpRule,
): Promise<string | { subject: string; body: string }> {
  logInfo(`Generating intelligent response for lead ${lead.id} in clinic ${clinic.name}`);

  const openaiKey = OPENAI_API_KEY;
  const bookingLink = clinic.calendly_link;
  const unsubscribeLink = `${SUPABASE_URL}/functions/v1/unsubscribe-lead?lead_id=${lead.id}&clinic_id=${clinic.id}`;

  const bookingButton = isEmail
    ? `<a href="${bookingLink}" style="color: #10b981; text-decoration: none; font-weight: bold;">Let's schedule a quick chat!</a>`
    : `📅 Book here: ${bookingLink}`;

  // Only create unsubscribe elements for emails (NEVER for SMS per instructions)
  const unsubscribeButton = isEmail
    ? `<a href="${unsubscribeLink}" style="color: #6b7280; text-decoration: underline; font-weight: bold; font-size: 12px;">unsubscribe here</a>`
    : null;

  const unsubscribeFooter = isEmail
    ? `<br><br><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;"><div style="text-align: center; font-size: 12px; color: #6b7280;">If you no longer wish to receive these emails, you can ${unsubscribeButton}.</div>`
    : null;

  if (!openaiKey) {
    logInfo("No OpenAI API key found, using fallback message");
    const fallbackMessage = isEmail
      ? `Hey ${lead.first_name || "there"}, thanks for your interest in ${clinic.name}! Just wanted to check in - any questions I can help with?<br><br>Ready to take the next step? ${bookingButton}`
      : `Hey ${lead.first_name || "there"}, thanks for your interest in ${clinic.name}! Just wanted to check in - any questions I can help with?\n\n${bookingButton}`;

    if (isEmail) {
      return {
        subject: `Quick follow-up from ${clinic.name}`,
        body: `${fallbackMessage}${unsubscribeFooter}`,
      };
    }
    return `${fallbackMessage}\n\n${unsubscribeButton}`;
  }

  try {
    console.log("Clinics data:", JSON.stringify(clinic, null, 2));

    const conversationContext = conversationHistory
      .map(
        msg =>
          `${msg.sender_type === "user" ? `${lead.first_name || "Patient"}` : clinic.assistants?.[0]?.assistant_name || "Assistant"}: ${msg.message}`,
      )
      .join("\n");

    const isDemo = rule && rule.toleranceWindow !== undefined;

    const leadAge = rule
      ? parseInt(rule.name.match(/(\d+)day/)?.[1] || "0") || // Primary: extract from rule name
        (isDemo
          ? Math.floor(rule.timeFromCreated / (60 * 1000)) // Demo: minutes as days
          : Math.floor(rule.timeFromCreated / (24 * 60 * 60 * 1000))) || // Production: actual days
        1
      : 1;

    const assistantInstructions = clinic.assistants?.[0]?.instructions || "";

    let systemPrompt = "";
    let userPrompt = "";

    if (isEmail) {
      systemPrompt = `${assistantInstructions}

CRITICAL EMAIL FORMATTING RULES:
• **FOLLOW EXACT EMAIL TEMPLATES**: Use the story-driven, psychology-based email format from the provided 20-email nurture sequence examples
• **SUBJECT PATTERNS**: Create unique subjects like these examples:
  - "The [dollar amount/number] mistake that started a movement"
  - "Why we ignore problems that matter most"
  - "The [location/entity] with no [expected thing]"
  - "The myth of the 'perfect time'"
  - "The [effect/phenomenon] is weirder than you think"
  - "The woman/man who [action] and changed [outcome]"
  - "What [profession] know about [concept] that the rest of us don't"
  - "The lost art of [concept]"
  - "The [number]-minute rule for [action]"
  - "Lessons from [number] patient conversations"
• **EMAIL STRUCTURE**: Follow this exact storytelling pattern:
  1. Hook with specific story/example/statistic
  2. Build narrative with concrete details
  3. Reveal the lesson or principle
  4. Connect to broader human behavior/psychology
  5. Relate back to reader's situation
  6. Call to action
  7. P.S. with service offer
• **STORYTELLING ELEMENTS**: Include:
  - Corporate examples (J&J, Toyota, Fortune 500)
  - Medical/healthcare stories and research
  - Psychology studies and behavioral science
  - Historical examples with specific dates/names
  - Personal anecdotes from clinic experience
• **TONE**: Conversational, educational, story-driven, never pushy
• **FORMAT**: Natural paragraph flow, not forced short lines
• **PARAGRAPH LENGTH**: ABSOLUTE 20-word maximum - count EVERY word including "a", "the", "and". NO EXCEPTIONS. Split long sentences into multiple paragraphs rather than exceed 20 words.
• **SUBJECT LINE**: NEVER write "Subject:" in the subject line - write ONLY the subject text without any prefix
• Do NOT include "Subject:" prefix or clinic signatures
• Do NOT include unsubscribe text (system handles this automatically)
• Include booking links when appropriate for email follow-ups

BOOKING LINK FOR EMAILS:
${bookingLink ? `Available booking link: ${bookingLink}` : "No booking link configured"}
When including booking links in emails, use this HTML format:
<a href="${bookingLink}" style="color: #10b981; text-decoration: none; font-weight: bold;">Schedule your consultation</a>`;

      userPrompt = `Generate a follow-up email for ${lead.first_name || "this patient"} (${leadAge} days old) at ${clinic.name}.

Previous conversation:
${conversationContext || "No previous conversation - this is a follow-up email in our nurturing sequence."}

Patient Details:
- Name: ${lead.first_name || ""} ${lead.last_name || ""}
- Lead Age: ${leadAge} days
- Interest Level: ${lead.interest_level || "unknown"}
- Urgency: ${lead.urgency || "unknown"}
- Clinic Type: ${clinic.clinic_type || "healthcare"}

FOLLOW THESE EXACT EMAIL EXAMPLES FOR INSPIRATION:

**Day 21 Example**: "The $20 million mistake that started a movement" - J&J Tylenol story showing decisive action
**Day 24 Example**: "Why we ignore problems that matter most" - Psychology of urgency effect  
**Day 27 Example**: "The hospital with no waiting room" - Virginia Mason Medical Center innovation
**Day 30 Example**: "The myth of the 'perfect time'" - Present bias and cost of waiting
**Day 33 Example**: "The placebo effect is weirder than you think" - 2002 knee surgery study
**Day 36 Example**: "The woman who walked into a clinic and changed medicine" - Fanny Longfellow ether story
**Day 39 Example**: "What surgeons know about confidence" - Confidence through preparation
**Day 42 Example**: "The lost art of follow-through" - Duke habits research (45% of actions)
**Day 45 Example**: "The experiment that shocked psychologists" - Milgram authority study
**Day 50 Example**: "The 10-minute rule for doing anything hard" - Starting momentum technique
**Day 55 Example**: "Lessons from 1,000 patient conversations" - Three common myths
**Day 60 Example**: "The quiet cost of putting yourself last" - Self-care prioritization
**Day 70 Example**: "How billion-dollar companies make decisions fast" - Speed over perfection
**Day 80 Example**: "The psychology of momentum (and how to get it)" - Zeigarnik effect
**Day 90 Example**: "The 3 most common myths I hear in this clinic" - Patient misconceptions
**Day 100 Example**: "Are you still curious, or should I close your file?" - Direct final sequence
**Day 110 Example**: "The one-year challenge" - Long-term perspective mental exercise
**Day 115 Example**: "The invisible opportunity cost" - Hidden costs of inaction
**Day 118 Example**: "The best time to start (and it's not what you think)" - Tree planting proverb
**Day 120 Example**: "Before I stop bugging you..." - Final email sequence

GENERATE AN EMAIL FOLLOWING THIS PATTERN:
1. Create unique subject using patterns above (vary the hook completely) - NO "Subject:" prefix
2. Start with personalized greeting: "Hi ${lead.first_name || "there"},"
3. Begin with specific story, statistic, or historical example
4. Build narrative with concrete details (names, dates, numbers)
5. Extract the universal principle or psychology concept
6. Connect to human behavior and decision-making
7. Relate back to reader's ${clinic.clinic_type} situation
8. End with conversational call-to-action

CRITICAL FORMATTING REQUIREMENTS:
- Subject line: Write ONLY the text, never include "Subject:"
- Paragraphs: ABSOLUTE 20-word limit - count EVERY single word including "a", "the", "and"
- If a sentence is 25 words, split it into TWO paragraphs
- NO EXCEPTIONS to the 20-word rule - sacrifice sentence flow if needed
- Better to have short, choppy paragraphs than exceed 20 words
- Count words like this: "In(1) 1999(2), a(3) pivotal(4) study(5)..." and STOP at word 20
- Start each new paragraph on a NEW LINE with proper line breaks between them
- Do NOT combine multiple sentences into one paragraph block

MAKE IT COMPLETELY UNIQUE - USE DIVERSE STORY TYPES:
- Historical events: Wright brothers, Marie Curie, Alexander Fleming discoveries
- Psychology research: Stanford marshmallow test, Milgram experiments, cognitive biases
- Innovation breakthroughs: Post-it notes accident, Velcro invention, GPS development  
- Cultural shifts: How habits changed society, social movements, generational changes
- Scientific discoveries: Medical breakthroughs, unexpected findings, paradigm shifts
- Human behavior studies: Why people procrastinate, decision-making patterns, social psychology

SUBJECT LINE VARIATIONS:
- "The accidental discovery that changed everything"
- "Why 89% of people make this same mistake"  
- "What kindergarteners taught us about [topic]"
- "The 15-minute rule that transformed lives"
- "Before you decide, read this"

AVOID REPETITIVE PATTERNS:
- NEVER use "$X million lesson" or "$X cost" templates repeatedly  
- DON'T start with "In [year], [entity] faced..." every time
- AVOID corporate loss/cost stories if recently used
- ROTATE between: historical events, psychology studies, scientific discoveries, cultural phenomena, innovations
- COMPLETELY different opening hooks: questions, statistics, quotes, observations, scenarios
- VARY the lesson types: behavioral psychology, decision science, innovation stories, cultural shifts
- NO MORE than one "cost/loss" story per sequence

REMEMBER: End naturally without signatures, footers, or closing formalities. The system will add unsubscribe links automatically.

`;
    } else {
      // SMS responses - use specific patterns with new style guidelines
      systemPrompt = `You are a conversational assistant for ${clinic.name}. 

RESPONSE STYLE - BE ENGAGING:
• Sound like you're texting a friend - casual but knowledgeable
• Create gentle urgency without being pushy
• Use personality and light humor when appropriate
• Be direct and honest - cut through the fluff
• Make people feel like they're talking to a real person

AVOID FILLER PHRASES:
• Never use "just checking in", "wanted to", "just wanted to", "hope you're well"
• Skip pleasantries and get straight to the value/offer
• Be direct and purposeful in your communication
• Donot include dashes in the response 

CRITICAL: Generate responses inspired by the specific examples provided. Capture the tone, style, and approach.`;

      // Get specific patterns based on rule name
      let patternExamples = "";

      if (rule?.name === "sms_5min_initial") {
        patternExamples = `SMS 0 PATTERN EXAMPLES (Generate response inspired by these):
- "Hey ${lead.first_name}, this is ${clinic.assistants?.[0]?.assistant_name} at ${clinic.name}. Thanks for reaching out. I can hold a spot for some time this month. Would you like to move forward?"
- "Hey ${lead.first_name}, this is ${clinic.assistants?.[0]?.assistant_name} at ${clinic.name} I'd love to reserve a spot for you this month. Would you like me to hold one?"
- "Hey ${lead.first_name}, this is ${clinic.assistants?.[0]?.assistant_name} at ${clinic.name} We've got openings coming up soon, should I save one in your name?"
- "Hey ${lead.first_name}, this is ${clinic.assistants?.[0]?.assistant_name} at ${clinic.name} I can set aside some time this month just for you. Want to move forward?"
- "Hey ${lead.first_name}, this is ${clinic.assistants?.[0]?.assistant_name} at ${clinic.name} There's availability right now, and I'd be happy to secure it for you. Should I go ahead?"`;
      } else if (rule?.name === "sms_2day_followup") {
        patternExamples = `SMS 1 PATTERN EXAMPLES (Generate response inspired by these):
- "Hey ${lead.first_name}, Most people reach out, then stall. Want me to make it simple and send you two times to pick from?"
- "Hey ${lead.first_name}, A lot of people pause at this step, want me to make it easy and share two time options?"
- "Hey ${lead.first_name}, Most folks hesitate around this point. Would it help if I gave you two simple choices?"
- "Hey ${lead.first_name}, Sometimes the hardest part is choosing. Want me to narrow it down to two options for you?"
- "Hey ${lead.first_name}, Sometimes the next step feels unclear. Want me to make it easy and send two times for you to pick from?"`;
      } else if (rule?.name === "sms_5day_followup") {
        patternExamples = `SMS 2 PATTERN EXAMPLES (Generate response inspired by these):
- "Hey ${lead.first_name}, truth is, doing something is easier than overthinking it. Should I grab the next cancellation for you?"
- "Hey ${lead.first_name}, Honestly, action beats overthinking. Want me to lock in the next cancellation for you?"
- "Hey ${lead.first_name}, Doing is easier than delaying. Want me to reserve the next opening that comes up?"
- "Hey ${lead.first_name}, Overthinking slows things down. Want me to grab the next available spot for you?"
- "Hey ${lead.first_name}, No need to overthink, should I hold the next cancellation for you?"`;
      } else if (rule?.name === "sms_10day_followup") {
        patternExamples = `SMS 3 PATTERN EXAMPLES (Generate response inspired by these):
- "Hey ${lead.first_name}, You've done the thinking. The only gap now is action. Want me to hold a spot so it's off your plate?"
- "Hey ${lead.first_name}, You've thought it through. The only step left is action. Want me to lock in a spot for you?"
- "Hey ${lead.first_name}, The only thing missing is the next step. Want me to set aside a spot so it's handled?"
- "Hey ${lead.first_name}, You've already made the decision in your head. Want me to grab a spot so it's official?"
- "Hey ${lead.first_name}, You've covered the details. Now it's just action. Want me to secure a time for you?"`;
      } else if (rule?.name === "sms_20day_followup") {
        patternExamples = `SMS 4 PATTERN EXAMPLES (Generate response inspired by these):
- "Hey ${lead.first_name}, before email takes over, what's the one thing you need to feel this visit is worth it?"
- "Hey ${lead.first_name}, before we switch to email, what's the one thing that would make this visit feel worthwhile for you?"
- "Hey ${lead.first_name}, what's the one thing that would make this visit pay off for you?"
- "Hey ${lead.first_name}, before we continue, what's the one thing that would make this time feel well spent for you?"
- "Hey ${lead.first_name}, I'm curious, what's the single thing you'd need for this appointment to feel valuable?"`;
      }

      userPrompt = `Generate a follow-up SMS for ${lead.first_name || "this patient"} at ${clinic.name}.

${patternExamples}

Previous conversation:
${conversationContext || "No previous conversation - this is a follow-up SMS in our nurturing sequence."}

Patient Details:
- Name: ${lead.first_name || ""} ${lead.last_name || ""}
- Interest Level: ${lead.interest_level || "unknown"}
- Urgency: ${lead.urgency || "unknown"}

IMPORTANT: Generate a response that captures the same tone, style, and approach as the examples above. Sound casual but knowledgeable, create gentle urgency without being pushy, and make it feel like texting a friend.`;
    }

    logInfo("Calling OpenAI API for intelligent response generation");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: isEmail ? 500 : 150,
        temperature: 0.8,
      }),
    });

    logInfo("OpenAI API response status:", { status: response.status, statusText: response.statusText });

    if (response.ok) {
      const data = await response.json();
      logInfo("OpenAI API response data received");
      const generatedContent = data.choices[0]?.message?.content;

      logInfo("Generated content preview:", generatedContent?.substring(0, 200));

      if (generatedContent) {
        if (isEmail) {
          const lines = generatedContent.split("\n");
          let subject = "";
          let body = "";
          let foundSubject = false;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.toLowerCase().startsWith("subject:")) {
              subject = line.replace(/^subject:\s*/i, "").trim();
              subject = subject.replace(/^subject:\s*/i, "").trim();
              // Remove any markdown formatting like ** from subject
              subject = subject.replace(/^\*\*|\*\*$/g, "").trim();
              foundSubject = true;
            } else if (foundSubject && line.trim()) {
              if (line.toLowerCase().startsWith("subject:")) {
                continue;
              }
              // After finding subject, everything else is body content
              body += (body ? "\n" : "") + line;
            } else if (foundSubject && !line.trim() && body) {
              // Preserve empty lines within body content
              body += "\n";
            }
          }

          // Fallback: if no "Subject:" prefix found, treat first line as subject
          if (!subject && lines.length > 0) {
            subject = lines[0].trim();
            body = lines.slice(1).join("\n").trim();
          }

          body += `\n\n${unsubscribeFooter}`;
          const htmlBody = body.replace(/\n/g, "<br>");

          if (subject && htmlBody) {
            logInfo("Successfully generated intelligent email response via OpenAI");
            return { subject, body: htmlBody.trim() };
          }
        } else {
          const smsBody = generatedContent.trim();

          logInfo("Successfully generated intelligent SMS response via OpenAI");
          return smsBody;
        }
      }
    } else {
      const errorText = await response.text();
      logError("OpenAI API call failed", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
    }
  } catch (error) {
    logError("Error generating intelligent response with OpenAI", error);
  }

  logInfo("Using fallback intelligent response");

  if (isEmail) {
    const fallbackSubject = `Quick follow-up from ${clinic.name}`;
    const fallbackBody = `Hey ${lead.first_name || "there"},<br><br>Just wanted to check in - still thinking about ${clinic.clinic_type}, or do you have any questions I can help with?<br><br>Ready to take the next step? ${bookingButton}<br><br>Just reply if you want to talk!${unsubscribeFooter}`;

    return { subject: fallbackSubject, body: fallbackBody };
  } else {
    const smsMessage = `Hey ${lead.first_name || "there"}! Still curious about ${clinic.clinic_type} or should I circle back later? No pressure!`;

    return `${smsMessage}\n\n${bookingButton}\n${unsubscribeButton}`;
  }
}

async function sendMessage(
  lead: Lead,
  clinic: Clinic,
  rule: FollowUpRule,
  messageContent: string | { subject: string; body: string },
  supabase: any,
): Promise<{ success: boolean; error?: string }> {
  if (rule.communicationType === "sms") {
    if (typeof messageContent === "string") {
      return await sendSMS(lead.phone, messageContent, lead.clinic_id, supabase, clinic.twilio_config?.[0]);
    } else {
      return { success: false, error: "Invalid message format for SMS" };
    }
  } else {
    if (typeof messageContent === "object" && messageContent.subject && messageContent.body) {
      // Pass leadId to sendEmail for unsubscribe link
      return await sendEmail(
        lead.email!,
        messageContent.subject,
        messageContent.body,
        lead.clinic_id,
        supabase,
        undefined, // emailSettings
        lead.id, // leadId for unsubscribe link
      );
    } else {
      return { success: false, error: "Invalid message format for email" };
    }
  }
}

// Enhanced sendSMS function
async function sendSMS(
  toPhone: string,
  message: string,
  clinicId: string,
  supabase: any,
  twilioSettings?: any,
): Promise<{ success: boolean; error?: string }> {
  logInfo(`Attempting to send SMS to ${toPhone} for clinic ${clinicId}`);

  try {
    let smsSettings = twilioSettings;

    if (!smsSettings) {
      const { data: fetchedSettings, error: settingsError } = await supabase
        .from("twilio_config")
        .select("twilio_account_sid, twilio_auth_token, twilio_phone_number")
        .eq("clinic_id", clinicId)
        .eq("status", "active")
        .single();

      if (settingsError) {
        logError("Error fetching Twilio settings", { clinicId, error: settingsError });
        return { success: false, error: `Error fetching Twilio settings: ${settingsError.message}` };
      }

      smsSettings = fetchedSettings;
    }

    const missingFields = [];
    if (!smsSettings?.twilio_account_sid) missingFields.push("twilio_account_sid");
    if (!smsSettings?.twilio_auth_token) missingFields.push("twilio_auth_token");
    if (!smsSettings?.twilio_phone_number) missingFields.push("twilio_phone_number");

    if (missingFields.length > 0) {
      logError("Incomplete Twilio settings for clinic", {
        clinicId,
        missingFields,
      });
      return {
        success: false,
        error: `Incomplete Twilio settings for clinic. Missing: ${missingFields.join(", ")}`,
      };
    }

    const { twilio_account_sid, twilio_auth_token, twilio_phone_number } = smsSettings;

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${twilio_account_sid}:${twilio_auth_token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: twilio_phone_number,
        To: toPhone,
        Body: message,
      }),
    });

    if (response.ok) {
      const responseData = await response.json();
      logInfo("SMS sent successfully", { messageSid: responseData.sid });
      return { success: true };
    } else {
      const errorText = await response.text();
      logError("Twilio API call failed", { status: response.status, error: errorText });
      return { success: false, error: `Twilio API error (${response.status}): ${errorText}` };
    }
  } catch (error: any) {
    logError("Error sending SMS", error);
    return { success: false, error: error.message };
  }
}

// Enhanced sendEmail function using Mailgun
async function sendEmail(
  toEmail: string,
  subject: string,
  body: string,
  clinicId: string,
  supabase: any,
  emailSettings?: any,
  leadId?: string,
): Promise<{ success: boolean; error?: string }> {
  logInfo(`Attempting to send email to ${toEmail} for clinic ${clinicId}`);

  try {
    let settings = emailSettings;

    if (!settings) {
      const { data: fetchedSettings, error: settingsError } = await supabase
        .from("clinic")
        .select("mailgun_domain, mailgun_email, name, address, phone, logo")
        .eq("id", clinicId)
        .single();

      if (settingsError) {
        logError("Error fetching Mailgun settings from clinic table", { clinicId, error: settingsError });
        return { success: false, error: `Error fetching Mailgun settings: ${settingsError.message}` };
      }

      settings = fetchedSettings;
    }

    const missingFields = [];
    if (!settings?.mailgun_domain) missingFields.push("mailgun_domain");
    if (!settings?.mailgun_email) missingFields.push("mailgun_email");

    if (missingFields.length > 0) {
      logError("Incomplete Mailgun settings for clinic", {
        clinicId,
        missingFields,
      });
      return {
        success: false,
        error: `Incomplete Mailgun settings for clinic. Missing: ${missingFields.join(", ")}`,
      };
    }

    if (!MAILGUN_API_KEY) {
      logError("MAILGUN_API_KEY environment variable not set");
      return {
        success: false,
        error: "Mailgun API key not configured",
      };
    }

    const { mailgun_domain, mailgun_email, name: clinicName, address, phone, logo } = settings;

    // Create professional HTML email template
    const primaryColor = "#2563eb"; // Default blue if no color set
    const logo_url = logo;

    const logoSection = logo_url
      ? `<img src="${logo_url}" alt="${clinicName} Logo" style="max-height: 60px; margin-bottom: 30px; display: block;">`
      : "";

    // Convert body content to HTML with better formatting
    const isAlreadyHTML = body.includes("<br>") || body.includes("<p>") || body.includes("<div>");

    const contentBody = isAlreadyHTML
      ? body // Use as-is if already HTML formatted
      : body
          .replace(/\n\n/g, '</p><p style="margin: 0 0 20px 0; line-height: 1.6;">')
          .replace(/\n/g, "<br>")
          .replace(/^/, '<p style="margin: 0 0 20px 0; line-height: 1.6;">')
          .replace(/$/, "</p>");

    const professionalHtmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        ${
                          logoSection
                            ? `
                        <!-- Header with Logo -->
                        <tr>
                            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                                ${logoSection}
                            </td>
                        </tr>`
                            : ""
                        }
                        
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
                                            <strong style="color: ${primaryColor}; font-size: 16px; display: block; margin-bottom: 10px;">${clinicName}</strong>
                                            ${address ? `<div style="margin-bottom: 8px;">${address}</div>` : ""}
                                            ${phone ? `<div style="margin-bottom: 8px;">Phone: <a href="tel:${phone}" style="color: ${primaryColor}; text-decoration: none;">${phone}</a></div>` : ""}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    // Create plain text version
    let emailBody = body;
    if (leadId && SUPABASE_URL) {
      const unsubscribeUrl = `${SUPABASE_URL}/functions/v1/unsubscribe-lead?lead_id=${leadId}&clinic_id=${clinicId}`;

      const textFooter = `\n\n---\n${clinicName}\n${address ? `${address}\n` : ""}${phone ? `Phone: ${phone}\n` : ""}\n\nYou're receiving this because you showed interest in our services.\nNot interested anymore? Unsubscribe here: ${unsubscribeUrl}`;

      emailBody += textFooter;
    }

    logInfo("Sending professional branded email via Mailgun", {
      domain: mailgun_domain,
      from: mailgun_email,
      to: toEmail,
      subject: subject,
      contentLength: emailBody.length,
      hasUnsubscribe: !!leadId,
      hasLogo: !!logo_url,
      clinicName,
    });

    const formData = new FormData();
    formData.append("from", `${clinicName} <${mailgun_email}>`); // Include clinic name in sender
    formData.append("to", toEmail);
    formData.append("subject", subject);
    formData.append("text", emailBody);
    formData.append("html", professionalHtmlTemplate);

    const response = await fetch(`https://api.mailgun.net/v3/${mailgun_domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
      },
      body: formData,
    });

    if (response.ok) {
      const responseData = await response.json();
      logInfo("Email sent successfully via Mailgun", {
        messageId: responseData.id,
        message: responseData.message,
      });
      return { success: true };
    } else {
      const errorText = await response.text();
      logError("Mailgun API call failed", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      let errorMessage = `Mailgun API error (${response.status}): ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = `Mailgun error: ${errorJson.message}`;
        }
      } catch (e) {
        errorMessage = `Mailgun error: ${e} ${errorText}`;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error: any) {
    logError("Error sending email via Mailgun", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Save message to conversation history
async function saveMessageToHistory(
  threadId: string,
  messageContent: string | { subject: string; body: string },
  followUpType: string,
  supabase: any,
): Promise<void> {
  try {
    const now = new Date().toISOString();
    let messageText = "";

    if (typeof messageContent === "string") {
      messageText = `${followUpType.toUpperCase()}: ${messageContent}`;
    } else {
      messageText = `${followUpType.toUpperCase()} EMAIL - Subject: ${messageContent.subject}\n\n${messageContent.body}`;
    }

    await supabase.from("conversation").insert({
      thread_id: threadId,
      message: messageText,
      timestamp: now,
      is_from_user: false,
      sender_type: "assistant",
    });

    logInfo(`Saved message to history for thread ${threadId}`);
  } catch (error) {
    logError(`Error saving message to history for thread ${threadId}`, error);
  }
}

export { determineFollowUpsForLead, generateIntelligentResponse, logError, logInfo, processAllLeads, sendEmail, sendSMS };
export type { Clinic, Conversation, FollowUpRule, Lead, ProcessingResult };
