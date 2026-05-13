"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setResult("⚠️ Por favor ingresa un enlace.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      // Mostrar el análisis si la API responde correctamente
      if (data.success && data.analysis) {
        setResult(data.analysis);
      } else {
        // Mostrar el error devuelto por la API o un mensaje genérico
        setResult(data.error || "❌ Error de conexión.");
      }
    } catch (error) {
      setResult("❌ Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000000",
        color: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#1f1f1f",
          padding: "40px",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "700px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            fontSize: "3rem",
            marginBottom: "20px",
          }}
        >
          🚗 Analizador de Precios de Autos
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#cccccc",
            marginBottom: "30px",
            fontSize: "1.1rem",
            lineHeight: "1.6",
          }}
        >
          Pega un enlace de Facebook Marketplace y descubre si el auto está bajo
          o sobre el precio de mercado.
        </p>

        <input
          type="text"
          placeholder="Pega aquí el enlace del vehículo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{
            width: "100%",
            padding: "16px",
            fontSize: "1rem",
            borderRadius: "10px",
            border: "1px solid #444",
            backgroundColor: "#2c2c2c",
            color: "#ffffff",
            marginBottom: "20px",
            boxSizing: "border-box",
          }}
        />

        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={{
            width: "100%",
            padding: "16px",
            fontSize: "1.1rem",
            fontWeight: "bold",
            borderRadius: "10px",
            border: "none",
            backgroundColor: loading ? "#666666" : "#0070f3",
            color: "#ffffff",
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: "25px",
          }}
        >
          {loading ? "Analizando..." : "Analizar Precio"}
        </button>

        {result && (
          <div
            style={{
              backgroundColor: "#2c2c2c",
              padding: "20px",
              borderRadius: "12px",
              whiteSpace: "pre-wrap",
              lineHeight: "1.7",
              color: "#ffffff",
              border: "1px solid #444",
            }}
          >
            {result}
          </div>
        )}
      </div>
    </main>
  );
}