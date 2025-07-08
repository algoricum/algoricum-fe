// supabase/functions/send-email/index.js
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { clinic_id, thread_id, message, to_email = null, subject = null } = await req.json();
    if (!clinic_id || !message) {
      return new Response(JSON.stringify({
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get email settings for the clinic
    const { data: emailSettings, error: settingsError } = await supabaseClient.from('email_settings').select('*').eq('clinic_id', clinic_id).single();
    if (settingsError || !emailSettings) {
      return new Response(JSON.stringify({
        error: 'Email settings not configured for this clinic'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get thread information
    let threadData = null;
    let recipientEmail = to_email;
    let emailSubject = subject;
    if (thread_id) {
      const { data: thread, error: threadError } = await supabaseClient.from('thread').select('email_from, email_subject').eq('id', thread_id).single();
      if (thread && !threadError) {
        threadData = thread;
        recipientEmail = recipientEmail || thread.email_from;
        emailSubject = emailSubject || `Re: ${thread.email_subject || 'Your inquiry'}`;
      }
    }
    if (!recipientEmail) {
      return new Response(JSON.stringify({
        error: 'No recipient email found'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get clinic information for personalization
    const { data: clinicData } = await supabaseClient.from('clinic').select('name').eq('id', clinic_id).single();
    const clinicName = clinicData?.name || 'Your Healthcare Provider';
    // Send the email
    const emailResult = await sendSMTPEmail(emailSettings, {
      to: recipientEmail,
      subject: emailSubject || `Message from ${clinicName}`,
      body: message,
      clinicName
    });
    if (!emailResult.success) {
      return new Response(JSON.stringify({
        error: 'Failed to send email',
        details: emailResult.error
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Store the sent message in conversation table
    if (thread_id) {
      const { error: conversationError } = await supabaseClient.from('conversation').insert({
        thread_id: thread_id,
        message: message,
        sender_type: 'assistant',
        timestamp: new Date().toISOString()
      });
      if (conversationError) {
        console.error('Failed to store conversation:', conversationError);
      }
    }
    return new Response(JSON.stringify({
      message: 'Email sent successfully',
      to: recipientEmail,
      subject: emailSubject,
      thread_id: thread_id
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Send email error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
async function sendSMTPEmail(settings, emailData) {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: settings.smtp_host,
        port: settings.smtp_port || 587,
        tls: settings.smtp_use_tls !== false,
        auth: {
          username: settings.smtp_user,
          password: settings.smtp_password
        }
      }
    });
    await client.send({
      from: `${settings.smtp_sender_name || emailData.clinicName} <${settings.smtp_sender_email}>`,
      to: emailData.to,
      subject: emailData.subject,
      content: emailData.body,
      html: formatEmailHTML(emailData.body, emailData.clinicName)
    });
    await client.close();
    return {
      success: true
    };
  } catch (error) {
    console.error('SMTP Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
function formatEmailHTML(message, clinicName) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Message from ${clinicName}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin: 0;">${clinicName}</h2>
        </div>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
            <div style="white-space: pre-wrap;">${message}</div>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; font-size: 0.9em; color: #6c757d;">
            <p style="margin: 0;">This message was sent by ${clinicName}'s AI assistant. If you have any questions or concerns, please contact us directly.</p>
        </div>
    </body>
    </html>
  `;
}
