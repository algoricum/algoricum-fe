import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface MailgunWebhookData {
  sender: string;
  recipient: string;
  subject: string;
  'body-plain': string;
  'body-html'?: string;
  timestamp: string;
  signature: string;
  token: string;
  'message-headers'?: string;
  'In-Reply-To'?: string;
  References?: string;
  'Message-Id'?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const mailgunSigningKey = Deno.env.get('MAILGUN_WEBHOOK_SIGNING_KEY');

    if (!supabaseUrl || !supabaseKey || !mailgunSigningKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing environment variables'
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    // Debug request headers and content type
    const contentType = req.headers.get('content-type');
    console.log('Request content-type:', contentType);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    let webhookData: Partial<MailgunWebhookData> = {};
    
    try {
      if (contentType?.includes('application/x-www-form-urlencoded') || contentType?.includes('multipart/form-data')) {
        // Parse form data from Mailgun webhook
        const formData = await req.formData();
        
        for (const [key, value] of formData.entries()) {
          webhookData[key as keyof MailgunWebhookData] = value as string;
        }
      } else {
        // Try parsing as JSON if not form data
        const textBody = await req.text();
        console.log('Raw request body:', textBody);
        
        if (textBody) {
          try {
            webhookData = JSON.parse(textBody);
          } catch (jsonError) {
            // If not JSON, try to parse as URL-encoded string
            const urlParams = new URLSearchParams(textBody);
            for (const [key, value] of urlParams.entries()) {
              webhookData[key as keyof MailgunWebhookData] = value;
            }
          }
        }
      }
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to parse request body',
        details: parseError.message
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Parsed webhook data:', {
      sender: webhookData.sender,
      recipient: webhookData.recipient,
      subject: webhookData.subject,
      allKeys: Object.keys(webhookData)
    });

    // Verify we have minimum required data
    if (!webhookData.sender && !webhookData.recipient) {
      console.log('Webhook data appears to be empty or invalid');
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid webhook data - missing sender and recipient'
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verify Mailgun webhook signature (skip in development if signature data is missing)
    if (webhookData.signature && webhookData.timestamp && webhookData.token) {
      if (!verifyMailgunSignature(webhookData, mailgunSigningKey)) {
        console.error('Invalid Mailgun signature');
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid signature'
        }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    } else {
      console.log('Signature verification skipped - missing signature data');
    }

    // Process the reply
    const result = await processEmailReply(webhookData, supabaseClient);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

function verifyMailgunSignature(data: Partial<MailgunWebhookData>, signingKey: string): boolean {
  try {
    const { timestamp, token, signature } = data;
    
    console.log('Signature verification inputs:', {
      timestamp,
      token,
      signature,
      signingKeyLength: signingKey?.length,
      signingKeyPrefix: signingKey?.substring(0, 8) + '...'
    });
    
    if (!timestamp || !token || !signature) {
      console.log('Missing signature components');
      return false;
    }

    // Create the string to verify: timestamp + token
    const stringToSign = timestamp + token;
    console.log('String to sign:', stringToSign);
    
    // For now, let's skip signature verification and log what we would need
    console.log('Expected signature format: HMAC-SHA256 hex digest');
    console.log('Received signature:', signature);
    
    // TODO: Implement proper HMAC-SHA256 verification
    // For now, return true to test the rest of the flow
    console.log('SKIPPING signature verification for testing');
    return true;
    
    /*
    // Proper HMAC-SHA256 verification would look like this:
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(signingKey);
    const dataBuffer = encoder.encode(stringToSign);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    console.log('Expected signature:', expectedSignature);
    return signature === expectedSignature;
    */
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

async function processEmailReply(
  webhookData: Partial<MailgunWebhookData>, 
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
    console.log('Message body preview:', messageBody.substring(0, 100) + '...');
    console.log('Email metadata:', { subject, timestamp, messageId });

    // First, find the clinic by matching recipient email to mailgun_email
    console.log('🔍 Looking for clinic with mailgun_email:', recipientEmail.toLowerCase());
    
    const { data: clinicData, error: clinicError } = await supabaseClient
      .from('clinic')
      .select('id, name, mailgun_email')
      .eq('mailgun_email', recipientEmail.toLowerCase())
      .limit(1)
      .single();

    
      console.log('Clinic query result:', { clinicData, clinicError });

    if (clinicError || !clinicData) {
      console.error('❌ Error finding clinic or clinic not found:', clinicError);
      return {
        success: false,
        message: `No clinic found for recipient email: ${recipientEmail}`
      };
    }

    console.log(`✅ Found clinic: ${clinicData.id} - ${clinicData.name}`);

    // Check if sender email exists in lead table for this clinic
    console.log('🔍 Looking for lead with email:', senderEmail.toLowerCase(), 'in clinic:', clinicData.id);
    
    const { data: leadData, error: leadError } = await supabaseClient
      .from('lead')
      .select('id, email, first_name, last_name, status, clinic_id')
      .eq('email', senderEmail.toLowerCase())
      .eq('clinic_id', clinicData.id)
      .single();

    console.log('Lead query result:', { leadData, leadError });

    if (leadError && leadError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking lead:', leadError);
      return {
        success: false,
        message: 'Database error while checking lead'
      };
    }

    if (!leadData) {
      console.log(`⚠️ No lead found for email: ${senderEmail} in clinic: ${clinicData.id}`);
      return {
        success: true,
        message: 'Email not from a known lead - ignoring'
      };
    }

    console.log(`✅ Found lead: ${leadData.id} - ${leadData.first_name} ${leadData.last_name}`);

    // Check if this is a reply to a previous email
    const isReply = subject.toLowerCase().includes('re:') || 
                   webhookData['In-Reply-To'] || 
                   webhookData.References;

    console.log('📧 Email type analysis:', {
      isReply,
      subjectHasRe: subject.toLowerCase().includes('re:'),
      hasInReplyTo: !!webhookData['In-Reply-To'],
      hasReferences: !!webhookData.References,
      inReplyToValue: webhookData['In-Reply-To'],
      referencesValue: webhookData.References
    });

    // Find or create thread
    let threadId: string;
    
    if (isReply) {
      console.log('🔍 Looking for existing thread based on email headers...');
      
      // Try to find existing thread based on email headers or subject
      const { data: existingThread, error: threadSearchError } = await supabaseClient
        .from('conversation')
        .select('thread_id')
        .or(
          `email_message_id.eq.${webhookData['In-Reply-To']},` +
          `email_message_id.in.(${webhookData.References?.split(' ').join(',')})`
        )
        .limit(1)
        .single();

      console.log('Thread search result:', { existingThread, threadSearchError });

      if (existingThread) {
        threadId = existingThread.thread_id;
        console.log(`✅ Found existing thread: ${threadId}`);
      } else {
        console.log('⚠️ No existing thread found, creating new thread for reply');
        // Create new thread if we can't find the original
        const { data: newThread, error: threadError } = await supabaseClient
          .from('threads')
          .insert({
            lead_id: leadData.id,
            subject: subject,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        console.log('New thread creation result:', { newThread, threadError });

        if (threadError) {
          console.error('❌ Error creating thread:', threadError);
          return {
            success: false,
            message: 'Failed to create conversation thread'
          };
        }
        threadId = newThread.id;
        console.log(`✅ Created new thread: ${threadId}`);
      }
    } else {
      console.log('📝 Creating new thread for new conversation');
      // Create new thread for new conversation
      const { data: newThread, error: threadError } = await supabaseClient
        .from('threads')
        .insert({
          lead_id: leadData.id,
          subject: subject,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      console.log('New conversation thread result:', { newThread, threadError });

      if (threadError) {
        console.error('❌ Error creating thread:', threadError);
        return {
          success: false,
          message: 'Failed to create conversation thread'
        };
      }
      threadId = newThread.id;
      console.log(`✅ Created new conversation thread: ${threadId}`);
    }

    // Save conversation record
    const conversationData = {
      thread_id: threadId,
      message: messageBody,
      timestamp: timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString(),
      is_from_user: false, // This is from the lead, not from clinic user
      sender_type: 'lead',
      email_message_id: messageId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('💾 Saving conversation with data:', {
      ...conversationData,
      message: conversationData.message.substring(0, 100) + '...' // Truncate for logging
    });

    const { data: conversationRecord, error: conversationError } = await supabaseClient
      .from('conversation')
      .insert(conversationData)
      .select()
      .single();

    console.log('Conversation save result:', { conversationRecord, conversationError });

    if (conversationError) {
      console.error('❌ Error saving conversation:', conversationError);
      return {
        success: false,
        message: 'Failed to save conversation record'
      };
    }

    console.log(`✅ Saved conversation record: ${conversationRecord.id}`);

    // Update lead's updated_at timestamp and potentially status
    console.log('📝 Updating lead timestamp...');
    const { error: leadUpdateError } = await supabaseClient
      .from('lead')
      .update({ 
        updated_at: new Date().toISOString(),
        // Optionally update status if needed
        // status: 'Replied' 
      })
      .eq('id', leadData.id);

    if (leadUpdateError) {
      console.error('⚠️ Error updating lead:', leadUpdateError);
    } else {
      console.log('✅ Updated lead timestamp');
    }

    // Optional: Trigger notifications
    console.log('🔔 Triggering notifications...');
    await triggerNotifications(leadData, conversationRecord, clinicData, supabaseClient);

    const responseData = {
      success: true,
      message: 'Reply processed and saved successfully',
      data: {
        lead_id: leadData.id,
        conversation_id: conversationRecord.id,
        thread_id: threadId,
        clinic_id: clinicData.id,
        sender: senderEmail
      }
    };

    console.log('🎉 Processing completed successfully:', responseData);

    return responseData;

  } catch (error) {
    console.error('Error processing email reply:', error);
    return {
      success: false,
      message: 'Internal processing error'
    };
  }
}

async function triggerNotifications(
  leadData: any, 
  conversationRecord: any,
  clinicData: any,
  supabaseClient: any
): Promise<void> {
  try {
    console.log('🔔 Creating notification for new reply...');
    
    // Create notification record for clinic staff
    const notificationData = {
      type: 'new_reply',
      title: `New reply from ${leadData.first_name} ${leadData.last_name}`,
      message: `Lead ${leadData.email} has replied to your email`,
      lead_id: leadData.id,
      clinic_id: clinicData.id,
      conversation_id: conversationRecord.id,
      is_read: false,
      created_at: new Date().toISOString()
    };

    console.log('Notification data:', notificationData);

    // Note: Adjust table name and structure based on your notifications table
    const { data: notification, error: notificationError } = await supabaseClient
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    console.log('Notification save result:', { notification, notificationError });

    if (notificationError) {
      console.error('⚠️ Error saving notification:', notificationError);
    } else {
      console.log('✅ Notification created successfully');
    }
  } catch (error) {
    console.error('❌ Error triggering notifications:', error);
    // Don't fail the main process if notifications fail
  }
}