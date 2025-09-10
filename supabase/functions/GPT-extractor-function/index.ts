import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface ExtractedContact {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  countryCode: string | null;
  mobile: string | null;
  fullName: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
  hasCountryCode: boolean;
  hasMobile: boolean;
}

serve(async req => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse the incoming JSON data
    const inputData = await req.json();

    if (!inputData) {
      return new Response(JSON.stringify({ error: "No data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the prompt for GPT
    const prompt = `
You are a data extraction specialist. I will provide you with JSON data of any structure, and you need to extract contact information from it.

Extract the following information and return it as a valid JSON object:
- email: Extract email address (return null if not found)
- firstName: Extract first name (return null if not found)
- lastName: Extract last name (return null if not found)  
- phone: Extract primary phone number (return null if not found)
- countryCode: Extract country code from phone number (return null if not found)
- mobile: Extract mobile/cell phone number if different from phone (return null if not found)
- fullName: Extract full name if available as single field (return null if not found)

Also include these boolean flags:
- hasEmail: true if email was found, false otherwise
- hasPhone: true if any phone number was found, false otherwise
- hasCountryCode: true if country code was found, false otherwise
- hasMobile: true if mobile number was found, false otherwise

Important rules:
1. Only return valid JSON format
2. Use null for missing data, never use empty strings
3. Don't make up data - only extract what's actually present
4. For phone numbers, try to identify country codes (like +1, +44, etc.)
5. Be flexible with field names - data might use "email", "mail", "e-mail", etc.
6. Same for names - could be "name", "fullName", "first_name", "fname", etc.
7. For mobile vs phone, prioritize mobile numbers if both exist

Here's the data to extract from:
${JSON.stringify(inputData, null, 2)}

Return only the JSON object with the extracted data.`;

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a data extraction specialist. Always return valid JSON format only, no additional text or explanation.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error("OpenAI API error:", error);
      return new Response(JSON.stringify({ error: "Failed to process data with AI service" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiResponse.json();
    const extractedText = openaiData.choices[0]?.message?.content?.trim();

    if (!extractedText) {
      return new Response(JSON.stringify({ error: "No response from AI service" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the extracted JSON
    let extractedContact: ExtractedContact;
    try {
      extractedContact = JSON.parse(extractedText);
    } catch (parseError) {
      console.error("Failed to parse extracted JSON:", parseError);
      console.error("Raw response:", extractedText);

      // Return a fallback response
      return new Response(
        JSON.stringify({
          error: "Failed to parse extracted data",
          rawResponse: extractedText,
          fallback: {
            email: null,
            firstName: null,
            lastName: null,
            phone: null,
            countryCode: null,
            mobile: null,
            fullName: null,
            hasEmail: false,
            hasPhone: false,
            hasCountryCode: false,
            hasMobile: false,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate and clean the response
    const cleanedResponse: ExtractedContact = {
      email: extractedContact.email || null,
      firstName: extractedContact.firstName || null,
      lastName: extractedContact.lastName || null,
      phone: extractedContact.phone || null,
      countryCode: extractedContact.countryCode || null,
      mobile: extractedContact.mobile || null,
      fullName: extractedContact.fullName || null,
      hasEmail: !!extractedContact.email,
      hasPhone: !!(extractedContact.phone || extractedContact.mobile),
      hasCountryCode: !!extractedContact.countryCode,
      hasMobile: !!extractedContact.mobile,
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: cleanedResponse,
        originalData: inputData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
