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

function parseEmailData(fetchResponse: string) {
  console.log('Parsing email data from IMAP response...');
  
  const headers: { [key: string]: string } = {};
  let body = '';
  
  try {
    const lines = fetchResponse.split('\n');
    let headerSection = '';
    let bodySection = '';
    let inHeaderSection = false;
    let inBodySection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('BODY[HEADER.FIELDS')) {
        console.log('Found BODY[HEADER.FIELDS] section');
        inHeaderSection = true;
        inBodySection = false;
        continue;
      }
      
      if (line.includes('BODY[TEXT]')) {
        console.log('Found BODY[TEXT] section');
        inHeaderSection = false;
        inBodySection = true;
        continue;
      }
      
      if (line.startsWith('A004 OK') || (line.trim() === ')' && !inHeaderSection && !inBodySection)) {
        console.log('Found end of fetch response');
        break;
      }
      
      if (inHeaderSection && line.trim() && line.trim() !== ')') {
        headerSection += line + '\n';
      }
      
      if (inBodySection && !line.startsWith('A004')) {
        bodySection += line + '\n';
      }
    }
    
    console.log(`Header section length: ${headerSection.length}`);
    console.log(`Body section length: ${bodySection.length}`);
    
    if (headerSection) {
      parseHeaders(headerSection, headers);
    }
    
    if (bodySection) {
      body = parseEmailBody(bodySection);
    }
    
    console.log('Parsed headers:', Object.keys(headers));
    console.log('From header:', headers.from);
    console.log('Subject header:', headers.subject);
    console.log('Body preview:', body.substring(0, 100));
    
    if (headers.from) {
      headers.from = extractEmailAddress(headers.from);
    }
    
    return {
      headers,
      body: body.trim()
    };
    
  } catch (error) {
    console.error('Error parsing email data:', error);
    console.error('Raw response preview:', fetchResponse.substring(0, 1000));
    
    return {
      headers: {
        from: extractFallbackEmail(fetchResponse),
        subject: extractFallbackSubject(fetchResponse) || 'Parse Error'
      },
      body: extractFallbackBody(fetchResponse)
    };
  }
}

function parseHeaders(headerSection: string, headers: { [key: string]: string }) {
  const headerLines = headerSection.split('\n');
  let currentHeader = '';
  let currentValue = '';
  
  for (const headerLine of headerLines) {
    const line = headerLine.trim();
    if (!line || line === ')') continue;
    
    if (line.includes(':') && !headerLine.startsWith(' ') && !headerLine.startsWith('\t')) {
      if (currentHeader && currentValue) {
        headers[currentHeader.toLowerCase().trim()] = currentValue.trim();
      }
      
      const colonIndex = line.indexOf(':');
      currentHeader = line.substring(0, colonIndex).trim();
      currentValue = line.substring(colonIndex + 1).trim();
    } else if (currentHeader && line) {
      currentValue += ' ' + line;
    }
  }
  
  if (currentHeader && currentValue) {
    headers[currentHeader.toLowerCase().trim()] = currentValue.trim();
  }
}

function parseEmailBody(bodySection: string): string {
  const lines = bodySection.split('\n');
  let cleanedBody = '';
  let inHeaders = true;
  let skipUntilBlankLine = false;
  let boundary: string | null = null;
  let inTextPart = false;
  let textPartFound = false;
  
  const multipartMatch = bodySection.match(/Content-Type:\s*multipart\/[^;]+;\s*boundary[=:]\s*["']?([^"'\s;]+)["']?/i);
  if (multipartMatch) {
    boundary = multipartMatch[1];
    console.log(`Detected multipart boundary: ${boundary}`);
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.match(/^\d+\s+FETCH/) || 
        trimmed.match(/BODY\[TEXT\]\s*\{\d+\}/) || 
        trimmed === ')' ||
        trimmed.startsWith('A004')) {
      continue;
    }
    
    if (boundary && trimmed.includes(`--${boundary}`)) {
      if (trimmed === `--${boundary}--`) {
        break;
      } else if (trimmed === `--${boundary}`) {
        inHeaders = true;
        inTextPart = false;
        skipUntilBlankLine = false;
        continue;
      }
    }
    
    if (inHeaders) {
      if (trimmed === '') {
        inHeaders = false;
        continue;
      }
      
      if (trimmed.match(/Content-Type:\s*text\/plain/i)) {
        inTextPart = true;
        textPartFound = true;
      }
      
      if (trimmed.match(/Content-Transfer-Encoding:/i) ||
          trimmed.match(/Content-Disposition:/i) ||
          trimmed.match(/Content-ID:/i)) {
        skipUntilBlankLine = true;
      }
      
      continue;
    }
    
    if (boundary && textPartFound && !inTextPart) {
      continue;
    }
    
    if (!trimmed || 
        trimmed.match(/^[A-Za-z0-9+\/=]{40,}$/) || 
        trimmed.match(/^=\?[^?]+\?[BQ]\?[^?]+\?=$/)) {
      continue;
    }
    
    cleanedBody += line + '\n';
  }
  
  return cleanedBody.trim();
}

function extractEmailAddress(fromHeader: string): string {
  const emailMatch = fromHeader.match(/<([^>]+)>/) || 
                    fromHeader.match(/([^\s<>]+@[^\s<>]+)/);
  return emailMatch ? emailMatch[1].trim() : fromHeader.trim();
}

function extractFallbackEmail(response: string): string {
  const emailMatch = response.match(/From:\s*[^<]*<([^>]+)>/) ||
                    response.match(/From:\s*([^\s<>]+@[^\s<>]+)/) ||
                    response.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return emailMatch ? emailMatch[1] : 'unknown@example.com';
}

function extractFallbackSubject(response: string): string | null {
  const subjectMatch = response.match(/Subject:\s*(.+?)(?:\r?\n|\r)/i);
  return subjectMatch ? subjectMatch[1].trim() : null;
}

function extractFallbackBody(response: string): string {
  const lines = response.split('\n');
  let body = '';
  let foundText = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.match(/^\d+\s+FETCH/) ||
        trimmed.match(/BODY\[/) ||
        trimmed.match(/^[A-Z][a-z-]+:/) ||
        trimmed.startsWith('A00') ||
        !trimmed) {
      continue;
    }
    
    if (trimmed.length > 10 && 
        !trimmed.match(/^[A-Za-z0-9+\/=]{40,}$/) &&
        !trimmed.includes('Content-Type') &&
        !trimmed.includes('boundary=')) {
      body += trimmed + ' ';
      foundText = true;
    }
  }
  
  return foundText ? body.trim() : 'Email content could not be parsed';
}

async function sendReplySimple(originalEmail: any, replyContent: string, smtpConfig: any) {
  try {
    console.log('Sending simple reply email...');
    console.log('Original reply content:', replyContent);

    // Validate inputs
    if (!replyContent || replyContent.trim().length === 0) {
      console.error('No valid reply content provided');
      throw new Error('Reply content is empty or invalid');
    }
    if (!originalEmail?.headers?.from) {
      console.error('Missing sender email address');
      throw new Error('Missing sender email address');
    }
    if (!smtpConfig?.smtp_host || !smtpConfig?.smtp_port || !smtpConfig?.smtp_sender_email) {
      console.error('Invalid SMTP configuration:', smtpConfig);
      throw new Error('Invalid SMTP configuration');
    }

    // Clean and prepare content - improved subject removal
    let cleanContent = replyContent.trim();
    
    // Remove any "Subject:" prefix and following content more aggressively
    cleanContent = cleanContent.replace(/^Subject:\s*[^\r\n]*[\r\n]+/i, '');
    cleanContent = cleanContent.replace(/^Subject:\s*[^\r\n]*/i, '');
    
    // Clean up line endings and normalize whitespace
    cleanContent = cleanContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    cleanContent = cleanContent.trim();
    
    // Ensure we have content after cleaning
    if (!cleanContent || cleanContent.length === 0) {
      console.error('Content is empty after cleaning');
      throw new Error('Content is empty after processing');
    }

    console.log('Cleaned content:', cleanContent);
    console.log('Cleaned content length:', cleanContent.length);

    // Try multiple SMTP client configurations
    const configurations = [
      // Configuration 1: Standard TLS
      {
        connection: {
          hostname: smtpConfig.smtp_host,
          port: smtpConfig.smtp_port,
          tls: smtpConfig.smtp_use_tls,
          auth: {
            username: smtpConfig.smtp_user,
            password: smtpConfig.smtp_password
          }
        }
      },
      // Configuration 2: STARTTLS explicit
      {
        connection: {
          hostname: smtpConfig.smtp_host,
          port: smtpConfig.smtp_port,
          tls: false,
          auth: {
            username: smtpConfig.smtp_user,
            password: smtpConfig.smtp_password
          }
        }
      },
      // Configuration 3: Different port with TLS
      {
        connection: {
          hostname: smtpConfig.smtp_host,
          port: 465, // Try SSL port
          tls: true,
          auth: {
            username: smtpConfig.smtp_user,
            password: smtpConfig.smtp_password
          }
        }
      }
    ];

    const emailData = {
      from: `${smtpConfig.smtp_sender_name || 'Clinic Support'} <${smtpConfig.smtp_sender_email}>`,
      to: originalEmail.headers.from,
      subject: `Re: ${originalEmail.headers.subject || 'Your inquiry'}`,
      content: cleanContent,
    };

    console.log('Attempting to send email with data:', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      contentLength: cleanContent.length,
      contentPreview: cleanContent.substring(0, 150)
    });

    // Try each configuration
    for (let i = 0; i < configurations.length; i++) {
      const config = configurations[i];
      console.log(`Trying SMTP configuration ${i + 1}:`, {
        hostname: config.connection.hostname,
        port: config.connection.port,
        tls: config.connection.tls
      });

      try {
        const smtpClient = new SMTPClient(config);
        
        // Try different content field names
        const emailVariations = [
          { ...emailData, content: cleanContent },
          { ...emailData, text: cleanContent },
          { ...emailData, html: cleanContent.replace(/\n/g, '<br>') },
          { ...emailData, body: cleanContent }
        ];

        for (const emailVariation of emailVariations) {
          try {
            console.log('Trying email variation with fields:', Object.keys(emailVariation));
            await smtpClient.send(emailVariation);
            await smtpClient.close();
            console.log('✅ Email sent successfully');
            return { success: true };
          } catch (sendError) {
            console.log(`Email variation failed: ${sendError.message}`);
            continue;
          }
        }
        
        await smtpClient.close();
        
      } catch (configError) {
        console.log(`Configuration ${i + 1} failed: ${configError.message}`);
        continue;
      }
    }

    throw new Error('All SMTP configurations and email formats failed');

  } catch (error) {
    console.error('❌ Failed to send simple reply:', error.message);
    console.error('SMTP Config:', {
      host: smtpConfig?.smtp_host,
      port: smtpConfig?.smtp_port,
      user: smtpConfig?.smtp_user,
      sender: smtpConfig?.smtp_sender_email,
      tls: smtpConfig?.smtp_use_tls
    });
    
    // Fallback: Try with minimal SMTP client setup
    try {
      console.log('Attempting fallback with minimal configuration...');
      
      const fallbackClient = new SMTPClient({
        connection: {
          hostname: smtpConfig.smtp_host,
          port: 587,
          tls: false, // Start without TLS
          auth: {
            username: smtpConfig.smtp_user,
            password: smtpConfig.smtp_password
          }
        }
      });

      // Ultra-simple email format
      const simpleEmailData = {
        from: smtpConfig.smtp_sender_email,
        to: originalEmail.headers.from,
        subject: `Re: ${originalEmail.headers.subject || 'Your inquiry'}`,
        text: cleanContent // Use only text field
      };

      await fallbackClient.send(simpleEmailData);
      await fallbackClient.close();
      
      console.log('✅ Fallback method succeeded');
      return { success: true };
      
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
      throw new Error(`All email sending attempts failed. Last error: ${error.message}`);
    }
  }
}

async function processEmails(imapConfig: any, smtpConfig: any, aiConfig: any) {
  let conn: Deno.Conn | Deno.TlsConn;
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  const processedEmails = [];
  
  try {
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

    const readBuffer = async (timeoutMs = 10000): Promise<string> => {
      const buffer = new Uint8Array(8192);
      let result = '';
      const deadline = Date.now() + timeoutMs;
      
      while (Date.now() < deadline) {
        try {
          const n = await Promise.race([
            conn.read(buffer),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Read timeout')), 3000)
            )
          ]);
          
          if (n === null) break;
          const chunk = textDecoder.decode(buffer.subarray(0, n));
          result += chunk;
          if (result.endsWith('\r\n')) break;
        } catch (error) {
          if (error.message === 'Read timeout' && result.length > 0) continue;
          throw error;
        }
      }
      return result.trim();
    };

    const sendCommand = async (tag: string, command: string): Promise<string> => {
      const fullCommand = `${tag} ${command}\r\n`;
      console.log(`IMAP >>> ${tag} ${command.replace(/LOGIN.*/, 'LOGIN [REDACTED]')}`);
      
      await conn.write(textEncoder.encode(fullCommand));
      
      let response = '';
      let complete = false;
      const startTime = Date.now();
      const timeout = 30000;
      
      while (!complete && (Date.now() - startTime) < timeout) {
        const chunk = await readBuffer(5000);
        response += chunk + '\n';
        
        const lines = response.split('\n');
        for (const line of lines) {
          if (line.startsWith(`${tag} OK`) || 
              line.startsWith(`${tag} NO`) || 
              line.startsWith(`${tag} BAD`)) {
            complete = true;
            break;
          }
        }
      }
      
      return response;
    };

    console.log('Reading IMAP server greeting...');
    await readBuffer(5000);
    
    console.log('Authenticating...');
    const loginResponse = await sendCommand('A001', `LOGIN "${imapConfig.username}" "${imapConfig.password}"`);
    if (!loginResponse.includes('A001 OK')) {
      throw new Error('IMAP authentication failed');
    }

    console.log('Selecting INBOX...');
    await sendCommand('A002', 'SELECT INBOX');
    
    console.log('Searching for unread emails...');
    const searchResponse = await sendCommand('A003', 'SEARCH UNSEEN');
    const messageIds = parseSearchResults(searchResponse);
    
    console.log(`Found ${messageIds.length} unread emails`);

    for (const messageId of messageIds) {
      try {
        console.log(`Processing email ${messageId}...`);
        
        const fetchResponse = await sendCommand('A004', `FETCH ${messageId} (BODY[HEADER.FIELDS (FROM SUBJECT DATE)] BODY[TEXT])`);
        
        let emailData;
        try {
          emailData = parseEmailData(fetchResponse);
        } catch (parseError) {
          console.error(`Parse error for email ${messageId}:`, parseError);
          processedEmails.push({
            message_id: messageId,
            reply_sent: false,
            error: `Parse error: ${parseError.message}`
          });
          await sendCommand('A005', `STORE ${messageId} +FLAGS (\\Seen)`);
          continue;
        }
        
        console.log(`Parsed email data:`, {
          from: emailData.headers.from,
          subject: emailData.headers.subject,
          bodyLength: emailData.body?.length || 0
        });
        
        if (!emailData.headers.from || !emailData.body || emailData.body.trim().length < 10) {
          console.log(`Skipping email ${messageId} - insufficient data`);
          processedEmails.push({
            message_id: messageId,
            from: emailData.headers.from || 'unknown',
            subject: emailData.headers.subject || 'No subject',
            reply_sent: false,
            error: 'Insufficient email data'
          });
          await sendCommand('A005', `STORE ${messageId} +FLAGS (\\Seen)`);
          continue;
        }

        const aiResponse = await generateAIResponse(emailData, aiConfig);
        
        console.log('AI Response:', aiResponse); // Log AI response for debugging

        if (aiResponse && aiResponse.trim().length > 0) {
          try {
            await sendReplySimple(emailData, aiResponse, smtpConfig);
            await sendCommand('A005', `STORE ${messageId} +FLAGS (\\Seen)`);
            
            processedEmails.push({
              message_id: messageId,
              from: emailData.headers.from,
              subject: emailData.headers.subject || 'No subject',
              reply_sent: true,
              processed_at: new Date().toISOString()
            });
            
            console.log(`Successfully processed email ${messageId}`);
          } catch (sendError) {
            console.error(`Failed to send reply for email ${messageId}:`, sendError.message);
            processedEmails.push({
              message_id: messageId,
              from: emailData.headers.from,
              reply_sent: false,
              error: `Send error: ${sendError.message}`
            });
          }
        } else {
          console.log(`No valid AI response for email ${messageId}`);
          processedEmails.push({
            message_id: messageId,
            from: emailData.headers.from,
            reply_sent: false,
            error: 'No valid AI response generated'
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (emailError) {
        console.error(`Error processing email ${messageId}:`, emailError.message);
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
    console.error('IMAP processing error:', error);
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

async function generateAIResponse(emailData: any, aiConfig: any): Promise<string | null> {
  try {
    const { openai, clinicName, clinic } = aiConfig;
    
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a customer service representative for ${clinicName}. Respond professionally to patient emails in plain text. Keep responses under 200 words. Avoid special characters, formatting, or symbols that might cause encoding issues.${clinicInfo}`
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

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) {
      throw new Error('No response content from AI');
    }
    return response;
    
  } catch (error) {
    console.error('AI response generation failed:', error);
    
    return `Dear patient,

Thank you for contacting ${aiConfig.clinicName}. We have received your message and will respond as soon as possible during our business hours.

For urgent medical concerns, please contact us directly or visit our clinic.

Best regards,
${aiConfig.clinicName} Team`;
  }
}

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