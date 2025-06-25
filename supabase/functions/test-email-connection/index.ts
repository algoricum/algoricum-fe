import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import OpenAI from 'jsr:@openai/openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Cache for email connections to avoid repeated connections
const connectionCache = new Map();

// Helper function to create JSON responses
const createResponse = (data: any, status = 200) => {
  console.log("Creating response with status:", status);
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables first
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return createResponse({
        success: false,
        error: 'Server configuration error: Missing Supabase credentials'
      }, 500);
    }

    if (!openaiKey) {
      console.error('Missing OpenAI API key');
      return createResponse({
        success: false,
        error: 'Server configuration error: Missing OpenAI API key'
      }, 500);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Initialize OpenAI client with validation
    console.log('Initializing OpenAI client...');
    const openai = new OpenAI({
      apiKey: openaiKey,
      timeout: 30000, // 30 second timeout
      maxRetries: 2
    });

    // Test OpenAI connection for cron jobs
    const requestData = await req.json();
    if (requestData.cron_job) {
      console.log('🤖 Cron job detected - testing OpenAI connection...');
      try {
        // Quick test to validate OpenAI API key
        await openai.models.list();
        console.log('✅ OpenAI connection validated for cron job');
      } catch (openaiTestError) {
        console.error('❌ OpenAI connection failed for cron job:', openaiTestError);
        return createResponse({
          success: false,
          error: `OpenAI API connection failed: ${openaiTestError.message}`,
          details: { context: 'cron_job_validation' }
        }, 500);
      }
    }

    
    // NEW: Check if this is a cron job call to process all clinics
    if (requestData.cron_job && requestData.process_all_clinics) {
      console.log('🤖 Processing all clinics via cron job...');
      
      // Get all email settings with their associated clinics and assistants
      const { data: emailConfigs, error: emailConfigsError } = await supabaseClient
        .from('email_settings')
        .select(`
          *,
          clinic:clinic_id (
            id,
            name,
            email,
            phone,
            business_hours,
            calendly_link,
            assistants (
              id,
              openai_assistant_id,
              assistant_name,
              instructions
            )
          )
        `)
        .not('clinic_id', 'is', null);


    

      if (emailConfigsError) {
        console.error('Failed to fetch email configurations:', emailConfigsError);
        return createResponse({
          success: false,
          error: `Failed to fetch email configurations: ${emailConfigsError.message}`
        }, 500);
      }

      if (!emailConfigs || emailConfigs.length === 0) {
        console.log('📭 No email configurations found');
        return createResponse({
          success: true,
          message: 'No email configurations found for processing',
          processed: 0
        });
      }

      console.log(`📧 Found ${emailConfigs.length} email configurations`);
      
      const results = [];
      let totalProcessed = 0;
      let totalErrors = 0;

      // Process each email configuration
      for (const emailConfig of emailConfigs) {
        try {
          const clinic = emailConfig.clinic;
          
          if (!clinic) {
            console.log(`⚠️ Skipping email config ID ${emailConfig.id} - no associated clinic`);
            continue;
          }

          console.log(`🏥 Processing clinic: ${clinic.name} (ID: ${clinic.id})`);
          
          const assistant = clinic.assistants?.[0];
          if (!assistant) {
            console.log(`⚠️ Skipping ${clinic.name} - no assistant configured`);
            continue;
          }

          // Process this clinic's emails using the email configuration
          const clinicResult = await processSingleClinicWithEmailSettings(
            emailConfig, 
            clinic, 
            assistant, 
            supabaseClient, 
            openai
          );
          
          if (clinicResult.success) {
            totalProcessed += clinicResult.emails_processed || 0;
          } else {
            totalErrors++;
          }

          results.push({
            clinic_id: clinic.id,
            clinic_name: clinic.name,
            email_settings_id: emailConfig.id,
            success: clinicResult.success,
            emails_processed: clinicResult.emails_processed || 0,
            error: clinicResult.error || null,
            processed_at: new Date().toISOString()
          });

          // Longer delay between clinics to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (clinicError) {
          console.error(`❌ Error processing email config ${emailConfig.id}:`, clinicError);
          totalErrors++;
          
          results.push({
            clinic_id: emailConfig.clinic?.id || 'unknown',
            clinic_name: emailConfig.clinic?.name || 'Unknown Clinic',
            email_settings_id: emailConfig.id,
            success: false,
            emails_processed: 0,
            error: clinicError instanceof Error ? clinicError.message : 'Unknown error',
            processed_at: new Date().toISOString()
          });
        }
      }

      // Log the cron job execution
      try {
        await supabaseClient
          .from('cron_job_logs')
          .insert({
            job_type: 'email_processing',
            total_clinics: emailConfigs.length,
            successful_clinics: results.filter(r => r.success).length,
            failed_clinics: totalErrors,
            total_emails_processed: totalProcessed,
            execution_details: results,
            executed_at: new Date().toISOString()
          });
      } catch (logError) {
        console.error('Failed to log cron job execution:', logError);
      }

      console.log(`🏁 Cron job completed:`);
      console.log(`   - Email configs processed: ${emailConfigs.length}`);
      console.log(`   - Total emails processed: ${totalProcessed}`);
      console.log(`   - Errors: ${totalErrors}`);

      return createResponse({
        success: true,
        message: `Cron job completed: processed ${totalProcessed} emails from ${emailConfigs.length} email configurations`,
        summary: {
          total_email_configs: emailConfigs.length,
          successful_clinics: results.filter(r => r.success).length,
          failed_clinics: totalErrors,
          total_emails_processed: totalProcessed,
          execution_time: new Date().toISOString()
        },
        details: results
      });
    }

    // Add diagnostic endpoint for debugging cron job issues
    if (requestData.diagnostic_test) {
      console.log('🔍 Running diagnostic test...');
      
      const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: {
          supabase_url: !!supabaseUrl,
          supabase_key: !!supabaseKey,
          openai_key: !!openaiKey,
          openai_key_length: openaiKey ? openaiKey.length : 0
        },
        openai_test: null,
        thread_test: null
      };

      // Test OpenAI connection
      try {
        const models = await openai.models.list();
        diagnostics.openai_test = {
          success: true,
          models_count: models.data?.length || 0
        };
        console.log('✅ OpenAI connection test passed');
      } catch (openaiError) {
        diagnostics.openai_test = {
          success: false,
          error: openaiError.message
        };
        console.error('❌ OpenAI connection test failed:', openaiError);
      }

      // Test thread creation
      try {
        const testThread = await openai.beta.threads.create({
          metadata: { test: 'diagnostic' }
        });
        diagnostics.thread_test = {
          success: true,
          thread_id: testThread.id,
          thread_created: !!testThread.id
        };
        console.log('✅ Thread creation test passed');
      } catch (threadError) {
        diagnostics.thread_test = {
          success: false,
          error: threadError.message
        };
        console.error('❌ Thread creation test failed:', threadError);
      }

      return createResponse({
        success: true,
        message: 'Diagnostic test completed',
        diagnostics
      });
    }

    // Add IMAP diagnostic endpoint for debugging email parsing issues
    if (requestData.imap_diagnostic) {
      console.log('🔍 Running IMAP diagnostic test...');
      
      if (!requestData.imap_server || !requestData.imap_user || !requestData.imap_password) {
        return createResponse({
          success: false,
          error: 'IMAP diagnostic requires imap_server, imap_user, and imap_password'
        }, 400);
      }
      
      const imapDiagnostic = {
        timestamp: new Date().toISOString(),
        imap_config: {
          server: requestData.imap_server,
          port: requestData.imap_port || 993,
          username: requestData.imap_user,
          ssl: requestData.imap_use_ssl !== false
        },
        connection_test: null,
        search_test: null,
        fetch_test: null
      };

      try {
        const diagnosticResult = await testImapConnection(
          requestData.imap_server,
          requestData.imap_port || 993,
          requestData.imap_user,
          requestData.imap_password,
          requestData.imap_use_ssl !== false
        );
        
        return createResponse({
          success: true,
          message: 'IMAP diagnostic completed',
          diagnostic: {
            ...imapDiagnostic,
            ...diagnosticResult
          }
        });
        
      } catch (diagnosticError) {
        return createResponse({
          success: false,
          message: 'IMAP diagnostic failed',
          error: diagnosticError.message,
          diagnostic: imapDiagnostic
        }, 500);
      }
    }

    // Verify authentication for manual calls
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createResponse({
        success: false,
        error: 'No authorization header provided'
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    
    // EXISTING: Continue with your normal single clinic processing for manual calls
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return createResponse({
        success: false,
        error: 'Authentication failed'
      }, 401);
    }

    const isCronJob = requestData.cron_job || false;
    console.log(`${isCronJob ? 'Cron job' : 'Manual'} execution started for user:`, user.id);

    // Extract and validate configuration
    const {
      smtp_host, smtp_port = 465, smtp_user, smtp_password,
      smtp_sender_email, smtp_sender_name = 'Clinic Support', smtp_use_tls = true,
      imap_server, imap_port = 993, imap_user, imap_password, imap_use_ssl = true,
      clinic_id, assistant_id
    } = requestData;

    // Validate required fields
    const missingFields = [];
    if (!smtp_host) missingFields.push('SMTP host');
    if (!smtp_user) missingFields.push('SMTP username');
    if (!smtp_password) missingFields.push('SMTP password');
    if (!imap_server) missingFields.push('IMAP server');
    if (!imap_user) missingFields.push('IMAP username');
    if (!imap_password) missingFields.push('IMAP password');

    if (missingFields.length > 0) {
      return createResponse({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        details: {
          missing_fields: missingFields,
          smtp_configured: !!(smtp_host && smtp_user && smtp_password),
          imap_configured: !!(imap_server && imap_user && imap_password)
        }
      }, 400);
    }

    // Get clinic and assistant information
    let clinicName = 'Your Clinic';
    let clinicInfo = null;
    let assistantInfo = null;

    if (clinic_id) {
      try {
        const { data: clinicData } = await supabaseClient
          .from('clinic')
          .select('name, email, phone, business_hours, calendly_link')  // Added business_hours and calendly_link
          .eq('id', clinic_id)
          .single();
        if (clinicData?.name) {
          clinicName = clinicData.name;
          clinicInfo = clinicData;
        }
      } catch (error) {
        console.warn('Could not fetch clinic information:', error);
      }
    }

    if (assistant_id) {
      try {
        const { data: assistantData } = await supabaseClient
          .from('assistants')
          .select('openai_assistant_id, assistant_name, instructions')
          .eq('id', assistant_id)
          .eq('clinic_id', clinic_id)
          .single();
        assistantInfo = assistantData;
      } catch (error) {
        console.warn('Could not fetch assistant information:', error);
      }
    }

    // Initialize test results
    const testResults = {
      smtp: {
        success: false,
        message: '',
        error: '',
        details: {
          host: smtp_host,
          port: smtp_port,
          username: smtp_user,
          tls: smtp_use_tls,
          sender_email: smtp_sender_email || smtp_user
        }
      },
      imap: {
        success: false,
        message: '',
        error: '',
        details: {
          host: imap_server,
          port: imap_port,
          username: imap_user,
          ssl: imap_use_ssl,
          mailbox_info: null,
          latest_email: null,
          processed_emails: []
        }
      },
      overall: false,
      test_timestamp: new Date().toISOString(),
      is_cron_job: isCronJob
    };

    // Test SMTP Connection (skip for cron)
    if (!isCronJob) {
      console.log('Testing SMTP connection...');
      
      try {
        const smtpStartTime = Date.now();
        const smtpClient = new SMTPClient({
          connection: {
            hostname: smtp_host,
            port: smtp_port,
            tls: smtp_use_tls,
            auth: {
              username: smtp_user,
              password: smtp_password
            }
          }
        });

        const testEmailHTML = generateDetailedTestEmail(clinicName, clinicInfo, {
          smtp_host, smtp_port, smtp_user, smtp_sender_email, smtp_use_tls,
          imap_server, imap_port, imap_user, imap_use_ssl
        });

        const testEmailText = generateTextTestEmail(clinicName, {
          smtp_host, smtp_port, smtp_user, smtp_sender_email, smtp_use_tls,
          imap_server, imap_port, imap_user, imap_use_ssl
        });

        await smtpClient.send({
          from: `${smtp_sender_name} <${smtp_sender_email || smtp_user}>`,
          to: smtp_user,
          subject: `✅ Email Configuration Test - ${clinicName} - ${new Date().toLocaleDateString()}`,
          html: testEmailHTML,
          text: testEmailText
        });

        await smtpClient.close();
        const smtpDuration = Date.now() - smtpStartTime;
        
        testResults.smtp.success = true;
        testResults.smtp.message = `SMTP connection successful (${smtpDuration}ms)`;
        testResults.smtp.details.response_time = smtpDuration;
        console.log(`SMTP test successful in ${smtpDuration}ms`);
        
      } catch (smtpError) {
        testResults.smtp.error = smtpError.message;
        testResults.smtp.details.error_type = smtpError.name || 'SMTPError';
        console.error('SMTP Test Error:', smtpError.message);
        
        if (smtpError.message.includes('authentication')) {
          testResults.smtp.message = 'Authentication failed - check username and password';
        } else if (smtpError.message.includes('connection')) {
          testResults.smtp.message = 'Connection failed - check host and port settings';
        } else {
          testResults.smtp.message = 'SMTP connection failed';
        }
      }
    } else {
      testResults.smtp.success = true;
      testResults.smtp.message = 'SMTP connection skipped for cron job';
    }

    console.log('Starting IMAP email processing...');
    
    // IMAP Connection and Email Processing
    try {
      const imapStartTime = Date.now();
      const imapResult = await processEmailsWithAutoReply({
        hostname: imap_server,
        port: imap_port,
        username: imap_user,
        password: imap_password,
        useSsl: imap_use_ssl
      }, {
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_password,
        smtp_sender_email: smtp_sender_email || smtp_user,
        smtp_sender_name,
        smtp_use_tls
      }, {
        openai,
        assistantInfo,
        clinicName,
        clinicInfo,
        clinic_id,
        supabaseClient
      });
      
      const imapDuration = Date.now() - imapStartTime;
      
      if (imapResult.success) {
        testResults.imap.success = true;
        testResults.imap.message = `IMAP processing successful (${imapDuration}ms)`;
        testResults.imap.details = {
          ...testResults.imap.details,
          ...imapResult.details,
          response_time: imapDuration
        };

        console.log(`IMAP processing successful in ${imapDuration}ms`);
      } else {
        throw new Error(imapResult.error);
      }
      
    } catch (imapError) {
      testResults.imap.error = imapError.message;
      testResults.imap.details.error_type = imapError.name || 'IMAPError';
      console.error('IMAP Processing Error:', imapError.message);
      
      if (imapError.message.includes('authentication') || imapError.message.includes('LOGIN')) {
        testResults.imap.message = 'Authentication failed - check username and password';
      } else if (imapError.message.includes('connection') || imapError.message.includes('connect')) {
        testResults.imap.message = 'Connection failed - check host and port settings';
      } else {
        testResults.imap.message = 'IMAP processing failed';
      }
    }

    // Overall success evaluation
    testResults.overall = testResults.smtp.success && testResults.imap.success;

    // Generate response based on whether it's a cron job or manual test
    if (isCronJob) {
      return createResponse({
        success: testResults.overall,
        message: testResults.overall 
          ? `✅ Cron job completed successfully for ${clinicName}` 
          : `❌ Cron job failed for ${clinicName}`,
        summary: {
          smtp_status: testResults.smtp.success ? 'Connected' : 'Failed',
          imap_status: testResults.imap.success ? 'Connected' : 'Failed',
          emails_processed: testResults.imap.details.processed_emails?.length || 0,
          execution_type: 'cron_job'
        },
        details: testResults
      });
    } else {
      if (testResults.overall) {
        return createResponse({
          success: true,
          message: `🎉 Email configuration test successful for ${clinicName}! ${testResults.imap.details.processed_emails?.length || 0} emails processed.`,
          summary: {
            smtp_status: 'Connected successfully',
            imap_status: 'Connected successfully',
            test_email_sent: true,
            mailbox_access: true,
            emails_processed: testResults.imap.details.processed_emails?.length || 0
          },
          details: testResults
        });
      } else {
        const failedServices = [];
        if (!testResults.smtp.success) failedServices.push('SMTP (outgoing email)');
        if (!testResults.imap.success) failedServices.push('IMAP (incoming email)');
        
        return createResponse({
          success: false,
          message: `❌ Email configuration test failed for: ${failedServices.join(' and ')}`,
          summary: {
            smtp_status: testResults.smtp.success ? 'Connected' : 'Failed',
            imap_status: testResults.imap.success ? 'Connected' : 'Failed',
            test_email_sent: testResults.smtp.success,
            mailbox_access: testResults.imap.success
          },
          details: testResults,
          troubleshooting: generateTroubleshootingGuide(testResults)
        }, 400);
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return createResponse({
      success: false,
      error: `Unexpected error: ${error.message}`,
      details: {
        error_type: error.name || 'UnknownError',
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    }, 500);
  }
});


function formatBusinessHours(businessHoursJson: string | object): string {
  try {
    let businessHours;
    
    // Parse JSON if it's a string, otherwise use as object
    if (typeof businessHoursJson === 'string') {
      businessHours = JSON.parse(businessHoursJson);
    } else {
      businessHours = businessHoursJson;
    }
    
    if (!businessHours || typeof businessHours !== 'object') {
      return '';
    }
    
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const openDays = [];
    const closedDays = [];
    
    // Group days by open/closed status and times
    for (const day of dayOrder) {
      const dayData = businessHours[day];
      if (dayData && dayData.isOpen) {
        openDays.push({
          day,
          openTime: dayData.openTime,
          closeTime: dayData.closeTime
        });
      } else {
        closedDays.push(day);
      }
    }
    
    let formattedHours = '';
    
    // Group consecutive days with same hours
    const groupedDays = [];
    let currentGroup = null;
    
    for (const dayInfo of openDays) {
      const timeRange = `${dayInfo.openTime} - ${dayInfo.closeTime}`;
      
      if (!currentGroup || currentGroup.timeRange !== timeRange) {
        if (currentGroup) {
          groupedDays.push(currentGroup);
        }
        currentGroup = {
          days: [dayInfo.day],
          timeRange: timeRange
        };
      } else {
        currentGroup.days.push(dayInfo.day);
      }
    }
    
    if (currentGroup) {
      groupedDays.push(currentGroup);
    }
    
    // Format the grouped days
    const formattedGroups = groupedDays.map(group => {
      if (group.days.length === 1) {
        return `${group.days[0]}: ${group.timeRange}`;
      } else if (group.days.length === 2) {
        return `${group.days[0]} & ${group.days[1]}: ${group.timeRange}`;
      } else {
        const firstDay = group.days[0];
        const lastDay = group.days[group.days.length - 1];
        return `${firstDay} - ${lastDay}: ${group.timeRange}`;
      }
    });
    
    formattedHours = formattedGroups.join(', ');
    
    // Add closed days if any
    if (closedDays.length > 0) {
      if (formattedHours) {
        formattedHours += '. ';
      }
      if (closedDays.length === 1) {
        formattedHours += `Closed on ${closedDays[0]}`;
      } else {
        formattedHours += `Closed on ${closedDays.join(' & ')}`;
      }
    }
    
    return formattedHours;
    
  } catch (error) {
    console.error('Error formatting business hours:', error);
    return '';
  }
}

// Helper function to process a single clinic using email_settings table data
async function processSingleClinicWithEmailSettings(emailConfig, clinic, assistant, supabaseClient, openai) {
  try {
    console.log(`🏥 Processing emails for clinic: ${clinic.name}`);
    
    // Add initial delay to stagger clinic processing
    const randomDelay = Math.random() * 2000; // 0-2 seconds random delay
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    // Use your existing processEmailsWithAutoReply function with email_settings data
    const imapResult = await processEmailsWithAutoReply({
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
      assistantInfo: assistant,
      clinicName: clinic.name,
      clinicInfo: clinic,
      clinic_id: clinic.id,
      supabaseClient
    });

    console.log(`✅ Clinic ${clinic.name} processed: ${imapResult.success ? 'Success' : 'Failed'}`);
    
    return {
      success: imapResult.success,
      emails_processed: imapResult.details?.successfully_replied || 0,
      error: imapResult.error || null
    };
    
  } catch (error) {
    console.error(`❌ Error processing clinic ${clinic.name}:`, error);
    
    // Check if it's a rate limit error
    if (error.message.includes('rate') || error.message.includes('Rate limit')) {
      return {
        success: false,
        emails_processed: 0,
        error: `Rate limit exceeded: ${error.message}`
      };
    }
    
    return {
      success: false,
      emails_processed: 0,
      error: error.message
    };
  }
}

// Enhanced function to process emails and auto-reply
async function processEmailsWithAutoReply(
  imapConfig: {
    hostname: string;
    port: number;
    username: string;
    password: string;
    useSsl?: boolean;
  },
  smtpConfig: {
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_password: string;
    smtp_sender_email: string;
    smtp_sender_name: string;
    smtp_use_tls: boolean;
  },
  aiConfig: {
    openai: any;
    assistantInfo: any;
    clinicName: string;
    clinicInfo: any;
    clinic_id: string;
    supabaseClient: any;
  }
) {
  const { hostname, port, username, password, useSsl = true } = imapConfig;
  
  let conn: Deno.Conn | Deno.TlsConn;
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  const processedEmails = [];
  
  try {
    console.log(`Connecting to IMAP server: ${hostname}:${port} (SSL: ${useSsl})`);
    
    // Establish connection
    if (useSsl) {
      conn = await Deno.connectTls({
        hostname,
        port,
        caCerts: [],
      });
    } else {
      conn = await Deno.connect({
        hostname,
        port
      });
    }
    
    console.log('IMAP connection established');
    
  } catch (error) {
    console.error('IMAP connection failed:', error);
    return {
      success: false,
      error: `Failed to connect to ${hostname}:${port} - ${error.message}`,
      details: { hostname, port, useSsl, stage: 'connection' }
    };
  }

  // Response reading and command sending functions
  const readBuffer = async (timeoutMs = 30000): Promise<string> => {
    const buffer = new Uint8Array(8192);
    let result = '';
    const deadline = Date.now() + timeoutMs;
    
    while (Date.now() < deadline) {
      try {
        const n = await Promise.race([
          conn.read(buffer),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Read timeout')), 5000)
          )
        ]);
        
        if (n === null) break;
        
        const chunk = textDecoder.decode(buffer.subarray(0, n));
        result += chunk;
        
        if (result.endsWith('\r\n')) {
          break;
        }
        
      } catch (error) {
        if (error.message === 'Read timeout' && result.length > 0) {
          continue;
        }
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

  try {
    // Read server greeting
    console.log('Reading IMAP server greeting...');
    const greeting = await readBuffer(10000);
    console.log(`IMAP greeting received`);
    
    if (!greeting.includes('* OK') && !greeting.includes('* PREAUTH')) {
      throw new Error(`Invalid IMAP greeting: ${greeting}`);
    }

    // Authenticate
    console.log('Authenticating with IMAP server...');
    const loginResponse = await sendCommand('A001', `LOGIN "${username}" "${password}"`);
    
    if (!loginResponse.includes('A001 OK')) {
      throw new Error('IMAP authentication failed');
    }

    // Select INBOX
    console.log('Selecting INBOX...');
    const selectResponse = await sendCommand('A002', 'SELECT INBOX');
    
    if (!selectResponse.includes('A002 OK')) {
      throw new Error(`Failed to select INBOX`);
    }

    // Search for unread emails
    console.log('Searching for unread emails...');
    const searchResponse = await sendCommand('A003', 'SEARCH UNSEEN');
    console.log('Raw search response:', searchResponse);
    
    const messageIds = parseSearchResultsForIds(searchResponse);
    console.log(`Found ${messageIds.length} unread emails:`, messageIds);

    // Process each unread email
    if (messageIds.length === 0) {
      console.log('No unread emails found, checking if there are any emails at all...');
      
      // Try searching for all emails to see if IMAP is working
      const allEmailsResponse = await sendCommand('A007', 'SEARCH ALL');
      console.log('All emails search response:', allEmailsResponse);
      
      const allIds = parseSearchResultsForIds(allEmailsResponse);
      console.log(`Total emails in mailbox: ${allIds.length}`);
      
      if (allIds.length > 0) {
        console.log('There are emails in the mailbox, but none are marked as unread');
        
        // Let's try the latest email to test parsing
        const latestId = Math.max(...allIds);
        console.log(`Testing with latest email ID: ${latestId}`);
        
        try {
          const testFetch = await sendCommand('A008', `FETCH ${latestId} (FLAGS BODY[HEADER.FIELDS (FROM SUBJECT DATE)])`);
          console.log('Test fetch response:', testFetch);
        } catch (testError) {
          console.error('Test fetch failed:', testError);
        }
      }
    }

    for (const messageId of messageIds) {
      try {
        console.log(`Processing email ID: ${messageId}`);
        
        // Fetch email headers and body
        console.log(`Fetching email ${messageId} data...`);
        let fetchResponse = '';
        let emailData = null;
        
        // Try primary fetch command
        try {
          fetchResponse = await sendCommand('A004', `FETCH ${messageId} (BODY[HEADER] BODY[TEXT])`);
          console.log(`Raw fetch response for email ${messageId}:`, fetchResponse.substring(0, 500) + '...');
          
          emailData = parseEmailData(fetchResponse);
        } catch (fetchError) {
          console.error(`Primary fetch failed for email ${messageId}:`, fetchError);
        }
        
        // If primary fetch didn't work or didn't get good data, try alternative
        if (!emailData || !emailData.headers.from) {
          console.log(`Trying alternative fetch for email ${messageId}...`);
          try {
            fetchResponse = await sendCommand('A009', `FETCH ${messageId} (BODY.PEEK[HEADER] BODY.PEEK[TEXT])`);
            console.log(`Alternative fetch response:`, fetchResponse.substring(0, 500) + '...');
            emailData = parseEmailData(fetchResponse);
          } catch (altFetchError) {
            console.error(`Alternative fetch failed for email ${messageId}:`, altFetchError);
          }
        }
        
        // If still no good data, try simple header fetch
        if (!emailData || !emailData.headers.from) {
          console.log(`Trying simple header fetch for email ${messageId}...`);
          try {
            fetchResponse = await sendCommand('A010', `FETCH ${messageId} (BODY[HEADER.FIELDS (FROM SUBJECT DATE)] BODY[TEXT])`);
            console.log(`Simple fetch response:`, fetchResponse.substring(0, 500) + '...');
            emailData = parseEmailData(fetchResponse);
          } catch (simpleFetchError) {
            console.error(`Simple fetch failed for email ${messageId}:`, simpleFetchError);
          }
        }
        
        if (!emailData) {
          console.log(`Failed to fetch email ${messageId} with any method`);
          continue;
        }
        
        console.log(`Parsed email data for ${messageId}:`, {
          from: emailData.headers.from,
          subject: emailData.headers.subject,
          bodyLength: emailData.body?.length || 0,
          allHeaders: Object.keys(emailData.headers)
        });
        
        if (!emailData.headers.from) {
          console.log(`Skipping email ${messageId} - no sender information`);
          console.log('Available headers:', Object.keys(emailData.headers));
          console.log('Full headers object:', emailData.headers);
          continue;
        }

        // Generate AI response
        console.log(`Generating AI response for email from: ${emailData.headers.from}`);
        const aiResponse = await generateAIResponse(
          emailData,
          aiConfig.openai,
          aiConfig.assistantInfo,
          aiConfig.clinicName,
          aiConfig.clinicInfo
        );

        if (aiResponse) {
          // Send reply
          console.log(`Sending reply to: ${emailData.headers.from}`);
          await sendReply(emailData, aiResponse, smtpConfig);
          
          // Mark as read
          await sendCommand('A005', `STORE ${messageId} +FLAGS (\\Seen)`);
          
          // Save to database
          await saveEmailProcessingStatus({
            clinic_id: aiConfig.clinic_id,
            message_id: messageId.toString(),
            sender_email: emailData.headers.from,
            subject: emailData.headers.subject || 'No subject',
            reply_sent: true,
            ai_response: aiResponse
          }, aiConfig.supabaseClient);
          
          processedEmails.push({
            message_id: messageId,
            from: emailData.headers.from,
            subject: emailData.headers.subject || 'No subject',
            reply_sent: true,
            processed_at: new Date().toISOString()
          });
          
          console.log(`Successfully processed and replied to email ${messageId}`);
        } else {
          console.log(`Failed to generate AI response for email ${messageId}`);
          
          // Save failed attempt to database
          await saveEmailProcessingStatus({
            clinic_id: aiConfig.clinic_id,
            message_id: messageId.toString(),
            sender_email: emailData.headers.from,
            subject: emailData.headers.subject || 'No subject',
            reply_sent: false,
            error_message: 'Failed to generate AI response'
          }, aiConfig.supabaseClient);
          
          processedEmails.push({
            message_id: messageId,
            from: emailData.headers.from,
            subject: emailData.headers.subject || 'No subject',
            reply_sent: false,
            error: 'Failed to generate AI response',
            processed_at: new Date().toISOString()
          });
        }
        
        // Add delay between processing emails to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 3000)); // Increased to 3 seconds
        
      } catch (emailError) {
        console.error(`❌ Error processing email ${messageId}:`, emailError);
        
        // Check if it's a rate limit error and wait longer
        if (emailError.message.includes('rate') || emailError.message.includes('Rate limit')) {
          console.log('⏳ Rate limit detected, waiting 10 seconds before continuing...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        // Save failed attempt to database
        await saveEmailProcessingStatus({
          clinic_id: aiConfig.clinic_id,
          message_id: messageId.toString(),
          sender_email: emailData?.headers?.from || 'unknown',
          subject: emailData?.headers?.subject || 'No subject',
          reply_sent: false,
          error_message: emailError.message
        }, aiConfig.supabaseClient);
        
        processedEmails.push({
          message_id: messageId,
          reply_sent: false,
          error: emailError.message,
          processed_at: new Date().toISOString()
        });
      }
    }

    // Logout
    await sendCommand('A006', 'LOGOUT');
    conn.close();

    return {
      success: true,
      details: {
        hostname,
        port,
        username,
        useSsl,
        total_unread: messageIds.length,
        processed_emails: processedEmails,
        successfully_replied: processedEmails.filter(e => e.reply_sent).length
      }
    };

  } catch (error) {
    console.error('IMAP processing error:', error);
    
    try {
      conn.close();
    } catch (_) {
      // Ignore close errors
    }
    
    return {
      success: false,
      error: error.message || 'Unknown IMAP error',
      details: {
        hostname,
        port,
        username,
        useSsl,
        processed_emails: processedEmails
      }
    };
  }
}

// COMPLETELY FIXED AI response generation with enhanced cron job support
async function generateAIResponse(
  emailData: any,
  openai: any,
  assistantInfo: any,
  clinicName: string,
  clinicInfo: any
): Promise<string | null> {
  try {
    console.log('Starting AI response generation...');
    console.log('Assistant info:', assistantInfo ? 'Available' : 'Not available');
    console.log('OpenAI client:', openai ? 'Initialized' : 'Not initialized');
    
    // Validate inputs
    if (!openai) {
      console.log('OpenAI client not available, using default response');
      return generateDefaultResponse(emailData, clinicName, clinicInfo);
    }
    
    // Validate email data first
    if (!emailData?.body && !emailData?.headers?.subject) {
      console.log('Empty email content, using default response');
      return generateDefaultResponse(emailData, clinicName, clinicInfo);
    }

    // Check if we have valid assistant info
    if (!assistantInfo?.openai_assistant_id || typeof assistantInfo.openai_assistant_id !== 'string') {
      console.log('No valid assistant configured, using chat completion API...');
      return await generateChatCompletionResponse(emailData, openai, clinicName, clinicInfo);
    }

    console.log(`Attempting to use assistant ID: ${assistantInfo.openai_assistant_id}`);

    // Try assistant API with robust error handling
    try {
      const result = await tryAssistantAPI(emailData, openai, assistantInfo, clinicName);
      console.log('✅ Assistant API succeeded');
      return result;
    } catch (assistantError) {
      console.error('❌ Assistant API failed:', assistantError.message);
      
      // Check if it's a rate limit error
      if (assistantError.message.includes('rate') || assistantError.message.includes('quota')) {
        console.log('Rate limit detected, waiting before fallback...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Fallback to chat completion
      console.log('🔄 Falling back to chat completion API...');
      return await generateChatCompletionResponse(emailData, openai, clinicName, clinicInfo);
    }
    
  } catch (error) {
    console.error('❌ Error in generateAIResponse:', error);
    
    // Final fallback to default response
    console.log('🔄 All AI methods failed, using default response');
    return generateDefaultResponse(emailData, clinicName, clinicInfo);
  }
}

// FIXED: Assistant API function with proper thread validation and cron job handling
async function tryAssistantAPI(emailData: any, openai: any, assistantInfo: any, clinicName: string, clinicInfo: any): Promise<string> {
  console.log('Creating OpenAI thread...');
  
  let thread: any = null;
  let retryCount = 0;
  const maxRetries = 3;
  
  // Validate OpenAI client first
  if (!openai) {
    throw new Error('OpenAI client is not initialized');
  }

  if (!assistantInfo?.openai_assistant_id) {
    throw new Error('Assistant ID is not provided or invalid');
  }
  
  while (retryCount < maxRetries) {
    try {
      console.log(`Thread creation attempt ${retryCount + 1}/${maxRetries}`);
      
      // Create thread with timeout and retry logic
      const threadCreationPromise = openai.beta.threads.create({
        metadata: {
          clinic: clinicName,
          created_by: 'email_processing'
        }
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Thread creation timeout')), 20000)
      );
      
      thread = await Promise.race([threadCreationPromise, timeoutPromise]);
      
      // Validate thread was created properly
      if (!thread || typeof thread !== 'object') {
        throw new Error(`Thread creation returned invalid response: ${typeof thread}`);
      }
      
      if (!thread.id || typeof thread.id !== 'string') {
        throw new Error(`Thread missing or invalid ID: ${JSON.stringify(thread)}`);
      }
      
      if (!thread.id.startsWith('thread_')) {
        throw new Error(`Thread ID format invalid: ${thread.id}`);
      }
      
      console.log(`✅ Thread created successfully: ${thread.id}`);
      break; // Success, exit retry loop
      
    } catch (threadError) {
      retryCount++;
      console.error(`Thread creation attempt ${retryCount} failed:`, threadError.message);
      
      if (retryCount >= maxRetries) {
        throw new Error(`Thread creation failed after ${maxRetries} attempts: ${threadError.message}`);
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
      console.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  try {
    // Prepare clinic information for the AI
    let clinicInfoText = '';
    if (clinicInfo) {
      clinicInfoText = `\n\nCLINIC INFORMATION:
- Name: ${clinicName}`;
      
      if (clinicInfo.phone) {
        clinicInfoText += `\n- Phone: ${clinicInfo.phone}`;
      }
      
    if (clinicInfo.business_hours) {
        const formattedHours = formatBusinessHours(clinicInfo.business_hours);
        if (formattedHours) {
          clinicInfoText += `\n- Business Hours: ${formattedHours}`;
        }
      }
      
      if (clinicInfo.calendly_link) {
        clinicInfoText += `\n- Online Scheduling: ${clinicInfo.calendly_link}`;
      }
      
      if (clinicInfo.email) {
        clinicInfoText += `\n- Email: ${clinicInfo.email}`;
      }
    }

    // Prepare email content (truncated for token limits)
    const emailContent = `
PATIENT EMAIL INQUIRY:

From: ${emailData.headers.from || 'Unknown sender'}
Subject: ${truncateText(emailData.headers.subject || 'No subject', 100)}

Message:
${truncateText(emailData.body || 'No message content', 1200)}

${clinicInfoText}

Please generate a professional, helpful response for ${clinicName}. 

IMPORTANT INSTRUCTIONS:
- If the patient asks about clinic hours, timing, schedule, or when you're open, provide the business hours information.
- If they want to book an appointment and you have a Calendly link, include it in your response.
- Keep responses concise and professional.
- Always be courteous and helpful.
`;

    console.log('Adding message to thread...');
    try {
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: emailContent
      });
      console.log('✅ Message added to thread successfully');
    } catch (messageError) {
      console.error('❌ Failed to add message to thread:', messageError);
      if (messageError.message.includes('rate') || messageError.status === 429) {
        throw new Error('Rate limit exceeded when adding message to thread');
      }
      throw new Error(`Failed to add message to thread: ${messageError.message}`);
    }

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Starting assistant run...');
    let run;
    try {
      // Create enhanced instructions that include clinic timing information
      let instructions = `You are a helpful assistant for ${clinicName}. Respond professionally and concisely to patient inquiries. Keep responses under 200 words.`;
      
     if (clinicInfo?.business_hours) {
        const formattedHours = formatBusinessHours(clinicInfo.business_hours);
        if (formattedHours) {
          instructions += ` When patients ask about clinic hours, timing, or schedule, inform them that ${clinicName} is open: ${formattedHours}.`;
        }
      }
      
      
      if (clinicInfo?.calendly_link) {
        instructions += ` For appointment scheduling, direct them to book online at: ${clinicInfo.calendly_link}`;
      }
      
      if (clinicInfo?.phone) {
        instructions += ` For urgent matters or phone appointments, they can call: ${clinicInfo.phone}`;
      }

      run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistantInfo.openai_assistant_id,
        instructions: instructions
      });
      console.log(`✅ Run created: ${run.id}, initial status: ${run.status}`);
    } catch (runCreateError) {
      console.error('❌ Failed to create assistant run:', runCreateError);
      if (runCreateError.message.includes('rate') || runCreateError.status === 429) {
        throw new Error('Rate limit exceeded when creating assistant run');
      }
      if (runCreateError.message.includes('assistant') || runCreateError.status === 404) {
        throw new Error(`Assistant not found or not accessible: ${assistantInfo.openai_assistant_id}`);
      }
      throw new Error(`Failed to create assistant run: ${runCreateError.message}`);
    }

    // Wait for completion with proper timeout and rate limit handling
    let runStatus = run;
    let attempts = 0;
    const maxAttempts = 45; // Increased to 45 seconds
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;
    
    while ((runStatus.status === 'running' || runStatus.status === 'queued' || runStatus.status === 'in_progress') && attempts < maxAttempts) {
      // Progressive delay - start with 1s, increase to 2s after 10 attempts
      const delayMs = attempts > 10 ? 2000 : 1000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
      attempts++;
      
      try {
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        console.log(`Run status: ${runStatus.status} (attempt ${attempts}/${maxAttempts})`);
        consecutiveErrors = 0; // Reset error counter on success
        
        // Check for failed status
        if (runStatus.status === 'failed') {
          const errorMessage = runStatus.last_error?.message || 'Unknown error';
          throw new Error(`Assistant run failed: ${errorMessage}`);
        }
        
      } catch (retrieveError) {
        consecutiveErrors++;
        console.error(`❌ Error retrieving run status (${consecutiveErrors}/${maxConsecutiveErrors}):`, retrieveError.message);
        
        // If it's a rate limit error, wait longer
        if (retrieveError.message.includes('rate') || retrieveError.status === 429) {
          console.log('⏳ Rate limit hit, waiting 5 seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        // If too many consecutive errors, give up
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(`Run status retrieval failed after ${maxConsecutiveErrors} consecutive errors: ${retrieveError.message}`);
        }
        
        // For other errors, just continue trying
        continue;
      }
    }

    if (attempts >= maxAttempts) {
      throw new Error(`Assistant run timed out after ${maxAttempts} seconds`);
    }

    if (runStatus.status === 'completed') {
      console.log('Run completed successfully, retrieving messages...');
      
      // Get messages
      const messages = await openai.beta.threads.messages.list(thread.id, { 
        limit: 10,
        order: 'desc'
      });
      
      // Find the latest assistant message
      const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
      
      if (!assistantMessage) {
        throw new Error('No assistant message found in thread');
      }
      
      if (!assistantMessage.content || !Array.isArray(assistantMessage.content)) {
        throw new Error('Assistant message has no content array');
      }
      
      const textContent = assistantMessage.content.find(content => content.type === 'text');
      
      if (!textContent || !textContent.text || !textContent.text.value) {
        throw new Error('No text content found in assistant message');
      }
      
      const responseText = textContent.text.value.trim();
      
      if (responseText.length === 0) {
        throw new Error('Assistant response is empty');
      }
      
      console.log('✅ Successfully extracted AI response from assistant');
      return responseText;
      
    } else if (runStatus.status === 'failed') {
      const errorMessage = runStatus.last_error ? runStatus.last_error.message : 'Unknown failure';
      throw new Error(`Assistant run failed: ${errorMessage}`);
    } else if (runStatus.status === 'cancelled') {
      throw new Error('Assistant run was cancelled');
    } else {
      throw new Error(`Assistant run ended with unexpected status: ${runStatus.status}`);
    }
    
  } catch (error) {
    console.error('Error in assistant processing:', error);
    throw error;
  }
}

// 4. Update the Chat Completion function to include clinic timing information:
async function generateChatCompletionResponse(
  emailData: any,
  openai: any,
  clinicName: string,
  clinicInfo: any
): Promise<string> {
  try {
    console.log('Using OpenAI Chat Completion API...');
    
    // Build clinic information for the system prompt
    let clinicDetails = '';
    if (clinicInfo) {
       if (clinicInfo.business_hours) {
        const formattedHours = formatBusinessHours(clinicInfo.business_hours);
        if (formattedHours) {
          clinicDetails += ` Our business hours are: ${formattedHours}.`;
        }
      }
      if (clinicInfo.calendly_link) {
        clinicDetails += ` Patients can book appointments online at: ${clinicInfo.calendly_link}.`;
      }
      if (clinicInfo.phone) {
        clinicDetails += ` For urgent matters, they can call: ${clinicInfo.phone}.`;
      }
    }
    
    const systemPrompt = `You are a customer service representative for ${clinicName}. Respond professionally and helpfully to patient emails. Keep responses under 200 words and always be courteous.${clinicDetails} When patients ask about clinic hours, timing, or schedule, make sure to provide this information. Sign off as "${clinicName} Team".`;
    
    // Truncate content to stay within token limits
    const emailBody = truncateText(emailData.body || 'No content', 1500);
    const subject = truncateText(emailData.headers.subject || 'No subject', 100);
    
    const userPrompt = `Please respond to this patient email:

From: ${emailData.headers.from || 'Unknown'}
Subject: ${subject}

Message: ${emailBody}

Generate a helpful, professional response. If they're asking about clinic timing or hours, make sure to include our business hours and scheduling information.`;

    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`Chat completion attempt ${retryCount + 1}/${maxRetries}`);
        
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 400,
          temperature: 0.7,
          top_p: 0.9
        });

        if (!completion.choices || completion.choices.length === 0) {
          throw new Error('No choices returned from chat completion');
        }
        
        const message = completion.choices[0].message;
        if (!message || !message.content) {
          throw new Error('No message content in chat completion response');
        }
        
        const responseText = message.content.trim();
        
        if (responseText.length === 0) {
          throw new Error('Chat completion returned empty response');
        }

        console.log('✅ Successfully generated response using chat completion API');
        return responseText;
        
      } catch (completionError) {
        retryCount++;
        console.error(`Chat completion attempt ${retryCount} failed:`, completionError.message);
        
        // Check for rate limit errors
        if (completionError.message.includes('rate') || completionError.status === 429) {
          if (retryCount < maxRetries) {
            const waitTime = Math.pow(2, retryCount) * 2000; // 4s, 8s, 16s
            console.log(`⏳ Rate limit hit, waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // If it's the last retry, throw the error
        if (retryCount >= maxRetries) {
          throw new Error(`Chat completion failed after ${maxRetries} attempts: ${completionError.message}`);
        }
        
        // For other errors, wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Chat completion failed after all retries');
    
  } catch (error) {
    console.error('❌ Error in generateChatCompletionResponse:', error);
    throw error;
  }
}

// Helper function to truncate text safely
function truncateText(text: string, maxLength: number): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - 3) + '...';
}

// Generate default response when all AI fails
function generateDefaultResponse(emailData: any, clinicName: string, clinicInfo: any): string {
  const senderName = emailData?.headers?.from?.split('<')[0]?.trim() || 'valued patient';
  
 let timingInfo = '';
  if (clinicInfo?.business_hours) {
    const formattedHours = formatBusinessHours(clinicInfo.business_hours);
    if (formattedHours) {
      timingInfo += `\n\nOur clinic hours are: ${formattedHours}`;
    }
  }
  
  if (clinicInfo?.calendly_link) {
    timingInfo += `\nYou can schedule an appointment online at: ${clinicInfo.calendly_link}`;
  }
  
  return `Dear ${senderName},

Thank you for contacting ${clinicName}. We have received your message and will respond as soon as possible during our business hours.${timingInfo}

For urgent medical concerns, please contact us directly${clinicInfo?.phone ? ` at ${clinicInfo.phone}` : ''} or visit our clinic.

We appreciate your patience and look forward to assisting you.

Best regards,
${clinicName} Team`;
}

// FIXED: Save email processing status with better error handling
async function saveEmailProcessingStatus(data: {
  clinic_id?: string;
  message_id: string;
  sender_email: string;
  subject: string;
  reply_sent: boolean;
  ai_response?: string;
  error_message?: string;
}, supabaseClient: any) {
  try {
    console.log('Saving email processing status to database...');
    
    const insertData = {
      clinic_id: data.clinic_id || null,
      message_id: data.message_id,
      sender_email: data.sender_email,
      subject: data.subject,
      processed_at: new Date().toISOString(),
      reply_sent: data.reply_sent,
      ai_response: data.ai_response || null,
      error_message: data.error_message || null
    };

    const { error } = await supabaseClient
      .from('email_processing_status')
      .insert(insertData);

    if (error) {
      console.error('Error saving email processing status:', error);
      console.error('Insert data was:', JSON.stringify(insertData, null, 2));
    } else {
      console.log('✅ Email processing status saved successfully');
    }
  } catch (saveError) {
    console.error('Failed to save email processing status:', saveError);
  }
}

// Send reply email with better error handling
async function sendReply(
  originalEmail: any,
  replyContent: string,
  smtpConfig: any
) {
  try {
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

    const originalSubject = originalEmail.headers.subject || 'Your inquiry';
    const replySubject = originalSubject.startsWith('Re: ') 
      ? originalSubject 
      : `Re: ${originalSubject}`;

    await smtpClient.send({
      from: `${smtpConfig.smtp_sender_name} <${smtpConfig.smtp_sender_email}>`,
      to: originalEmail.headers.from,
      subject: replySubject,
      text: replyContent,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        ${replyContent.replace(/\n/g, '<br>')}
      </div>`
    });

    await smtpClient.close();
    console.log('✅ Reply sent successfully');
    
  } catch (error) {
    console.error('Failed to send reply:', error);
    throw error;
  }
}

// Helper functions (keeping existing ones)
// Improved search results parsing with better logging
function parseSearchResultsForIds(searchResponse: string): number[] {
  console.log('Parsing search results...');
  const lines = searchResponse.split('\n');
  const messageIds: number[] = [];
  
  for (const line of lines) {
    console.log('Processing line:', line.trim());
    
    // Look for lines that contain "* SEARCH" followed by message IDs
    if (line.includes('* SEARCH')) {
      console.log('Found SEARCH response line:', line);
      
      // Extract everything after "* SEARCH"
      const searchMatch = line.match(/\*\s+SEARCH\s+(.*)/);
      if (searchMatch && searchMatch[1]) {
        const idString = searchMatch[1].trim();
        console.log('ID string from search:', idString);
        
        if (idString) {
          // Split by spaces and parse as numbers
          const parts = idString.split(/\s+/);
          for (const part of parts) {
            const trimmed = part.trim();
            if (/^\d+$/.test(trimmed)) {
              const id = parseInt(trimmed);
              messageIds.push(id);
              console.log('Found message ID:', id);
            }
          }
        }
      }
    }
    
    // Also check for lines that might just be numbers (some IMAP servers format differently)
    if (/^\*\s+\d+/.test(line.trim())) {
      const match = line.match(/^\*\s+(\d+)/);
      if (match) {
        const id = parseInt(match[1]);
        messageIds.push(id);
        console.log('Found message ID from number line:', id);
      }
    }
  }
  
  console.log('Final parsed message IDs:', messageIds);
  return messageIds;
}

// Improved email data parsing with better IMAP response handling
function parseEmailData(fetchResponse: string) {
  const headers: { [key: string]: string } = {};
  let body = '';
  
  console.log('Parsing email data from IMAP response...');
  
  try {
    // Split the response into lines
    const lines = fetchResponse.split('\n');
    let currentSection = '';
    let headerSection = '';
    let bodySection = '';
    let inHeaderSection = false;
    let inBodySection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check for BODY[HEADER] section start
      if (trimmed.includes('BODY[HEADER]') || line.includes('BODY[HEADER]')) {
        console.log('Found BODY[HEADER] section');
        inHeaderSection = true;
        inBodySection = false;
        
        // The header data might be on the same line after the BODY[HEADER] marker
        const headerStart = line.indexOf('BODY[HEADER]');
        if (headerStart !== -1) {
          const remainingLine = line.substring(headerStart + 'BODY[HEADER]'.length);
          if (remainingLine.trim()) {
            headerSection += remainingLine + '\n';
          }
        }
        continue;
      }
      
      // Check for BODY[TEXT] section start
      if (trimmed.includes('BODY[TEXT]') || line.includes('BODY[TEXT]')) {
        console.log('Found BODY[TEXT] section');
        inHeaderSection = false;
        inBodySection = true;
        
        // The body data might be on the same line after the BODY[TEXT] marker
        const bodyStart = line.indexOf('BODY[TEXT]');
        if (bodyStart !== -1) {
          const remainingLine = line.substring(bodyStart + 'BODY[TEXT]'.length);
          if (remainingLine.trim()) {
            bodySection += remainingLine + '\n';
          }
        }
        continue;
      }
      
      // Check for end of fetch response
      if (trimmed.startsWith('A004 OK') || trimmed.startsWith(')')) {
        console.log('Found end of fetch response');
        break;
      }
      
      // Collect header data
      if (inHeaderSection) {
        headerSection += line + '\n';
      }
      
      // Collect body data
      if (inBodySection) {
        bodySection += line + '\n';
      }
    }
    
    console.log(`Header section length: ${headerSection.length}`);
    console.log(`Body section length: ${bodySection.length}`);
    
    // Parse headers from header section
    if (headerSection) {
      const headerLines = headerSection.split('\n');
      let currentHeader = '';
      let currentValue = '';
      
      for (const headerLine of headerLines) {
        // Skip empty lines and lines that don't look like headers
        if (!headerLine.trim() || headerLine.trim() === ')') continue;
        
        // Check if this line starts a new header (contains a colon and doesn't start with whitespace)
        if (headerLine.includes(':') && !headerLine.startsWith(' ') && !headerLine.startsWith('\t')) {
          // Save the previous header if we have one
          if (currentHeader && currentValue) {
            headers[currentHeader.toLowerCase().trim()] = currentValue.trim();
          }
          
          // Start new header
          const colonIndex = headerLine.indexOf(':');
          currentHeader = headerLine.substring(0, colonIndex).trim();
          currentValue = headerLine.substring(colonIndex + 1).trim();
        } else if (currentHeader && headerLine.trim()) {
          // This is a continuation of the previous header (folded header)
          currentValue += ' ' + headerLine.trim();
        }
      }
      
      // Don't forget the last header
      if (currentHeader && currentValue) {
        headers[currentHeader.toLowerCase().trim()] = currentValue.trim();
      }
    }
    
    // Clean up body section
    if (bodySection) {
      body = bodySection
        .split('\n')
        .filter(line => line.trim() !== ')' && !line.trim().startsWith('A004'))
        .join('\n')
        .trim();
    }
    
    console.log('Parsed headers:', Object.keys(headers));
    console.log('From header:', headers.from);
    console.log('Subject header:', headers.subject);
    console.log('Body preview:', body.substring(0, 100));
    
    return {
      headers,
      body: body.trim()
    };
    
  } catch (error) {
    console.error('Error parsing email data:', error);
    console.error('Raw response was:', fetchResponse.substring(0, 1000));
    
    // Return empty data on parsing error
    return {
      headers: {},
      body: ''
    };
  }
}

// Keep existing helper functions
function generateDetailedTestEmail(clinicName: string, clinicInfo: any, config: any): string {
  const testTime = new Date().toLocaleString();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Configuration Test - ${clinicName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .email-container {
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .content {
            padding: 30px 20px;
        }
        .success-badge {
            background-color: #d4edda;
            color: #155724;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #28a745;
            font-weight: 500;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            border-top: 1px solid #e9ecef;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>✅ Email Test Successful</h1>
            <p>Your IMAP/SMTP configuration with auto-reply is working perfectly!</p>
        </div>
        <div class="content">
            <div class="success-badge">
                🎉 Congratulations! Your email system for <strong>${clinicName}</strong> is ready for AI-powered patient communications with automatic replies.
            </div>
            <p><strong>SMTP:</strong> ${config.smtp_host}:${config.smtp_port}</p>
            <p><strong>IMAP:</strong> ${config.imap_server}:${config.imap_port}</p>
            <p><strong>Auto-Reply:</strong> Enabled with AI Assistant</p>
        </div>
        <div class="footer">
            <p>Test completed on ${testTime}</p>
            <p>Powered by <strong>${clinicName}</strong> AI Assistant</p>
        </div>
    </div>
</body>
</html>`.trim();
}

function generateTextTestEmail(clinicName: string, config: any): string {
  const testTime = new Date().toLocaleString();
  return `
EMAIL CONFIGURATION TEST - ${clinicName}
${'='.repeat(50)}

✅ CONGRATULATIONS! Your email system with auto-reply is working perfectly!

SMTP: ${config.smtp_host}:${config.smtp_port}
IMAP: ${config.imap_server}:${config.imap_port}
Auto-Reply: Enabled with AI Assistant

Test completed: ${testTime}
Powered by ${clinicName} AI Assistant
`.trim();
}

function generateTroubleshootingGuide(testResults: any) {
  const guide = {
    smtp_issues: [] as any[],
    imap_issues: [] as any[],
    general_tips: [] as string[]
  };

  // SMTP troubleshooting
  if (!testResults.smtp.success) {
    const smtpError = testResults.smtp.error.toLowerCase();
    if (smtpError.includes('authentication') || smtpError.includes('login')) {
      guide.smtp_issues.push({
        issue: 'Authentication Failed',
        solutions: [
          'Verify username and password are correct',
          'For Gmail: Use App Password instead of regular password',
          'For Outlook: Ensure account has SMTP enabled',
          'Check if 2-factor authentication is required'
        ]
      });
    }
    if (smtpError.includes('connection') || smtpError.includes('connect')) {
      guide.smtp_issues.push({
        issue: 'Connection Failed',
        solutions: [
          'Verify SMTP server hostname is correct',
          'Check if port number is correct (465 for SSL, 587 for TLS)',
          'Ensure firewall allows outbound connections',
          'Try alternative ports if available'
        ]
      });
    }
  }

  // IMAP troubleshooting
  if (!testResults.imap.success) {
    const imapError = testResults.imap.error.toLowerCase();
    if (imapError.includes('authentication') || imapError.includes('login')) {
      guide.imap_issues.push({
        issue: 'Authentication Failed',
        solutions: [
          'Verify IMAP username and password',
          'For Gmail: Enable IMAP in settings and use App Password',
          'For Outlook: Ensure IMAP is enabled in account settings',
          'Check if different credentials are needed for IMAP vs SMTP'
        ]
      });
    }
    if (imapError.includes('connection') || imapError.includes('connect')) {
      guide.imap_issues.push({
        issue: 'Connection Failed',
        solutions: [
          'Verify IMAP server hostname (imap.gmail.com for Gmail)',
          'Check IMAP port (993 for SSL, 143 for non-SSL)',
          'Ensure IMAP is enabled in email provider settings',
          'Check firewall settings for port 993'
        ]
      });
    }
  }

  // General tips
  guide.general_tips = [
    'Test with a simple email provider first (Gmail, Outlook)',
    'Ensure ports 993 (IMAP) and 465/587 (SMTP) are open in firewall',
    'For Gmail: Enable IMAP and use App Password if 2FA is enabled',
    'Set up cron job to run email processing every 5 minutes',
    'Monitor logs for email processing errors and AI response failures'
  ];

  return guide;
}

// Diagnostic function to test IMAP connection and email parsing
async function testImapConnection(hostname: string, port: number, username: string, password: string, useSsl: boolean) {
  let conn: Deno.Conn | Deno.TlsConn;
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  
  const diagnostic = {
    connection_test: { success: false, message: '', details: {} },
    search_test: { success: false, message: '', details: {} },
    fetch_test: { success: false, message: '', details: {} }
  };

  try {
    console.log(`Testing IMAP connection to ${hostname}:${port} (SSL: ${useSsl})`);
    
    // Test connection
    if (useSsl) {
      conn = await Deno.connectTls({ hostname, port, caCerts: [] });
    } else {
      conn = await Deno.connect({ hostname, port });
    }
    
    diagnostic.connection_test.success = true;
    diagnostic.connection_test.message = 'Connection established';
    
    // Helper functions for this diagnostic
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
      const timeout = 15000;
      
      while (!complete && (Date.now() - startTime) < timeout) {
        const chunk = await readBuffer(3000);
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

    // Test authentication
    const greeting = await readBuffer(5000);
    console.log('IMAP greeting received');
    
    const loginResponse = await sendCommand('D001', `LOGIN "${username}" "${password}"`);
    if (!loginResponse.includes('D001 OK')) {
      throw new Error('Authentication failed');
    }
    
    const selectResponse = await sendCommand('D002', 'SELECT INBOX');
    if (!selectResponse.includes('D002 OK')) {
      throw new Error('Failed to select INBOX');
    }
    
    // Test search
    console.log('Testing email search...');
    const searchAllResponse = await sendCommand('D003', 'SEARCH ALL');
    const allIds = parseSearchResultsForIds(searchAllResponse);
    
    const searchUnseenResponse = await sendCommand('D004', 'SEARCH UNSEEN');
    const unseenIds = parseSearchResultsForIds(searchUnseenResponse);
    
    diagnostic.search_test.success = true;
    diagnostic.search_test.message = `Found ${allIds.length} total emails, ${unseenIds.length} unread`;
    diagnostic.search_test.details = {
      total_emails: allIds.length,
      unread_emails: unseenIds.length,
      all_ids: allIds.slice(0, 10), // First 10 IDs
      unread_ids: unseenIds,
      raw_search_all: searchAllResponse.substring(0, 200),
      raw_search_unseen: searchUnseenResponse.substring(0, 200)
    };
    
    // Test fetch if we have emails
    if (allIds.length > 0) {
      console.log('Testing email fetch...');
      const testId = allIds[allIds.length - 1]; // Get latest email
      
      const fetchResponse = await sendCommand('D005', `FETCH ${testId} (BODY[HEADER] BODY[TEXT])`);
      const emailData = parseEmailData(fetchResponse);
      
      diagnostic.fetch_test.success = true;
      diagnostic.fetch_test.message = `Successfully fetched and parsed email ${testId}`;
      diagnostic.fetch_test.details = {
        test_email_id: testId,
        parsed_headers: Object.keys(emailData.headers),
        from_header: emailData.headers.from,
        subject_header: emailData.headers.subject,
        body_length: emailData.body?.length || 0,
        raw_fetch_preview: fetchResponse.substring(0, 300)
      };
    } else {
      diagnostic.fetch_test.message = 'No emails available to test fetch';
    }
    
    // Cleanup
    await sendCommand('D006', 'LOGOUT');
    conn.close();
    
    return diagnostic;
    
  } catch (error) {
    console.error('IMAP diagnostic error:', error);
    
    if (conn) {
      try { conn.close(); } catch (_) {}
    }
    
    diagnostic.connection_test.message = error.message;
    return diagnostic;
  }
}