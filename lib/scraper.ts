import { ApifyClient } from "apify-client";

export async function scrapeMarketplaceData(url: string) {
  try {
    const client = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });

    const run = await client.actor("apify/facebook-marketplace-scraper").call({
      startUrls: [{ url }],
      maxItems: 1,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items.length) {
      throw new Error("No se encontraron datos.");
    }

    const item: any = items[0];

    return {
      title: item.title || "No encontrado",
      price: item.price || "No encontrado",
      description: item.description || "No encontrado",
      location: item.location || "No encontrado",
      mileage: item.mileage || "No encontrado",
      year: item.year || "No encontrado",
    };
  } catch (error) {
    return {
      title: "No encontrado",
      price: "No encontrado",
      description: "No se pudo extraer información del anuncio.",
      location: "No encontrado",
      mileage: "No encontrado",
      year: "No encontrado",
    };
  }
}