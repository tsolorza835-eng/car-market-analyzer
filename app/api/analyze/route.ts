import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL requerida" },
        { status: 400 }
      );
    }

    // 🔥 AQUÍ DEBE IR TU SCRAPER REAL
    const scrapedData = await fetch("http://localhost:3000/api/scraper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await scrapedData.json();

    if (!data || !data.title) {
      return NextResponse.json(
        {
          success: false,
          error: "Scraper no devolvió datos válidos",
        },
        { status: 500 }
      );
    }

    // 🔥 CÁLCULOS DEFENSIVOS (sin "No disponible" falso)
    const price = Number(data.price) || 0;
    const avgMarket = Number(data.avgMarket) || 0;

    const diff =
      avgMarket > 0 ? ((price - avgMarket) / avgMarket) * 100 : null;

    const profit =
      avgMarket > 0 ? avgMarket - price : null;

    const maxBuy20 = avgMarket ? avgMarket * 0.8 : null;
    const maxBuy30 = avgMarket ? avgMarket * 0.7 : null;

    // 🔥 INSERT EN SUPABASE
    const { error } = await supabase.from("listings").insert([
      {
        title: data.title,
        price: data.price,
        market_avg: avgMarket,
        location: data.location || "Concepción",
        created_at: new Date(),
      },
    ]);

    if (error) {
      console.error("Supabase error:", error);
    }

    return NextResponse.json({
      success: true,
      data: {
        title: data.title,
        price,
        avgMarket,
        diff,
        profit,
        maxBuy20,
        maxBuy30,
      },
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}