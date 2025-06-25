// supabase/functions/assistant-chat/index.js - Updated with enhanced logging
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import OpenAI from 'jsr:@openai/openai';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Function to parse lead assessment from AI response
const parseLeadAssessment = (message)=>{
  
  const assessmentRegex = /\[LEAD_ASSESSMENT\]([\s\S]*?)\[\/LEAD_ASSESSMENT\]/i;
  const match = message.match(assessmentRegex);
  if (!match) {
    console.warn('❌ No LEAD_ASSESSMENT block found in AI response');
    console.warn('🔍 AI Response was:', message);
    return {
      status: null,
      interest_level: null,
      urgency: null,
      cleanMessage: message,
      hasValidAssessment: false
    };
  }
  console.log('✅ LEAD_ASSESSMENT block found!');
  const assessmentBlock = match[1];
  const cleanMessage = message.replace(match[0], '').trim();
  console.log('📊 Assessment block content:', assessmentBlock);
  // Extract individual values with more strict validation
  const statusMatch = assessmentBlock.match(/STATUS:\s*(\w+)/i);
  const interestMatch = assessmentBlock.match(/INTEREST:\s*(\w+)/i);
  const urgencyMatch = assessmentBlock.match(/URGENCY:\s*([\w-]+)/i);
  const status = statusMatch ? statusMatch[1].toLowerCase() : null;
  const interest_level = interestMatch ? interestMatch[1].toLowerCase() : null;
  const urgency = urgencyMatch ? urgencyMatch[1].toLowerCase().replace('-', '_') : null;
  console.log('🔧 Extracted values:', {
    status,
    interest_level,
    urgency
  });
  // Validate all required fields are present
  const hasValidAssessment = status && interest_level && urgency;
  if (!hasValidAssessment) {
    console.warn('⚠️ Incomplete LEAD_ASSESSMENT found:', {
      status: !!status,
      interest_level: !!interest_level,
      urgency: !!urgency,
      assessmentBlock
    });
  }
  // Validate values are from allowed lists
  const validStatuses = [
    'new',
    'responded',
    'needs-follow-up',
    'in-nurture',
    'cold',
    'reactivated',
    'booked',
    'confirmed',
    'no-show',
    'converted',
    'not-interested',
    'archived'
  ];
  const validInterestLevels = [
    'high',
    'medium',
    'low'
  ];
  const validUrgencies = [
    'asap',
    'this_month',
    'curious'
  ];
  const isValidStatus = status && validStatuses.includes(status);
  const isValidInterest = interest_level && validInterestLevels.includes(interest_level);
  const isValidUrgency = urgency && validUrgencies.includes(urgency);
  if (!isValidStatus) console.warn('❌ Invalid status:', status, '| Valid options:', validStatuses);
  if (!isValidInterest) console.warn('❌ Invalid interest_level:', interest_level, '| Valid options:', validInterestLevels);
  if (!isValidUrgency) console.warn('❌ Invalid urgency:', urgency, '| Valid options:', validUrgencies);
  const finalValidation = hasValidAssessment && isValidStatus && isValidInterest && isValidUrgency;
  console.log(finalValidation ? '✅ Assessment validation PASSED' : '❌ Assessment validation FAILED');
  return {
    status: isValidStatus ? status : null,
    interest_level: isValidInterest ? interest_level : null,
    urgency: isValidUrgency ? urgency : null,
    cleanMessage: cleanMessage,
    hasValidAssessment: finalValidation
  };
};
// Function to update lead status asynchronously (non-blocking)
const updateLeadStatusAsync = async (supabaseClient, leadId, assessmentData)=>{
  try {
    const { status, interest_level, urgency, hasValidAssessment } = assessmentData;
    if (!leadId) {
      console.warn('No leadId provided for status update');
      return;
    }
    // If we don't have a complete assessment, log it but still update what we have
    if (!hasValidAssessment) {
      console.warn('Incomplete assessment data for lead:', leadId, assessmentData);
    }
    const updateData = {
      updated_at: new Date().toISOString()
    };
    // Only update fields that were provided and are valid
    if (status) updateData.status = status;
    if (interest_level) updateData.interest_level = interest_level;
    if (urgency) updateData.urgency = urgency;
    // If we have at least one valid field, proceed with update
    if (Object.keys(updateData).length > 1) {
      const { error } = await supabaseClient.from('lead').update(updateData).eq('id', leadId);
      if (error) {
        console.error('Error updating lead status:', error);
      } else {
        console.log(`✅ Lead status updated - Status: ${status || 'unchanged'}, Interest: ${interest_level || 'unchanged'}, Urgency: ${urgency || 'unchanged'}`);
        // If assessment was incomplete, we should log this for monitoring
        if (!hasValidAssessment) {
          console.log('⚠️ AI provided incomplete assessment - may need prompt adjustment');
        }
      }
    } else {
      console.warn('No valid assessment data to update for lead:', leadId);
    }
  } catch (error) {
    console.error('Error in updateLeadStatusAsync:', error);
  }
};
serve(async (req)=>{
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Get request data - now expects thread_id which is the internal thread ID
    const { clinic_id, thread_id, openai_thread_id = null, message } = await req.json();
    console.log('📥 Incoming user message:', message);
    if (!clinic_id || !thread_id || !message) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: clinic_id, thread_id, and message are required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get the assistant for this clinic
    const { data: assistantData, error: assistantError } = await supabaseClient.from('assistants').select('id, openai_assistant_id').eq('clinic_id', clinic_id).single();
    if (assistantError || !assistantData) {
      return new Response(JSON.stringify({
        error: 'No assistant configured for this clinic'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get lead information from the thread
    const { data: threadData, error: threadError } = await supabaseClient.from('threads').select('lead_id, lead:lead_id(first_name, last_name, email, phone, status, interest_level, urgency)').eq('id', thread_id).single();
    if (threadError || !threadData) {
      return new Response(JSON.stringify({
        error: 'Thread not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')
    });
    let currentOpenaiThreadId = openai_thread_id;
    // If no OpenAI thread_id, create a new thread
    if (!currentOpenaiThreadId) {
      const newThread = await openai.beta.threads.create();
      currentOpenaiThreadId = newThread.id;
    }
    // Add the user message to the thread
    await openai.beta.threads.messages.create(currentOpenaiThreadId, {
      role: 'user',
      content: message
    });
    // Run the assistant on the thread
    const run = await openai.beta.threads.runs.create(currentOpenaiThreadId, {
      assistant_id: assistantData.openai_assistant_id
    });
    // Poll for the run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(currentOpenaiThreadId, run.id);
    // Wait for the run to complete (with timeout)
    const startTime = Date.now();
    const timeout = 30000; // 30 seconds
    while(runStatus.status !== 'completed' && runStatus.status !== 'failed' && Date.now() - startTime < timeout){
      // Wait before polling again
      await new Promise((resolve)=>setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(currentOpenaiThreadId, run.id);
    }
    if (runStatus.status !== 'completed') {
      return new Response(JSON.stringify({
        error: 'Assistant run did not complete in time or failed',
        status: runStatus.status
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get the latest messages
    const messages = await openai.beta.threads.messages.list(currentOpenaiThreadId);
    // Get the latest assistant message
    const assistantMessages = messages.data.filter((msg)=>msg.role === 'assistant');
    const latestMessage = assistantMessages.length > 0 ? assistantMessages[0] : null;
    if (!latestMessage) {
      return new Response(JSON.stringify({
        error: 'No assistant response found'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Format the message content
    let messageContent = latestMessage.content.map((content)=>{
      if (content.type === 'text') {
        return content.text.value;
      }
      return null;
    }).filter(Boolean).join('\n');
    // 🔍 LOG THE RAW ASSISTANT RESPONSE HERE
    console.log('🤖 RAW ASSISTANT RESPONSE:', messageContent);
    console.log('📏 Response length:', messageContent.length);
    console.log('🔤 Response preview (first 200 chars):', messageContent.substring(0, 200));
    // Check if it contains the old format
    if (messageContent.includes('[STATUS_UPDATE:')) {
      console.warn('🚨 DETECTED OLD FORMAT: [STATUS_UPDATE:] found in response!');
    }
    // Check if it contains the new format
    if (messageContent.includes('[LEAD_ASSESSMENT]')) {
      console.log('✅ NEW FORMAT DETECTED: [LEAD_ASSESSMENT] found in response!');
    } else {
      console.warn('❌ NEW FORMAT NOT FOUND: No [LEAD_ASSESSMENT] block detected!');
    }
    // Parse lead assessment from the AI response
    const assessmentData = parseLeadAssessment(messageContent);
    // Use the clean message (without assessment block) for the response
    const cleanMessage = assessmentData.cleanMessage;
    // Update lead status asynchronously (non-blocking)
    // This happens after we send the response, so it doesn't delay the message
    setTimeout(()=>{
      updateLeadStatusAsync(supabaseClient, threadData.lead_id, assessmentData);
    }, 0);
    return new Response(JSON.stringify({
      openai_thread_id: currentOpenaiThreadId,
      message: cleanMessage,
      role: 'assistant',
      run_id: run.id,
      // Include assessment data for frontend if needed
      lead_assessment: {
        status: assessmentData.status,
        interest_level: assessmentData.interest_level,
        urgency: assessmentData.urgency
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
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
