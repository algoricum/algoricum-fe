// supabase/functions/manage-assistant-with-files/index.js
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import OpenAI from 'jsr:@openai/openai';

function getCorsHeaders(request) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://algoricum.hashlogics.com',
    'https://app.algoricum.com'
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

async function uploadFilesToOpenAI(files, openai) {
  const uploadedFiles = [];
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file || file.size === 0) continue;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileForOpenAI = new File([arrayBuffer], file.name, {
        type: file.type
      });

      const openaiFile = await openai.files.create({
        file: fileForOpenAI,
        purpose: 'assistants'
      });

      uploadedFiles.push({
        openai_file_id: openaiFile.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type
      });
    } catch (error) {
      console.error(`Failed to upload file ${file.name}:`, error);
      errors.push({ fileName: file.name, error: error.message });
    }
  }

  return { uploadedFiles, errors };
}

async function deleteExistingFiles(assistantId, supabaseClient, openai) {
  try {
    // Get existing files for this assistant
    const { data: existingFiles } = await supabaseClient
      .from('assistant_files')
      .select('openai_file_id')
      .eq('assistant_id', assistantId);

    if (existingFiles && existingFiles.length > 0) {
      // Delete files from OpenAI
      for (const fileRecord of existingFiles) {
        try {
          await openai.files.del(fileRecord.openai_file_id);
        } catch (error) {
          console.error(`Failed to delete OpenAI file ${fileRecord.openai_file_id}:`, error);
        }
      }

      // Delete records from our database
      await supabaseClient
        .from('assistant_files')
        .delete()
        .eq('assistant_id', assistantId);
    }
  } catch (error) {
    console.error('Error deleting existing files:', error);
  }
}

async function createVectorStoreWithFiles(name, fileIds, openai) {
  if (fileIds.length === 0) return null;

  try {
    // Create vector store
    const vectorStore = await openai.vectorStores.create({
      name: `${name} Knowledge Base`
    });

    // Add all files to vector store
    const addFilePromises = fileIds.map(fileId =>
      openai.vectorStores.files.create(vectorStore.id, { file_id: fileId })
    );

    await Promise.all(addFilePromises);
    return vectorStore.id;
  } catch (error) {
    console.error('Error creating vector store:', error);
    throw error;
  }
}

serve(async (req) => {
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

    // Get form data (multipart/form-data with files)
    const formData = await req.formData();
    
    // Extract files - expecting up to 3 files
    const files = [
      formData.get('clinic_document_1'),
      formData.get('clinic_document_2'),
      formData.get('clinic_document_3')
    ].filter(file => file && file.size > 0);

    // Extract other form fields
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
        tools = [{ type: "file_search" }];
      }
    } catch (e) {
      tools = [{ type: "file_search" }];
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
    const { data: clinicData, error: clinicError } = await supabaseClient
      .from('clinic')
      .select('id')
      .eq('id', clinic_id)
      .single();

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

    let assistantResult;
    let openaiAssistantId;

    // If we're updating an assistant
    if (assistant_id) {
      // Get the existing assistant
      const { data: assistantData, error: assistantError } = await supabaseClient
        .from('assistants')
        .select('openai_assistant_id, id')
        .eq('id', assistant_id)
        .eq('clinic_id', clinic_id)
        .single();

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

      // Delete existing files for this assistant (rewrite logic)
      await deleteExistingFiles(assistantData.id, supabaseClient, openai);
    }

    // Upload new files to OpenAI if any are provided
    let uploadedFiles = [];
    let vectorStoreId = null;

    if (files.length > 0) {
      const { uploadedFiles: newFiles, errors } = await uploadFilesToOpenAI(files, openai);
      
      if (errors.length > 0) {
        console.warn('Some files failed to upload:', errors);
      }

      uploadedFiles = newFiles;
      
      if (uploadedFiles.length > 0) {
        const fileIds = uploadedFiles.map(f => f.openai_file_id);
        vectorStoreId = await createVectorStoreWithFiles(name, fileIds, openai);
      }
    }

    // Create or update the OpenAI Assistant
    if (assistant_id) {
      // Update existing assistant
      await openai.beta.assistants.update(openaiAssistantId, {
        name,
        description,
        instructions,
        model,
        tools,
        ...vectorStoreId ? {
          tool_resources: {
            file_search: {
              vector_store_ids: [vectorStoreId]
            }
          }
        } : {}
      });

      // Update our database record
      const { data: updatedAssistant, error: updateError } = await supabaseClient
        .from('assistants')
        .update({
          assistant_name: name,
          assistant_description: description,
          instructions,
          model,
          updated_at: new Date().toISOString()
        })
        .eq('id', assistant_id)
        .select()
        .single();

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
      // Create new assistant
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
              vector_store_ids: [vectorStoreId]
            }
          }
        } : {}
      });

      openaiAssistantId = newAssistant.id;

      // Store the assistant info in our database
      const { data: createdAssistant, error: createError } = await supabaseClient
        .from('assistants')
        .upsert({
          clinic_id,
          openai_assistant_id: openaiAssistantId,
          assistant_name: name,
          assistant_description: description,
          instructions,
          model
        })
        .select()
        .single();

      if (createError) {
        // Clean up the OpenAI assistant if our DB insert fails
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

    // Save file references in the database
    if (uploadedFiles.length > 0) {
      const fileRecords = uploadedFiles.map(file => ({
        assistant_id: assistantResult.id,
        openai_file_id: file.openai_file_id,
        file_name: file.file_name,
        purpose: 'assistants'
      }));

      const { error: fileError } = await supabaseClient
        .from('assistant_files')
        .insert(fileRecords);

      if (fileError) {
        console.error('Failed to save file references in database', fileError);
        // Continue anyway as the assistant was created successfully
      }
    }

    return new Response(JSON.stringify({
      message: assistant_id ? 'Assistant updated successfully' : 'Assistant created successfully',
      assistant: assistantResult,
      filesUploaded: uploadedFiles.length,
      fileDetails: uploadedFiles.map(f => ({
        name: f.file_name,
        openai_file_id: f.openai_file_id
      }))
    }), {
      status: assistant_id ? 200 : 201,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: `Error: ${error.message}`,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }
});