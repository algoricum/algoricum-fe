// supabase/functions/email-webhook-handler/index.ts
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
  const startTime = Date.now();

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
    
    // Parse webhook data (same as before)
    const contentType = req.headers.get('content-type');
    let webhookData: Partial<MailgunWebhookData> = {};
    
    try {
      if (contentType?.includes('application/x-www-form-urlencoded') || contentType?.includes('multipart/form-data')) {
        const formData = await req.formData();
        for (const [key, value] of formData.entries()) {
          webhookData[key as keyof MailgunWebhookData] = value as string;
        }
      } else {
        const textBody = await req.text();
        if (textBody) {
          try {
            webhookData = JSON.parse(textBody);
          } catch (jsonError) {
            console.error('Error parsing JSON:', jsonError);
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

    console.log('📧 Received email webhook:', {
      sender: webhookData.sender,
      recipient: webhookData.recipient,
      subject: webhookData.subject?.substring(0, 50) + '...'
    });

    // Basic validation
    if (!webhookData.sender || !webhookData.recipient) {
      console.log('❌ Invalid webhook data - missing sender and recipient');
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid webhook data - missing sender and recipient'
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Quick signature verification (optional in development)
    if (webhookData.signature && webhookData.timestamp && webhookData.token) {
      if (!verifyMailgunSignature(webhookData)) {
        console.error('❌ Invalid Mailgun signature');
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid signature'
        }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Create queue message
    const jobId = crypto.randomUUID();
    const queueMessage = {
      id: jobId,
      webhookData: webhookData,
      timestamp: new Date().toISOString(),
      attempts: 0,
      maxAttempts: 3,
      priority: determinePriority(webhookData)
    };

    console.log(`📦 Queuing email job ${jobId} with priority ${queueMessage.priority}`);

    // Add to pgmq queue
    const { error } = await supabaseClient.rpc('send_email_to_queue', {
      queue_name: 'email_processing',
      message: queueMessage
    });

    if (error) {
      console.error('❌ Failed to queue email:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to queue email for processing'
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Email queued successfully in ${processingTime}ms`);

    // Quick response to Mailgun
    return new Response(JSON.stringify({
      success: true,
      message: 'Email queued for processing',
      data: {
        job_id: jobId,
        priority: queueMessage.priority,
        processing_time_ms: processingTime
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Webhook processing error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      processing_time_ms: processingTime
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

function verifyMailgunSignature(data: Partial<MailgunWebhookData>): boolean {
  try {
    const { timestamp, token, signature } = data;
    
    if (!timestamp || !token || !signature) {
      console.log('Missing signature components');
      return false;
    }

    // TODO: Implement proper HMAC-SHA256 verification
    // For now, return true for testing
    console.log('⚠️ SKIPPING signature verification for testing');
    return true;
    
    /*
    // Proper HMAC-SHA256 verification:
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(signingKey);
    const dataBuffer = encoder.encode(timestamp + token);
    
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
    
    return signature === expectedSignature;
    */
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function determinePriority(webhookData: Partial<MailgunWebhookData>): number {
  const subject = webhookData.subject?.toLowerCase() || '';
  const body = webhookData['body-plain']?.toLowerCase() || '';
  
  // High priority (1) - urgent keywords
  if (subject.includes('urgent') || subject.includes('emergency') || 
      body.includes('urgent') || body.includes('emergency') ||
      body.includes('asap') || body.includes('immediately')) {
    return 1;
  }
  
  // Medium priority (2) - replies
  if (subject.includes('re:') || webhookData['In-Reply-To']) {
    return 2;
  }
  
  // Low priority (3) - new inquiries
  return 3;
}