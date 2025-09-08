import { getSupabaseSession } from "@/utils/supabase/auth-helper";


export const handleSubscribe = async (priceId: any,clinicId:any) => {
    if (!clinicId) return;
    const session = await getSupabaseSession();
    // setSubscribingId(priceId);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clinic_id: clinicId, price_id: priceId }),
      });

      if (!res.ok) throw new Error("Failed to create checkout session");
      const { url } = await res.json();
      console.log("Checkout session URL:", url);
      window.location.href = url;
    } catch (err) {
      console.error("Subscribe error:", err);
    } finally {
      // setSubscribingId(null);
    }
  };
