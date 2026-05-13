import OpenAI from "openai";
import { NextResponse } from "next/server";
import { scrapeMarketplaceData } from "../../../scraper";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: "No se proporcionó un enlace.",
        },
        { status: 400 }
      );
    }

    const carData = await scrapeMarketplaceData(url);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres un experto en compra y venta de autos usados en Chile.",
        },
        {
          role: "user",
          content: `
Analiza este vehículo y determina si su precio está bajo, justo o sobre el mercado chileno.

Datos del vehículo:
${JSON.stringify(carData, null, 2)}

Entrega:
- Precio estimado de mercado
- Evaluación del precio
- Ventajas
- Riesgos
- Recomendación final
          `,
        },
      ],
      temperature: 0.3,
    });

    const analysis =
      completion.choices[0]?.message?.content ||
      "No se pudo generar el análisis.";

    return NextResponse.json({
      success: true,
      data: carData,
      analysis,
    });
  } catch (error) {
    console.error("Error en análisis:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor.",
      },
      { status: 500 }
    );
  }
}