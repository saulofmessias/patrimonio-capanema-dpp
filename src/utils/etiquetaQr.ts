import { PatrimonioRecord } from '../types/appsheet';

export type QrPayloadMode = 'ficha' | 'link' | 'numero';

const CUSTOM_QR_BASE_URL_KEY = 'patrimonio_qr_base_url';

export function getEtiquetaCodigo(
  bem: Partial<Pick<PatrimonioRecord, 'etiquetaNumero' | 'numeroTombamento' | 'id'>>
): string {
  return (bem.etiquetaNumero || bem.numeroTombamento || bem.id || '').trim();
}

export function getDefaultAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    // Em ambiente de desenvolvimento (ais-dev-*), converte para a URL compartilhada (ais-pre-*)
    // para que as etiquetas funcionem ao serem lidas por câmeras de celulares externos.
    return window.location.origin.replace('//ais-dev-', '//ais-pre-');
  }
  return '';
}

export function getCustomQrBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (localStorage.getItem(CUSTOM_QR_BASE_URL_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setCustomQrBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = url.trim().replace(/\/+$/, '');
    if (clean) {
      localStorage.setItem(CUSTOM_QR_BASE_URL_KEY, clean);
    } else {
      localStorage.removeItem(CUSTOM_QR_BASE_URL_KEY);
    }
  } catch {
    // Ignora erro de armazenamento local
  }
}

export function getAppBaseUrl(): string {
  return getCustomQrBaseUrl() || getDefaultAppBaseUrl();
}

export function buildEtiquetaQrLink(codigo: string, baseUrl?: string): string {
  const cleanCode = codigo.trim();
  const origin = (baseUrl || getAppBaseUrl()).replace(/\/+$/, '');
  if (!origin) return cleanCode;
  return `${origin}/?etiqueta=${encodeURIComponent(cleanCode)}`;
}

export function buildEtiquetaQrFicha(bem: {
  etiquetaNumero?: string;
  numeroTombamento?: string;
  id: string;
  descricao?: string;
  status?: string;
  secretariaSetor?: string;
  local?: string;
  localizacaoExata?: string;
  departamento?: string;
}): string {
  const codigo = getEtiquetaCodigo(bem);
  const nomeRaw = (bem.descricao || 'Sem descrição').trim().replace(/\s+/g, ' ');
  const nome = nomeRaw.length > 80 ? `${nomeRaw.slice(0, 77)}...` : nomeRaw;
  const status = (bem.status || 'Ativo / Em Uso').trim();
  const secretaria = (bem.secretariaSetor || 'Não informada').trim();
  const local = (bem.local || bem.localizacaoExata || '').trim();
  const depto = (bem.departamento || 'Setor Geral').trim();

  const lines = [
    'PATRIMÔNIO CAPANEMA',
    `Nº: ${codigo}`,
    `Nome: ${nome}`,
    `Status: ${status}`,
    `Secretaria: ${secretaria}`
  ];

  if (local && local.toLowerCase() !== depto.toLowerCase()) {
    lines.push(`Local: ${local}`);
  }
  lines.push(`Depto: ${depto}`);

  return lines.join('\n');
}

export function buildEtiquetaQrPayload(
  bem: PatrimonioRecord,
  mode: QrPayloadMode,
  baseUrl?: string
): string {
  if (mode === 'ficha') {
    return buildEtiquetaQrFicha(bem);
  }
  const codigo = getEtiquetaCodigo(bem);
  if (mode === 'link') {
    return buildEtiquetaQrLink(codigo, baseUrl);
  }
  return codigo;
}

export function extractCodigoFromQrData(dado: string): string {
  const raw = dado.trim();
  if (!raw) return '';

  // 1. Formato JSON (legado ou testes antigos)
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.etiqueta) return String(parsed.etiqueta).trim();
      if (parsed.tombo) return String(parsed.tombo).trim();
      if (parsed.id) return String(parsed.id).trim();
    } catch {
      // Segue para os demais formatos
    }
  }

  // 2. Formato URL completa ou relativa (ex: https://.../?etiqueta=466 ou /?etiqueta=466)
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/?') || raw.includes('?etiqueta=')) {
    try {
      const url = new URL(raw.startsWith('http') ? raw : `https://local.app${raw.startsWith('/') ? '' : '/'}${raw}`);
      const param =
        url.searchParams.get('etiqueta') ||
        url.searchParams.get('patrimonio') ||
        url.searchParams.get('tombo') ||
        url.searchParams.get('id');
      if (param && param.trim()) {
        return param.trim();
      }
      const segments = url.pathname.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last) return decodeURIComponent(last).trim();
    } catch {
      // Segue para os demais formatos
    }
  }

  // 3. Formato Ficha Completa em Texto ("PATRIMÔNIO CAPANEMA\nNº: 466\nNome: ...")
  const fichaMatch = raw.match(/(?:^|\r?\n)\s*(?:Nº|N°|N\.º|Etiqueta|Numero|Número)\s*:\s*([^\r\n]+)/i);
  if (fichaMatch && fichaMatch[1]) {
    return fichaMatch[1].trim();
  }

  // 4. Formato "ID: 13 | Cadeira | Status: ..."
  if (/ID\s*:\s*([0-9a-zA-Z_-]+)/i.test(raw)) {
    const match = raw.match(/ID\s*:\s*([0-9a-zA-Z_-]+)/i);
    if (match && match[1]) return match[1].trim();
  }

  // 5. Formato separado por pipes ("PMC-DPP|13|id")
  if (raw.includes('|')) {
    const parts = raw.split('|').map(p => p.trim());
    const partWithNumber = parts.find(p => /^\d+$/.test(p)) || parts[1] || parts[0];
    if (partWithNumber) return partWithNumber;
  }

  // 6. Caminho simples (".../patrimonio/466")
  if (raw.includes('/')) {
    const segments = raw.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) return last.trim();
  }

  return raw;
}

export function findPatrimonioByCodigo(
  patrimonios: PatrimonioRecord[],
  codigoRaw: string
): PatrimonioRecord | undefined {
  const buscaLower = codigoRaw.trim().toLowerCase();
  if (!buscaLower) return undefined;

  const numLimpo = codigoRaw.replace(/\D/g, '');
  const numSemZero = numLimpo ? String(parseInt(numLimpo, 10)) : '';

  const matchNumerico = (valor: string | undefined) => {
    if (!valor || !numLimpo) return false;
    const limpo = valor.replace(/\D/g, '');
    if (!limpo) return false;
    return limpo === numLimpo || String(parseInt(limpo, 10)) === numSemZero;
  };

  // Prioridade absoluta: Etiqueta_Numero -> Tombamento -> ID interno
  return (
    patrimonios.find(p => p.etiquetaNumero && p.etiquetaNumero.trim().toLowerCase() === buscaLower) ||
    patrimonios.find(p => matchNumerico(p.etiquetaNumero)) ||
    patrimonios.find(p => p.numeroTombamento && p.numeroTombamento.trim().toLowerCase() === buscaLower) ||
    patrimonios.find(p => matchNumerico(p.numeroTombamento)) ||
    patrimonios.find(p => p.id.trim().toLowerCase() === buscaLower) ||
    patrimonios.find(p => matchNumerico(p.id))
  );
}
