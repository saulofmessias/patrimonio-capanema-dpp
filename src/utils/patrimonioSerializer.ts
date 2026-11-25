import { PatrimonioRecord, TransferenciaRecord, VistoriaRecord } from '../types/appsheet';

/**
 * Serializadores unicos dos documentos gravados no Firestore.
 *
 * Antes, o caminho online (App.tsx) e o caminho offline (offlineSyncManager)
 * montavam o payload cada um do seu jeito. O resultado eram bens gravados
 * offline com campos a menos (local, departamento, localizacaoExata) e que,
 * ao sincronizar, sobrescreviam o documento com um formato diferente do
 * esperado pelas consultas e pelo app.
 *
 * Agora os dois caminhos usam exatamente o mesmo serializador.
 */

export type FirestorePayload = Record<string, unknown>;

/** Remove campos que existem apenas no estado local do cliente. */
function semCamposLocais(record: Record<string, unknown>): Record<string, unknown> {
  const { isOfflinePending: _ignorado, ...resto } = record;
  return resto;
}

export function toFirestorePatrimonio(
  record: PatrimonioRecord,
  nowIso: string = record.atualizadoEm || new Date().toISOString()
): FirestorePayload {
  const base = semCamposLocais(record as unknown as Record<string, unknown>);
  return {
    id: base.id,
    etiquetaNumero: base.etiquetaNumero || base.numeroTombamento,
    numeroTombamento: base.numeroTombamento,
    descricao: base.descricao,
    categoria: base.categoria,
    secretariaSetor: base.secretariaSetor,
    local: base.local || base.localizacaoExata || 'Sede / Geral',
    localizacaoExata: base.localizacaoExata || base.local || '',
    departamento: base.departamento || 'Setor Geral',
    responsavel: base.responsavel,
    servidorDetentor: base.servidorDetentor || '',
    marcaModelo: base.marcaModelo || '',
    numeroSerie: base.numeroSerie || '',
    estadoConservacao: base.estadoConservacao,
    status: base.status,
    valorAquisicao: base.valorAquisicao,
    dataAquisicao: base.dataAquisicao || '',
    numeroNotaFiscal: base.numeroNotaFiscal || '',
    garantiaAte: base.garantiaAte || '',
    fotoBem: base.fotoBem || '',
    observacoes: base.observacoes || '',
    cadastradoPor: base.cadastradoPor,
    dataCadastro: base.dataCadastro || '',
    atualizadoEm: nowIso,
    ...(base.excluido
      ? {
          excluido: true,
          excluidoEm: base.excluidoEm || nowIso,
          excluidoPor: base.excluidoPor || '',
        }
      : {}),
  };
}

export function toFirestoreTransferencia(record: TransferenciaRecord): FirestorePayload {
  const base = semCamposLocais(record as unknown as Record<string, unknown>);
  return {
    id: base.id,
    patrimonioId: base.patrimonioId,
    patrimonioNumero: base.patrimonioNumero,
    patrimonioDescricao: base.patrimonioDescricao,
    dataTransferencia: base.dataTransferencia,
    secretariaOrigem: base.secretariaOrigem,
    secretariaDestino: base.secretariaDestino,
    responsavelOrigem: base.responsavelOrigem,
    novoResponsavel: base.novoResponsavel,
    motivo: base.motivo || '',
    autorizadoPor: base.autorizadoPor,
    termoGerado: base.termoGerado,
  };
}

export function toFirestoreVistoria(record: VistoriaRecord): FirestorePayload {
  const base = semCamposLocais(record as unknown as Record<string, unknown>);
  return {
    id: base.id,
    patrimonioId: base.patrimonioId,
    patrimonioNumero: base.patrimonioNumero,
    patrimonioDescricao: base.patrimonioDescricao,
    dataVistoria: base.dataVistoria,
    vistoriador: base.vistoriador,
    statusEncontrado: base.statusEncontrado,
    parecer: base.parecer || '',
    fotoVistoria: base.fotoVistoria || '',
  };
}

/** Serializador generico por tipo de registro da fila offline. */
export function toFirestorePayload(
  type: 'patrimonio' | 'transferencia' | 'vistoria',
  payload: Record<string, unknown>
): FirestorePayload {
  if (type === 'patrimonio') {
    return toFirestorePatrimonio(payload as unknown as PatrimonioRecord);
  }
  if (type === 'transferencia') {
    return toFirestoreTransferencia(payload as unknown as TransferenciaRecord);
  }
  return toFirestoreVistoria(payload as unknown as VistoriaRecord);
}
