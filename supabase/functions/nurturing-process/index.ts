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

    if (!supabaseUrl || !supabaseKey || !openaiKey) {
      logError('Missing environment variables');
      return createResponse({
        success: false,
        error: 'Server configuration error: Missing credentials'
      }, 500);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey, timeout: 30000, maxRetries: 2 });

    const requestData = await req.json();
    logInfo('Request received', requestData);

    const { 
      clinic_id, 
      lead_id, 
      cron_job = false, 
      process_all_chats = false,
      batch_process = false,
      hours_threshold = 24 
    } = requestData;

    // Handle batch processing
    if (cron_job || process_all_chats || batch_process) {
      logInfo('Starting batch processing', { cron_job, process_all_chats, batch_process });
      return await processBatchNurturing(supabaseClient, openai, {
        clinic_id,
        process_all_chats,
        hours_threshold
      });
    }

    // Handle single lead processing
    if (!clinic_id || !lead_id) {
      logError('Missing required fields', { clinic_id, lead_id });
      return createResponse({
        success: false,
        error: 'Missing required fields: clinic_id and lead_id'
      }, 400);
    }

    // Process single lead
    const { data: leadData, error: leadError } = await supabaseClient
      .from('lead')
      .select('id, email, first_name, last_name, status, clinic_id')
      .eq('id', lead_id)
      .eq('clinic_id', clinic_id)
      .single();

    if (leadError || !leadData) {
      logError('Lead not found', { lead_id, clinic_id, error: leadError });
      return createResponse({
        success: false,
        error: 'Lead not found'
      }, 404);
    }

    // Get email settings and clinic data
    const [emailSettingsResult, clinicResult] = await Promise.all([
      supabaseClient.from('email_settings').select('*').eq('clinic_id', clinic_id).single(),
      supabaseClient.from('clinic').select('*').eq('id', clinic_id).single()
    ]);

    if (emailSettingsResult.error || !emailSettingsResult.data) {
      return createResponse({
        success: false,
        error: 'Email settings not configured for this clinic'
      }, 404);
    }

    if (clinicResult.error || !clinicResult.data) {
      return createResponse({
        success: false,
        error: 'Clinic not found'
      }, 404);
    }

    const result = await processSingleLead(
      supabaseClient, 
      openai, 
      leadData, 
      emailSettingsResult.data,
      clinicResult.data
    );

    return createResponse({
      success: result.success,
      message: result.message || 'Lead processed',
      result: result,
      executionTime: Date.now() - startTime
    });

  } catch (error) {
    logError('Error in nurturing process', error);
    return createResponse({
      success: false,
      error: `Internal server error: ${error.message}`,
      executionTime: Date.now() - startTime
    }, 500);
  }
});

// Simplified batch processing function based on lead status
async function processBatchNurturing(
  supabaseClient: any, 
  openai: any, 
  options: { clinic_id?: string, process_all_chats: boolean, hours_threshold: number }
) {
  const batchStartTime = Date.now();
  logInfo('Starting simplified batch processing based on lead status', options);

  try {
    // Get leads that need nurturing based on status
    let leadsQuery = supabaseClient
      .from('lead')
      .select('id, email, first_name, last_name, status, clinic_id, updated_at')
      .in('status', ['new', 'needs-follow-up', 'cold', 'in-nurture', 'booked'])
      .not('email', 'is', null)
      .neq('email', '');

    // Filter by clinic if specified
    if (options.clinic_id && !options.process_all_chats) {
      leadsQuery = leadsQuery.eq('clinic_id', options.clinic_id);
      logInfo('Filtering by clinic_id', { clinic_id: options.clinic_id });
    }

    // Apply time threshold - only process leads updated before threshold
    if (options.hours_threshold > 0) {
      const thresholdDate = new Date(Date.now() - options.hours_threshold * 60 * 60 * 1000);
      leadsQuery = leadsQuery.lt('updated_at', thresholdDate.toISOString());
      logInfo('Applying time threshold filter', { 
        thresholdDate: thresholdDate.toISOString(),
        hours_threshold: options.hours_threshold 
      });
    }

    const { data: leadsData, error: leadsError } = await leadsQuery;

    if (leadsError) {
      logError('Error fetching leads for batch processing', leadsError);
      return createResponse({
        success: false,
        error: 'Error fetching leads for batch processing'
      }, 500);
    }

    if (!leadsData || leadsData.length === 0) {
      logInfo('No leads found for processing');
      return createResponse({
        success: true,
        message: 'No leads found for processing',
        summary: { total_processed: 0, successful: 0, failed: 0 }
      });
    }

    logInfo('Leads found for processing', {
      totalLeads: leadsData.length,
      statusBreakdown: leadsData.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {})
    });

    // Get all unique clinic IDs
    const clinicIds = [...new Set(leadsData.map(lead => lead.clinic_id))];

    // Fetch email settings for all clinics
    const { data: emailSettingsData, error: emailSettingsError } = await supabaseClient
      .from('email_settings')
      .select('clinic_id, smtp_host, smtp_user, smtp_password, smtp_port, smtp_use_tls, smtp_sender_email')
      .in('clinic_id', clinicIds);

    if (emailSettingsError) {
      logError('Error fetching email settings', emailSettingsError);
      return createResponse({
        success: false,
        error: 'Error fetching email settings'
      }, 500);
    }

    // Create email settings map
    const emailSettingsMap = new Map();
    if (emailSettingsData) {
      emailSettingsData
        .filter(settings => settings.smtp_host && settings.smtp_user && settings.smtp_password)
        .forEach(settings => {
          emailSettingsMap.set(settings.clinic_id, settings);
        });
    }

    // Fetch clinic data for all clinics
    const { data: clinicsData, error: clinicsError } = await supabaseClient
      .from('clinic')
      .select('id, name, phone, business_hours, booking_link')
      .in('id', clinicIds);

    if (clinicsError) {
      logError('Error fetching clinics data', clinicsError);
      return createResponse({
        success: false,
        error: 'Error fetching clinics data'
      }, 500);
    }

    const clinicsMap = new Map(clinicsData?.map(clinic => [clinic.id, clinic]) || []);

    // Filter leads that have both email settings and clinic data
    const leadsToProcess = leadsData.filter(lead => {
      const hasEmailSettings = emailSettingsMap.has(lead.clinic_id);
      const hasClinicData = clinicsMap.has(lead.clinic_id);
      
      if (!hasEmailSettings) {
        logInfo(`Skipping lead ${lead.id} - clinic ${lead.clinic_id} has no email configuration`);
        return false;
      }
      
      if (!hasClinicData) {
        logInfo(`Skipping lead ${lead.id} - clinic ${lead.clinic_id} data not found`);
        return false;
      }
      
      return true;
    });

    logInfo('Final leads to process', {
      totalLeadsWithEmailAndClinic: leadsToProcess.length,
      clinicsWithEmailConfig: emailSettingsMap.size
    });

    if (leadsToProcess.length === 0) {
      return createResponse({
        success: true,
        message: 'No leads left to process after filtering',
        summary: { total_processed: 0, successful: 0, failed: 0 }
      });
    }

    const results = [];
    const batchSize = 5;

    for (let i = 0; i < leadsToProcess.length; i += batchSize) {
      const batch = leadsToProcess.slice(i, i + batchSize);
      logInfo(`Processing batch ${Math.floor(i / batchSize) + 1}`, { 
        batchSize: batch.length,
        startIndex: i 
      });

      const batchPromises = batch.map(async (lead) => {
        try {
          return await processSingleLead(
            supabaseClient, 
            openai, 
            lead, 
            emailSettingsMap.get(lead.clinic_id),
            clinicsMap.get(lead.clinic_id)
          );
        } catch (error) {
          logError(`Error processing lead ${lead.id}`, error);
          return {
            lead_id: lead.id,
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
      if (i + batchSize < leadsToProcess.length) {
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
      message: `Batch processing completed. Processed ${results.length} leads.`,
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

// Process individual lead based on status
async function processSingleLead(
  supabaseClient: any,
  openai: any,
  leadData: any,
  emailSettings: any,
  clinicData: any
) {
  const leadId = leadData.id;
  const leadEmail = leadData.email;
  const leadName = `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || 'Patient';
  const leadStatus = leadData.status;
  const clinicId = leadData.clinic_id;

  logInfo(`Processing lead: ${leadId}`, { 
    leadEmail, 
    leadName, 
    leadStatus,
    clinicId 
  });

  let emailSubject = '';
  let emailContent = '';
  let conversationMessage = '';
  let newStatus = leadStatus;

  try {
    // Create SMTP client
    const smtpClient = new SMTPClient({
      connection: {
        hostname: emailSettings.smtp_host,
        port: parseInt(emailSettings.smtp_port?.toString() || '465'),
        tls: emailSettings.smtp_use_tls !== false,
        auth: { 
          username: emailSettings.smtp_user, 
          password: emailSettings.smtp_password 
        }
      }
    });

    if (leadStatus === 'new') {
      // First interaction - welcome message
      emailSubject = `Welcome to ${clinicData.name}!`;
      
      const welcomePrompt = `Create a brief, warm welcome email (1 paragraph only) for ${leadName} who just contacted ${clinicData.name}. Welcome them, mention you're here to help with their healthcare needs, and include the booking link: ${clinicData.booking_link || 'call us to schedule'}. Keep it under 60 words and friendly.`;

      const welcomeResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: welcomePrompt }],
        max_tokens: 100
      });

      emailContent = welcomeResponse.choices[0].message.content;
      conversationMessage = `Welcome! I'm here to help you with any questions about ${clinicData.name}. Feel free to ask about our services or book an appointment! 😊`;
      newStatus = 'responded';

    } else if (['needs-follow-up', 'cold', 'in-nurture'].includes(leadStatus)) {
      // Get last conversation to provide context
      const { data: lastConversation } = await supabaseClient
        .from('conversation')
        .select('message, timestamp, is_from_user')
        .eq('lead_id', leadId)
        .order('timestamp', { ascending: false })
        .limit(5);

      const conversationContext = lastConversation 
        ? lastConversation.map(c => `${c.is_from_user ? 'Patient' : 'Assistant'}: ${c.message}`).join('\n')
        : 'No previous conversation found';

      emailSubject = `Following up on your inquiry - ${clinicData.name}`;

      const followUpPrompt = `Create a brief follow-up email (1 paragraph only) for ${leadName} regarding their inquiry at ${clinicData.name}. Reference that you wanted to follow up, offer help, and include booking link: ${clinicData.booking_link || 'call to schedule'}. Keep it under 60 words and conversational.`;

      const followUpResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: followUpPrompt }],
        max_tokens: 100
      });

      emailContent = followUpResponse.choices[0].message.content;
      
      conversationMessage = `Hi ${leadName}! I wanted to follow up on our previous conversation. ${clinicData.booking_link ? `If you're ready to book an appointment, you can do so here: ${clinicData.booking_link}` : `Please call us to schedule: ${clinicData.phone}`}

Is there anything specific I can help you with today? 😊`;
      
      newStatus = 'in-nurture';

    } else if (leadStatus === 'booked') {
      // Lead expressed intent but hasn't confirmed
      emailSubject = `Ready to confirm your appointment with ${clinicData.name}?`;

      const bookingPrompt = `Create a brief email (1 paragraph only) for ${leadName} who showed interest in booking at ${clinicData.name} but hasn't confirmed. Gently remind them to complete booking and include link: ${clinicData.booking_link || 'call to schedule'}. Keep it under 60 words and encouraging.`;

      const bookingResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: bookingPrompt }],
        max_tokens: 100
      });

      emailContent = bookingResponse.choices[0].message.content;
      
      conversationMessage = `Hi ${leadName}! I see you're interested in booking an appointment with us. ${clinicData.booking_link ? `You can complete your booking here: ${clinicData.booking_link}` : `Please call us to schedule: ${clinicData.phone}`}

I'm here if you have any questions about our services! 📅`;
      
      // Keep status as 'booked' until they actually confirm
    }

    // Send email
    await smtpClient.send({
      from: emailSettings.smtp_sender_email || emailSettings.smtp_user,
      to: leadEmail,
      subject: emailSubject,
      content: emailContent
    });

    // Find or create thread for this lead
    let { data: existingThread } = await supabaseClient
      .from('thread')
      .select('id')
      .eq('lead_id', leadId)
      .eq('clinic_id', clinicId)
      .single();

    let threadId = existingThread?.id;

    if (!threadId) {
      // Create new thread
      const { data: newThread, error: threadError } = await supabaseClient
        .from('thread')
        .insert({
          lead_id: leadId,
          clinic_id: clinicId,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (threadError) {
        logError(`Error creating thread for lead ${leadId}`, threadError);
        threadId = null;
      } else {
        threadId = newThread.id;
      }
    }

    // Store conversation message if we have a thread
    if (threadId) {
      await supabaseClient
        .from('conversation')
        .insert({
          thread_id: threadId,
          message: conversationMessage,
          is_from_user: false,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

    // Update lead status
    await supabaseClient
      .from('lead')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId);

    await smtpClient.close();

    logInfo(`Successfully processed lead ${leadId}`, {
      oldStatus: leadStatus,
      newStatus: newStatus,
      emailSent: true
    });

    return {
      lead_id: leadId,
      success: true,
      action: `${leadStatus}_email_sent`,
      message: `Email sent for ${leadStatus} lead`,
      old_status: leadStatus,
      new_status: newStatus
    };

  } catch (error) {
    logError(`Error processing lead ${leadId}`, error);
    return {
      lead_id: leadId,
      success: false,
      error: error.message
    };
  }
}
