export const metadata = {
  title: "IECCT-SV AI Auditor",
  description: "Evaluación automática de calidez en teleconsultas médicas de El Salvador",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
