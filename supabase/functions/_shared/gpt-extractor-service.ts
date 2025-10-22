// supabase/functions/_shared/gpt-extractor-service.ts

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

export async function extractAndCleanContacts(inputData: any, requestId?: string): Promise<any[]> {
  if (!inputData || inputData.length === 0) {
    console.log(`[${requestId}] No data to extract`);
    return [];
  }

  try {
    console.log(`[${requestId}] Calling GPT-extractor-function for ${Array.isArray(inputData) ? inputData.length : 1} records`);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/GPT-extractor-function`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        data: inputData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] GPT extractor failed:`, errorText);
      throw new Error(`GPT extractor failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      console.log(`[${requestId}] GPT extraction successful: ${result.data.length} contacts extracted`);
      return result.data;
    } else {
      console.error(`[${requestId}] GPT extractor returned error:`, result);
      return [];
    }
  } catch (error) {
    console.error(`[${requestId}] Error calling GPT extractor:`, error);
    // Return empty array instead of original data to avoid processing malformed data
    return [];
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
