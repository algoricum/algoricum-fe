import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface TwilioWebhookData {
  To: string;        
  From: string;       
  Body: string;  
  MessageSid: string; 
  AccountSid: string;
  NumSegments: string;
  SmsSid: string;   
  SmsStatus: string;  
  ApiVersion: string;
}

function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('📱 SMS webhook received');
  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing environment variables');
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/xml' } 
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    // Get clinic_id from query parameters
    const url = new URL(req.url);
    const clinicId = url.searchParams.get('clinic_id');

    if (!clinicId) {
      console.error('❌ Missing clinic_id in query parameters');
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/xml' } 
        }
      );
    }

    // Parse Twilio webhook data (form-encoded)
    const formData = await req.formData();
    const webhookData: TwilioWebhookData = {
      To: formData.get('To') as string,
      From: formData.get('From') as string,
      Body: formData.get('Body') as string,
      MessageSid: formData.get('MessageSid') as string,
      AccountSid: formData.get('AccountSid') as string,
      NumSegments: formData.get('NumSegments') as string,
      SmsSid: formData.get('SmsSid') as string,
      SmsStatus: formData.get('SmsStatus') as string,
      ApiVersion: formData.get('ApiVersion') as string
    };

    console.log(`📱 SMS from ${webhookData.From} to ${webhookData.To}`);

    // Validate required fields
    if (!webhookData.From || !webhookData.To || !webhookData.Body) {
      console.error('❌ Missing required webhook data');
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/xml' } }
      );
    }

    // Process SMS message directly
    const result = await processSMSMessage(webhookData, supabaseClient, clinicId);
    
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ SMS processed in ${processingTime}ms`);

    // Generate TwiML response
    let twimlResponse = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    
    if (result.success && result.data?.ai_response) {
      // Include the AI response in TwiML to send back immediately
      twimlResponse += `<Message>${escapeXml(result.data.ai_response)}</Message>`;
      console.log('✅ AI response included in TwiML');
    }
    
    twimlResponse += '</Response>';

    return new Response(twimlResponse, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/xml' }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ SMS processor error:', error);
    
    // Always return valid TwiML even on error
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { 
        status: 200, // Return 200 to Twilio to avoid retries
        headers: { ...corsHeaders, 'Content-Type': 'application/xml' } 
      }
    );
  }
});

async function processSMSMessage(
  webhookData: TwilioWebhookData, 
  supabaseClient: any,
  clinicId: string
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const senderPhone = normalizePhoneNumber(webhookData.From);
    const recipientPhone = normalizePhoneNumber(webhookData.To);
    const messageBody = webhookData.Body || '';
    const messageSid = webhookData.MessageSid;

    console.log(`Processing SMS from: ${senderPhone} to: ${recipientPhone}`);

    // Find the clinic by matching recipient phone to twilio_phone_number and clinic_id
    const { data: twilioConfig, error: configError } = await supabaseClient
      .from('twilio_config')
      .select(`
        id,
        clinic_id,
        phone_number,
        twilio_account_sid,
        twilio_auth_token,
        twilio_phone_number,
        status,
        clinic:clinic_id (
          id,
          name,
          calendly_link
        )
      `)
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (configError || !twilioConfig) {
      console.error('❌ Error finding Twilio config:', configError);
      return {
        success: false,
        message: `No active Twilio config found for phone number: ${recipientPhone} and clinic_id: ${clinicId}`
      };
    }

    // Use both new structure and fallback to old structure for compatibility
    const clinicData = {
      id: twilioConfig.clinic_id,
      name: twilioConfig.name || twilioConfig.clinic?.name,
      phone_number: twilioConfig.phone_number,
      calendly_link: twilioConfig.clinic.calendly_link
    };
    console.log(`✅ Found clinic: ${clinicData.id} - ${clinicData.name}`);

    // Check if sender phone exists in lead table for this clinic with improved matching
    const { data: existingLead, error: leadError } = await supabaseClient
      .from('lead')
      .select('id, email, first_name, last_name, status, clinic_id, notes, form_data, created_at')
      .eq('clinic_id', clinicData.id)
      .limit(1)
      .single();

    let leadData = existingLead;

    if (leadError && leadError.code !== 'PGRST116') {
      console.error('❌ Error checking lead:', leadError);
      return {
        success: false,
        message: 'Database error while checking lead'
      };
    }

    if (!leadData) {
      console.log(`⚠️ No lead found for phone: ${senderPhone}`);
      console.log('🆕 Creating new lead for incoming SMS...');
      
      // Find or create default source for SMS leads
      let defaultSourceId: string;

      const { data: existingSource } = await supabaseClient
        .from('lead_source')
        .select('id')
        .eq('name', 'SMS Inbound')
        .limit(1)
        .single();

      if (existingSource) {
        defaultSourceId = existingSource.id;
      } else {
        const { data: newSource, error: createSourceError } = await supabaseClient
          .from('lead_source')
          .insert({
            name: 'SMS Inbound',
            description: 'Leads created from inbound SMS messages',
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (createSourceError) {
          console.error('❌ Error creating default source:', createSourceError);
          return {
            success: false,
            message: 'Failed to create default lead source'
          };
        }
        
        defaultSourceId = newSource.id;
      }
      
      const newLeadData = {
        email: `${senderPhone.replace(/\D/g, '')}@sms.lead`,
        first_name: `SMS Lead ${senderPhone.slice(-4)}`,
        last_name: null,
        clinic_id: clinicData.id,
        source_id: defaultSourceId,
        status: 'New',
        interest_level: null,
        urgency: null,
        notes: `Auto-created from inbound SMS: ${senderPhone}\n\nInitial message:\n${messageBody}`,
        form_data: { 
          auto_created: true, 
          from_sms: true, 
          phone_number: senderPhone,
          initial_message: messageBody,
          twilio_message_sid: messageSid
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: createdLead, error: createLeadError } = await supabaseClient
        .from('lead')
        .insert(newLeadData)
        .select('id, email, first_name, last_name, status, clinic_id, notes, form_data, created_at')
        .single();

      if (createLeadError) {
        console.error('❌ Error creating new lead:', createLeadError);
        return {
          success: false,
          message: 'Failed to create new lead'
        };
      }

      leadData = createdLead;
      console.log(`✅ Created new lead: ${leadData.id}`);
    } else {
      console.log(`✅ Found existing lead: ${leadData.id}`);
    }

    // Create or find thread for SMS conversation
    let threadId: string;
    
    const { data: existingThread } = await supabaseClient
      .from('threads')
      .select('id')
      .eq('lead_id', leadData.id)
      .eq('clinic_id', clinicData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingThread) {
      threadId = existingThread.id;
    } else {
      const { data: newThread, error: threadError } = await supabaseClient
        .from('threads')
        .insert({
          lead_id: leadData.id,
          clinic_id: clinicData.id,
          status: "new",
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (threadError) {
        return {
          success: false,
          message: 'Failed to create conversation thread'
        };
      }
      threadId = newThread.id;
    }

    // Save conversation record
    const conversationData = {
      thread_id: threadId,
      message: messageBody,
      timestamp: new Date().toISOString(),
      is_from_user: false,
      sender_type: 'lead',
      email_message_id: messageSid,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: conversationRecord, error: conversationError } = await supabaseClient
      .from('conversation')
      .insert(conversationData)
      .select()
      .single();

    if (conversationError) {
      console.error('❌ Error saving conversation:', conversationError);
      return {
        success: false,
        message: 'Failed to save conversation record'
      };
    }

    // Generate AI response
    console.log('🤖 Generating AI response...');
    const aiResponse = await generateAIResponse(leadData, messageBody, supabaseClient, clinicData, threadId);
    
    let aiResponseText = '';
    if (aiResponse.success && aiResponse.response) {
      aiResponseText = aiResponse.response;
      
      console.log('💾 Saving AI response to conversation...');
      await saveAIResponseToConversation(
        threadId, 
        aiResponseText, 
        messageSid,
        supabaseClient
      );
    }

    // Update lead's updated_at timestamp
    await supabaseClient
      .from('lead')
      .update({ 
        updated_at: new Date().toISOString()
      })
      .eq('id', leadData.id);

    return {
      success: true,
      message: 'SMS processed successfully',
      data: {
        lead_id: leadData.id,
        conversation_id: conversationRecord.id,
        thread_id: threadId,
        clinic_id: clinicData.id,
        sender: senderPhone,
        lead_created: !existingLead,
        action: 'conversation_created',
        ai_response_sent: aiResponse?.success || false,
        ai_response: aiResponseText
      }
    };

  } catch (error) {
    console.error('Error processing SMS message:', error);
    return {
      success: false,
      message: 'Internal processing error: ' + error.message
    };
  }
}

async function generateAIResponse(
  leadData: any,
  messageBody: string,
  supabaseClient: any,
  clinicData: any,
  threadId?: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  console.log('🚀 === Starting generateAIResponse ===');
  console.log('📋 Function parameters:', {
    leadId: leadData?.id,
    leadName: `${leadData?.first_name} ${leadData?.last_name}`,
    messageLength: messageBody?.length,
    clinicId: clinicData?.id,
    clinicName: clinicData?.name,
    threadId: threadId
  });

  try {
    console.log('🤖 Calling OpenAI Assistants API for SMS response generation...');
    
    // Get conversation history for context if threadId is provided
    let conversationContext = '';
    if (threadId) {
      console.log('🔍 Fetching conversation history for threadId:', threadId);
      const { data: conversationHistory, error: historyError } = await supabaseClient
        .from('conversation')
        .select('message, sender_type, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(10);

      if (historyError) {
        console.error('❌ Error fetching conversation history:', historyError);
      } else {
        console.log('✅ Conversation history fetched:', conversationHistory?.length || 0, 'messages');
      }

      conversationContext = conversationHistory
        ? conversationHistory.map((c: any) => 
            `${c.sender_type === 'lead' ? 'Patient' : 'Clinic'}: ${c.message}`
          ).join('\n\n')
        : '';
    } else {
      console.log('ℹ️ No threadId provided, skipping conversation history');
    }

    // Extract phone from form_data or notes
    const phoneNumber = leadData.form_data?.phone_number || 
                       leadData.notes?.match(/\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || 
                       'Not provided';
    console.log('📱 Extracted phone number:', phoneNumber);

    // Get booking and unsubscribe links
    const bookingLink = clinicData.calendly_link || 'https://calendly.com/book';
    const unsubscribeLink = `${Deno.env.get('SUPABASE_URL')}/functions/v1/unsubscribe-lead?lead_id=${leadData.id}&clinic_id=${clinicData.id}`;
    const bookingButton = `📅 Book here: ${bookingLink}`;
    const unsubscribeButton = `To stop texts: ${unsubscribeLink}`;
    
    console.log('🔗 Generated links:', {
      bookingLink: bookingLink,
      unsubscribeLink: unsubscribeLink
    });

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('🔑 OpenAI API Key check:', {
      exists: !!openaiApiKey,
      length: openaiApiKey?.length || 0,
      prefix: openaiApiKey?.substring(0, 7) || 'none'
    });

    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not found');
      const fallbackResponse = `Hey ${leadData.first_name || 'there'}! Thanks for reaching out to ${clinicData.name}. Happy to help!\n${bookingButton}\n${unsubscribeButton}`;
      return { success: true, response: fallbackResponse };
    }

    // Get the assistant ID for this clinic
    console.log('🔍 Searching for assistant for clinic:', clinicData.id);
    const { data: assistantData, error: assistantError } = await supabaseClient
      .from('assistants')
      .select('openai_assistant_id, assistant_name, model')
      .eq('clinic_id', clinicData.id)
      .limit(1)
      .single();

    console.log('🤖 Assistant query result:', {
      error: assistantError,
      assistantData: assistantData,
      assistantId: assistantData?.openai_assistant_id,
      assistantName: assistantData?.assistant_name
    });

    if (assistantError || !assistantData?.openai_assistant_id) {
      console.error('❌ No assistant found for clinic, falling back to Chat Completions API');
      console.error('Assistant error details:', assistantError);
      console.error('Assistant data:', assistantData);
      console.error('❌ CRITICAL: Falling back to Chat Completions instead of using Assistant with data');
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }

    const assistantId = assistantData.openai_assistant_id;
    console.log(`🤖 Using assistant: ${assistantId} (${assistantData.assistant_name})`);

    // Import OpenAI (dynamic import for Deno)
    console.log('📦 Importing OpenAI SDK...');
    const { default: OpenAI } = await import('jsr:@openai/openai');
    console.log('✅ OpenAI SDK imported successfully');

    const openai = new OpenAI({
      apiKey: openaiApiKey
    });
    console.log('✅ OpenAI client initialized');

    // Test basic API connectivity
    console.log('🔌 Testing OpenAI API connectivity...');
    try {
      const models = await openai.models.list();
      console.log('✅ OpenAI API accessible, models count:', models.data?.length || 0);
    } catch (apiError) {
      console.error('❌ OpenAI API not accessible:', apiError);
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }

    // Verify assistant exists first
    console.log('🔍 Verifying assistant exists...');
    try {
      const assistant = await openai.beta.assistants.retrieve(assistantId);
      console.log(`✅ Assistant verified:`, {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model,
        tools: assistant.tools?.length || 0
      });
    } catch (error) {
      console.error('❌ Assistant not found or not accessible:', error.message);
      console.error('Assistant verification error details:', error);
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }

    const systemPrompt = `You are the virtual assistant for ${clinicData.name}, a medical clinic responding via SMS. Generate a helpful, conversational SMS response to this patient's message.

TONE REQUIREMENTS:
- Sound casual and friendly - like texting a knowledgeable friend
- Be helpful and informative about their specific question
- Keep main message under 160 characters (links don't count toward limit)
- Use personality when appropriate
- Avoid special characters that might not display well in SMS

Lead Information:
- Name: ${leadData.first_name || ''} ${leadData.last_name || ''}
- Phone: ${phoneNumber}
- Status: ${leadData.status || 'unknown'}
- Clinic Name: ${clinicData.name}
- Clinic Phone: ${clinicData.phone_number || 'Not provided'}

Previous Conversation:
${conversationContext || 'No previous conversation'}

REQUIRED ELEMENTS:
- MUST include booking button: ${bookingButton}
- MUST include unsubscribe option: ${unsubscribeButton}
- Respond helpfully to their specific message/question
- Keep the main response conversational and under 160 characters

Generate a helpful SMS response that answers their question and includes all required elements.`;

    const userPrompt = `Current SMS Message: ${messageBody}

Please generate a helpful SMS response that addresses their message and includes all required elements.`;

    console.log('📝 Prompts prepared:', {
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      messageBody: messageBody
    });

    // Create a thread for this conversation
    console.log('🧵 Creating OpenAI thread...');
    let openaiThread;
    try {
      const threadRequest = {
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      };
      console.log('📤 Thread creation request:', threadRequest);
      
      openaiThread = await openai.beta.threads.create(threadRequest);
      console.log('✅ Thread creation response:', {
        id: openaiThread?.id,
        object: openaiThread?.object,
        created_at: openaiThread?.created_at,
        metadata: openaiThread?.metadata,
        fullResponse: openaiThread
      });
    } catch (error) {
      console.error('❌ Thread creation failed:', error.message);
      console.error('Thread creation error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        response: error.response?.data || 'No response data'
      });
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }

    // Validate thread creation
    if (!openaiThread || !openaiThread.id) {
      console.error('❌ Thread created but no ID returned:', openaiThread);
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }

    const openaiThreadId = openaiThread.id;
    console.log(`✅ Created thread with ID: ${openaiThreadId}`);
    
    // Additional validation to catch issues early
    if (typeof openaiThreadId !== 'string' || openaiThreadId.trim() === '') {
      console.error('❌ Invalid thread ID received:', { 
        threadId: openaiThreadId, 
        type: typeof openaiThreadId,
        threadObject: openaiThread 
      });
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }

    // Create a run with additional instructions (system prompt)
    console.log('🏃 Creating run...');
    let openaiRun;
    try {
      const runRequest = {
        assistant_id: assistantId,
        // Keep additional_instructions focused on SMS context, let Assistant use its file knowledge
        additional_instructions: `
You are responding directly to this SMS from a patient: "${messageBody}"

Patient: ${leadData.first_name || 'SMS Lead'} (${phoneNumber})
Context: ${conversationContext ? 'Ongoing conversation - see history' : 'First time contacting us'}

RESPOND AS THE CLINIC DIRECTLY - not as someone helping write a response.

Search your knowledge base files for accurate pricing and service details. Give specific prices from your documents when asked about treatment costs.

SMS Requirements:
- Keep main message under 160 characters 
- Include: ${bookingButton}
- Include: ${unsubscribeButton}
- Be conversational and helpful
- Use specific pricing from your files, not generic responses
        `.trim(),
        max_completion_tokens: 500, // Increased for file search operations
        temperature: 0.8
      };
      console.log('📤 Run creation request:', runRequest);
      
      openaiRun = await openai.beta.threads.runs.create(openaiThreadId, runRequest);
      console.log('✅ Run creation response:', {
        id: openaiRun?.id,
        object: openaiRun?.object,
        status: openaiRun?.status,
        assistant_id: openaiRun?.assistant_id,
        thread_id: openaiRun?.thread_id,
        fullResponse: openaiRun
      });
    } catch (error) {
      console.error('❌ Run creation failed:', error.message);
      console.error('Run creation error details:', error);
      console.error('❌ CRITICAL: Run creation failed, falling back to Chat Completions instead of using Assistant with data');
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }

    // Validate run creation
    if (!openaiRun || !openaiRun.id) {
      console.error('❌ Run created but no ID returned:', openaiRun);
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }

    const openaiRunId = openaiRun.id;
    console.log(`✅ Created run with ID: ${openaiRunId} for thread: ${openaiThreadId}`);
    
    // Additional validation for run ID
    if (typeof openaiRunId !== 'string' || openaiRunId.trim() === '') {
      console.error('❌ Invalid run ID received:', { 
        runId: openaiRunId, 
        type: typeof openaiRunId,
        runObject: openaiRun 
      });
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }

    // Validate both IDs before proceeding
    if (!openaiThreadId || !openaiRunId) {
      console.error('❌ Missing required IDs:', { threadId: openaiThreadId, runId: openaiRunId });
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }

    // Store IDs in function-scoped variables to avoid any scope issues
    const threadIdForRetrieval = String(openaiThreadId);
    const runIdForRetrieval = String(openaiRunId);
    
    console.log('🔒 Stored IDs for retrieval:', {
      threadIdForRetrieval,
      runIdForRetrieval,
      originalThreadId: openaiThreadId,
      originalRunId: openaiRunId
    });

    // Wait for the run to complete
    console.log('⏳ Waiting for run to complete...');
    console.log(`🔍 Will check run ${runIdForRetrieval} in thread ${threadIdForRetrieval}`);
    console.log(`🔍 Debug - threadId: "${threadIdForRetrieval}", runId: "${runIdForRetrieval}"`);
    
    let runStatus;
    try {
      // Double check IDs before making the call
      if (!threadIdForRetrieval || !runIdForRetrieval) {
        console.error('❌ Missing IDs before run retrieve:', { threadId: threadIdForRetrieval, runId: runIdForRetrieval });
        return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
      }
      
      // Final debug log right before API call
      console.log('🔍 Final ID check before API call:', {
        threadIdForRetrieval: threadIdForRetrieval,
        runIdForRetrieval: runIdForRetrieval,
        threadIdType: typeof threadIdForRetrieval,
        runIdType: typeof runIdForRetrieval
      });
      
      // Try the OpenAI SDK call with multiple approaches if needed
      console.log('🔍 About to call retrieve with:', { threadId: threadIdForRetrieval, runId: runIdForRetrieval });
      
      try {
        // First attempt: standard signature
        runStatus = await openai.beta.threads.runs.retrieve(threadIdForRetrieval, runIdForRetrieval);
        console.log('✅ Standard retrieve call succeeded');
      } catch (retrieveError) {
        console.error('❌ Standard retrieve failed, trying alternative approach:', retrieveError.message);
        
        // Second attempt: try with explicit object parameter - fallback approach
        try {
          const altRunStatus = await openai.beta.threads.runs.list(threadIdForRetrieval);
          const targetRun = altRunStatus.data.find(run => run.id === runIdForRetrieval);
          if (targetRun) {
            runStatus = targetRun;
            console.log('✅ Alternative retrieve via list succeeded');
          } else {
            throw new Error(`Run ${runIdForRetrieval} not found in thread ${threadIdForRetrieval}`);
          }
        } catch (altError) {
          console.error('❌ Alternative retrieve also failed:', altError.message);
          throw retrieveError; // Re-throw the original error
        }
      }
      console.log('🔄 Initial run status:', {
        status: runStatus.status,
        last_error: runStatus.last_error,
        started_at: runStatus.started_at,
        completed_at: runStatus.completed_at
      });
    } catch (error) {
      console.error('❌ Failed to get initial run status:', error);
      console.error('❌ Error details:', {
        threadId: threadIdForRetrieval,
        runId: runIdForRetrieval,
        originalThreadId: openaiThreadId,
        originalRunId: openaiRunId,
        error: error.message
      });
      console.error('❌ CRITICAL: Failed to get run status, falling back to Chat Completions instead of using Assistant with data');
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }
    
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max wait to allow file search processing
    
    while ((runStatus.status === 'in_progress' || runStatus.status === 'queued') && attempts < maxAttempts) {
      console.log(`⏳ Run attempt ${attempts + 1}/${maxAttempts}, status: ${runStatus.status}`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      try {
        console.log(`🔍 Retry ${attempts + 1} ID check:`, {
          threadIdForRetrieval: threadIdForRetrieval,
          runIdForRetrieval: runIdForRetrieval,
          threadIdType: typeof threadIdForRetrieval,
          runIdType: typeof runIdForRetrieval
        });
        
        // Use the same fallback approach that worked in the initial call
        try {
          runStatus = await openai.beta.threads.runs.retrieve(threadIdForRetrieval, runIdForRetrieval);
          console.log(`✅ Standard retry ${attempts + 1} retrieve succeeded`);
        } catch (retryRetrieveError) {
          console.error(`❌ Standard retry ${attempts + 1} retrieve failed, using alternative:`, retryRetrieveError.message);
          
          // Use the working alternative approach
          const altRunStatus = await openai.beta.threads.runs.list(threadIdForRetrieval);
          const targetRun = altRunStatus.data.find(run => run.id === runIdForRetrieval);
          if (targetRun) {
            runStatus = targetRun;
            console.log(`✅ Alternative retry ${attempts + 1} retrieve succeeded`);
          } else {
            throw new Error(`Run ${runIdForRetrieval} not found in thread ${threadIdForRetrieval} on retry ${attempts + 1}`);
          }
        }
        console.log(`🔄 Status update ${attempts + 1}: ${runStatus.status}`);
      } catch (error) {
        console.error(`❌ Error retrieving run status on attempt ${attempts + 1}:`, error);
        console.error('❌ CRITICAL: Run status retrieval failed during retry, falling back to Chat Completions instead of using Assistant with data');
        return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
      }
      
      attempts++;
    }

    console.log('🏁 Final run status:', {
      status: runStatus.status,
      last_error: runStatus.last_error,
      completed_at: runStatus.completed_at,
      attempts: attempts
    });

    if (runStatus.status === 'completed') {
      console.log('✅ Run completed successfully, fetching messages...');
      console.log(`📨 Fetching messages from thread: ${threadIdForRetrieval}`);
      
      // Get the assistant's response
      const messages = await openai.beta.threads.messages.list(threadIdForRetrieval);
      console.log('📨 Messages retrieved:', {
        count: messages.data?.length || 0,
        firstMessage: messages.data?.[0]
      });
      
      const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
      console.log('🤖 Assistant message found:', {
        exists: !!assistantMessage,
        contentType: assistantMessage?.content?.[0]?.type,
        hasText: !!assistantMessage?.content?.[0]?.text?.value
      });
      
      if (assistantMessage && assistantMessage.content[0]?.text?.value) {
        let aiResponse = assistantMessage.content[0].text.value.trim();
        console.log('📝 Raw AI response:', aiResponse);

        // Ensure booking and unsubscribe links are included
        const hasBookingLink = aiResponse.includes(bookingLink);
        const hasUnsubscribeLink = aiResponse.includes(unsubscribeLink) || 
                                  aiResponse.toLowerCase().includes('stop texts') || 
                                  aiResponse.toLowerCase().includes('unsubscribe');

        console.log('🔗 Link validation:', {
          hasBookingLink,
          hasUnsubscribeLink,
          originalLength: aiResponse.length
        });

        if (!hasBookingLink) {
          aiResponse += `\n${bookingButton}`;
          console.log('➕ Added booking button');
        }
        if (!hasUnsubscribeLink) {
          aiResponse += `\n${unsubscribeButton}`;
          console.log('➕ Added unsubscribe button');
        }

        console.log('✅ AI SMS response generated successfully via Assistants API');
        console.log('📤 Final response length:', aiResponse.length);
        return { success: true, response: aiResponse };
      } else {
        console.error('❌ No valid content in assistant message');
        return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
      }
    } else if (runStatus.status === 'failed') {
      console.error('❌ Assistant run failed:', runStatus.last_error);
      console.error('❌ CRITICAL: Assistant run failed, falling back to Chat Completions instead of using Assistant with data');
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    } else if (runStatus.status === 'incomplete') {
      console.error('❌ Assistant run incomplete - likely file search timeout');
      console.error('Run details:', {
        status: runStatus.status,
        last_error: runStatus.last_error,
        required_action: runStatus.required_action,
        incomplete_details: runStatus.incomplete_details
      });
      console.error('❌ CRITICAL: Assistant run incomplete (file search timeout), falling back to Chat Completions instead of using Assistant with data');
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    } else {
      console.error('❌ Assistant run timed out or other status:', runStatus.status);
      console.error('❌ CRITICAL: Assistant run timed out, falling back to Chat Completions instead of using Assistant with data');
      return await generateFallbackResponse(leadData, messageBody, clinicData, conversationContext, openaiApiKey);
    }

  } catch (error) {
    console.error('❌ Error generating AI response via Assistants API:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    console.error('❌ CRITICAL: Unexpected error in Assistants API flow, falling back to Chat Completions instead of using Assistant with data');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (openaiApiKey) {
      return await generateFallbackResponse(leadData, messageBody, clinicData, '', openaiApiKey);
    }
    
    // Final fallback
    const bookingLink = clinicData.calendly_link || 'https://calendly.com/book';
    const unsubscribeLink = `${Deno.env.get('SUPABASE_URL')}/functions/v1/unsubscribe-lead?lead_id=${leadData.id}&clinic_id=${clinicData.id}`;
    const bookingButton = `📅 Book here: ${bookingLink}`;
    const unsubscribeButton = `To stop texts: ${unsubscribeLink}`;
    
    const fallbackResponse = `Hey ${leadData.first_name || 'there'}! Thanks for reaching out to ${clinicData.name}. Happy to help!\n${bookingButton}\n${unsubscribeButton}`;
    return { success: true, response: fallbackResponse };
  } finally {
    console.log('🏁 === Ending generateAIResponse ===');
  }
}

// Fallback function using Chat Completions API
async function generateFallbackResponse(
  leadData: any,
  messageBody: string,
  clinicData: any,
  conversationContext: string,
  openaiApiKey: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    console.log('🔄 Using fallback Chat Completions API...');
    
    const phoneNumber = leadData.form_data?.phone_number || 
                       leadData.notes?.match(/\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || 
                       'Not provided';

    const bookingLink = clinicData.calendly_link || 'https://calendly.com/book';
    const unsubscribeLink = `${Deno.env.get('SUPABASE_URL')}/functions/v1/unsubscribe-lead?lead_id=${leadData.id}&clinic_id=${clinicData.id}`;
    const bookingButton = `📅 Book here: ${bookingLink}`;
    const unsubscribeButton = `To stop texts: ${unsubscribeLink}`;

    const prompt = `You are the virtual assistant for ${clinicData.name}, a medical clinic responding via SMS. Generate a helpful, conversational SMS response to this patient's message.

TONE REQUIREMENTS:
- Sound casual and friendly - like texting a knowledgeable friend
- Be helpful and informative about their specific question
- Keep main message under 160 characters (links don't count toward limit)
- Use personality when appropriate
- Avoid special characters that might not display well in SMS

Lead Information:
- Name: ${leadData.first_name || ''} ${leadData.last_name || ''}
- Phone: ${phoneNumber}
- Status: ${leadData.status || 'unknown'}
- Clinic Name: ${clinicData.name}
- Clinic Phone: ${clinicData.phone_number || 'Not provided'}

Current SMS Message: ${messageBody}

Previous Conversation:
${conversationContext || 'No previous conversation'}

REQUIRED ELEMENTS:
- MUST include booking button: ${bookingButton}
- MUST include unsubscribe option: ${unsubscribeButton}
- Respond helpfully to their specific message/question
- Keep the main response conversational and under 160 characters

Generate a helpful SMS response that answers their question and includes all required elements.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant for ${clinicData.name}. Respond professionally to patient SMS inquiries. Keep responses concise, SMS-friendly, and include all required elements.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      console.error('❌ OpenAI API error:', response.status, response.statusText);
      const fallbackResponse = `Hey ${leadData.first_name || 'there'}! Thanks for reaching out to ${clinicData.name}. Happy to help!\n${bookingButton}\n${unsubscribeButton}`;
      return { success: true, response: fallbackResponse };
    }

    const data = await response.json();
    let aiResponse = data.choices[0]?.message?.content?.trim();

    if (!aiResponse) {
      console.error('❌ No response generated by AI');
      const fallbackResponse = `Hey ${leadData.first_name || 'there'}! Thanks for reaching out to ${clinicData.name}. Happy to help!\n${bookingButton}\n${unsubscribeButton}`;
      return { success: true, response: fallbackResponse };
    }

    // Ensure booking and unsubscribe links are included
    const hasBookingLink = aiResponse.includes(bookingLink);
    const hasUnsubscribeLink = aiResponse.includes(unsubscribeLink) || 
                              aiResponse.toLowerCase().includes('stop texts') || 
                              aiResponse.toLowerCase().includes('unsubscribe');

    if (!hasBookingLink) {
      aiResponse += `\n${bookingButton}`;
    }
    if (!hasUnsubscribeLink) {
      aiResponse += `\n${unsubscribeButton}`;
    }

    console.log('✅ AI SMS response generated successfully via fallback');
    return { success: true, response: aiResponse };

  } catch (error) {
    console.error('❌ Error in fallback response generation:', error);
    const bookingLink = clinicData.calendly_link || 'https://calendly.com/book';
    const unsubscribeLink = `${Deno.env.get('SUPABASE_URL')}/functions/v1/unsubscribe-lead?lead_id=${leadData.id}&clinic_id=${clinicData.id}`;
    const bookingButton = `📅 Book here: ${bookingLink}`;
    const unsubscribeButton = `To stop texts: ${unsubscribeLink}`;
    
    const fallbackResponse = `Hey ${leadData.first_name || 'there'}! Thanks for reaching out to ${clinicData.name}. Happy to help!\n${bookingButton}\n${unsubscribeButton}`;
    return { success: true, response: fallbackResponse };
  }
}

async function saveAIResponseToConversation(
  threadId: string,
  aiResponse: string,
  originalMessageSid: string,
  supabaseClient: any
): Promise<void> {
  try {
    console.log('💾 Saving AI SMS response to conversation thread...');
    
    const aiConversationData = {
      thread_id: threadId,
      message: aiResponse,
      timestamp: new Date().toISOString(),
      is_from_user: true,
      sender_type: 'ai_assistant',
      email_message_id: `reply_${originalMessageSid}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: aiConversationRecord, error: aiConversationError } = await supabaseClient
      .from('conversation')
      .insert(aiConversationData)
      .select()
      .single();

    if (aiConversationError) {
      console.error('❌ Error saving AI SMS response to conversation:', aiConversationError);
    } else {
      console.log('✅ AI SMS response saved to conversation:', aiConversationRecord.id);
    }

  } catch (error) {
    console.error('❌ Error saving AI SMS response:', error);
  }
}