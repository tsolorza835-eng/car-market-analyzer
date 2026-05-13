"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [resultado, setResultado] = useState("");
  const [cargando, setCargando] = useState(false);

  async function analizarAuto() {
    const cleanUrl = url.trim();

    if (
      !cleanUrl ||
      !(
        cleanUrl.includes("facebook.com") ||
        cleanUrl.includes("fb.com")
      )
    ) {
      setResultado("❌ Debes proporcionar un enlace válido.");
      return;
    }

    setCargando(true);
    setResultado("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: cleanUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResultado(`❌ ${data.error || "Ocurrió un error."}`);
      } else {
        setResultado(data.raw);
      }
    } catch (error) {
      setResultado("❌ Error de conexión.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="bg-zinc-900 border border-zinc-800 shadow-2xl rounded-3xl p-8 max-w-3xl w-full">
        <h1 className="text-4xl font-bold text-center mb-4 text-white">
          🚗 Analizador de Precios de Autos
        </h1>

        <p className="text-zinc-400 text-center mb-6">
          Pega un enlace de Facebook Marketplace y descubre si el auto está
          bajo o sobre el precio de mercado.
        </p>

        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Pega aquí el enlace del vehículo"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 mb-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={analizarAuto}
          disabled={cargando}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 px-6 rounded-xl transition duration-200"
        >
          {cargando ? "Analizando..." : "Chúpalo José Ignacio"}
        </button>

        {resultado && (
          <div className="mt-8 bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <pre className="whitespace-pre-wrap text-white font-sans leading-7">
              {resultado}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}