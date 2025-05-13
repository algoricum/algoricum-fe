// supabase/functions/manage-assistant/index.js

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

    // Get request data
    const { 
      clinic_id, 
      assistant_id = null, 
      name, 
      description, 
      instructions, 
      model,
      tools,
      file_ids
    } = await req.json()

    if (!clinic_id || !name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user has access to the clinic
    const { data: clinicData, error: clinicError } = await supabaseClient
      .from('clinic')
      .select('id')
      .eq('id', clinic_id)
      .single()
    
    if (clinicError || !clinicData) {
      return new Response(JSON.stringify({ error: 'Clinic not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    })

    let openaiAssistantId = null
    let existingAssistant = null
// Format file_ids as an array if it's not
const fileIdsArray = file_ids
let vectorStoreId = null

// Create a vector store for files if needed
if (fileIdsArray.length > 0) {
  try {
    // Create a vector store with a name related to the clinic
    // console.log(openai.vectorStores)
    const vectorStore = await openai.vectorStores.create({
      name: `${name} Knowledge Base`
    })
    
    vectorStoreId = vectorStore.id
    
    // Add files to the vector store
    await openai.vectorStores.files.create(vectorStoreId, {
      file_id: fileIdsArray,
    });
    // You may want to implement polling here to ensure all files are processed
    // For simplicity, we're continuing without polling
  } catch (vectorError) {
    return new Response(JSON.stringify({ error: `Failed to create vector store: ${vectorError.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

    // If we're updating an assistant
    if (assistant_id) {
      // Get the existing assistant
      const { data: assistantData, error: assistantError } = await supabaseClient
        .from('assistants')
        .select('openai_assistant_id')
        .eq('id', assistant_id)
        .eq('clinic_id', clinic_id)
        .single()
      
      if (assistantError || !assistantData) {
        return new Response(JSON.stringify({ error: 'Assistant not found or access denied' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      openaiAssistantId = assistantData.openai_assistant_id
      
      // Update the OpenAI Assistant

      existingAssistant = await openai.beta.assistants.update(
        openaiAssistantId,
        {
          name,
          description,
          instructions,
          model,
          tools,
          tool_resources : {
            file_search: {
              vector_store_ids: [vectorStoreId]
            }
          }
        }
      )
      // Update our database record
      const { data: updatedAssistant, error: updateError } = await supabaseClient
        .from('assistants')
        .update({
          assistant_name: name,
          assistant_description: description,
          instructions,
          model,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assistant_id)
        .select()
        .single()
      
      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to update assistant' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ 
        message: 'Assistant updated successfully',
        assistant: updatedAssistant
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } 
    // Creating a new assistant
    else {
      // Create the OpenAI Assistant
      const newAssistant = await openai.beta.assistants.create({
        name,
        description,
        instructions: instructions || `You are an AI assistant for a healthcare clinic called ${name}. 
        Be professional, friendly, and helpful. Assist patients with their inquiries, 
        help them understand treatments, and guide them to book appointments.`,
        model,
        tools,
        tool_resources : {
          file_search: {
            vector_store_ids: [vectorStoreId]
          }
        }
      })
      // Store the assistant info in our database
      const { data: createdAssistant, error: createError } = await supabaseClient
        .from('assistants')
        .insert({
          clinic_id,
          openai_assistant_id: newAssistant.id,
          assistant_name: name,
          assistant_description: description,
          instructions,
          model,
        })
        .select()
        .single()
      
      if (createError) {
        // Need to clean up the OpenAI assistant if our DB insert fails
        try {
          await openai.beta.assistants.del(newAssistant.id)
        } catch (deleteError) {
          console.error('Failed to delete OpenAI assistant after database failure', deleteError)
        }
        
        return new Response(JSON.stringify({ error: 'Failed to create assistant', details: createError }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ 
        message: 'Assistant created successfully',
        assistant: createdAssistant
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: `hey ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})