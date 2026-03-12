'use client';

import { useState, useCallback } from 'react';

// ─── Constantes visuales ────────────────────────────────────────────────────
const C = {
  bg: '#0a0f1e',
  surface: '#111827',
  surface2: '#1e2736',
  border: '#2d3748',
  borderLight: '#374151',
  text: '#f0f4f8',
  textMuted: '#8899aa',
  textDim: '#4a5568',
  blue: '#38bdf8',
  green: '#34d399',
  red: '#f87171',
  yellow: '#fbbf24',
  orange: '#fb923c',
  purple: '#a78bfa',
};

const COMPLIANCE_ORDER = [
  { component: 'ANAMNESIS', criteria: ['Motivo de Consulta', 'Signos Vitales', 'Talla y Peso', 'Antecedentes', 'Alergias', 'Transcripción Clínica', 'Presente Enfermedad'] },
  { component: 'EXAMEN FÍSICO', criteria: ['Examen Físico'] },
  { component: 'DIAGNÓSTICO', criteria: ['Apreciación Diagnóstica', 'Diagnóstico Principal', 'Diagnóstico Secundario', 'Problema Activo'] },
  { component: 'PRODUCTOS DE LA CONSULTA', criteria: ['Prescripción – Indicación', 'Prescripción – Dosis', 'Laboratorios', 'Imágenes', 'Seguridad al Contraste', 'Referencia Interna', 'Referencia Externa', 'Constancia Médica', 'Recomendaciones', 'Seguimiento'] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const extractSheetId = (url) => {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
};

const complianceStyle = (val) => {
  if (!val || val === '-' || val === '' || val === 'N/A') return null;
  const n = parseInt(String(val).replace('%', '').trim());
  if (isNaN(n)) return null;
  if (n >= 98) return { bg: '#052e16', text: '#86efac', border: '#16a34a' };
  if (n >= 95) return { bg: '#1c1003', text: '#fde68a', border: '#ca8a04' };
  if (n >= 85) return { bg: '#1c0a00', text: '#fed7aa', border: '#c2410c' };
  return { bg: '#1c0202', text: '#fecaca', border: '#dc2626' };
};

const safeParseJSON = (raw) => {
  try {
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────
function StepItem({ msg, status }) {
  const color = { done: C.green, active: C.blue, error: C.red, pending: C.textDim }[status] || C.textDim;
  const icon = { done: '✓', active: '◉', error: '✕', pending: '○' }[status] || '○';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', color, fontSize: 13 }}>
      <span style={{ width: 18, textAlign: 'center', fontWeight: 700 }}>{icon}</span>
      <span>{msg}</span>
    </div>
  );
}

function SectionTitle({ children, color = C.yellow }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, color, textTransform: 'uppercase',
      letterSpacing: 1.5, padding: '10px 0 8px', borderBottom: `1px solid ${C.border}`,
      marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function Badge({ count, label, color }) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '8px 18px', background: color + '18', border: `1px solid ${color}44`, borderRadius: 8, marginRight: 10 }}>
      <span style={{ fontSize: 26, fontWeight: 800, color }}>{count}</span>
      <span style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</span>
    </div>
  );
}

function ComplianceTable({ data, periods }) {
  if (!data || !data.length) return null;
  return (
    <div style={{ overflowX: 'auto', marginBottom: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={thStyle}>COMPONENTE</th>
            <th style={thStyle}>CRITERIO</th>
            {periods.map(p => <th key={p} style={{ ...thStyle, minWidth: 110, textAlign: 'center' }}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {COMPLIANCE_ORDER.map(({ component, criteria }) =>
            criteria.map((criterion, ci) => {
              const row = data.find(r =>
                r.component?.toUpperCase().includes(component.split(' ')[0]) &&
                r.criterion?.toLowerCase().includes(criterion.split(' ')[0].toLowerCase())
              ) || { component, criterion, values: [] };
              return (
                <tr key={component + criterion}>
                  {ci === 0 && (
                    <td style={{ ...tdStyle, fontWeight: 700, color: C.blue, verticalAlign: 'middle' }}
                      rowSpan={criteria.length}>{component}</td>
                  )}
                  <td style={{ ...tdStyle, color: C.text }}>{criterion}</td>
                  {periods.map(p => {
                    const v = row.values?.find(x => x.period === p || x.period?.includes(p.split(' ')[2]));
                    const pct = v?.pct || '-';
                    const cs = complianceStyle(pct);
                    return (
                      <td key={p} style={{
                        ...tdStyle, textAlign: 'center', fontWeight: cs ? 700 : 400,
                        background: cs?.bg || 'transparent', color: cs?.text || C.textDim,
                        border: `1px solid ${cs?.border || C.border}`,
                      }}>{pct}</td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8, lineHeight: 2 }}>
        <span style={{ color: '#86efac' }}>■ ≥98% Óptimo</span>{'  '}
        <span style={{ color: '#fde68a' }}>■ ≥95% a &lt;98% Muy Bueno</span>{'  '}
        <span style={{ color: '#fed7aa' }}>■ ≥85% a &lt;95% Aceptable</span>{'  '}
        <span style={{ color: '#fecaca' }}>■ &lt;85% Oportunidad de mejora</span>
      </div>
    </div>
  );
}

function QuantTable({ consultations, totalNC, totalER }) {
  if (!consultations || !consultations.length) return null;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 8 }}>
      <thead>
        <tr>
          <th style={thStyle}>Num Cita</th>
          <th style={{ ...thStyle, textAlign: 'left' }}>Diagnóstico</th>
          <th style={{ ...thStyle, textAlign: 'center', color: C.red }}>No Conformidades</th>
          <th style={{ ...thStyle, textAlign: 'center', color: C.yellow }}>Eventos de Riesgo</th>
        </tr>
      </thead>
      <tbody>
        {consultations.map((row, i) => (
          <tr key={i}>
            <td style={{ ...tdStyle, color: C.blue, fontWeight: 700 }}>{row.id}</td>
            <td style={{ ...tdStyle, color: C.text }}>{row.diagnosis}</td>
            <td style={{ ...tdStyle, textAlign: 'center', color: row.nc > 0 ? C.red : C.textDim, fontWeight: row.nc > 0 ? 700 : 400 }}>{row.nc ?? 0}</td>
            <td style={{ ...tdStyle, textAlign: 'center', color: row.er > 0 ? C.yellow : C.textDim, fontWeight: row.er > 0 ? 700 : 400 }}>{row.er ?? 0}</td>
          </tr>
        ))}
        <tr style={{ background: C.surface2 }}>
          <td colSpan={2} style={{ ...tdStyle, fontWeight: 700, color: C.textMuted }}>TOTAL</td>
          <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: C.red }}>{totalNC}</td>
          <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: C.yellow }}>{totalER}</td>
        </tr>
      </tbody>
    </table>
  );
}

function FindingBlock({ finding, type }) {
  const countColor = type === 'nc' ? C.red : C.yellow;
  const countLabel = type === 'nc' ? 'No conformidades Identificadas' : 'Eventos de Riesgo Identificados';
  return (
    <div style={{ marginBottom: 18, paddingLeft: 16, borderLeft: `3px solid ${countColor}33` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, textDecoration: 'underline', marginBottom: 8 }}>
        {finding.criterion}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: countColor, marginBottom: 6 }}>
        {countLabel}: ({finding.count}):
      </div>
      <div style={{ marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.yellow }}>Tipificación: </span>
        <span style={{ fontSize: 12, color: C.text }}>{finding.typification}</span>
      </div>
      <div style={{ marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>Hallazgos: </span>
        <span style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.7 }}>{finding.findings}</span>
      </div>
      <div>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>Impacto en la atención: </span>
        <span style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.7 }}>{finding.impact}</span>
      </div>
    </div>
  );
}

const thStyle = {
  padding: '8px 12px', background: '#1a2332', color: C.textMuted,
  textAlign: 'left', border: `1px solid ${C.border}`, fontWeight: 600,
};
const tdStyle = {
  padding: '7px 12px', border: `1px solid ${C.border}`, color: C.textMuted,
};

// ─── Componente principal ────────────────────────────────────────────────────
export default function AuditorReporteApp() {
  const [screen, setScreen] = useState('setup');
  const [dbUrl, setDbUrl] = useState('');
  const [cumplUrl, setCumplUrl] = useState('');
  const [rawDb, setRawDb] = useState('');
  const [rawCumpl, setRawCumpl] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriods, setSelectedPeriods] = useState([]);
  const [compareMode, setCompareMode] = useState('last2');
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ─── Step helpers ──────────────────────────────────────────────────────────
  const addStep = (msg) => setSteps(p => [...p, { msg, status: 'active' }]);
  const doneStep = () => setSteps(p => p.map((s, i) => i === p.length - 1 ? { ...s, status: 'done' } : s));
  const failStep = (msg) => setSteps(p => p.map((s, i) => i === p.length - 1 ? { ...s, status: 'error', msg: msg || s.msg } : s));

  // ─── Claude call ───────────────────────────────────────────────────────────
  const claude = useCallback(async (messages, system = '', maxTokens = 8000) => {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: maxTokens, system, messages }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Error Claude: ${res.status}`);
    return data.content?.[0]?.text || '';
  }, []);

  // ─── Fetch sheet ───────────────────────────────────────────────────────────
  const fetchSheet = useCallback(async (url) => {
    const id = extractSheetId(url);
    if (!id) throw new Error('URL inválida. Asegúrate de pegar el link completo de Google Sheets.');
    const res = await fetch(`/api/sheets?id=${id}`);
    const text = await res.text();
    if (!res.ok) {
      let msg = 'No se pudo acceder a la hoja.';
      try { msg = JSON.parse(text).error || msg; } catch { /* noop */ }
      throw new Error(msg);
    }
    return text;
  }, []);

  // ─── CARGAR DATOS ──────────────────────────────────────────────────────────
  const handleLoad = async () => {
    if (!dbUrl.trim() || !cumplUrl.trim()) {
      setError('Ingresa ambas URLs de Google Sheets.');
      return;
    }
    setError('');
    setSteps([]);
    setScreen('loading');
    try {
      addStep('Conectando a Base de Datos de Consultas…');
      const db = await fetchSheet(dbUrl);
      setRawDb(db);
      doneStep();

      addStep('Conectando a Gráficas de Cumplimiento…');
      const cumpl = await fetchSheet(cumplUrl);
      setRawCumpl(cumpl);
      doneStep();

      addStep('Identificando médicos en la base de datos…');
      const preview = db.split('\n').slice(0, 200).join('\n');
      const raw = await claude([{
        role: 'user',
        content: `Analiza este CSV de auditoría médica y devuelve un JSON con la lista única de médicos.

CSV:
${preview}

Responde SOLO con un JSON array:
[{"code":"000FV1","name":"FATIMA DANIELA VASQUEZ PEREZ","specialty":"MEDICINA GENERAL","dependency":"Doctor SV - El Salvador"}]

Solo el JSON, sin texto adicional.`,
      }], 'Extractor de datos CSV. Responde solo con JSON válido. Sin explicaciones.');

      const parsed = safeParseJSON(raw);
      if (!parsed || !Array.isArray(parsed)) throw new Error('No se pudo identificar médicos. Verifica el formato del archivo.');
      setDoctors(parsed);
      doneStep();
      setScreen('select-doctor');
    } catch (e) {
      failStep(e.message);
      setError(e.message);
      setTimeout(() => setScreen('setup'), 2000);
    }
  };

  // ─── SELECCIONAR MÉDICO ────────────────────────────────────────────────────
  const handleSelectDoctor = async (doc) => {
    setSelectedDoctor(doc);
    setError('');
    setSteps([]);
    setScreen('loading');
    try {
      addStep(`Buscando períodos auditados de ${doc.name}…`);
      const preview = rawDb.split('\n').slice(0, 600).join('\n');
      const raw = await claude([{
        role: 'user',
        content: `Del siguiente CSV de auditoría médica, extrae todos los PERÍODOS AUDITADOS del médico con código "${doc.code}".

CSV:
${preview}

Devuelve SOLO un JSON array con los períodos en orden cronológico (del más antiguo al más reciente):
["01 al 15 enero 2026","16 al 31 enero 2026","01 al 15 febrero 2026"]

Solo el JSON, sin texto adicional.`,
      }], 'Extractor de períodos de auditoría. Responde solo con JSON.');

      const parsed = safeParseJSON(raw);
      if (!parsed || !Array.isArray(parsed)) throw new Error('No se encontraron períodos para este médico.');
      setPeriods(parsed);
      setSelectedPeriods(parsed.length >= 2 ? parsed.slice(-2) : parsed);
      setCompareMode('last2');
      doneStep();
      setScreen('select-period');
    } catch (e) {
      failStep(e.message);
      setError(e.message);
      setTimeout(() => setScreen('select-doctor'), 2000);
    }
  };

  // ─── GENERAR INFORME ───────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const periodsToUse = compareMode === 'all' ? periods : selectedPeriods;
    if (periodsToUse.length === 0) { setError('Selecciona al menos un período.'); return; }
    setError('');
    setSteps([]);
    setScreen('generating');

    try {
      addStep('Extrayendo hallazgos del médico…');

      const dbChunk = rawDb.split('\n').slice(0, 800).join('\n');
      const cumplChunk = rawCumpl.split('\n').slice(0, 400).join('\n');

      const structuredRaw = await claude([{
        role: 'user',
        content: `Extrae TODOS los datos de auditoría del médico "${selectedDoctor.code}" - "${selectedDoctor.name}" para los períodos: ${periodsToUse.join(', ')}.

BASE DE DATOS CSV:
${dbChunk}

GRÁFICAS DE CUMPLIMIENTO CSV:
${cumplChunk}

Devuelve un JSON con esta estructura EXACTA:
{
  "doctorInfo": {
    "code": "000FV1",
    "name": "FATIMA DANIELA VASQUEZ PEREZ",
    "specialty": "MEDICINA GENERAL",
    "dependency": "Doctor SV - El Salvador"
  },
  "periods": ["01 al 15 enero 2026", "01 al 15 febrero 2026"],
  "consultations": [
    {
      "id": "1108006",
      "diagnosis": "DB92.Z - Hepatopatía grasa no alcohólica",
      "period": "01 al 15 febrero 2026",
      "findings": [
        {
          "component": "ANAMNESIS",
          "criterion": "Alergias",
          "typification": "Omisión de indagación y documentación de alergias",
          "classification": "No Conformidad",
          "detail": "El médico omitió completamente el interrogatorio sobre alergias"
        }
      ]
    }
  ],
  "compliance": [
    {
      "component": "ANAMNESIS",
      "criterion": "Motivo de Consulta",
      "values": [
        {"period": "01 al 15 enero 2026", "pct": "100%"},
        {"period": "01 al 15 febrero 2026", "pct": "100%"}
      ]
    }
  ]
}

IMPORTANTE: Incluye TODAS las consultas y TODOS los hallazgos. Incluye los 22 criterios de cumplimiento con "-" si no hay dato. Solo el JSON.`,
      }], 'Eres auditor médico experto. Extrae datos estructurados exactos de CSV. Solo JSON válido.');

      const structured = safeParseJSON(structuredRaw);
      if (!structured) throw new Error('Error al estructurar los datos. Intenta nuevamente.');
      doneStep();

      addStep('Generando análisis cualitativo con IA…');

      const consultationsSummary = JSON.stringify(structured.consultations || []);
      const complianceSummary = JSON.stringify(structured.compliance || []);

      const reportRaw = await claude([{
        role: 'user',
        content: `Genera el informe completo de auditoría médica en JSON estructurado.

DATOS DEL MÉDICO:
${JSON.stringify(structured.doctorInfo)}

PERÍODOS ANALIZADOS: ${periodsToUse.join(' | ')}

CONSULTAS Y HALLAZGOS:
${consultationsSummary}

DATOS DE CUMPLIMIENTO:
${complianceSummary}

Devuelve un JSON con esta estructura EXACTA (sigue el formato del informe IECCT-SV):
{
  "header": {
    "reportNumber": "000FV1-MG-2026-P003",
    "name": "FATIMA DANIELA VASQUEZ PEREZ",
    "code": "000FV1",
    "specialty": "MEDICINA GENERAL",
    "dependency": "Doctor SV - El Salvador",
    "periodAudited": "01 al 15 febrero 2026"
  },
  "executiveSummary": {
    "riskProfile": "Se evidencia un perfil de riesgo con afectación crítica en los componentes de...",
    "totalNC": 14,
    "totalER": 5,
    "components": [
      {"name": "ANAMNESIS", "total": 11, "nc": 7, "er": 4},
      {"name": "EXAMEN FÍSICO", "total": 5, "nc": 5, "er": 0},
      {"name": "DIAGNÓSTICO", "total": 2, "nc": 1, "er": 1},
      {"name": "PRODUCTOS DE LA CONSULTA", "total": 1, "nc": 1, "er": 0}
    ]
  },
  "compliance": [
    {
      "component": "ANAMNESIS",
      "criterion": "Motivo de Consulta",
      "values": [{"period": "01 al 15 febrero 2026", "pct": "100%"}]
    }
  ],
  "quantitative": {
    "consultations": [
      {"id": "1108006", "diagnosis": "DB92.Z - Hepatopatía grasa no alcohólica, sin especificación", "nc": 3, "er": 0}
    ],
    "totalNC": 14,
    "totalER": 5
  },
  "qualitative": {
    "ncAnalysis": {
      "intro": "Se ha realizado un análisis de un total de 5 auditorías. Se identificaron 14 No conformidades y 5 Eventos de Riesgo...",
      "components": [
        {
          "component": "ANAMNESIS",
          "criteria": [
            {
              "criterion": "Alergias",
              "count": 5,
              "typification": "Omisión de indagación y documentación de alergias.",
              "findings": "En las cinco consultas auditadas (ID 1108006, 1109656...) el médico omitió...",
              "impact": "Expone al paciente a un riesgo crítico de reacciones adversas..."
            }
          ]
        }
      ]
    },
    "erAnalysis": {
      "intro": "Se identificaron 5 Eventos de Riesgo...",
      "components": [
        {
          "component": "ANAMNESIS",
          "criteria": [
            {
              "criterion": "Signos Vitales",
              "count": 1,
              "typification": "Registro fraudulento que el paciente no cuenta con instrumentos...",
              "findings": "En la consulta por Cálculo renal (ID 1103810)...",
              "impact": "Afecta la veracidad del expediente clínico..."
            }
          ]
        }
      ]
    }
  },
  "periodComparison": {
    "enabled": true,
    "periods": ["01 al 15 enero 2026", "01 al 15 febrero 2026"],
    "summary": "Resumen de máximo 4 líneas comparando criterios con impacto en atención al usuario",
    "positive": ["Criterio X: 60% → 100% (mejora)"],
    "negative": ["Criterio Y: 80% → 40% (deterioro)"],
    "sustained": ["Criterio Z: 0% en ambos períodos (sin variación, requiere atención)"]
  }
}

REGLAS CRÍTICAS:
1. Orden componentes: ANAMNESIS → EXAMEN FÍSICO → DIAGNÓSTICO → PRODUCTOS DE LA CONSULTA
2. NO mezclar componentes ni criterios entre sí
3. Separar CADA tipificación con su hallazgo e impacto individual (una por bloque)
4. Correlacionar cada hallazgo con el ID de consulta y diagnóstico específico
5. Contar exactamente: cada tipificación individual cuenta como 1
6. periodComparison.enabled = true solo si hay 2+ períodos analizados
7. Solo el JSON, sin texto adicional`,
      }], `Eres un auditor médico experto del sistema IECCT-SV de El Salvador. Generas informes de auditoría precisos con el formato exacto requerido. Correlacionas diagnósticos con hallazgos. No inventas información. Cuentas tipificaciones exactamente. Separas cada tipificación en su propio bloque de análisis.`, 10000);

      const report = safeParseJSON(reportRaw);
      if (!report) throw new Error('Error al generar el informe. Intenta nuevamente.');
      doneStep();

      setReportData(report);
      setScreen('report');
    } catch (e) {
      failStep(e.message);
      setError(e.message);
      setTimeout(() => setScreen('select-period'), 2500);
    }
  };

  // ─── DESCARGAR INFORME ─────────────────────────────────────────────────────
  const downloadReport = () => {
    if (!reportData) return;
    const r = reportData;
    const h = r.header || {};
    const es = r.executiveSummary || {};
    const q = r.qualitative || {};
    const pc = r.periodComparison || {};

    let txt = '';
    txt += `INFORME DE AUDITORÍA N° ${h.reportNumber || ''}\n\n`;
    txt += `NOMBRE\t${h.name || ''}\n`;
    txt += `CÓDIGO\t${h.code || ''}\n`;
    txt += `ESPECIALIDAD\t${h.specialty || ''}\n`;
    txt += `DEPENDENCIA\t${h.dependency || ''}\n`;
    txt += `PERIODO AUDITADO\t${h.periodAudited || ''}\n\n`;

    txt += `${'─'.repeat(70)}\nRESUMEN EJECUTIVO\n${'─'.repeat(70)}\n`;
    txt += `${es.riskProfile || ''}\n\n`;
    txt += `Se identificaron ${es.totalNC || 0} No Conformidades en total; También se identificaron ${es.totalER || 0} Eventos de Riesgo.\n\n`;
    (es.components || []).forEach(c => {
      txt += `${c.name}: se identifican ${c.total} hallazgos; de los cuales ${c.nc} son No Conformidades y ${c.er} son Eventos de Riesgo.\n`;
    });

    txt += `\n${'─'.repeat(70)}\nANÁLISIS DE NO CONFORMIDADES\n${'─'.repeat(70)}\n`;
    txt += `\nANÁLISIS CUANTITATIVO\n`;
    txt += `${'Num Cita'.padEnd(12)}${'Diagnóstico'.padEnd(60)}${'NC'.padEnd(6)}ER\n`;
    (r.quantitative?.consultations || []).forEach(c => {
      txt += `${String(c.id).padEnd(12)}${String(c.diagnosis).padEnd(60)}${String(c.nc).padEnd(6)}${c.er}\n`;
    });
    txt += `\nTOTAL NC: ${r.quantitative?.totalNC || 0}   TOTAL ER: ${r.quantitative?.totalER || 0}\n`;

    txt += `\n${'─'.repeat(70)}\nANÁLISIS CUALITATIVO\n${'─'.repeat(70)}\n`;
    txt += `${q.ncAnalysis?.intro || ''}\n\n`;
    txt += `Análisis de No Conformidades\n`;
    (q.ncAnalysis?.components || []).forEach((comp, i) => {
      txt += `\n${i + 1}. ${comp.component}\n`;
      (comp.criteria || []).forEach(f => {
        txt += `__${f.criterion}__\n`;
        txt += `No conformidades Identificadas: (${f.count}):\n`;
        txt += `Tipificación: ${f.typification}\n`;
        txt += `Hallazgos: ${f.findings}\n`;
        txt += `Impacto en la atención: ${f.impact}\n\n`;
      });
    });

    txt += `${'─'.repeat(70)}\nAnálisis de Eventos de Riesgo\n`;
    txt += `${q.erAnalysis?.intro || ''}\n\n`;
    (q.erAnalysis?.components || []).forEach((comp, i) => {
      txt += `\n${i + 1}. ${comp.component}\n`;
      (comp.criteria || []).forEach(f => {
        txt += `__${f.criterion}__\n`;
        txt += `Evento de Riesgo Identificado: (${f.count}):\n`;
        txt += `Tipificación: ${f.typification}\n`;
        txt += `Hallazgos: ${f.findings}\n`;
        txt += `Impacto en la atención: ${f.impact}\n\n`;
      });
    });

    if (pc.enabled) {
      txt += `${'─'.repeat(70)}\n`;
      txt += `COMENTARIO DE SEGUIMIENTO Y COMPARACIÓN DE PERÍODOS (${(pc.periods || []).join(' vs ')}):\n`;
      txt += `${pc.summary || ''}\n\nSe han observado los siguientes hallazgos:\n`;
      txt += `Tendencia positiva: ${(pc.positive || []).join('; ')}\n`;
      txt += `Tendencia negativa: ${(pc.negative || []).join('; ')}\n`;
      txt += `Tendencia sostenida: ${(pc.sustained || []).join('; ')}\n`;
    }

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Informe_${h.code}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Estilos comunes ───────────────────────────────────────────────────────
  const appStyle = {
    minHeight: '100vh',
    background: `linear-gradient(160deg, ${C.bg} 0%, #0d1525 50%, ${C.bg} 100%)`,
    color: C.text,
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    padding: 24,
  };
  const cardStyle = {
    background: 'rgba(17,24,39,0.95)',
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: 32,
    maxWidth: 820,
    margin: '0 auto',
    backdropFilter: 'blur(10px)',
  };
  const inputStyle = {
    width: '100%', background: C.bg, border: `1px solid ${C.borderLight}`,
    borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14,
    boxSizing: 'border-box', outline: 'none',
  };
  const btnPrimary = {
    background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
    color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%',
  };
  const btnSecondary = {
    background: 'transparent', color: C.textMuted,
    border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 20px',
    fontSize: 13, cursor: 'pointer', width: '100%',
  };
  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
  };
  const errorStyle = {
    background: 'rgba(239,68,68,0.08)', border: `1px solid ${C.red}44`,
    borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 12, marginTop: 14,
  };

  // ─── PANTALLA SETUP ────────────────────────────────────────────────────────
  if (screen === 'setup') return (
    <div style={appStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.blue, marginBottom: 4 }}>
            🏥 Auditoría Médica — Análisis de No Conformidades
          </div>
          <div style={{ fontSize: 14, color: C.textMuted }}>
            Sistema IECCT-SV · Generador de Informes por Médico
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>🛢️ Base de Datos x Cita 2026 (Google Sheets)</label>
          <input style={inputStyle} value={dbUrl} onChange={e => setDbUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..." />
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
            Contiene los hallazgos por consulta, tipificaciones y clasificaciones NC/ER
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={labelStyle}>🕸️ Gráficas de Cumplimiento 2026 (Google Sheets)</label>
          <input style={inputStyle} value={cumplUrl} onChange={e => setCumplUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..." />
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
            Contiene los porcentajes de cumplimiento por criterio y período
          </div>
        </div>

        <button style={btnPrimary} onClick={handleLoad}>Cargar Datos y Seleccionar Médico →</button>

        {error && <div style={errorStyle}>⚠ {error}</div>}

        <div style={{ marginTop: 20, padding: '14px 16px', background: C.surface2, borderRadius: 8, fontSize: 11, color: C.textDim, lineHeight: 1.8 }}>
          <strong style={{ color: C.textMuted }}>Requisito de acceso:</strong> Las hojas deben estar publicadas en la web.<br />
          Google Sheets → <strong>Archivo → Publicar en la web</strong> → Seleccionar hoja → CSV → Publicar
        </div>
      </div>
    </div>
  );

  // ─── PANTALLA LOADING ──────────────────────────────────────────────────────
  if (screen === 'loading') return (
    <div style={appStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.blue, marginBottom: 24 }}>
          Procesando…
        </div>
        {steps.map((step, i) => <StepItem key={i} {...step} />)}
        {error && <div style={errorStyle}>⚠ {error}</div>}
      </div>
    </div>
  );

  // ─── PANTALLA SELECCIÓN MÉDICO ─────────────────────────────────────────────
  if (screen === 'select-doctor') return (
    <div style={appStyle}>
      <div style={{ ...cardStyle, maxWidth: 960 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.blue, marginBottom: 4 }}>
          Seleccionar Médico
        </div>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
          {doctors.length} médico(s) encontrado(s) en la base de datos
        </div>

        <input style={{ ...inputStyle, marginBottom: 20 }}
          placeholder="Buscar por nombre o código…"
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12 }}>
          {doctors
            .filter(d => !searchTerm ||
              d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              d.code?.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(doc => (
              <div key={doc.code} onClick={() => handleSelectDoctor(doc)}
                style={{
                  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: 16, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.background = C.surface2; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg; }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.blue, marginBottom: 4 }}>{doc.code}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{doc.name}</div>
                {doc.specialty && <div style={{ fontSize: 12, color: C.textMuted }}>{doc.specialty}</div>}
                {doc.dependency && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{doc.dependency}</div>}
              </div>
            ))}
        </div>

        {error && <div style={errorStyle}>⚠ {error}</div>}
        <button style={{ ...btnSecondary, marginTop: 20, width: 'auto', padding: '8px 20px' }}
          onClick={() => setScreen('setup')}>← Volver</button>
      </div>
    </div>
  );

  // ─── PANTALLA SELECCIÓN PERÍODO ────────────────────────────────────────────
  if (screen === 'select-period') return (
    <div style={appStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{selectedDoctor?.name}</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            Código: <strong style={{ color: C.text }}>{selectedDoctor?.code}</strong>
            {selectedDoctor?.specialty && ` · ${selectedDoctor.specialty}`}
          </div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
            {periods.length} período(s) auditado(s) disponibles
          </div>
        </div>

        <SectionTitle>Configuración de Análisis</SectionTitle>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {[
            {
              value: 'last2',
              label: periods.length >= 2 ? `Últimos 2 períodos: ${periods.slice(-2).join(' y ')}` : 'Último período disponible',
              desc: 'Comparación estándar (recomendado)',
            },
            {
              value: 'custom',
              label: 'Selección personalizada de períodos',
              desc: 'Elige exactamente qué períodos incluir',
            },
            {
              value: 'all',
              label: `Todos los períodos (${periods.length})`,
              desc: 'Análisis global del histórico completo',
            },
          ].map(opt => (
            <label key={opt.value} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
              background: compareMode === opt.value ? `${C.blue}10` : C.bg,
              border: `1px solid ${compareMode === opt.value ? C.blue : C.border}`,
              borderRadius: 8, cursor: 'pointer',
            }}>
              <input type="radio" checked={compareMode === opt.value}
                onChange={() => {
                  setCompareMode(opt.value);
                  if (opt.value === 'last2') setSelectedPeriods(periods.slice(-2));
                  if (opt.value === 'all') setSelectedPeriods(periods);
                }} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {compareMode === 'custom' && (
          <div style={{ marginBottom: 20, padding: '14px 16px', background: C.surface2, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>PERÍODOS DISPONIBLES</div>
            {periods.map(p => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedPeriods.includes(p)}
                  onChange={e => setSelectedPeriods(prev =>
                    e.target.checked ? [...prev, p] : prev.filter(x => x !== p)
                  )} />
                <span style={{ fontSize: 13, color: C.text }}>{p}</span>
              </label>
            ))}
          </div>
        )}

        {error && <div style={errorStyle}>⚠ {error}</div>}

        <button style={btnPrimary} onClick={handleGenerate}>
          Generar Informe de Auditoría →
        </button>
        <button style={{ ...btnSecondary, marginTop: 10 }} onClick={() => setScreen('select-doctor')}>
          ← Cambiar médico
        </button>
      </div>
    </div>
  );

  // ─── PANTALLA GENERANDO ────────────────────────────────────────────────────
  if (screen === 'generating') return (
    <div style={appStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.blue, marginBottom: 8 }}>
          Generando Informe…
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 24 }}>
          {selectedDoctor?.name} ({selectedDoctor?.code})
        </div>
        {steps.map((step, i) => <StepItem key={i} {...step} />)}
        {error && <div style={errorStyle}>⚠ {error}</div>}
      </div>
    </div>
  );

  // ─── PANTALLA REPORTE ──────────────────────────────────────────────────────
  if (screen === 'report' && reportData) {
    const r = reportData;
    const h = r.header || {};
    const es = r.executiveSummary || {};
    const q = r.qualitative || {};
    const pc = r.periodComparison || {};
    const reportPeriods = compareMode === 'all' ? periods : selectedPeriods;

    return (
      <div style={appStyle}>
        <div style={{ ...cardStyle, maxWidth: 960 }}>

          {/* Acciones */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>Informe Generado</div>
              <div style={{ fontSize: 12, color: C.textDim }}>
                {h.name} · {h.code} · {h.periodAudited}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={downloadReport}
                style={{ background: '#052e16', color: '#86efac', border: '1px solid #16a34a', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                ↓ Descargar .txt
              </button>
              <button onClick={() => setScreen('select-period')}
                style={{ background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 13 }}>
                ← Nuevo análisis
              </button>
            </div>
          </div>

          {/* Encabezado del informe */}
          <div style={{ background: C.surface2, borderRadius: 10, padding: '20px 24px', marginBottom: 24, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.blue, marginBottom: 16 }}>
              INFORME DE AUDITORÍA N° {h.reportNumber}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
              {[
                ['NOMBRE', h.name],
                ['CÓDIGO', h.code],
                ['ESPECIALIDAD', h.specialty],
                ['DEPENDENCIA', h.dependency],
                ['PERIODO AUDITADO', h.periodAudited],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, minWidth: 110 }}>{k}</span>
                  <span style={{ fontSize: 13, color: C.text }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen ejecutivo */}
          <div style={{ marginBottom: 24 }}>
            <SectionTitle color={C.yellow}>Resumen Ejecutivo</SectionTitle>
            <p style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.8, marginBottom: 16 }}>
              {es.riskProfile}
            </p>
            <div style={{ marginBottom: 16 }}>
              <Badge count={es.totalNC} label="No Conformidades" color={C.red} />
              <Badge count={es.totalER} label="Eventos de Riesgo" color={C.yellow} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(es.components || []).filter(c => c.total > 0).map(c => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: C.text, minWidth: 240 }}>{c.name}:</span>
                  <span style={{ color: C.textMuted }}>
                    {c.total} hallazgo(s) —
                    <span style={{ color: C.red }}> {c.nc} NC</span> /
                    <span style={{ color: C.yellow }}> {c.er} ER</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla de cumplimiento */}
          <div style={{ marginBottom: 28 }}>
            <SectionTitle>Reporte de Cumplimiento por Criterio</SectionTitle>
            <ComplianceTable data={r.compliance} periods={reportPeriods} />
          </div>

          {/* Análisis de no conformidades */}
          <div style={{ marginBottom: 8 }}>
            <SectionTitle color={C.red}>Análisis de No Conformidades</SectionTitle>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 12 }}>ANÁLISIS CUANTITATIVO</div>
              <QuantTable
                consultations={r.quantitative?.consultations}
                totalNC={r.quantitative?.totalNC}
                totalER={r.quantitative?.totalER}
              />
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 12 }}>ANÁLISIS CUALITATIVO</div>
              <p style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.8, marginBottom: 20 }}>
                {q.ncAnalysis?.intro}
              </p>

              {/* NC por componente */}
              {(q.ncAnalysis?.components || []).map((comp, i) => (
                <div key={comp.component} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 12 }}>
                    {i + 1}. {comp.component}
                  </div>
                  {(comp.criteria || []).map((f, j) => (
                    <FindingBlock key={j} finding={f} type="nc" />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Análisis de eventos de riesgo */}
          {(q.erAnalysis?.components || []).some(c => c.criteria?.length > 0) && (
            <div style={{ marginBottom: 24, borderTop: `2px solid ${C.border}`, paddingTop: 24 }}>
              <SectionTitle color={C.yellow}>Análisis de Eventos de Riesgo</SectionTitle>
              <p style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.8, marginBottom: 20 }}>
                {q.erAnalysis?.intro}
              </p>
              {(q.erAnalysis?.components || []).map((comp, i) => (
                <div key={comp.component} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 12 }}>
                    {i + 1}. {comp.component}
                  </div>
                  {(comp.criteria || []).map((f, j) => (
                    <FindingBlock key={j} finding={f} type="er" />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Comparación de períodos */}
          {pc.enabled && (
            <div style={{ marginBottom: 8, borderTop: `2px solid ${C.border}`, paddingTop: 24 }}>
              <SectionTitle color={C.purple}>
                Comparación de Períodos: {(pc.periods || []).join(' vs ')}
              </SectionTitle>
              <p style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.8, marginBottom: 16 }}>
                {pc.summary}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Tendencia positiva', items: pc.positive, color: C.green, icon: '↑' },
                  { label: 'Tendencia negativa', items: pc.negative, color: C.red, icon: '↓' },
                  { label: 'Tendencia sostenida', items: pc.sustained, color: C.yellow, icon: '→' },
                ].map(({ label, items, color, icon }) => items?.length > 0 && (
                  <div key={label} style={{ padding: '12px 16px', background: color + '0d', border: `1px solid ${color}33`, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8 }}>{icon} {label}</div>
                    {items.map((item, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#d1d5db', padding: '2px 0' }}>• {item}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
