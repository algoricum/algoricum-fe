import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import OpenAI from 'jsr:@openai/openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseKey || !openaiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing environment variables'
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey });
    const requestData = await req.json();

    // Handle cron job for all clinics
    if (requestData.cron_job && requestData.process_all_clinics) {
      console.log('🤖 Processing all clinics via cron job...');
      
      const { data: emailConfigs, error } = await supabaseClient
        .from('email_settings')
        .select(`
          *,
          clinic:clinic_id (
            id, name, business_hours, calendly_link, phone,
            assistants (openai_assistant_id, assistant_name, instructions)
          )
        `)
        .not('clinic_id', 'is', null);

      if (error || !emailConfigs?.length) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No email configurations found',
          processed: 0
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let totalProcessed = 0;
      const results = [];

      for (const emailConfig of emailConfigs) {
        try {
          const clinic = emailConfig.clinic;
          if (!clinic) continue;

          console.log(`🏥 Processing clinic: ${clinic.name}`);
          
          const result = await processClinicEmails(emailConfig, clinic, openai, supabaseClient);
          
          totalProcessed += result.emails_processed || 0;
          results.push({
            clinic_name: clinic.name,
            success: result.success,
            emails_processed: result.emails_processed || 0,
            error: result.error || null
          });

          // Delay between clinics
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`❌ Error processing clinic:`, error);
          results.push({
            clinic_name: emailConfig.clinic?.name || 'Unknown',
            success: false,
            emails_processed: 0,
            error: error.message
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Processed ${totalProcessed} emails from ${emailConfigs.length} clinics`,
        total_emails_processed: totalProcessed,
        details: results
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Handle manual single clinic processing (if needed)
    return new Response(JSON.stringify({
      success: false,
      error: 'Manual processing not supported in simplified version'
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// Process emails for a single clinic
async function processClinicEmails(emailConfig: any, clinic: any, openai: any, supabaseClient: any) {
  try {
    const imapResult = await processEmails({
      hostname: emailConfig.imap_server,
      port: emailConfig.imap_port,
      username: emailConfig.imap_user,
      password: emailConfig.imap_password,
      useSsl: emailConfig.imap_use_ssl
    }, {
      smtp_host: emailConfig.smtp_host,
      smtp_port: emailConfig.smtp_port,
      smtp_user: emailConfig.smtp_user,
      smtp_password: emailConfig.smtp_password,
      smtp_sender_email: emailConfig.smtp_sender_email || emailConfig.smtp_user,
      smtp_sender_name: emailConfig.smtp_sender_name || 'Clinic Support',
      smtp_use_tls: emailConfig.smtp_use_tls
    }, {
      openai,
      assistant: clinic.assistants?.[0],
      clinicName: clinic.name,
      clinic,
      supabaseClient
    });

    return {
      success: imapResult.success,
      emails_processed: imapResult.details?.processed_emails?.length || 0,
      error: imapResult.error || null
    };
  } catch (error) {
    return {
      success: false,
      emails_processed: 0,
      error: error.message
    };
  }
}

// Simplified email processing
async function processEmails(imapConfig: any, smtpConfig: any, aiConfig: any) {
  let conn: Deno.Conn | Deno.TlsConn;
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  const processedEmails = [];
  
  try {
    // Connect to IMAP
    if (imapConfig.useSsl) {
      conn = await Deno.connectTls({
        hostname: imapConfig.hostname,
        port: imapConfig.port,
        caCerts: [],
      });
    } else {
      conn = await Deno.connect({
        hostname: imapConfig.hostname,
        port: imapConfig.port
      });
    }

    // Helper functions
    const readBuffer = async (): Promise<string> => {
      const buffer = new Uint8Array(8192);
      let result = '';
      const n = await conn.read(buffer);
      if (n !== null) {
        result = textDecoder.decode(buffer.subarray(0, n));
      }
      return result.trim();
    };

    const sendCommand = async (tag: string, command: string): Promise<string> => {
      const fullCommand = `${tag} ${command}\r\n`;
      await conn.write(textEncoder.encode(fullCommand));
      
      let response = '';
      let complete = false;
      
      while (!complete) {
        const chunk = await readBuffer();
        response += chunk + '\n';
        
        if (response.includes(`${tag} OK`) || 
            response.includes(`${tag} NO`) || 
            response.includes(`${tag} BAD`)) {
          complete = true;
        }
      }
      
      return response;
    };

    // IMAP authentication
    await readBuffer(); // greeting
    
    const loginResponse = await sendCommand('A001', `LOGIN "${imapConfig.username}" "${imapConfig.password}"`);
    if (!loginResponse.includes('A001 OK')) {
      throw new Error('IMAP authentication failed');
    }

    await sendCommand('A002', 'SELECT INBOX');
    
    // Search for unread emails
    const searchResponse = await sendCommand('A003', 'SEARCH UNSEEN');
    const messageIds = parseSearchResults(searchResponse);
    
    console.log(`Found ${messageIds.length} unread emails`);

    // Process each email
    for (const messageId of messageIds) {
      try {
        // Fetch email
        const fetchResponse = await sendCommand('A004', `FETCH ${messageId} (BODY[HEADER] BODY[TEXT])`);
        const emailData = parseEmailData(fetchResponse);
        
        if (!emailData.headers.from) continue;

        // Generate AI response
        const aiResponse = await generateAIResponse(emailData, aiConfig);

        if (aiResponse) {
          // Send reply
          await sendReply(emailData, aiResponse, smtpConfig);
          
          // Mark as read
          await sendCommand('A005', `STORE ${messageId} +FLAGS (\\Seen)`);
          
          processedEmails.push({
            message_id: messageId,
            from: emailData.headers.from,
            reply_sent: true
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (emailError) {
        console.error(`Error processing email ${messageId}:`, emailError);
        processedEmails.push({
          message_id: messageId,
          reply_sent: false,
          error: emailError.message
        });
      }
    }

    await sendCommand('A006', 'LOGOUT');
    conn.close();

    return {
      success: true,
      details: {
        processed_emails: processedEmails,
        total_processed: processedEmails.length
      }
    };

  } catch (error) {
    if (conn) {
      try { conn.close(); } catch (_) {}
    }
    
    return {
      success: false,
      error: error.message,
      details: { processed_emails: processedEmails }
    };
  }
}

// Generate AI response
async function generateAIResponse(emailData: any, aiConfig: any): Promise<string | null> {
  try {
    const { openai, assistant, clinicName, clinic } = aiConfig;
    
    // Build clinic info
    let clinicInfo = '';
    if (clinic?.business_hours) {
      clinicInfo += `\nBusiness Hours: ${JSON.stringify(clinic.business_hours)}`;
    }
    if (clinic?.phone) {
      clinicInfo += `\nPhone: ${clinic.phone}`;
    }
    if (clinic?.calendly_link) {
      clinicInfo += `\nScheduling: ${clinic.calendly_link}`;
    } 
    if (!clinic?.calendly_link){
      clinicInfo += `\nScheduling: ${clinic.calendly_link}`;
    }

    // Use chat completion for simplicity
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a customer service representative for ${clinicName}. Respond professionally to patient emails. Keep responses under 200 words.${clinicInfo}`
        },
        {
          role: "user",
          content: `Please respond to this patient email:
From: ${emailData.headers.from}
Subject: ${emailData.headers.subject || 'No subject'}
Message: ${emailData.body || 'No content'}`
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    return completion.choices[0]?.message?.content?.trim() || null;
    
  } catch (error) {
    console.error('AI response generation failed:', error);
    
    // Fallback response
    return `Dear patient,

Thank you for contacting ${aiConfig.clinicName}. We have received your message and will respond as soon as possible during our business hours.

For urgent medical concerns, please contact us directly or visit our clinic.

Best regards,
${aiConfig.clinicName} Team`;
  }
}

// Send reply email
async function sendReply(originalEmail: any, replyContent: string, smtpConfig: any) {
  const smtpClient = new SMTPClient({
    connection: {
      hostname: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port,
      tls: smtpConfig.smtp_use_tls,
      auth: {
        username: smtpConfig.smtp_user,
        password: smtpConfig.smtp_password
      }
    }
  });

  const subject = originalEmail.headers.subject || 'Your inquiry';
  const replySubject = subject.startsWith('Re: ') ? subject : `Re: ${subject}`;

  await smtpClient.send({
    from: `${smtpConfig.smtp_sender_name} <${smtpConfig.smtp_sender_email}>`,
    to: originalEmail.headers.from,
    subject: replySubject,
    text: replyContent
  });

  await smtpClient.close();
}

// Parse search results for message IDs
function parseSearchResults(searchResponse: string): number[] {
  const messageIds: number[] = [];
  const lines = searchResponse.split('\n');
  
  for (const line of lines) {
    if (line.includes('* SEARCH')) {
      const match = line.match(/\*\s+SEARCH\s+(.*)/);
      if (match && match[1]) {
        const parts = match[1].trim().split(/\s+/);
        for (const part of parts) {
          if (/^\d+$/.test(part)) {
            messageIds.push(parseInt(part));
          }
        }
      }
    }
  }
  
  return messageIds;
}

// Parse email data from IMAP response
function parseEmailData(fetchResponse: string) {
  const headers: { [key: string]: string } = {};
  let body = '';
  
  const lines = fetchResponse.split('\n');
  let inHeaders = false;
  let inBody = false;
  
  for (const line of lines) {
    if (line.includes('BODY[HEADER]')) {
      inHeaders = true;
      continue;
    }
    if (line.includes('BODY[TEXT]')) {
      inHeaders = false;
      inBody = true;
      continue;
    }
    
    if (inHeaders && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      headers[key] = value;
    }
    
    if (inBody && line.trim() && !line.includes('A004')) {
      body += line + '\n';
    }
  }
  
  return {
    headers,
    body: body.trim()
  };
}