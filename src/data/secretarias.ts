import { LocalizacaoRecord } from '../types/appsheet';

/**
 * Cadastro oficial das Secretarias e Órgãos do Município de Capanema (PA).
 *
 * A base migrada do AppSheet e o cadastro interno usavam grafias diferentes
 * para a mesma secretaria. O caso mais grave era "SECRETARIA DE ASSITENCIA
 * SOCIAL" (cadastro) x "SECRETARIA DE ASSISTÊNCIA SOCIAL" (base com 703 bens),
 * o que fazia o filtro não retornar nenhum bem e, ao editar um desses bens,
 * o formulário cair no fallback e gravar a secretaria errada.
 *
 * Por isso o nome canônico vive aqui e toda comparação passa por
 * `normalizeSecretariaNome`.
 */

export const SECRETARIAS_CANONICAS: LocalizacaoRecord[] = [
  { id: 1, nome: 'GABINETE DO PREFEITO', endereco: 'Rua Djalma Dutra, 2506 - Centro', cidade: 'Capanema' },
  { id: 2, nome: 'SECRETARIA DE ADMINISTRAÇÃO', endereco: 'AV. BARÃO DE CAPANEMA, Nº S/N - CENTRO', cidade: 'Capanema' },
  { id: 3, nome: 'SECRETARIA DE ASSISTÊNCIA SOCIAL', endereco: 'AV DOM PEDRO II, Nº SN - CENTRO', cidade: 'Capanema' },
  { id: 4, nome: 'SECRETARIA DE COMUNICAÇÃO', endereco: 'TV DJALMA DUTRA, Nº 2506', cidade: 'Capanema' },
  { id: 5, nome: 'SECRETARIA DE EDUCAÇÃO', endereco: 'AV BARÃO DE CAPANEMA, Nº 847 - AREIA BRANCA', cidade: 'Capanema' },
  { id: 6, nome: 'SECRETARIA DE SAÚDE', endereco: 'TV CESAR PINHEIRO, Nº 297 - CENTRO', cidade: 'Capanema' },
  { id: 7, nome: 'SECRETARIA DE AGRICULTURA', endereco: 'RUA MIGUEL LEITE, Nº 112 - IGREJINHA', cidade: 'Capanema' },
  { id: 8, nome: 'SECRETARIA DE CULTURA', endereco: 'ALAMEDA ODILON PONTES, Nº SN - CENTRO', cidade: 'Capanema' },
  { id: 9, nome: 'SECRETARIA DE DESPORTO E LAZER', endereco: 'ALAMEDA ODILON PONTES, Nº SN - CENTRO', cidade: 'Capanema' },
  { id: 10, nome: 'SECRETARIA DE FINANÇAS', endereco: 'TV CESAR PINHEIRO, Nº 375 - CENTRO', cidade: 'Capanema' },
  { id: 11, nome: 'SECRETARIA DE INDÚSTRIA, COMÉRCIO, MINERAÇÃO E TURISMO', endereco: 'TV. DOIS DE JUNHO, Nº 109 - CENTRO', cidade: 'Capanema' },
  { id: 12, nome: 'SECRETARIA DE MEIO AMBIENTE', endereco: 'TRAVESSA DO PARIQUIS, Nº 3142 - AREIA BRANCA', cidade: 'Capanema' },
  { id: 13, nome: 'SECRETARIA DE PLANEJAMENTO', endereco: 'TV DJALMA DUTRA, Nº 2590 - CENTRO', cidade: 'Capanema' },
  { id: 14, nome: 'SECRETARIA DE TRÂNSITO', endereco: 'TV. DOS JURUNAS, Nº 177 - TANCREDO NEVES', cidade: 'Capanema' },
  { id: 15, nome: 'SECRETARIA DE URBANISMO, OBRAS E VIAÇÃO', endereco: 'RUA 28 DE OUTUBRO, Nº 191 - CENTRO', cidade: 'Capanema' },
];

/** Secretaria usada quando o bem ainda não tem linkage (ex.: "Todas" no perfil admin). */
export const SECRETARIA_TODAS = 'Todas';

/**
 * Remove acentos, normaliza espaços e aplica correções de grafia conhecidas.
 * Ex.: "SECRETARIA DE ASSITENCIA SOCIAL" -> "SECRETARIA DE ASSISTENCIA SOCIAL"
 */
export function normalizeSecretariaNome(nome?: string | null): string {
  const base = String(nome || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

  if (!base) return '';

  // Grafias legadas que precisam ser reconciliadas com o cadastro canônico.
  const semAspas = base.replace(/[^A-Z0-9]+/g, '');
  if (semAspas === 'SECRETARIADEASSITENCIASOCIAL') return 'SECRETARIA DE ASSISTENCIA SOCIAL';
  if (semAspas === 'SECRETARIADEASSISTENCIASOCIAL') return 'SECRETARIA DE ASSISTENCIA SOCIAL';
  if (semAspas === 'SECRETARIANODEFINIDA' || semAspas === 'SECRETARIANAODEFINIDA') {
    return 'SECRETARIA NAO DEFINIDA';
  }

  return base;
}

/** Índice de localização de cada secretaria canônica, já normalizado. */
const LOCALIZACAO_POR_NOME_NORMALIZADO = new Map<string, LocalizacaoRecord>(
  SECRETARIAS_CANONICAS.map((loc) => [normalizeSecretariaNome(loc.nome), loc])
);

/**
 * Encontra a secretaria correspondente a um nome vindo da base migrada,
 * tolerando acentuação, caixa e grafias diferentes.
 */
export function findLocalizacaoPorNome(nome?: string | null): LocalizacaoRecord | undefined {
  const chave = normalizeSecretariaNome(nome);
  if (!chave) return undefined;
  return LOCALIZACAO_POR_NOME_NORMALIZADO.get(chave);
}

/** Resolve o id da localizacao (1..16) de uma secretaria, ou undefined se desconhecida. */
export function resolveSecretariaId(nome?: string | null): number | undefined {
  return findLocalizacaoPorNome(nome)?.id;
}

/** Resolve o nome canônico de uma secretaria a partir de qualquer grafia registrada. */
export function resolveSecretariaNome(nome?: string | null): string | undefined {
  return findLocalizacaoPorNome(nome)?.nome;
}

/**
 * Compara duas secretarias ignorando acentuação, caixa, espaços extras e as
 * grafias legadas conocidas. Usado na checagem de permissão por secretaria.
 */
export function isSameSecretaria(a?: string | null, b?: string | null): boolean {
  const na = normalizeSecretariaNome(a);
  const nb = normalizeSecretariaNome(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * Verifica se um servidor pode operar nos bens de uma secretaria.
 * "Todas" concede acesso a qualquer secretaria (administradores e gerentes gerais).
 */
export function canOperarNaSecretaria(secretariaDoPerfil: string | null | undefined, secretariaAlvo: string | null | undefined): boolean {
  const perfil = normalizeSecretariaNome(secretariaDoPerfil);
  const alvo = normalizeSecretariaNome(secretariaAlvo);
  if (!perfil || !alvo) return false;
  if (perfil === normalizeSecretariaNome(SECRETARIA_TODAS)) return true;
  return perfil === alvo;
}
