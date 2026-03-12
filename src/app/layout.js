export const metadata = {
  title: "Auditoría Médica — Análisis de No Conformidades",
  description: "Generador de informes de auditoría médica IECCT-SV. Análisis de No Conformidades y Eventos de Riesgo por médico.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
