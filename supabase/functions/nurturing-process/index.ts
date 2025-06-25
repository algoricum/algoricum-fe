import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import OpenAI from 'jsr:@openai/openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const createResponse = (data: any, status = 200) => {
  console.log("Creating response with status:", status, "Data:", JSON.stringify(data));
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
};

// Logging utility
const logInfo = (message: string, data?: any) => {
  console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data) : '');
};

const logError = (message: string, error?: any) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
};

const logWarning = (message: string, data?: any) => {
  console.warn(`[WARNING] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  logInfo('Nurturing process started');

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      logError('Missing Supabase environment variables');
      return createResponse({
        success: false,
        error: 'Server configuration error: Missing Supabase credentials'
      }, 500);
    }

    if (!openaiKey) {
      logError('Missing OpenAI API key');
      return createResponse({
        success: false,
        error: 'Server configuration error: Missing OpenAI API key'
      }, 500);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey, timeout: 30000, maxRetries: 2 });

    const requestData = await req.json();
    logInfo('Request received', requestData);

    const { 
      clinic_id, 
      chat_id, 
      cron_job = false, 
      process_all_chats = false,
      batch_process = false,
      hours_threshold = 24 
    } = requestData;

    // Handle cron job or batch processing
    if (cron_job || process_all_chats || batch_process) {
      logInfo('Starting batch processing', { cron_job, process_all_chats, batch_process });
      
      // For batch processing, we'll fetch SMTP config from email_settings table per clinic
      // No need to validate SMTP config here since each clinic might have different settings
      return await processBatchNurturing(supabaseClient, openai, {
        clinic_id,
        process_all_chats,
        hours_threshold
      });
    }

    if (!clinic_id || !chat_id) {
      logError('Missing required fields', { clinic_id, chat_id });
      return createResponse({
        success: false,
        error: 'Missing required fields: clinic_id and chat_id'
      }, 400);
    }

    logInfo('Processing single chat', { clinic_id, chat_id });

    // Fetch clinic information
    const { data: clinicData, error: clinicError } = await supabaseClient
      .from('clinic')
      .select('name, email, phone, business_hours, calendly_link')
      .eq('id', clinic_id)
      .single();

    if (clinicError || !clinicData) {
      logError('Clinic not found', { clinic_id, error: clinicError });
      return createResponse({
        success: false,
        error: 'Clinic not found'
      }, 404);
    }

    logInfo('Clinic data fetched', { clinicName: clinicData.name });

    // Fetch chat information with lead details
    const { data: chatData, error: chatError } = await supabaseClient
      .from('chat')
      .select(`
        id, 
        lead_id, 
        openai_thread_id, 
        status,
        leads!inner(email, name, phone)
      `)
      .eq('id', chat_id)
      .eq('clinic_id', clinic_id)
      .single();

    if (chatError || !chatData) {
      logError('Chat or lead information not found', { chat_id, clinic_id, error: chatError });
      return createResponse({
        success: false,
        error: 'Chat or lead information not found'
      }, 404);
    }

    const leadEmail = chatData.leads.email;
    const leadName = chatData.leads.name || 'Patient';
    
    logInfo('Chat and lead data fetched', { 
      chatId: chat_id, 
      leadEmail, 
      leadName, 
      currentStatus: chatData.status 
    });

    // Fetch recent chat messages (last 20 for better context)
    const { data: messagesData, error: messagesError } = await supabaseClient
      .from('chat_messages')
      .select('id, message, is_from_user, timestamp, sender_type')
      .eq('thread_id', chat_id)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (messagesError) {
      logError('Error fetching chat messages', { chat_id, error: messagesError });
      return createResponse({
        success: false,
        error: 'Error fetching chat messages'
      }, 500);
    }

    if (!messagesData || messagesData.length === 0) {
      logWarning('No messages found for chat', { chat_id });
      return createResponse({
        success: true,
        action: 'no_messages',
        message: 'No messages found to process'
      });
    }

    logInfo('Messages fetched', { messageCount: messagesData.length });

    // Reverse messages to get chronological order for analysis
    const chronologicalMessages = messagesData.reverse();

    // Analyze messages for meeting/appointment requests using OpenAI
    const messagesText = chronologicalMessages
      .map(m => `${m.is_from_user ? 'User' : 'Assistant'}: ${m.message}`)
      .join('\n');

    logInfo('Starting OpenAI analysis');

    const analysisPrompt = `
      Analyze the following conversation to determine if the user has requested a meeting, appointment, or booking.
      Look for keywords like: "book", "appointment", "meeting", "schedule", "consultation", "visit", "see doctor", etc.
      
      Return a JSON object with:
      - meetingRequested: boolean (true if user has asked for meeting/appointment/booking)
      - serviceType: string or null (type of service if mentioned: "consultation", "botox", "dental", "general checkup", etc.)
      - urgency: string or null ("urgent" if they mention urgency, otherwise null)

      Conversation:
      ${messagesText}
    `;

    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: analysisPrompt }],
      response_format: { type: 'json_object' }
    });

    const analysisResult = JSON.parse(analysisResponse.choices[0].message.content);
    const { meetingRequested, serviceType, urgency } = analysisResult;

    logInfo('OpenAI analysis completed', analysisResult);

    // Initialize SMTP client from request data or environment
    const smtpHost = requestData.smtp_host || Deno.env.get('SMTP_HOST');
    const smtpPort = requestData.smtp_port || Deno.env.get('SMTP_PORT') || '465';
    const smtpUser = requestData.smtp_user || requestData.smtp_username || Deno.env.get('SMTP_USER') || Deno.env.get('SMTP_USERNAME');
    const smtpPassword = requestData.smtp_password || Deno.env.get('SMTP_PASSWORD');

    // Validate SMTP configuration
    if (!smtpHost || !smtpUser || !smtpPassword) {
      logError('Missing SMTP configuration', { 
        hasHost: !!smtpHost, 
        hasUser: !!smtpUser, 
        hasPassword: !!smtpPassword,
        requestData: {
          smtp_host: requestData.smtp_host,
          smtp_user: requestData.smtp_user,
          smtp_username: requestData.smtp_username,
          smtp_password: !!requestData.smtp_password
        }
      });
      
      return createResponse({
        success: false,
        error: 'SMTP configuration required: Please provide smtp_host, smtp_user (or smtp_username), and smtp_password in request body or environment variables'
      }, 400);
    }

    const smtpClient = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: parseInt(smtpPort),
        tls: true,
        auth: { 
          username: smtpUser, 
          password: smtpPassword 
        }
      }
    });

    try {
      // STEP 1: Check if they asked for meeting/appointment
      if (meetingRequested) {
        logInfo('Meeting requested - checking meetings table for existing record');
        
        // STEP 2: Check meetings table for existing record
        const { data: existingMeeting, error: meetingError } = await supabaseClient
          .from('meetings')
          .select('id, meeting_time, meeting_link, status, meeting_notes')
          .eq('lead_email', leadEmail)
          .eq('clinic_id', clinic_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (meetingError && meetingError.code !== 'PGRST116') {
          logError('Error checking existing meetings', { leadEmail, error: meetingError });
          return createResponse({
            success: false,
            error: 'Error checking existing meetings'
          }, 500);
        }

        if (existingMeeting && existingMeeting.meeting_time) {
          // STEP 3: Existing meeting found - send reminder + ask for feedback
          const meetingTime = new Date(existingMeeting.meeting_time);
          const now = new Date();
          
          logInfo('Existing meeting found', { 
            meetingTime: meetingTime.toISOString(), 
            isFuture: meetingTime > now 
          });

          // Meeting reminder + feedback request message
          const reminderMessage = `Great! I see you have an upcoming ${serviceType || 'appointment'} scheduled for ${meetingTime.toLocaleDateString()} at ${meetingTime.toLocaleTimeString()}.

${existingMeeting.meeting_link ? `🔗 Meeting Link: ${existingMeeting.meeting_link}\n` : ''}${clinicData.calendly_link ? `📅 To reschedule if needed: ${clinicData.calendly_link}\n` : ''}
We're looking forward to seeing you!

How has your experience with ${clinicData.name} been so far? We'd love to hear your feedback to help us serve you better! 😊`;

          // Meeting reminder email
          const emailSubject = `Upcoming Appointment Reminder - ${clinicData.name}`;
          const emailContent = `Dear ${leadName},

This is a friendly reminder about your upcoming ${serviceType || 'appointment'} with ${clinicData.name}.

📅 Date & Time: ${meetingTime.toLocaleDateString()} at ${meetingTime.toLocaleTimeString()}
${existingMeeting.meeting_link ? `🔗 Meeting Link: ${existingMeeting.meeting_link}\n` : ''}${clinicData.calendly_link ? `📅 To reschedule: ${clinicData.calendly_link}\n` : ''}
We look forward to seeing you soon!

Best regards,
${clinicData.name} Team
${clinicData.phone ? `📞 ${clinicData.phone}` : ''}`;

          await smtpClient.send({
            from: smtpUser,
            to: leadEmail,
            subject: emailSubject,
            content: emailContent
          });

          // Store reminder message in chat
          await supabaseClient
            .from('chat_messages')
            .insert({
              thread_id: chat_id,
              message: reminderMessage,
              is_from_user: false,
              sender_type: 'assistant',
              timestamp: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          // Update chat status
          await supabaseClient
            .from('chat')
            .update({ 
              status: 'meeting_reminded',
              updated_at: new Date().toISOString()
            })
            .eq('id', chat_id);

          logInfo('Meeting reminder sent and feedback requested', { 
            action: 'meeting_reminder_sent',
            executionTime: Date.now() - startTime 
          });

          return createResponse({
            success: true,
            action: 'meeting_reminder_sent',
            message: 'Meeting reminder email sent and feedback requested',
            meetingDetails: {
              time: existingMeeting.meeting_time,
              link: existingMeeting.meeting_link
            }
          });
        } else {
          // STEP 4: No existing meeting - provide booking link
          logInfo('No existing meeting found - providing booking link');
          
          // Booking link provision message
          const bookingMessage = `I'd be happy to help you schedule ${urgency === 'urgent' ? 'an urgent ' : ''}${serviceType ? `a ${serviceType}` : 'an appointment'} with ${clinicData.name}!

${clinicData.calendly_link ? `📅 **Book Your Appointment:** ${clinicData.calendly_link}\n` : '🏥 **Please call us to schedule:** '}${clinicData.business_hours ? `⏰ **Business Hours:** ${clinicData.business_hours}\n` : ''}${clinicData.phone ? `📞 **Phone:** ${clinicData.phone}\n` : ''}
Let me know if you need any assistance with the booking process! 😊`;

          // Booking information email
          const emailSubject = `Appointment Booking - ${clinicData.name}`;
          const emailContent = `Dear ${leadName},

Thank you for your interest in scheduling ${serviceType ? `a ${serviceType}` : 'an appointment'} with ${clinicData.name}.

${clinicData.calendly_link ? `📅 Book Your Appointment: ${clinicData.calendly_link}\n\n` : ''}${clinicData.business_hours ? `⏰ Business Hours: ${clinicData.business_hours}\n` : ''}${clinicData.phone ? `📞 Phone: ${clinicData.phone}\n` : ''}
We look forward to serving you!

Best regards,
${clinicData.name} Team`;

          await smtpClient.send({
            from: smtpUser,
            to: leadEmail,
            subject: emailSubject,
            content: emailContent
          });

          // Create pending meeting record
          await supabaseClient
            .from('meetings')
            .insert({
              clinic_id: clinic_id,
              lead_email: leadEmail,
              lead_name: leadName,
              service_type: serviceType || 'General',
              urgency: urgency || 'Normal',
              status: 'pending',
              meeting_notes: `Chat ID: ${chat_id}, Service: ${serviceType || 'General'}, Urgency: ${urgency || 'Normal'}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          // Store booking message in chat
          await supabaseClient
            .from('chat_messages')
            .insert({
              thread_id: chat_id,
              message: bookingMessage,
              is_from_user: false,
              sender_type: 'assistant',
              timestamp: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          // Update chat status
          await supabaseClient
            .from('chat')
            .update({ 
              status: 'booking_link_provided',
              updated_at: new Date().toISOString()
            })
            .eq('id', chat_id);

          logInfo('Booking link provided', { 
            action: 'booking_link_provided',
            executionTime: Date.now() - startTime 
          });

          return createResponse({
            success: true,
            action: 'booking_link_provided',
            message: 'Booking link provided and email sent',
            bookingLink: clinicData.calendly_link
          });
        }
      } else {
        // STEP 5: No meeting request - share clinic info with business hours + booking link
        logInfo('No meeting request detected - sharing clinic info with booking option');
        
        // Clinic information with booking option message
        const clinicInfoMessage = `Hello ${leadName}! 👋

Welcome to ${clinicData.name}. We're here to help with all your healthcare needs.

🏥 **Our Services Include:**
• General consultations
• Preventive care  
• Minor procedures
• Specialized treatments

${clinicData.business_hours ? `⏰ **Business Hours:** ${clinicData.business_hours}\n` : ''}${clinicData.phone ? `📞 **Phone:** ${clinicData.phone}\n` : ''}${clinicData.calendly_link ? `📅 **Book an Appointment:** ${clinicData.calendly_link}\n` : ''}
Feel free to ask any questions about our services or book an appointment anytime! 😊`;

        // Welcome email with clinic information
        const emailSubject = `Welcome to ${clinicData.name}`;
        const emailContent = `Dear ${leadName},

Thank you for contacting ${clinicData.name}!

We're committed to providing you with excellent healthcare services.

${clinicData.business_hours ? `⏰ Business Hours: ${clinicData.business_hours}\n` : ''}${clinicData.phone ? `📞 Phone: ${clinicData.phone}\n` : ''}${clinicData.calendly_link ? `📅 Book an Appointment: ${clinicData.calendly_link}\n` : ''}
Please don't hesitate to reach out if you have any questions or would like to schedule an appointment.

Best regards,
${clinicData.name} Team`;

        await smtpClient.send({
          from: smtpUser,
          to: leadEmail,
          subject: emailSubject,
          content: emailContent
        });

        // Store clinic info message in chat
        await supabaseClient
          .from('chat_messages')
          .insert({
            thread_id: chat_id,
            message: clinicInfoMessage,
            is_from_user: false,
            sender_type: 'assistant',
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        // Update chat status
        await supabaseClient
          .from('chat')
          .update({ 
            status: 'clinic_info_shared',
            updated_at: new Date().toISOString()
          })
          .eq('id', chat_id);

        // Create pending meeting record for tracking
        await supabaseClient
          .from('meetings')
          .insert({
            clinic_id: clinic_id,
            lead_email: leadEmail,
            lead_name: leadName,
            service_type: 'General',
            urgency: 'Normal',
            status: 'pending',
            meeting_notes: `Chat ID: ${chat_id}, Initial contact - clinic info shared`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        logInfo('Clinic information shared with booking option', { 
          action: 'clinic_info_shared',
          executionTime: Date.now() - startTime 
        });

        return createResponse({
          success: true,
          action: 'clinic_info_shared',
          message: 'Clinic information shared with booking option and welcome email sent'
        });
      }
    } finally {
      await smtpClient.close();
    }

  } catch (error) {
    logError('Error in nurturing process', error);
    return createResponse({
      success: false,
      error: `Internal server error: ${error.message}`,
      executionTime: Date.now() - startTime
    }, 500);
  }
});

// Batch processing function
async function processBatchNurturing(
  supabaseClient: any, 
  openai: any, 
  options: { clinic_id?: string, process_all_chats: boolean, hours_threshold: number }
) {
  const batchStartTime = Date.now();
  logInfo('Starting batch processing', options);
  const thresholdDate = new Date(Date.now() - options.hours_threshold * 60 * 60 * 1000);


  try {
    let query = supabaseClient
      .from('threads')
      .select(`
        id,
        clinic_id,
        lead_id,
        status,
        updated_at,
        openai_thread_id,
        leads!threads_lead_id_fkey(id, email, first_name, last_name, phone)
      `)
      .eq('status', 'new');

    // Filter by clinic if specified
    if (options.clinic_id && !options.process_all_chats) {
      query = query.eq('clinic_id', options.clinic_id);
      logInfo('Filtering by clinic_id', { clinic_id: options.clinic_id });
    }

    // First get threads, then manually join with leads data
    const { data: threadsData, error: threadsError } = await supabaseClient
      .from('threads')
      .select('id, clinic_id, lead_id, status, updated_at, openai_thread_id')
      .eq('status', 'new')
      .lt('updated_at', thresholdDate.toISOString());

    if (threadsError) {
      logError('Error fetching threads for batch processing', threadsError);
      return createResponse({
        success: false,
        error: 'Error fetching threads for batch processing'
      }, 500);
    }

    if (!threadsData || threadsData.length === 0) {
      logInfo('No threads to process');
      return createResponse({
        success: true,
        message: 'No threads found for processing',
        summary: {
          total_processed: 0,
          successful: 0,
          failed: 0
        }
      });
    }

    // Get all unique lead IDs
    const leadIds = [...new Set(threadsData.map(t => t.lead_id))];
    
    // Fetch leads data
    const { data: leadsData, error: leadsError } = await supabaseClient
      .from('lead')
      .select('id, email, first_name, last_name, phone')
      .in('id', leadIds);

    if (leadsError) {
      logError('Error fetching leads data', leadsError);
      return createResponse({
        success: false,
        error: 'Error fetching leads data'
      }, 500);
    }

    // Create a map for quick lead lookup
    const leadsMap = new Map(leadsData.map(lead => [lead.id, lead]));

    // Combine thread and lead data
    const threadsToProcess = threadsData
      .map(thread => ({
        ...thread,
        leads: leadsMap.get(thread.lead_id)
      }))
      .filter(thread => thread.leads && thread.leads.email); // Only process threads with valid lead email

    // Filter by clinic if specified (after manual join)
    const filteredThreads = options.clinic_id && !options.process_all_chats 
      ? threadsToProcess.filter(thread => thread.clinic_id === options.clinic_id)
      : threadsToProcess;


    // Filter by clinic if specified
    if (options.clinic_id && !options.process_all_chats) {
      logInfo('Filtering by clinic_id', { clinic_id: options.clinic_id });
    }

    const results = [];
    const batchSize = 5;

    for (let i = 0; i < filteredThreads.length; i += batchSize) {
      const batch = filteredThreads.slice(i, i + batchSize);
      logInfo(`Processing batch ${Math.floor(i / batchSize) + 1}`, { 
        batchSize: batch.length,
        startIndex: i 
      });

      const batchPromises = batch.map(async (thread) => {
        try {
          return await processSingleChat(supabaseClient, openai, thread);
        } catch (error) {
          logError(`Error processing thread ${thread.id}`, error);
          return {
            thread_id: thread.id,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      logInfo(`Batch ${Math.floor(i / batchSize) + 1} completed`, {
        successful: batchResults.filter(r => r.success).length,
        failed: batchResults.filter(r => !r.success).length
      });

      // Small delay between batches
      if (i + batchSize < filteredThreads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const summary = {
      total_processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      execution_time: Date.now() - batchStartTime
    };

    logInfo('Batch processing completed', summary);

    return createResponse({
      success: true,
      message: `Batch processing completed. Processed ${results.length} threads.`,
      results: results,
      summary: summary
    });

  } catch (error) {
    logError('Batch processing error', error);
    return createResponse({
      success: false,
      error: `Batch processing error: ${error.message}`,
      execution_time: Date.now() - batchStartTime
    }, 500);
  }
}

// Process individual chat function for batch processing
async function processSingleChat(
  supabaseClient: any,
  openai: any,
  threadData: any
) {
  const thread_id = threadData.id;
  const clinic_id = threadData.clinic_id;
  const leadEmail = threadData.leads.email;
  const leadName = (threadData.leads.first_name || '') + ' ' + (threadData.leads.last_name || '') || 'Patient';

  logInfo(`Processing individual thread: ${thread_id}`, { leadEmail, leadName, clinic_id });

  // Fetch clinic information first
  const { data: clinicData, error: clinicError } = await supabaseClient
    .from('clinic')
    .select('name, email, phone, business_hours, calendly_link')
    .eq('id', clinic_id)
    .single();

  if (clinicError || !clinicData) {
    logError(`Clinic not found for clinic_id: ${clinic_id}`, clinicError);
    return {
      thread_id,
      success: false,
      error: `Clinic not found for clinic_id: ${clinic_id}`
    };
  }

  // Fetch SMTP configuration from email_settings table for this clinic
  const { data: emailSettings, error: emailSettingsError } = await supabaseClient
    .from('email_settings')
    .select('smtp_host, smtp_port, smtp_user, smtp_password, smtp_sender_name, smtp_sender_email, smtp_use_tls')
    .eq('clinic_id', clinic_id)
    .single();

  if (emailSettingsError || !emailSettings) {
    logError(`No email settings found for clinic ${clinic_id}`, emailSettingsError);
    return {
      thread_id,
      success: false,
      error: `No email configuration found for clinic ${clinic_id}`
    };
  }

  // Validate SMTP configuration from database
  if (!emailSettings.smtp_host || !emailSettings.smtp_user || !emailSettings.smtp_password) {
    logError('Incomplete SMTP configuration in database', {
      clinic_id,
      hasHost: !!emailSettings.smtp_host,
      hasUser: !!emailSettings.smtp_user,
      hasPassword: !!emailSettings.smtp_password
    });
    return {
      thread_id,
      success: false,
      error: 'Incomplete SMTP configuration in database'
    };
  }

  logInfo(`Using SMTP config for clinic ${clinic_id}`, {
    smtp_host: emailSettings.smtp_host,
    smtp_port: emailSettings.smtp_port,
    smtp_user: emailSettings.smtp_user,
    smtp_use_tls: emailSettings.smtp_use_tls
  });

  // Fetch recent conversation messages
  const { data: messagesData, error: messagesError } = await supabaseClient
    .from('conversation')
    .select('id, message, is_from_user, timestamp, sender_type')
    .eq('thread_id', thread_id)
    .order('timestamp', { ascending: false })
    .limit(20);

  if (messagesError) {
    logError(`Error fetching messages for thread ${thread_id}`, messagesError);
    throw new Error('Error fetching conversation messages');
  }

  if (!messagesData || messagesData.length === 0) {
    logInfo(`No messages found for thread ${thread_id}`);
    return {
      thread_id,
      success: true,
      action: 'skipped',
      message: 'No messages found'
    };
  }

  const chronologicalMessages = messagesData.reverse();
  const messagesText = chronologicalMessages
    .map(m => `${m.is_from_user ? 'User' : 'Assistant'}: ${m.message}`)
    .join('\n');

  const analysisPrompt = `
    Analyze the following conversation to determine if the user has requested a meeting, appointment, or booking.
    Look for keywords like: "book", "appointment", "meeting", "schedule", "consultation", "visit", "see doctor", etc.
    
    Return a JSON object with:
    - meetingRequested: boolean (true if user has asked for meeting/appointment/booking)
    - serviceType: string or null (type of service if mentioned)
    - urgency: string or null ("urgent" if they mention urgency, otherwise null)

    Conversation:
    ${messagesText}
  `;

  const analysisResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: analysisPrompt }],
    response_format: { type: 'json_object' }
  });

  const analysisResult = JSON.parse(analysisResponse.choices[0].message.content);
  const { meetingRequested, serviceType, urgency } = analysisResult;

  logInfo(`Analysis result for thread ${thread_id}`, analysisResult);

  const smtpClient = new SMTPClient({
    connection: {
      hostname: emailSettings.smtp_host,
      port: parseInt(emailSettings.smtp_port.toString()),
      tls: emailSettings.smtp_use_tls,
      auth: { 
        username: emailSettings.smtp_user, 
        password: emailSettings.smtp_password 
      }
    }
  });

  let result = {
    thread_id,
    success: true,
    action: 'no_action',
    message: 'No action required'
  };

  try {
    if (meetingRequested) {
      // Check for existing meeting in meetings table
      const { data: existingMeeting } = await supabaseClient
        .from('meetings')
        .select('id, meeting_time, meeting_link, status')
        .eq('lead_email', leadEmail)
        .eq('clinic_id', clinic_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingMeeting && existingMeeting.meeting_time) {
        // Send meeting reminder + feedback request
        const meetingTime = new Date(existingMeeting.meeting_time);
        const reminderMessage = `I see you have an upcoming ${serviceType || 'appointment'} scheduled for ${meetingTime.toLocaleDateString()} at ${meetingTime.toLocaleTimeString()}. 

${existingMeeting.meeting_link ? `🔗 Meeting Link: ${existingMeeting.meeting_link}\n` : ''}
How has your experience with ${clinicData.name} been so far? We'd love your feedback! 😊`;

        // Send email reminder
        const emailSubject = `Appointment Reminder - ${clinicData.name}`;
        const emailContent = `Dear ${leadName},

Reminder: You have an upcoming ${serviceType || 'appointment'} scheduled for ${meetingTime.toLocaleDateString()} at ${meetingTime.toLocaleTimeString()}.

${existingMeeting.meeting_link ? `Meeting Link: ${existingMeeting.meeting_link}\n` : ''}
We look forward to seeing you!

Best regards,
${clinicData.name} Team`;

        await smtpClient.send({
          from: emailSettings.smtp_sender_email || emailSettings.smtp_user,
          to: leadEmail,
          subject: emailSubject,
          content: emailContent
        });

        await supabaseClient
          .from('conversation')
          .insert({
            thread_id: thread_id,
            message: reminderMessage,
            is_from_user: false,
            sender_type: 'assistant',
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        await supabaseClient
          .from('threads')
          .update({ 
            status: 'meeting_reminded',
            updated_at: new Date().toISOString()
          })
          .eq('id', thread_id);

        result = {
          thread_id,
          success: true,
          action: 'meeting_reminder_sent',
          message: 'Meeting reminder and feedback request sent'
        };
      } else {
        // Provide booking link
        const bookingMessage = `I'd be happy to help you schedule ${serviceType ? `a ${serviceType}` : 'an appointment'}! 

${clinicData.calendly_link ? `📅 Book here: ${clinicData.calendly_link}` : 'Please call us to schedule.'}

${clinicData.business_hours ? `⏰ Business Hours: ${clinicData.business_hours}\n` : ''}${clinicData.phone ? `📞 Phone: ${clinicData.phone}` : ''}`;

        // Send booking email
        const emailSubject = `Appointment Booking - ${clinicData.name}`;
        const emailContent = `Dear ${leadName},

Thank you for your interest in scheduling ${serviceType ? `a ${serviceType}` : 'an appointment'}.

${clinicData.calendly_link ? `📅 Book Your Appointment: ${clinicData.calendly_link}\n` : ''}${clinicData.business_hours ? `⏰ Business Hours: ${clinicData.business_hours}\n` : ''}${clinicData.phone ? `📞 Phone: ${clinicData.phone}\n` : ''}
We look forward to serving you!

Best regards,
${clinicData.name} Team`;

        await smtpClient.send({
          from: emailSettings.smtp_sender_email || emailSettings.smtp_user,
          to: leadEmail,
          subject: emailSubject,
          content: emailContent
        });

        // Create pending meeting record
        await supabaseClient
          .from('meetings')
          .insert({
            clinic_id: clinic_id,
            lead_email: leadEmail,
            lead_name: leadName,
            service_type: serviceType || 'General',
            urgency: urgency || 'Normal',
            status: 'pending',
            meeting_notes: `Thread ID: ${thread_id}, Service: ${serviceType || 'General'}, Urgency: ${urgency || 'Normal'}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        await supabaseClient
          .from('conversation')
          .insert({
            thread_id: thread_id,
            message: bookingMessage,
            is_from_user: false,
            sender_type: 'assistant',
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        await supabaseClient
          .from('threads')
          .update({ 
            status: 'booking_link_provided',
            updated_at: new Date().toISOString()
          })
          .eq('id', thread_id);

        result = {
          thread_id,
          success: true,
          action: 'booking_link_provided',
          message: 'Booking link provided and email sent'
        };
      }
    } else {
      // No meeting request - share clinic info with booking option
      const clinicInfoMessage = `Hello ${leadName}! 👋

Welcome to ${clinicData.name}. We're here to help with all your healthcare needs.

${clinicData.business_hours ? `⏰ Business Hours: ${clinicData.business_hours}\n` : ''}${clinicData.phone ? `📞 Phone: ${clinicData.phone}\n` : ''}${clinicData.calendly_link ? `📅 Book an appointment: ${clinicData.calendly_link}\n` : ''}
Feel free to ask any questions about our services! 😊`;

      // Send welcome email
      const emailSubject = `Welcome to ${clinicData.name}`;
      const emailContent = `Dear ${leadName},

Thank you for contacting ${clinicData.name}!

We're committed to providing excellent healthcare services.

${clinicData.business_hours ? `⏰ Business Hours: ${clinicData.business_hours}\n` : ''}${clinicData.phone ? `📞 Phone: ${clinicData.phone}\n` : ''}${clinicData.calendly_link ? `📅 Book an Appointment: ${clinicData.calendly_link}\n` : ''}
Please don't hesitate to reach out with any questions.

Best regards,
${clinicData.name} Team`;

      await smtpClient.send({
        from: emailSettings.smtp_sender_email || emailSettings.smtp_user,
        to: leadEmail,
        subject: emailSubject,
        content: emailContent
      });

      // Create pending meeting record for tracking
      await supabaseClient
        .from('meetings')
        .insert({
          clinic_id: clinic_id,
          lead_email: leadEmail,
          lead_name: leadName,
          service_type: 'General',
          urgency: 'Normal',
          status: 'pending',
          meeting_notes: `Thread ID: ${thread_id}, Initial contact - clinic info shared`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      await supabaseClient
        .from('conversation')
        .insert({
          thread_id: thread_id,
          message: clinicInfoMessage,
          is_from_user: false,
          sender_type: 'assistant',
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      await supabaseClient
        .from('threads')
        .update({ 
          status: 'clinic_info_shared',
          updated_at: new Date().toISOString()
        })
        .eq('id', thread_id);

      result = {
        thread_id,
        success: true,
        action: 'clinic_info_shared',
        message: 'Clinic information shared'
      };
    }

  } catch (error) {
    logError(`Error processing thread ${thread_id}`, error);
    result = {
      thread_id,
      success: false,
      error: error.message
    };
  } finally {
    await smtpClient.close();
  }

  return result;
}