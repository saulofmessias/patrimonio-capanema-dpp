export type AppSheetDataType =
  | 'Text'
  | 'LongText'
  | 'Number'
  | 'Decimal'
  | 'Price'
  | 'Percent'
  | 'Date'
  | 'Time'
  | 'DateTime'
  | 'Yes/No'
  | 'Ref'
  | 'Enum'
  | 'EnumList'
  | 'Image'
  | 'File'
  | 'LatLong'
  | 'Address'
  | 'Email'
  | 'Phone'
  | 'Url'
  | 'ChangeTimestamp'
  | 'Progress'
  | 'Signature';

export interface ColumnDefinition {
  id: string;
  name: string;
  type: AppSheetDataType;
  isKey: boolean;
  isRequired: boolean;
  isVirtual: boolean;
  refTable?: string;
  appFormula?: string;
  initialValue?: string;
  validIf?: string;
  showIf?: string;
  editableIf?: string;
  enumOptions?: string[];
  description?: string;
}

export interface TableDefinition {
  id: string;
  name: string;
  sheetSource?: string;
  rowCountEstimate?: number;
  columns: ColumnDefinition[];
  primaryKey: string;
  labelColumn: string;
}

export interface SliceDefinition {
  id: string;
  name: string;
  sourceTable: string;
  rowFilterCondition: string;
  allowedActions: ('ADDS' | 'UPDATES' | 'DELETES' | 'READ_ONLY')[];
  visibleColumns?: string[];
}

export interface ActionDefinition {
  id: string;
  name: string;
  targetTable: string;
  type: 'set_values' | 'navigate' | 'add_row_to_another_table' | 'trigger_webhook' | 'open_url';
  condition?: string;
  details: string;
}

export interface BotDefinition {
  id: string;
  name: string;
  eventTrigger: 'Data Change (Add/Update/Delete)' | 'Schedule (Cron)' | 'Webhook';
  targetTable: string;
  condition?: string;
  tasks: {
    type: 'Send Email' | 'Generate PDF / Document' | 'Run Webhook' | 'Change Status / Data';
    description: string;
  }[];
}

export interface ViewDefinition {
  id: string;
  name: string;
  type: 'deck' | 'table' | 'form' | 'detail' | 'dashboard' | 'chart' | 'gallery' | 'map' | 'calendar';
  sourceTableOrSlice: string;
  position: 'menu' | 'primary' | 'ref';
}

export interface MigrationStep {
  id: number;
  title: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  description: string;
  checklist: {
    item: string;
    completed: boolean;
    note?: string;
  }[];
}

export type AuditCategory = 
  | 'Tabelas & Esquema'
  | 'Fórmulas & Expressões'
  | 'Automações & Bots'
  | 'Arquitetura & Decisões'
  | 'Segurança & RBAC'
  | 'Checklist & Diagnóstico';

export type AuditSeverity = 'decision' | 'conversion' | 'validation' | 'warning' | 'info';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: AuditCategory;
  severity: AuditSeverity;
  title: string;
  description: string;
  entityAffected?: string;
  technicalRationale?: string;
  author: string;
  beforeState?: string;
  afterState?: string;
}

export interface PatrimonioRecord {
  id: string;
  numeroTombamento: string;
  etiquetaNumero?: string;
  descricao: string;
  categoria: string;
  secretariaSetor: string;
  local?: string;
  departamento?: string;
  localizacaoExata?: string;
  responsavel: string;
  servidorDetentor?: string;
  marcaModelo?: string;
  numeroSerie?: string;
  estadoConservacao: 'Excelente' | 'Bom' | 'Regular' | 'Ruim / Danificado' | 'Inservível / Ocioso';
  status: 'Ativo / Em Uso' | 'Em Transferência' | 'Em Manutenção' | 'Baixado / Alienado' | 'Cedido';
  valorAquisicao: number;
  dataAquisicao: string;
  numeroNotaFiscal?: string;
  garantiaAte?: string;
  fotoBem?: string;
  observacoes?: string;
  cadastradoPor: string;
  dataCadastro?: string;
  atualizadoEm: string;
  excluido?: boolean;
  excluidoEm?: string;
  excluidoPor?: string;
  isOfflinePending?: boolean;
}

export interface TransferenciaRecord {
  id: string;
  patrimonioId: string;
  patrimonioNumero: string;
  patrimonioDescricao: string;
  dataTransferencia: string;
  secretariaOrigem: string;
  secretariaDestino: string;
  responsavelOrigem: string;
  novoResponsavel: string;
  motivo?: string;
  autorizadoPor: string;
  termoGerado: boolean;
  isOfflinePending?: boolean;
}

export interface VistoriaRecord {
  id: string;
  patrimonioId: string;
  patrimonioNumero: string;
  patrimonioDescricao: string;
  dataVistoria: string;
  statusEncontrado: 'Localizado no Setor' | 'Não Localizado / Desaparecido' | 'Em Outro Setor Sem Guia' | 'Aguardando Descarte';
  vistoriador: string;
  parecer?: string;
  fotoVistoria?: string;
  isOfflinePending?: boolean;
}

export interface LocalizacaoRecord {
  id: number;
  nome: string;
  endereco: string;
  cidade: string;
  totalBensVinculados?: number;
}

export interface UsuarioRecord {
  id: string;
  nome: string;
  email: string;
  role: 'Administrador DPP' | 'Fiscal de Patrimônio' | 'Gerente Setorial' | 'Consulta';
  status: 'Ativo' | 'Inativo';
}

export interface GerentePatrimonioRecord {
  id: string;
  nome: string;
  email: string;
  localizacaoId: number;
  secretariaNome: string;
  cargo: string;
  telefone?: string;
}

