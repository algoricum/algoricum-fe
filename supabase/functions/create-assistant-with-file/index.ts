// supabase/functions/manage-assistant-with-files/index.js
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import OpenAI from 'jsr:@openai/openai';
function getCorsHeaders(request) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://algoricum.hashlogics.com'
  ];
  const isAllowed = allowedOrigins.includes(origin ?? '');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, referer, user-agent',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': isAllowed ? 'true' : 'false',
    'Vary': 'Origin'
  };
}
serve(async (req)=>{
  const headers = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'No authorization header'
      }), {
        status: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }
    // Verify the token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get form data (multipart/form-data with file)
    const formData = await req.formData();
    // Extract file and other form fields
    const file = formData.get('clinic_document');
    const clinic_id = formData.get('clinic_id');
    const assistant_id = formData.get('assistant_id') || null;
    const name = formData.get('name');
    const description = formData.get('description') || '';
    const instructions = formData.get('instructions') || '';
    const model = formData.get('model') || 'gpt-3.5-turbo';
    // Parse tools if provided, otherwise use default
    let tools = [];
    try {
      const toolsStr = formData.get('tools');
      if (toolsStr) {
        tools = JSON.parse(toolsStr);
      } else {
        // Default tools
        tools = [
          {
            type: "file_search"
          }
        ];
      }
    } catch (e) {
      // Default to retrieval if parsing fails
      tools = [
        {
          type: "file_search"
        }
      ];
    }
    if (!clinic_id || !name) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: clinic_id and name'
      }), {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }
    // Check if user has access to the clinic
    const { data: clinicData, error: clinicError } = await supabaseClient.from('clinic').select('id').eq('id', clinic_id).single();
    if (clinicError || !clinicData) {
      return new Response(JSON.stringify({
        error: 'Clinic not found or access denied'
      }), {
        status: 404,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')
    });
    // First handle the file upload if a file is provided
    let openaiFileId = null;
    if (file && file.size > 0) {
      try {
        // Convert file to arrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        // Create a proper File object for OpenAI
        const fileForOpenAI = new File([
          arrayBuffer
        ], file.name, {
          type: file.type
        });
        // Upload file to OpenAI
        const openaiFile = await openai.files.create({
          file: fileForOpenAI,
          purpose: 'assistants'
        });
        openaiFileId = openaiFile.id;
      } catch (fileError) {
        console.error("File upload error:", fileError);
        return new Response(JSON.stringify({
          error: `Failed to upload file to OpenAI: ${fileError.message}`,
          details: fileError
        }), {
          status: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    // Initialize file IDs array with the newly uploaded file if exists
    const fileIdsArray = openaiFileId ? [
      openaiFileId
    ] : [];
    let vectorStoreId = null;
    // Create a vector store for files if needed
    if (openaiFileId) {
      try {
        // Create a vector store with a name related to the clinic
        const vectorStore = await openai.vectorStores.create({
          name: `${name} Knowledge Base`
        });
        vectorStoreId = vectorStore.id;
        // Add files to the vector store
        await openai.vectorStores.files.create(vectorStoreId, {
          file_id: openaiFileId
        });
      } catch (vectorError) {
        return new Response(JSON.stringify({
          error: `Failed to create vector store: ${vectorError.message}`
        }), {
          status: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    let assistantResult;
    let openaiAssistantId;
    // If we're updating an assistant
    if (assistant_id) {
      // Get the existing assistant
      const { data: assistantData, error: assistantError } = await supabaseClient.from('assistants').select('openai_assistant_id').eq('id', assistant_id).eq('clinic_id', clinic_id).single();
      if (assistantError || !assistantData) {
        return new Response(JSON.stringify({
          error: 'Assistant not found or access denied'
        }), {
          status: 404,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        });
      }
      openaiAssistantId = assistantData.openai_assistant_id;
      // Update the OpenAI Assistant
      await openai.beta.assistants.update(openaiAssistantId, {
        name,
        description,
        instructions,
        model,
        tools,
        ...vectorStoreId ? {
          tool_resources: {
            file_search: {
              vector_store_ids: [
                vectorStoreId
              ]
            }
          }
        } : {}
      });
      // Update our database record
      const { data: updatedAssistant, error: updateError } = await supabaseClient.from('assistants').update({
        assistant_name: name,
        assistant_description: description,
        instructions,
        model,
        updated_at: new Date().toISOString()
      }).eq('id', assistant_id).select().single();
      if (updateError) {
        return new Response(JSON.stringify({
          error: 'Failed to update assistant'
        }), {
          status: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        });
      }
      assistantResult = updatedAssistant;
    } else {
      // Create the OpenAI Assistant
      const newAssistant = await openai.beta.assistants.create({
        name,
        description,
        instructions: instructions || `You are an AI assistant for a healthcare clinic called ${name}. 
        Be professional, friendly, and helpful. Assist patients with their inquiries, 
        help them understand treatments, and guide them to book appointments.`,
        model,
        tools,
        ...vectorStoreId ? {
          tool_resources: {
            file_search: {
              vector_store_ids: [
                vectorStoreId
              ]
            }
          }
        } : {}
      });
      openaiAssistantId = newAssistant.id;
      // Store the assistant info in our database
      const { data: createdAssistant, error: createError } = await supabaseClient
        .from('assistants')
        .upsert(
          {
            clinic_id,
            openai_assistant_id: openaiAssistantId,
            assistant_name: name,
            assistant_description: description,
            instructions,
            model
          },
        )
        .select()
        .single();

      if (createError) {
        // Need to clean up the OpenAI assistant if our DB insert fails
        try {
          await openai.beta.assistants.del(openaiAssistantId);
        } catch (deleteError) {
          console.error('Failed to delete OpenAI assistant after database failure', deleteError);
        }
        return new Response(JSON.stringify({
          error: 'Failed to create assistant',
          details: createError
        }), {
          status: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        });
      }
      assistantResult = createdAssistant;
    }
    // If we have a file, save its reference in the database
    if (openaiFileId) {
      const { error: fileError } = await supabaseClient
        .from('assistant_files')
        .upsert(
          {
            assistant_id: assistantResult.id,
            openai_file_id: openaiFileId,
            file_name: file.name,
            purpose: 'assistants'
          },
        );

      if (fileError) {
        console.error('Failed to save file reference in database', fileError);
        // Continue anyway as the assistant was created successfully
      }
    }

    return new Response(JSON.stringify({
      message: assistant_id ? 'Assistant updated successfully' : 'Assistant created successfully',
      assistant: assistantResult
    }), {
      status: assistant_id ? 200 : 201,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: `Error: ${error.message}`
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }
});
