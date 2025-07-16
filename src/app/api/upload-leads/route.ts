// src/app/api/upload-leads/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/config/client';

export async function POST(req: NextRequest) {
    const supabase = createClient();
  try {
    const { leads, clinic_id } = await req.json();

    // 1. Get source_id for 'File'
    const { data: source, error: sourceError } = await supabase
      .from('lead_source')
      .select('id')
      .eq('name', 'File')
      .single();

    if (sourceError) {
      return NextResponse.json({ error: sourceError.message }, { status: 500 });
    }

    const source_id = source.id;

    // 2. Prepare leads with required fields
    const leadsToInsert = leads.map((lead: any) => ({
      ...lead,
      source_id,
      clinic_id,
    }));

    // 3. Insert leads
    const { error: insertError } = await supabase
      .from('lead')
      .insert(leadsToInsert);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}