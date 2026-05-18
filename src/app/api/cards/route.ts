import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cards = data.map((row) => ({
    id: row.id,
    cardType: row.card_type,
    cardNumber: row.card_number,
    pin: row.pin,
    balance: row.balance !== null ? Number(row.balance) : null,
    initialAmount: row.initial_amount !== null ? Number(row.initial_amount) : null,
    label: row.label,
    source: row.source,
    expiryDate: row.expiry_date,
    status: row.status,
    lastChecked: row.last_checked,
    notes: row.notes,
    createdAt: row.created_at,
  }));

  return NextResponse.json(cards);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { data: existing } = await supabase
    .from("cards")
    .select("id")
    .eq("card_number", body.cardNumber.replace(/\s+/g, ""))
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Card number already exists" },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("cards")
    .insert({
      card_type: body.cardType || "flipkart",
      card_number: body.cardNumber.trim(),
      pin: body.pin?.trim() || "",
      balance: body.balance,
      initial_amount: body.initialAmount,
      label: body.label || "",
      source: body.source || "",
      expiry_date: body.expiryDate || null,
      status: body.status || "unknown",
      last_checked: body.lastChecked || null,
      notes: body.notes || "",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    cardType: data.card_type,
    cardNumber: data.card_number,
    pin: data.pin,
    balance: data.balance !== null ? Number(data.balance) : null,
    initialAmount: data.initial_amount !== null ? Number(data.initial_amount) : null,
    label: data.label,
    source: data.source,
    expiryDate: data.expiry_date,
    status: data.status,
    lastChecked: data.last_checked,
    notes: data.notes,
    createdAt: data.created_at,
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const dbUpdates: Record<string, unknown> = {};
  if (updates.cardType !== undefined) dbUpdates.card_type = updates.cardType;
  if (updates.cardNumber !== undefined) dbUpdates.card_number = updates.cardNumber;
  if (updates.pin !== undefined) dbUpdates.pin = updates.pin;
  if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
  if (updates.initialAmount !== undefined) dbUpdates.initial_amount = updates.initialAmount;
  if (updates.label !== undefined) dbUpdates.label = updates.label;
  if (updates.source !== undefined) dbUpdates.source = updates.source;
  if (updates.expiryDate !== undefined) dbUpdates.expiry_date = updates.expiryDate;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.lastChecked !== undefined) dbUpdates.last_checked = updates.lastChecked;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

  const { error } = await supabase
    .from("cards")
    .update(dbUpdates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [body.id];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }

  const { error } = await supabase
    .from("cards")
    .delete()
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: ids.length });
}
