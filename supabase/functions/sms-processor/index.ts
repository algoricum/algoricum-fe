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
          name
        )
      `)
      .eq('twilio_phone_number', recipientPhone)
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

    const clinicData = twilioConfig.clinic;
    console.log(`✅ Found clinic: ${clinicData.id} - ${clinicData.name}`);

    // Check if sender phone exists in lead table for this clinic
    // Try to match by phone in notes/form_data if no direct phone field
    const { data: existingLead, error: leadError } = await supabaseClient
      .from('lead')
      .select('id, email, first_name, last_name, status, clinic_id, notes, form_data')
      .eq('clinic_id', clinicData.id)
      .or(`notes.ilike.%${senderPhone}%,form_data::text.ilike.%${senderPhone}%`)
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
        email: `${senderPhone.replace(/\D/g, '')}@sms.lead`, // Dummy email for SMS leads
        first_name: `SMS Lead ${senderPhone.slice(-4)}`, // Use last 4 digits as identifier
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
        .select('id, email, first_name, last_name, status, clinic_id, notes, form_data')
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
    
    // Find existing thread for the lead
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
      // Create new thread
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

    // Save conversation record (using existing schema)
    const conversationData = {
      thread_id: threadId,
      message: messageBody,
      timestamp: new Date().toISOString(),
      is_from_user: false,
      sender_type: 'lead',
      email_message_id: messageSid, // Reuse email_message_id field for SMS ID
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
        ai_response: aiResponseText // Include for TwiML response
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
  try {
    console.log('🤖 Calling OpenAI for SMS response generation...');
    
    // Get conversation history for context if threadId is provided
    let conversationContext = '';
    if (threadId) {
      const { data: conversationHistory } = await supabaseClient
        .from('conversation')
        .select('message, sender_type, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(10);

      conversationContext = conversationHistory
        ? conversationHistory.map((c: any) => 
            `${c.sender_type === 'lead' ? 'Patient' : 'Clinic'}: ${c.message}`
          ).join('\n\n')
        : '';
    }

    // Extract phone from form_data or notes
    const phoneNumber = leadData.form_data?.phone_number || 
                       leadData.notes?.match(/\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || 
                       'Not provided';

    const prompt = `You are an AI assistant for ${clinicData.name}, a medical clinic responding via SMS. 
    
Lead Information:
- Name: ${leadData.first_name} ${leadData.last_name || ''}
- Phone: ${phoneNumber}
- Status: ${leadData.status}

Current SMS Message: ${messageBody}

Previous Conversation:
${conversationContext}

Please generate a helpful, professional SMS response to this lead's message. Keep it concise (ideal for SMS), warm, and informative. Encourage them to book an appointment if appropriate. Avoid using special characters that might not display well in SMS.

IMPORTANT: Keep response under 160 characters if possible to avoid SMS splitting.`;

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not found');
      return { success: false, error: 'OpenAI API key not configured' };
    }

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
            content: `You are a helpful AI assistant for ${clinicData.name}. Respond professionally to patient SMS inquiries. Keep responses concise and SMS-friendly.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150, // Shorter for SMS
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('❌ OpenAI API error:', response.status, response.statusText);
      return { success: false, error: 'Failed to generate AI response' };
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      console.error('❌ No response generated by AI');
      return { success: false, error: 'Empty AI response' };
    }

    console.log('✅ AI SMS response generated successfully');
    return { success: true, response: aiResponse };

  } catch (error) {
    console.error('❌ Error generating AI response:', error);
    return { success: false, error: error.message };
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
      email_message_id: `reply_${originalMessageSid}`, // Reuse email_message_id for SMS reply
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

function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with 1 and has 11 digits (US format), keep as is
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it has 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // For other formats, add + if not present
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