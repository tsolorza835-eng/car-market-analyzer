import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    return NextResponse.json({
      success: true,
      analysis: `
🚗 Análisis de prueba completado.

Enlace recibido:
${url}

✅ La conexión con la API está funcionando correctamente.
✅ Vercel está desplegado correctamente.
✅ El endpoint /api/analyze responde sin errores.

El siguiente paso será volver a integrar OpenAI y el scraper de Facebook Marketplace.
      `,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor.",
      },
      { status: 500 }
    );
  }
}