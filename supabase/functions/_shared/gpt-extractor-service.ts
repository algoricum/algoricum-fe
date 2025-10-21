// supabase/functions/_shared/gpt-extractor-service.ts

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

async function callOpenAI(prompt: string, retries = 2): Promise<any[]> {
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
          {
            role: "user",
            content: prompt,
          },
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

      return parsed.map(c => ({
        email: c.email || null,
        firstName: c.firstName || null,
        lastName: c.lastName || null,
        phone: c.phone || null,
        createdDate: c.createdDate || null,
      }));
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

export async function extractAndCleanContacts(inputData: any, requestId?: string): Promise<any[]> {
  if (!OPENAI_API_KEY) {
    console.warn(`[${requestId}] OpenAI API key not configured, skipping data cleaning`);
    return inputData;
  }

  if (!inputData) {
    throw new Error("No data provided");
  }

  const prompt = `
You are a data extraction specialist. I will provide you with JSON data of any structure, and you need to extract contact information from it.
There can be multiple contacts in the data.

Extract the following information and return it as a valid JSON array of objects:
- email: Extract email address (skip if no or duplicate email)
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
11. skip if duplicate email

Here's the data to extract from:
${JSON.stringify(inputData, null, 2)}

Return only the JSON array of extracted contacts.`;

  try {
    console.log(`[${requestId}] Starting GPT extraction for data cleaning`);
    let extractedContacts = await callOpenAI(prompt, 2);

    // Deduplicate by email
    const seen = new Set<string>();
    extractedContacts = extractedContacts.filter(contact => {
      if (!contact.email || seen.has(contact.email)) return false;
      seen.add(contact.email);
      return true;
    });

    console.log(`[${requestId}] GPT extraction completed: ${extractedContacts.length} clean contacts`);
    return extractedContacts;
  } catch (err) {
    console.error(`[${requestId}] GPT extraction failed:`, err.message);
    // Return original data if extraction fails
    return inputData;
  }
}

export async function cleanHubSpotContacts(contacts: any[], requestId?: string): Promise<any[]> {
  try {
    console.log(`[${requestId}] Cleaning ${contacts.length} HubSpot contacts with GPT`);

    // Extract clean data using GPT
    const cleanedContacts = await extractAndCleanContacts(contacts, requestId);

    console.log(`[${requestId}] Cleaned ${cleanedContacts.length} contacts from ${contacts.length} raw contacts`);
    return cleanedContacts;
  } catch (error) {
    console.error(`[${requestId}] Error cleaning HubSpot contacts:`, error);
    // Return original contacts if cleaning fails
    return contacts;
  }
}
