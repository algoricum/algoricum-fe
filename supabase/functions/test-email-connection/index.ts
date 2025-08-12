// supabase/functions/email-processor/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface QueueMessage {
  id: string;
  webhookData: any;
  timestamp: string;
  attempts: number;
  maxAttempts: number;
  priority: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('🔄 Email processor started');
  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing environment variables'
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    // Process one message from the queue
    const result = await processQueueBatch(supabaseClient);

    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Processor completed in ${processingTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Queue processing completed',
      data: result,
      processing_time_ms: processingTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Processor error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      processing_time_ms: processingTime
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

async function processQueueBatch(supabaseClient: any) {
  const results = {
    processed: 0,
    failed: 0,
    skipped: 0,
    queue_empty: false
  };

  try {
    // Read one message from the queue (30 second visibility timeout)
    console.log('📥 Reading from email_processing queue...');
    
    const { data: messages, error } = await supabaseClient.rpc('read_email_from_queue', {
      queue_name: 'email_processing',
      visibility_timeout: 30
    });

    if (error) {
      console.error('❌ Error reading from queue:', error);
      results.failed = 1;
      return results;
    }

    if (!messages || messages.length === 0) {
      console.log('📭 Queue is empty');
      results.queue_empty = true;
      return results;
    }

    // Process the first message
    const queueMessage = messages[0];
    console.log(`📧 Processing message ${queueMessage.msg_id} (job ${queueMessage.message.id})`);

    const success = await processEmailJob(queueMessage, supabaseClient);

    if (success) {
      // Delete message from queue
      await supabaseClient.rpc('delete_email_from_queue', {
        queue_name: 'email_processing',
        msg_id: queueMessage.msg_id
      });
      
      console.log(`✅ Message ${queueMessage.msg_id} processed and deleted`);
      results.processed = 1;
    } else {
      // Handle retry logic
      const jobMessage = queueMessage.message as QueueMessage;
      jobMessage.attempts++;

      if (jobMessage.attempts >= jobMessage.maxAttempts) {
        console.log(`❌ Message ${queueMessage.msg_id} failed permanently after ${jobMessage.attempts} attempts`);
        
        // Delete from queue (permanent failure)
        await supabaseClient.rpc('delete_email_from_queue', {
          queue_name: 'email_processing',
          msg_id: queueMessage.msg_id
        });
        
        // Optionally store in dead letter queue
        await supabaseClient.rpc('send_email_to_queue', {
          queue_name: 'email_processing_dlq',
          message: jobMessage
        });
        
        results.failed = 1;
      } else {
        console.log(`🔄 Message ${queueMessage.msg_id} will retry (attempt ${jobMessage.attempts}/${jobMessage.maxAttempts})`);
        
        // Delete current message and re-queue with updated attempt count
        await supabaseClient.rpc('delete_email_from_queue', {
          queue_name: 'email_processing',
          msg_id: queueMessage.msg_id
        });
        
        // Re-queue with updated attempt count
        await supabaseClient.rpc('send_email_to_queue', {
          queue_name: 'email_processing',
          message: jobMessage
        });
        
        results.skipped = 1;
      }
    }

    return results;

  } catch (error) {
    console.error('❌ Error in batch processing:', error);
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
async function processEmailReply(
  webhookData: any, 
  supabaseClient: any
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const senderEmail = webhookData.sender;
    const recipientEmail = webhookData.recipient;
    const messageBody = webhookData['body-plain'] || '';
    const subject = webhookData.subject || '';
    const timestamp = webhookData.timestamp;
    const messageId = webhookData['Message-Id'];

    if (!senderEmail || !messageBody || !recipientEmail) {
      return {
        success: false,
        message: 'Missing required email data'
      };
    }

    console.log(`Processing reply from: ${senderEmail} to: ${recipientEmail}`);

    // Find the clinic by matching recipient email to mailgun_email
    const { data: clinicData, error: clinicError } = await supabaseClient
      .from('clinic')
      .select('id, name, mailgun_email')
      .eq('mailgun_email', recipientEmail.toLowerCase())
      .limit(1)
      .single();

    if (clinicError || !clinicData) {
      console.error('❌ Error finding clinic:', clinicError);
      return {
        success: false,
        message: `No clinic found for recipient email: ${recipientEmail}`
      };
    }

    console.log(`✅ Found clinic: ${clinicData.id} - ${clinicData.name}`);

    // Check if sender email exists in lead table for this clinic
    const { data: existingLead, error: leadError } = await supabaseClient
      .from('lead')
      .select('id, email, first_name, last_name, status, clinic_id')
      .eq('email', senderEmail.toLowerCase())
      .eq('clinic_id', clinicData.id)
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
      console.log(`⚠️ No lead found for email: ${senderEmail}`);
      console.log('🆕 Creating new lead for incoming email...');
      
      // Find or create default source for email leads
      let defaultSourceId: string;
      
      const { data: existingSource } = await supabaseClient
        .from('lead_source')
        .select('id')
        .eq('name', 'Email')
        .limit(1)
        .single();

      if (existingSource) {
        defaultSourceId = existingSource.id;
      } else {
        const { data: newSource, error: createSourceError } = await supabaseClient
          .from('lead_source')
          .insert({
            name: 'Email Inbound',
            description: 'Leads created from inbound emails',
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
      
      // Extract name from email
      const emailPrefix = senderEmail.split('@')[0];
      const nameFromEmail = emailPrefix.replace(/[._-]/g, ' ').split(' ');
      
      const newLeadData = {
        email: senderEmail.toLowerCase(),
        first_name: nameFromEmail[0] || emailPrefix,
        last_name: nameFromEmail.length > 1 ? nameFromEmail.slice(1).join(' ') : null,
        clinic_id: clinicData.id,
        source_id: defaultSourceId,
        status: 'New',
        interest_level: null,
        urgency: null,
        notes: `Auto-created from inbound email: ${subject}\n\nEmail content:\n${messageBody}`,
        form_data: { auto_created: true, from_email: true, initial_subject: subject },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: createdLead, error: createLeadError } = await supabaseClient
        .from('lead')
        .insert(newLeadData)
        .select('id, email, first_name, last_name, status, clinic_id')
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
      
      // For new leads, just return success without creating conversation thread
      return {
        success: true,
        message: 'New lead created successfully from email',
        data: {
          lead_id: leadData.id,
          clinic_id: clinicData.id,
          sender: senderEmail,
          lead_created: true,
          action: 'lead_created_only'
        }
      };
    } else {
      console.log(`✅ Found existing lead: ${leadData.id}`);
    }

    // Check if this is a reply to a previous email
    const isReply = subject.toLowerCase().includes('re:') || 
                   webhookData['In-Reply-To'] || 
                   webhookData.References;

    // Find or create thread
    let threadId: string;
    
    if (isReply) {
      // Try to find existing thread
      const { data: existingThread } = await supabaseClient
        .from('conversation')
        .select('thread_id')
        .or(
          `email_message_id.eq.${webhookData['In-Reply-To']},` +
          `email_message_id.in.(${webhookData.References?.split(' ').join(',')})`
        )
        .limit(1)
        .single();

      if (existingThread) {
        threadId = existingThread.thread_id;
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
    } else {
      // Create new thread for new conversation
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
      timestamp: timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString(),
      is_from_user: false,
      sender_type: 'lead',
      email_message_id: messageId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: conversationRecord, error: conversationError } = await supabaseClient
      .from('conversation')
      .insert(conversationData)
      .select()
      .single();

    if (conversationError) {
      return {
        success: false,
        message: 'Failed to save conversation record'
      };
    }

    // Generate and send AI response
    console.log('🤖 Generating AI response...');
    const aiResponse = await generateAIResponse(leadData, messageBody, subject, supabaseClient, clinicData, threadId);
    
    if (aiResponse.success) {
      console.log('📧 Sending AI response via email...');
      const emailSent = await sendEmailResponse(
        senderEmail, 
        recipientEmail, 
        subject, 
        aiResponse.response, 
        conversationRecord.id
      );
      
      if (emailSent.success) {
        console.log('💾 Saving AI response to conversation...');
        await saveAIResponseToConversation(
          threadId, 
          aiResponse.response, 
          emailSent.messageId,
          supabaseClient
        );
      }
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
      message: 'Reply processed and AI response sent successfully',
      data: {
        lead_id: leadData.id,
        conversation_id: conversationRecord.id,
        thread_id: threadId,
        clinic_id: clinicData.id,
        sender: senderEmail,
        lead_created: false,
        action: 'conversation_created',
        ai_response_sent: aiResponse?.success || false
      }
    };

  } catch (error) {
    console.error('Error processing email reply:', error);
    return {
      success: false,
      message: 'Internal processing error: ' + error.message
    };
  }
}

// Your existing AI response generation function (unchanged)
async function generateAIResponse(
  leadData: any,
  messageBody: string,
  subject: string,
  supabaseClient: any,
  clinicData: any,
  threadId?: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    console.log('🤖 Calling OpenAI for response generation...');
    
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
            `${c.sender_type === 'lead' ? 'Lead' : 'Clinic'}: ${c.message}`
          ).join('\n\n')
        : '';
    }

    const prompt = `You are an AI assistant for ${clinicData.name}, a medical clinic. 
    
Lead Information:
- Name: ${leadData.first_name} ${leadData.last_name}
- Email: ${leadData.email}
- Status: ${leadData.status}

Current Email:
Subject: ${subject}
Message: ${messageBody}

Previous Conversation:
${conversationContext}

Please generate a helpful, professional response to this lead's email. Be warm, informative, and encourage them to book an appointment if appropriate. Keep the response concise and focused.`;

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
            content: `You are a helpful AI assistant for ${clinicData.name}. Respond professionally to patient inquiries.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
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

    console.log('✅ AI response generated successfully');
    return { success: true, response: aiResponse };

  } catch (error) {
    console.error('❌ Error generating AI response:', error);
    return { success: false, error: error.message };
  }
}

// Your existing email sending function (unchanged)
async function sendEmailResponse(
  toEmail: string,
  fromEmail: string,
  originalSubject: string,
  responseMessage: string,
  conversationId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log('📧 Sending email via Mailgun...');
    
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    const mailgunDomain = Deno.env.get('MAILGUN_BASE_DOMAIN');
    
    if (!mailgunApiKey || !mailgunDomain) {
      console.error('❌ Mailgun credentials not found');
      return { success: false, error: 'Mailgun credentials not configured' };
    }

    const replySubject = originalSubject.toLowerCase().startsWith('re:') 
      ? originalSubject 
      : `Re: ${originalSubject}`;

    const formData = new FormData();
    formData.append('from', fromEmail);
    formData.append('to', toEmail);
    formData.append('subject', replySubject);
    formData.append('text', responseMessage);
    formData.append('h:X-Conversation-ID', conversationId);

    const response = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Mailgun API error:', response.status, errorText);
      return { success: false, error: 'Failed to send email via Mailgun' };
    }

    const result = await response.json();
    console.log('✅ Email sent successfully via Mailgun');
    
    return { 
      success: true, 
      messageId: result.id 
    };

  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Your existing save AI response function (unchanged)
async function saveAIResponseToConversation(
  threadId: string,
  aiResponse: string,
  emailMessageId: string | undefined,
  supabaseClient: any
): Promise<void> {
  try {
    console.log('💾 Saving AI response to conversation thread...');
    
    const aiConversationData = {
      thread_id: threadId,
      message: aiResponse,
      timestamp: new Date().toISOString(),
      is_from_user: true,
      sender_type: 'ai_assistant',
      email_message_id: emailMessageId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: aiConversationRecord, error: aiConversationError } = await supabaseClient
      .from('conversation')
      .insert(aiConversationData)
      .select()
      .single();

    if (aiConversationError) {
      console.error('❌ Error saving AI response to conversation:', aiConversationError);
    } else {
      console.log('✅ AI response saved to conversation:', aiConversationRecord.id);
    }

  } catch (error) {
    console.error('❌ Error saving AI response:', error);
  }
}