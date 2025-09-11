import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface ExtractedContact {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdDate: string | null;
}

async function callOpenAI(prompt: string, retries = 2): Promise<ExtractedContact[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
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
            content: "You are a data extraction specialist. Always return valid JSON array only, no additional text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error("OpenAI API error:", error);
      throw new Error("Failed to process data with AI service");
    }

    const openaiData = await openaiResponse.json();
    const extractedText = openaiData.choices[0]?.message?.content?.trim();

    if (!extractedText) {
      throw new Error("No response from AI service");
    }

    try {
      // Clean markdown fences
      let cleaned = extractedText.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned
          .replace(/^```[a-zA-Z]*\n/, "")
          .replace(/```$/, "")
          .trim();
      }

      // Repair incomplete arrays
      if (cleaned.startsWith("[") && !cleaned.endsWith("]")) {
        cleaned = cleaned.replace(/,\s*$/, "");
        cleaned += "]";
      }

      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("Response not an array");

      return parsed.map(
        (c: any): ExtractedContact => ({
          email: c.email || null,
          firstName: c.firstName || null,
          lastName: c.lastName || null,
          phone: c.phone || null,
          createdDate: c.createdDate || null,
        }),
      );
    } catch (err) {
      console.error(`Parse failed on attempt ${attempt + 1}:`, err);
      console.error("Raw response:", extractedText);

      // retry if we still have attempts left
      if (attempt < retries) {
        console.log("Retrying OpenAI call...");
        continue;
      }

      // If retries exhausted, rethrow
      throw err;
    }
  }

  return [];
}

serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const prompt = `
You are a data extraction specialist. I will provide you with JSON data of any structure, and you need to extract contact information from it.
There can be multiple contacts in the data.

Extract the following information and return it as a valid JSON array of objects:
- email: Extract email address (null if not found)
- firstName: Extract first name (null if not found)
- lastName: Extract last name (null if not found)
- phone: Extract primary phone number (null if not found) e.g. (+54122222222/with country code)
- createdDate: Extract the date when the contact was created (null if not found)

Important rules:
1. Only return valid JSON format
2. Always return an array, even if only one contact
3. Use null for missing data, never empty strings
4. Don't make up data - only extract what's actually present
5. Be flexible with field names ("email", "mail", "e-mail", etc.)
6. Same for names ("name", "fullName", "first_name", etc.)
7. Dates may appear as "created", "createdAt", "creationDate", etc.
8. Skip entries that don't have at least an email
9. If multiple emails/phones, pick the first valid one
10. If no country code in phone, send null

Here's the data to extract from:
${JSON.stringify(inputData.data, null, 2)}

Return only the JSON array of extracted contacts.`;

    let extractedContacts: ExtractedContact[] = [];
    try {
      extractedContacts = await callOpenAI(prompt, 2);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Failed to parse extracted data",
          message: err.message,
          fallback: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedContacts,
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
