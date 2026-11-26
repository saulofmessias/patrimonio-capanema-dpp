import { GERENTES_LIST } from '../data/secretarias';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Converte qualquer formato de data/hora do AppSheet, Excel ou Firestore em padrão brasileiro legível.
 * Suporta:
 * - Serial numérico do Excel (ex: "46171,41997" -> "29/05/2026 às 10:04")
 * - ISO simples (ex: "2025-09-08 11:09:11" -> "08/09/2025 às 11:09")
 * - ISO completo com fuso (ex: "2026-11-19T14:25:00.000Z")
 * - Brasileiro (ex: "03/03/2026 09:47:53" -> "03/03/2026 às 09:47")
 */
export function formatCadastroDate(raw?: string | null, includeTime = true): string {
  if (!raw) return 'Não informada';
  const trimmed = String(raw).trim();
  if (!trimmed) return 'Não informada';

  // 1. Serial numérico do Excel / Google Sheets (ex: "46171,41997" ou "46171.41997")
  if (/^\d{5}([.,]\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed.replace(',', '.'));
    if (!Number.isNaN(serial) && serial > 20000 && serial < 90000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) {
        const datePart = `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
        const hh = d.getUTCHours();
        const mm = d.getUTCMinutes();
        if (includeTime && (hh > 0 || mm > 0)) {
          return `${datePart} às ${pad2(hh)}:${pad2(mm)}`;
        }
        return datePart;
      }
    }
  }

  // 2. Brasileiro DD/MM/YYYY [HH:mm[:ss]]
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::\d{2})?)?$/);
  if (brMatch) {
    const [, dd, mm, yyyy, hh, min] = brMatch;
    if (includeTime && hh && min) {
      return `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
    }
    return `${dd}/${mm}/${yyyy}`;
  }

  // 3. SQL / AppSheet YYYY-MM-DD [HH:mm[:ss]] (sem fuso Z)
  const sqlMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::\d{2})?)?$/);
  if (sqlMatch) {
    const [, yyyy, mm, dd, hh, min] = sqlMatch;
    if (includeTime && hh && min) {
      return `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
    }
    return `${dd}/${mm}/${yyyy}`;
  }

  // 4. ISO completo (ex: 2026-11-19T14:25:00.000Z)
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const datePart = parsed.toLocaleDateString('pt-BR');
    if (includeTime) {
      const timePart = parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `${datePart} às ${timePart}`;
    }
    return datePart;
  }

  return trimmed;
}

/**
 * Retorna data e hora separadas para exibição compacta em colunas de tabela.
 */
export function formatCadastroDateParts(raw?: string | null): { date: string; time: string } {
  const formatted = formatCadastroDate(raw, true);
  if (!formatted || formatted === 'Não informada') {
    return { date: '—', time: '' };
  }
  const idx = formatted.indexOf(' às ');
  if (idx !== -1) {
    return {
      date: formatted.slice(0, idx),
      time: formatted.slice(idx + 4),
    };
  }
  return { date: formatted, time: '' };
}

/**
 * Converte qualquer formato de data de cadastro para timestamp numérico (ms) para ordenação cronológica.
 */
export function parseCadastroTimestamp(raw?: string | null): number {
  if (!raw) return 0;
  const trimmed = String(raw).trim();
  if (!trimmed) return 0;

  // 1. Serial numérico Excel / Sheets
  if (/^\d{5}([.,]\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed.replace(',', '.'));
    if (!Number.isNaN(serial) && serial > 20000 && serial < 90000) {
      return Math.round((serial - 25569) * 86400 * 1000);
    }
  }

  // 2. Brasileiro DD/MM/YYYY [HH:mm[:ss]]
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brMatch) {
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = brMatch;
    return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
  }

  // 3. SQL YYYY-MM-DD [HH:mm[:ss]]
  const sqlMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (sqlMatch) {
    const [, yyyy, mm, dd, hh = '0', min = '0', ss = '0'] = sqlMatch;
    return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
  }

  // 4. ISO padrão
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Converte ID numérico de gerente legado do AppSheet (ex: "5") para o nome oficial do servidor responsável.
 */
export function formatResponsavelNome(responsavel?: string | null): string {
  const resp = String(responsavel || '').trim();
  if (!resp) return 'Não informado';
  if (/^\d+$/.test(resp)) {
    const found = GERENTES_LIST.find((g) => String(g.id) === resp);
    if (found) return found.nome;
  }
  return resp;
}
