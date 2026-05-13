import { chromium } from "playwright";

export async function extraerDatosMarketplace(url: string) {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  try {
    console.log("Abriendo:", url);

    // Cargar la página lo más rápido posible
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // Esperar solo 2 segundos
    await page.waitForTimeout(2000);

    // Extraer información
    const titulo = await page.title();
    const texto = await page.locator("body").innerText();

    await browser.close();

    return {
      titulo,
      texto: texto.slice(0, 6000), // Menos texto = menor costo y mayor velocidad
    };
  } catch (error) {
    console.error("Error al extraer datos de Marketplace:", error);

    await browser.close();

    return {
      titulo: "No se pudo acceder completamente al aviso",
      texto:
        "Facebook bloqueó parcialmente el acceso automático. Intenta nuevamente o utiliza otro enlace.",
    };
  }
}