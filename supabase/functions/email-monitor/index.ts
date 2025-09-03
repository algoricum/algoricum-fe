// supabase/functions/email-monitor/index.js - Self-contained with embedded IMAP
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Simple IMAP Client - Embedded directly in the function
class SimpleIMAP {
  constructor(config){
    this.config = {
      hostname: config.hostname,
      port: config.port || 993,
      username: config.username,
      password: config.password,
      useSsl: config.useSsl !== false,
      folder: config.folder || 'INBOX'
    };
    this.connection = null;
    this.tagCounter = 1;
    this.isLoggedIn = false;
    this.selectedFolder = null;
  }
  async connect() {
    try {
      this.connection = this.config.useSsl ? await Deno.connectTls({
        hostname: this.config.hostname,
        port: this.config.port
      }) : await Deno.connect({
        hostname: this.config.hostname,
        port: this.config.port
      });
      // Read greeting
      const greeting = await this.readResponse();
      if (!greeting.includes('OK')) {
        throw new Error(`IMAP connection failed: ${greeting}`);
      }
      return {
        success: true,
        greeting
      };
    } catch (error) {
      throw new Error(`Failed to connect to IMAP server: ${error.message}`);
    }
  }
  async login() {
    if (!this.connection) {
      throw new Error('Not connected to IMAP server');
    }
    try {
      const response = await this.sendCommand(`LOGIN ${this.config.username} ${this.config.password}`);
      if (!response.includes('OK')) {
        throw new Error(`IMAP authentication failed: ${response}`);
      }
      this.isLoggedIn = true;
      return {
        success: true
      };
    } catch (error) {
      throw new Error(`IMAP login failed: ${error.message}`);
    }
  }
  async selectFolder(folder = 'INBOX') {
    if (!this.isLoggedIn) {
      throw new Error('Not logged in to IMAP server');
    }
    try {
      const response = await this.sendCommand(`SELECT ${folder}`);
      if (!response.includes('OK')) {
        throw new Error(`Failed to select folder ${folder}: ${response}`);
      }
      this.selectedFolder = folder;
      const folderInfo = this.parseFolderResponse(response);
      return {
        success: true,
        folderInfo
      };
    } catch (error) {
      throw new Error(`Failed to select folder: ${error.message}`);
    }
  }
  async search(criteria = 'ALL', limit = 50) {
    if (!this.selectedFolder) {
      await this.selectFolder(this.config.folder);
    }
    try {
      const response = await this.sendCommand(`SEARCH ${criteria}`);
      if (!response.includes('OK')) {
        throw new Error(`Search failed: ${response}`);
      }
      const messageIds = this.parseSearchResponse(response);
      return messageIds.slice(0, limit);
    } catch (error) {
      throw new Error(`IMAP search failed: ${error.message}`);
    }
  }
  async fetchEmails(messageIds, parts = 'ENVELOPE BODY[TEXT]') {
    if (!messageIds || messageIds.length === 0) {
      return [];
    }
    const emails = [];
    for (const msgId of messageIds){
      try {
        const response = await this.sendCommand(`FETCH ${msgId} (${parts})`);
        const email = this.parseEmailResponse(response, msgId);
        if (email) {
          emails.push(email);
        }
      } catch (error) {
        console.error(`Error fetching email ${msgId}:`, error);
      }
    }
    return emails;
  }
  async getNewEmails(sinceDate = null, limit = 50) {
    try {
      let searchCriteria = 'UNSEEN';
      if (sinceDate) {
        const dateStr = this.formatIMAPDate(sinceDate);
        searchCriteria = `SINCE ${dateStr} UNSEEN`;
      }
      const messageIds = await this.search(searchCriteria, limit);
      if (messageIds.length === 0) {
        return [];
      }
      const emails = await this.fetchEmails(messageIds);
      return emails;
    } catch (error) {
      throw new Error(`Failed to get new emails: ${error.message}`);
    }
  }
  async logout() {
    if (this.connection) {
      try {
        if (this.isLoggedIn) {
          await this.sendCommand('LOGOUT');
        }
      } catch (error) {
        console.error('Error during logout:', error);
      } finally{
        this.connection.close();
        this.connection = null;
        this.isLoggedIn = false;
        this.selectedFolder = null;
      }
    }
  }
  async sendCommand(command) {
    const tag = `A${this.tagCounter++}`;
    const fullCommand = `${tag} ${command}\r\n`;
    await this.connection.write(new TextEncoder().encode(fullCommand));
    let response = '';
    let complete = false;
    while(!complete){
      const chunk = await this.readResponse();
      response += chunk + '\n';
      if (chunk.includes(`${tag} OK`) || chunk.includes(`${tag} NO`) || chunk.includes(`${tag} BAD`)) {
        complete = true;
      }
    }
    return response;
  }
  async readResponse() {
    const buffer = new Uint8Array(4096);
    const n = await this.connection.read(buffer);
    if (!n) {
      throw new Error('No response from IMAP server');
    }
    return new TextDecoder().decode(buffer.subarray(0, n)).trim();
  }
  parseSearchResponse(response) {
    const messageIds = [];
    const lines = response.split('\n');
    for (const line of lines){
      if (line.includes('SEARCH')) {
        const parts = line.split(' ');
        for(let i = 1; i < parts.length; i++){
          const id = parseInt(parts[i]);
          if (id && !isNaN(id)) {
            messageIds.push(id);
          }
        }
      }
    }
    return messageIds;
  }
  parseEmailResponse(response, messageId) {
    try {
      const lines = response.split('\n');
      let fromEmail = '';
      let subject = '';
      let body = '';
      let date = '';
      let bodyStarted = false;
      for (const line of lines){
        if (line.includes('ENVELOPE')) {
          const envelope = this.parseEnvelope(line);
          if (envelope) {
            fromEmail = envelope.from;
            subject = envelope.subject;
            date = envelope.date;
          }
        } else if (line.includes('BODY[TEXT]')) {
          bodyStarted = true;
        } else if (bodyStarted && !line.includes(`A${messageId}`)) {
          body += line + '\n';
        }
      }
      if (fromEmail && body.trim()) {
        return {
          messageId: `imap-${messageId}-${Date.now()}`,
          from: fromEmail,
          subject: subject || 'No Subject',
          body: body.trim(),
          date: date,
          timestamp: new Date().toISOString()
        };
      }
      return null;
    } catch (error) {
      console.error('Error parsing email response:', error);
      return null;
    }
  }
  parseEnvelope(envelopeLine) {
    try {
      const envelopeMatch = envelopeLine.match(/ENVELOPE \((.*)\)/);
      if (!envelopeMatch) return null;
      const envelope = envelopeMatch[1];
      const parts = this.parseIMAPList(envelope);
      return {
        date: this.unquote(parts[0]) || '',
        subject: this.unquote(parts[1]) || 'No Subject',
        from: this.parseAddress(parts[2]) || '',
        sender: this.parseAddress(parts[3]) || '',
        replyTo: this.parseAddress(parts[4]) || '',
        to: this.parseAddress(parts[5]) || '',
        cc: this.parseAddress(parts[6]) || '',
        bcc: this.parseAddress(parts[7]) || '',
        inReplyTo: this.unquote(parts[8]) || '',
        messageId: this.unquote(parts[9]) || ''
      };
    } catch (error) {
      console.error('Error parsing envelope:', error);
      return null;
    }
  }
  parseAddress(addressField) {
    if (!addressField || addressField === 'NIL') return '';
    try {
      const addressMatch = addressField.match(/\(\(([^)]+)\)\)/);
      if (addressMatch) {
        const parts = addressMatch[1].split(' ');
        if (parts.length >= 4) {
          const mailbox = this.unquote(parts[2]);
          const host = this.unquote(parts[3]);
          return `${mailbox}@${host}`;
        }
      }
    } catch (error) {
      console.error('Error parsing address:', error);
    }
    return '';
  }
  parseIMAPList(str) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let parenLevel = 0;
    for(let i = 0; i < str.length; i++){
      const char = str[i];
      if (char === '"' && str[i - 1] !== '\\') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === '(' && !inQuotes) {
        parenLevel++;
        current += char;
      } else if (char === ')' && !inQuotes) {
        parenLevel--;
        current += char;
      } else if (char === ' ' && !inQuotes && parenLevel === 0) {
        if (current.trim()) {
          parts.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      parts.push(current.trim());
    }
    return parts;
  }
  unquote(str) {
    if (!str || str === 'NIL') return '';
    return str.replace(/^"|"$/g, '');
  }
  parseFolderResponse(response) {
    const info = {
      exists: 0,
      recent: 0,
      unseen: 0
    };
    const lines = response.split('\n');
    for (const line of lines){
      if (line.includes('EXISTS')) {
        const match = line.match(/(\d+) EXISTS/);
        if (match) info.exists = parseInt(match[1]);
      } else if (line.includes('RECENT')) {
        const match = line.match(/(\d+) RECENT/);
        if (match) info.recent = parseInt(match[1]);
      }
    }
    return info;
  }
  formatIMAPDate(date) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
}
// Main edge function
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Get all clinics with email settings configured
    const { data: emailSettings, error: settingsError } = await supabaseClient.from('email_settings').select(`
        *,
        clinic:clinic_id (
          id,
          name,
          email
        )
      `).eq('auto_reply_enabled', true).not('imap_server', 'is', null).not('imap_user', 'is', null);
    if (settingsError) {
      throw new Error(`Failed to fetch email settings: ${settingsError.message}`);
    }
    console.log(`Found ${emailSettings.length} clinics with email monitoring enabled`);
    const results = [];
    for (const setting of emailSettings){
      try {
        console.log(`Processing emails for clinic: ${setting.clinic.name}`);
        const emails = await checkIMAPEmails(setting);
        let processedCount = 0;
        for (const email of emails){
          try {
            const processResult = await processIncomingEmail(supabaseClient, setting, email);
            results.push(processResult);
            if (processResult.status === 'processed') {
              processedCount++;
            }
          } catch (emailError) {
            console.error(`Error processing individual email:`, emailError);
            results.push({
              clinic_id: setting.clinic_id,
              error: emailError.message,
              status: 'email_process_failed'
            });
          }
        }
        // Update last check time
        await supabaseClient.from('email_settings').update({
          last_email_check: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', setting.id);
        console.log(`Processed ${processedCount} new emails for ${setting.clinic.name}`);
      } catch (error) {
        console.error(`Error processing emails for clinic ${setting.clinic_id}:`, error);
        results.push({
          clinic_id: setting.clinic_id,
          clinic_name: setting.clinic.name,
          error: error.message,
          status: 'clinic_failed'
        });
      }
    }
    const summary = {
      total_clinics: emailSettings.length,
      successful_clinics: results.filter((r)=>r.status === 'processed' || r.status === 'already_processed').length,
      failed_clinics: results.filter((r)=>r.status?.includes('failed')).length,
      total_emails_processed: results.filter((r)=>r.status === 'processed').length
    };
    return new Response(JSON.stringify({
      success: true,
      message: 'Email monitoring completed',
      summary,
      results,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Email monitoring error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
async function checkIMAPEmails(settings) {
  const imap = new SimpleIMAP({
    hostname: settings.imap_server,
    port: settings.imap_port || 993,
    username: settings.imap_user,
    password: settings.imap_password,
    useSsl: settings.imap_use_ssl !== false,
    folder: settings.imap_folder || 'INBOX'
  });
  try {
    console.log(`Checking IMAP emails for: ${settings.imap_user}`);
    await imap.connect();
    await imap.login();
    // Get emails since last check (or last 24 hours if never checked)
    const lastCheck = settings.last_email_check ? new Date(settings.last_email_check) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const emails = await imap.getNewEmails(lastCheck, 20);
    console.log(`Found ${emails.length} new emails for ${settings.clinic.name}`);
    return emails;
  } finally{
    await imap.logout();
  }
}

//Note : Email is removed in supabase.
async function processIncomingEmail(supabaseClient, settings, email) {
  try {
    const fromEmail = email.from;
    const subject = email.subject;
    const body = email.body;
    const messageId = email.messageId;
    console.log(`Processing email from: ${fromEmail}, subject: ${subject}`);
    // Check if already processed
    const { data: existingConversation } = await supabaseClient.from('conversation').select('id').eq('email_message_id', messageId).single();
    if (existingConversation) {
      return {
        clinic_id: settings.clinic_id,
        status: 'already_processed',
        message_id: messageId,
        from_email: fromEmail
      };
    }
    // Get or create email lead source
    //Note:Email is removed in lead source table so below  query never work.
    let emailSource;
    const { data: existingSource } = await supabaseClient.from('lead_source').select('id').eq('name', 'Email').single();
    if (existingSource) {
      emailSource = existingSource;
    } else {
      const { data: newSource, error: sourceError } = await supabaseClient.from('lead_source').insert({
        name: 'Email',
        description: 'Leads from email communications'
      }).select().single();
      if (sourceError) {
        throw new Error(`Failed to create email lead source: ${sourceError.message}`);
      }
      emailSource = newSource;
    }
    // Check for existing thread
    let existingThread = null;
    const { data: threadData } = await supabaseClient.from('thread').select('*').eq('clinic_id', settings.clinic_id).eq('email_from', fromEmail).eq('channel', 'email').order('created_at', {
      ascending: false
    }).limit(1);
    if (threadData && threadData.length > 0) {
      const cleanSubject = subject.replace(/^(Re:|RE:|Fwd:|FWD:)\s*/i, '').trim();
      const existingSubject = threadData[0].email_subject?.replace(/^(Re:|RE:|Fwd:|FWD:)\s*/i, '').trim();
      if (cleanSubject === existingSubject) {
        existingThread = threadData[0];
      }
    }
    let threadId = existingThread?.id;
    // Create thread if needed
    if (!threadId) {
      // Check/create lead
      const { data: leadData } = await supabaseClient.from('lead').select('id').eq('clinic_id', settings.clinic_id).eq('email', fromEmail).eq('source_id', emailSource.id).single();
      if (!leadData) {
        const { error: leadError } = await supabaseClient.from('lead').insert({
          clinic_id: settings.clinic_id,
          email: fromEmail,
          status: 'new',
          source_id: emailSource.id,
          notes: `Email lead from: ${fromEmail}`
        }).select().single();
        if (leadError) {
          throw new Error(`Failed to create lead: ${leadError.message}`);
        }
      }
      // Create thread
      const { data: newThread, error: threadError } = await supabaseClient.from('thread').insert({
        clinic_id: settings.clinic_id,
        email_from: fromEmail,
        email_subject: subject,
        email_to: settings.smtp_sender_email,
        channel: 'email',
        status: 'active'
      }).select().single();
      if (threadError) {
        throw new Error(`Failed to create thread: ${threadError.message}`);
      }
      threadId = newThread.id;
    }
    // Store message
    const { error: conversationError } = await supabaseClient.from('conversation').insert({
      thread_id: threadId,
      message: body,
      sender_type: 'user',
      email_message_id: messageId,
      timestamp: new Date().toISOString()
    });
    if (conversationError) {
      throw new Error(`Failed to store conversation: ${conversationError.message}`);
    }
    // Trigger AI response
    const responseResult = await triggerEmailResponse(settings.clinic_id, threadId, body);
    return {
      clinic_id: settings.clinic_id,
      thread_id: threadId,
      from_email: fromEmail,
      subject: subject,
      status: 'processed',
      ai_response_success: responseResult.success
    };
  } catch (error) {
    console.error('Error processing email:', error);
    return {
      clinic_id: settings.clinic_id,
      from_email: email.from,
      error: error.message,
      status: 'processing_failed'
    };
  }
}
async function triggerEmailResponse(clinicId, threadId, message) {
  try {
    console.log(`Triggering AI response for clinic: ${clinicId}, thread: ${threadId}`);
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/assistant-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        clinic_id: clinicId,
        thread_id: threadId,
        message: message,
        channel: 'email'
      })
    });
    if (!response.ok) {
      throw new Error(`Assistant chat API returned ${response.status}`);
    }
    const result = await response.json();
    if (result.message) {
      const emailResult = await sendEmailResponse(clinicId, threadId, result.message);
      return {
        success: true,
        message: result.message,
        email_sent: emailResult.success
      };
    } else {
      throw new Error('No AI message returned');
    }
  } catch (error) {
    console.error('Error triggering AI response:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
async function sendEmailResponse(clinicId, threadId, message) {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        clinic_id: clinicId,
        thread_id: threadId,
        message: message
      })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `Send email API returned ${response.status}`);
    }
    return result;
  } catch (error) {
    console.error('Error sending email response:', error);
    throw error;
  }
}
