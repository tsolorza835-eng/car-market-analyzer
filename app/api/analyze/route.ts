import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeMarketplace } from "@/lib/scraper";

// ✅ SUPABASE (SOLO VARIABLES SEGURAS DE BACKEND)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    // 🚀 SCRAPER LOCAL (SIN FETCH INTERNO)
    const data = await scrapeMarketplace(url);

    if (!data || !data.title) {
      return NextResponse.json(
        { success: false, error: "No se pudieron obtener datos del scraper" },
        { status: 500 }
      );
    }

    // 📊 CÁLCULOS SEGUROS
    const price = Number(data.price) || 0;
    const avgMarket = Number(data.avgMarket) || 0;

    const diff =
      avgMarket > 0 ? ((price - avgMarket) / avgMarket) * 100 : null;

    const profit =
      avgMarket > 0 ? avgMarket - price : null;

    const maxBuy20 = avgMarket ? Math.round(avgMarket * 0.8) : null;
    const maxBuy30 = avgMarket ? Math.round(avgMarket * 0.7) : null;

    // 💾 GUARDAR EN SUPABASE
    const { error } = await supabase.from("listings").insert({
      title: data.title,
      price,
      market_avg: avgMarket,
      location: data.location || "Concepción",
      created_at: new Date(),
    });

    if (error) {
      console.error("Supabase insert error:", error);
    }

    // 📤 RESPUESTA FRONTEND
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

  } catch (error) {
    console.error("Analyze error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}