// supabase/functions/upload-assistant-file/index.js

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import OpenAI from 'jsr:@openai/openai';

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
    const supabaseUrl = Deno.env.get('APP_URL') ?? ''
    const supabaseKey = Deno.env.get('APP_SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify the token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseClient.auth.getUser(token)
    
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get form data (file upload)
    const formData = await req.formData()
    const file = formData.get('file')
    const assistantId = formData.get('assistant_id')
    
    if (!file || !assistantId) {
      return new Response(JSON.stringify({ error: 'Missing file or assistant_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the assistant to verify access
    const { data: assistantData, error: assistantError } = await supabaseClient
      .from('assistants')
      .select('id, openai_assistant_id, clinic_id')
      .eq('id', assistantId)
      .single()
    
    if (assistantError || !assistantData) {
      return new Response(JSON.stringify({ error: 'Assistant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check user access to the clinic
    // Additional permission checks would go here

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    })

    // Convert file to a format OpenAI can use
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    
    // Upload file to OpenAI
    const openaiFile = await openai.files.create({
      file: new Blob([buffer], { type: file.type }),
      purpose: 'assistants',
    })

    // Attach the file to the assistant
    await openai.beta.assistants.create(
      assistantData.openai_assistant_id,
      {
        file_id: openaiFile.id,
      }
    )

    // Save file reference in our database
    const { data: createdFile, error: createError } = await supabaseClient
      .from('assistant_files')
      .insert({
        assistant_id: assistantId,
        openai_file_id: openaiFile.id,
        file_name: file.name,
        purpose: 'assistants',
      })
      .select()
      .single()
    
    if (createError) {
      return new Response(JSON.stringify({ error: 'Failed to save file reference' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ 
      message: 'File uploaded and attached to assistant successfully',
      file: createdFile
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