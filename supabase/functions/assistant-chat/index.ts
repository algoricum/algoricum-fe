// supabase/functions/assistant-chat/index.js

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import OpenAI from 'https://esm.sh/openai@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('APP_URL') ?? '',
      Deno.env.get('APP_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Get request data
    const { clinic_id, thread_id = null, message, conversation_id = null } = await req.json()
    
    if (!clinic_id || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the assistant for this clinic
    const { data: assistantData, error: assistantError } = await supabaseClient
      .from('assistants')
      .select('id, openai_assistant_id')
      .eq('clinic_id', clinic_id)
      .single()
    
    if (assistantError || !assistantData) {
      return new Response(JSON.stringify({ error: 'No assistant configured for this clinic' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    })

    let openaiThreadId = thread_id
    
    // If no thread_id, create a new thread
    if (!openaiThreadId) {
      const newThread = await openai.beta.threads.create()
      openaiThreadId = newThread.id
      
      // If conversation_id provided, link the thread to it
      if (conversation_id) {
        const { error: updateError } = await supabaseClient
          .from('conversations')
          .update({ thread_id: openaiThreadId })
          .eq('id', conversation_id)
        
        if (updateError) {
          console.error('Failed to update conversation with thread ID', updateError)
        }
      }
    }

    // Add the user message to the thread
    await openai.beta.threads.messages.create(
      openaiThreadId,
      {
        role: 'user',
        content: message,
      }
    )

    // Run the assistant on the thread
    const run = await openai.beta.threads.runs.create(
      openaiThreadId,
      {
        assistant_id: assistantData.openai_assistant_id,
      }
    )

    // Poll for the run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(
      openaiThreadId,
      run.id
    )

    // Wait for the run to complete (with timeout)
    const startTime = Date.now()
    const timeout = 30000 // 30 seconds
    
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && Date.now() - startTime < timeout) {
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      runStatus = await openai.beta.threads.runs.retrieve(
        openaiThreadId,
        run.id
      )
    }

    if (runStatus.status !== 'completed') {
      return new Response(JSON.stringify({ 
        error: 'Assistant run did not complete in time or failed', 
        status: runStatus.status 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the latest messages
    const messages = await openai.beta.threads.messages.list(
      openaiThreadId
    )

    // Get the latest assistant message
    const assistantMessages = messages.data.filter(msg => msg.role === 'assistant')
    const latestMessage = assistantMessages.length > 0 ? assistantMessages[0] : null

    if (!latestMessage) {
      return new Response(JSON.stringify({ error: 'No assistant response found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Format the message content
    const messageContent = latestMessage.content.map(content => {
      if (content.type === 'text') {
        return content.text.value
      }
      return null
    }).filter(Boolean).join('\n')

    // Store the message in the database if you have a messages table
    // For the MVP, we can skip this step and just return the response

    return new Response(JSON.stringify({ 
      thread_id: openaiThreadId,
      message: messageContent,
      role: 'assistant',
      run_id: run.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})