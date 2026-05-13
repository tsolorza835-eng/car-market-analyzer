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

    // 🔥 SCRAPER (robusto)
    const scrapedData = await fetch(
      new URL("/api/scraper", request.url),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }
    );

    // 🔥 NO ROMPER SI NO ES JSON
    const raw = await scrapedData.text();

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.error("❌ Scraper no devolvió JSON:", raw);

      return NextResponse.json(
        {
          success: false,
          error: "Scraper devolvió respuesta inválida",
        },
        { status: 500 }
      );
    }

    if (!data?.title && !data?.price) {
      return NextResponse.json(
        {
          success: false,
          error: "Scraper no devolvió datos completos",
        },
        { status: 500 }
      );
    }

    // 🔥 CÁLCULOS SEGUROS
    const price = Number(data.price) || 0;
    const avgMarket = Number(data.avgMarket) || 0;

    const diff =
      avgMarket > 0 ? ((price - avgMarket) / avgMarket) * 100 : null;

    const profit =
      avgMarket > 0 ? avgMarket - price : null;

    const maxBuy20 = avgMarket ? Math.round(avgMarket * 0.8) : null;
    const maxBuy30 = avgMarket ? Math.round(avgMarket * 0.7) : null;

    // 🔥 INSERT SUPABASE (seguro)
    const { error } = await supabase.from("listings").insert([
      {
        title: data.title || "Sin título",
        price: data.price || 0,
        market_avg: avgMarket,
        location: data.location || "Concepción",
        created_at: new Date(),
      },
    ]);

    if (error) {
      console.error("Supabase error:", error);
    }

    // 🔥 RESPUESTA FINAL
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
    console.error("❌ ERROR GENERAL:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}