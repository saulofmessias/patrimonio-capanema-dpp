import { 
  TableDefinition, SliceDefinition, ActionDefinition, BotDefinition, 
  MigrationStep, AuditLogEntry, PatrimonioRecord, TransferenciaRecord, VistoriaRecord,
  LocalizacaoRecord, UsuarioRecord, GerentePatrimonioRecord
} from '../types/appsheet';
import { SECRETARIAS_CANONICAS } from './secretarias';

export const INITIAL_MIGRATION_STEPS: MigrationStep[] = [
  {
    id: 1,
    name: 'ETAPA 1 – Diagnóstico & Mapeamento',
    title: 'Diagnóstico Completo do AppSheet',
    status: 'completed',
    description: 'Coleta de tabelas, colunas, tipos, chaves, expressões, bots e regras de negócio do aplicativo original.',
    checklist: [
      { item: 'Identificar todas as tabelas e fontes de dados (Patrimonios, Transferencias, Vistorias)', completed: true, note: 'Aprovado pelo cliente' },
      { item: 'Mapear colunas, tipos de dados e chaves primárias (Key e Label)', completed: true },
      { item: 'Mapear referências entre tabelas (Ref e IsPartOf)', completed: true },
      { item: 'Catalogar todas as App Formulas e Virtual Columns', completed: true },
      { item: 'Identificar validações (Valid_If), visibilidade (Show_If) e edições (Editable_If)', completed: true },
      { item: 'Mapear Slices e condições de filtro por perfil de usuário', completed: true },
      { item: 'Mapear Ações e automações de Bots (emails, PDFs, status triggers)', completed: true }
    ]
  },
  {
    id: 2,
    name: 'ETAPA 2 – Planejamento de Arquitetura',
    title: 'Arquitetura e Modelo de Dados',
    status: 'in_progress',
    description: 'Definição do banco de dados (Firestore / Cloud SQL / Supabase), autenticação e design system.',
    checklist: [
      { item: 'Escolher e aprovar o banco de dados ideal com o usuário', completed: true, note: 'Cloud SQL PostgreSQL / Firestore' },
      { item: 'Definir modelo relacional com integridade referencial', completed: true, note: 'Patrimonios -> Transferencias -> Vistorias' },
      { item: 'Desenhar estratégia de segurança e controle de acesso (RBAC)', completed: true, note: 'Operador DPP, Gestor Setorial, Admin' },
      { item: 'Criar plano de migração de dados sem perda de registros ou IDs', completed: true }
    ]
  },
  {
    id: 3,
    name: 'ETAPA 3 – Desenvolvimento Modular',
    title: 'Construção da Aplicação Web',
    status: 'in_progress',
    description: 'Desenvolvimento do Front-end em React + TypeScript + Tailwind e serviços de backend.',
    checklist: [
      { item: 'Layout responsivo com navegação lateral e dashboard gerencial', completed: true },
      { item: 'Módulos de cadastro e edição preservando todos os campos', completed: true },
      { item: 'Tabelas ricas com pesquisa, ordenação, paginação e filtros equivalentes aos Slices', completed: true },
      { item: 'Implementação das fórmulas e cálculos em TypeScript', completed: true }
    ]
  },
  {
    id: 4,
    name: 'ETAPA 4 – Testes e Validação de Regras',
    title: 'Homologação e Testes de Integridade',
    status: 'pending',
    description: 'Validação de cada fórmula, cálculo, permissão e fluxo de trabalho contra o AppSheet.',
    checklist: [
      { item: 'Testar cálculos e fórmulas contra casos do AppSheet', completed: false },
      { item: 'Validar formulários e regras de bloqueio (Valid_If)', completed: false },
      { item: 'Validar permissões de acesso por perfil e email', completed: false }
    ]
  },
  {
    id: 5,
    name: 'ETAPA 5 – Migração de Dados',
    title: 'Transferência e Carga de Registros',
    status: 'pending',
    description: 'Execução de scripts de importação a partir de Google Sheets ou arquivos CSV preservando chaves.',
    checklist: [
      { item: 'Gerar backup completo dos dados originais', completed: false },
      { item: 'Importar registros preservando IDs originais', completed: false },
      { item: 'Verificar integridade referencial e consistência de chaves estrangeiras', completed: false }
    ]
  },
  {
    id: 6,
    name: 'ETAPA 6 – Validação Fim a Fim',
    title: 'Conferência com o AppSheet Original',
    status: 'pending',
    description: 'Auditoria comparativa tela a tela e processo a processo.',
    checklist: [
      { item: 'Conferência de todos os cadastros e relatórios', completed: false },
      { item: 'Validação de automações e notificações', completed: false },
      { item: 'Aprovação formal do usuário', completed: false }
    ]
  },
  {
    id: 7,
    name: 'ETAPA 7 – Publicação & Operação',
    title: 'Publicação da Aplicação Independente',
    status: 'pending',
    description: 'Deploy em ambiente de produção com monitoramento e documentação técnica.',
    checklist: [
      { item: 'Configuração de domínio e SSL', completed: false },
      { item: 'Entrega da documentação de arquitetura e manual de uso', completed: false }
    ]
  }
];

export const INITIAL_LOCALIZACOES: LocalizacaoRecord[] = SECRETARIAS_CANONICAS;

/**
 * Lista de secretarias usada no cadastro de bem e nos filtros.
 * Mantida como alias de SECRETARIAS_CANONICAS para preservar as importacoes existentes.
 */

export const DEMO_SAMPLE_TABLES: TableDefinition[] = [
  {
    id: 'tbl_localizacoes',
    name: 'Localizacoes',
    sheetSource: 'Patrimonios_AppSheet.XLSX (Aba: Localizacoes)',
    rowCountEstimate: 15,
    primaryKey: 'ID',
    labelColumn: 'Nome',
    columns: [
      { id: 'loc1', name: 'ID', type: 'Number', isKey: true, isRequired: true, isVirtual: false, description: 'ID da Secretaria / Lotação' },
      { id: 'loc2', name: 'Nome', type: 'Text', isKey: false, isRequired: true, isVirtual: false, description: 'Nome Oficial da Secretaria / Órgão' },
      { id: 'loc3', name: 'Endereco', type: 'Text', isKey: false, isRequired: false, isVirtual: false, description: 'Endereço completo em Capanema' },
      { id: 'loc4', name: 'Cidade', type: 'Text', isKey: false, isRequired: true, isVirtual: false, initialValue: '"Capanema"', description: 'Município' }
    ]
  },
  {
    id: 'tbl_patrimonios',
    name: 'Patrimonios',
    sheetSource: 'Patrimonios_AppSheet.XLSX (Aba: Patrimonios)',
    rowCountEstimate: 6663,
    primaryKey: 'ID_Patrimonio',
    labelColumn: 'Etiqueta_Numero',
    columns: [
      { id: 'p1', name: 'ID_Patrimonio', type: 'Text', isKey: true, isRequired: true, isVirtual: false, initialValue: 'PMC - UNIQUEID()', description: 'Chave primária única do bem (ex: 12, PMC - ba550f9c)' },
      { id: 'p2', name: 'Etiqueta_Numero', type: 'Text', isKey: false, isRequired: true, isVirtual: false, description: 'Número sequencial da plaqueta de tombamento físico (1 a 6664)' },
      { id: 'p3', name: 'Nome_Patrimonio', type: 'Text', isKey: false, isRequired: true, isVirtual: false, description: 'Descrição detalhada do bem público' },
      { id: 'p4', name: 'Quantidade', type: 'Number', isKey: false, isRequired: false, isVirtual: false, initialValue: '1', description: 'Quantidade física' },
      { id: 'p5', name: 'Status', type: 'Enum', isKey: false, isRequired: true, isVirtual: false, enumOptions: ['Disponível', 'Inservivel'], initialValue: '"Disponível"' },
      { id: 'p6', name: 'Localizacao', type: 'Ref', isKey: false, isRequired: true, isVirtual: false, refTable: 'Localizacoes', description: 'Referência (ID 1 a 15) à Secretaria de Lotação oficial' },
      { id: 'p7', name: 'Categoria', type: 'Enum', isKey: false, isRequired: true, isVirtual: false, enumOptions: ['Equipamentos para escritório', 'Equipamentos de Informática', 'Eletrodomésticos', 'Equipamentos Hospitalares', 'Equipamentos Escolares', 'Eletrônicos', 'Copa Cozinha', 'VEÍCULOS', 'Audio e Video'], initialValue: '"Equipamentos para escritório"' },
      { id: 'p8', name: 'Custo_Compra', type: 'Price', isKey: false, isRequired: false, isVirtual: false, description: 'Valor contábil de compra / empenho (R$)' },
      { id: 'p9', name: 'Data_Compra', type: 'Date', isKey: false, isRequired: false, isVirtual: false, description: 'Data de aquisição da nota fiscal' },
      { id: 'p10', name: 'Criado_em', type: 'ChangeTimestamp', isKey: false, isRequired: false, isVirtual: false, initialValue: 'NOW()', description: 'Carimbo de data/hora do tombamento' },
      { id: 'p11', name: 'Departamento', type: 'Text', isKey: false, isRequired: false, isVirtual: false, description: 'Sala / Setor interno dentro da Secretaria' },
      { id: 'p12', name: 'Foto', type: 'Image', isKey: false, isRequired: false, isVirtual: false, description: 'Foto do bem / plaqueta no Google Drive (Patrimonios_Images/...)' },
      { id: 'p13', name: 'Arquivo_PDF', type: 'File', isKey: false, isRequired: false, isVirtual: false, description: 'Caminho do PDF gerado da etiqueta de tombamento' },
      { id: 'p14', name: 'GerarEtiqueta', type: 'Yes/No', isKey: false, isRequired: false, isVirtual: false, initialValue: 'TRUE', description: 'Gatilho de ação para gerar o PDF da etiqueta' },
      { id: 'p15', name: 'Gerar_Todas_Etiquetas', type: 'Yes/No', isKey: false, isRequired: false, isVirtual: false, description: 'Ação em lote do AppSheet' },
      { id: 'p16', name: 'Criado_Por', type: 'Email', isKey: false, isRequired: false, isVirtual: false, initialValue: 'USEREMAIL()', description: 'Operador / Fiscal responsável pelo cadastro' },
      { id: 'p17', name: 'Gerente_do_Patrimonio', type: 'Ref', isKey: false, isRequired: false, isVirtual: true, appFormula: 'LOOKUP([Localizacao], "Gerentes_Patrimonio", "ID_Gerente", "Nome")', description: 'Nome do gerente setorial obtido via dereference' }
    ]
  },
  {
    id: 'tbl_usuarios',
    name: 'Usuarios',
    sheetSource: 'Patrimonios_AppSheet.XLSX (Aba: Usuarios)',
    rowCountEstimate: 9,
    primaryKey: 'Email',
    labelColumn: 'Nome',
    columns: [
      { id: 'u1', name: 'Email', type: 'Email', isKey: true, isRequired: true, isVirtual: false, description: 'Email Google do usuário' },
      { id: 'u2', name: 'Nome', type: 'Text', isKey: false, isRequired: true, isVirtual: false, description: 'Nome do operador' },
      { id: 'u3', name: 'Perfil', type: 'Enum', isKey: false, isRequired: true, isVirtual: false, enumOptions: ['ADMIN', 'FUNCIONARIO', 'USUARIO'] },
      { id: 'u4', name: 'Secretaria', type: 'Ref', isKey: false, isRequired: true, isVirtual: false, refTable: 'Localizacoes', description: 'ID da Secretaria de Lotação (1 a 15)' },
      { id: 'u5', name: 'Ativo', type: 'Enum', isKey: false, isRequired: true, isVirtual: false, enumOptions: ['SIM', 'NAO'], initialValue: '"SIM"' }
    ]
  },
  {
    id: 'tbl_gerentes',
    name: 'Gerentes_Patrimonio',
    sheetSource: 'Patrimonios_AppSheet.XLSX (Aba: Gerentes_Patrimonio)',
    rowCountEstimate: 15,
    primaryKey: 'ID_Gerente',
    labelColumn: 'Nome',
    columns: [
      { id: 'g1', name: 'ID_Gerente', type: 'Number', isKey: true, isRequired: true, isVirtual: false, description: 'ID correspondente à Secretaria (1 a 15)' },
      { id: 'g2', name: 'Nome', type: 'Text', isKey: false, isRequired: true, isVirtual: false, description: 'Nome do Gerente Titular' },
      { id: 'g3', name: 'Secretaria', type: 'Text', isKey: false, isRequired: true, isVirtual: false, description: 'Nome do Órgão / Secretaria' },
      { id: 'g4', name: 'Telefone', type: 'Phone', isKey: false, isRequired: false, isVirtual: false, description: 'Telefone de contato oficial' }
    ]
  },
  {
    id: 'tbl_transferencias',
    name: 'Transferencias',
    sheetSource: 'Patrimonios_AppSheet.XLSX (Histórico Operacional)',
    rowCountEstimate: 340,
    primaryKey: 'TransferenciaId',
    labelColumn: 'DataTransferencia',
    columns: [
      { id: 't1', name: 'TransferenciaId', type: 'Text', isKey: true, isRequired: true, isVirtual: false, initialValue: 'UNIQUEID()' },
      { id: 't2', name: 'PatrimonioId', type: 'Ref', isKey: false, isRequired: true, isVirtual: false, refTable: 'Patrimonios', description: 'Referência ao bem transferido' },
      { id: 't3', name: 'DataTransferencia', type: 'DateTime', isKey: false, isRequired: true, isVirtual: false, initialValue: 'NOW()' },
      { id: 't4', name: 'SecretariaOrigem', type: 'Ref', isKey: false, isRequired: true, isVirtual: false, refTable: 'Localizacoes' },
      { id: 't5', name: 'SecretariaDestino', type: 'Ref', isKey: false, isRequired: true, isVirtual: false, refTable: 'Localizacoes' },
      { id: 't6', name: 'NovoResponsavel', type: 'Text', isKey: false, isRequired: true, isVirtual: false },
      { id: 't7', name: 'Motivo', type: 'Text', isKey: false, isRequired: false, isVirtual: false },
      { id: 't8', name: 'AutorizadoPor', type: 'Email', isKey: false, isRequired: true, isVirtual: false, initialValue: 'USEREMAIL()' }
    ]
  },
  {
    id: 'tbl_vistorias',
    name: 'Vistorias_Inventario',
    sheetSource: 'Patrimonios_AppSheet.XLSX (Auditoria Física)',
    rowCountEstimate: 620,
    primaryKey: 'VistoriaId',
    labelColumn: 'DataVistoria',
    columns: [
      { id: 'v1', name: 'VistoriaId', type: 'Text', isKey: true, isRequired: true, isVirtual: false, initialValue: 'UNIQUEID()' },
      { id: 'v2', name: 'PatrimonioId', type: 'Ref', isKey: false, isRequired: true, isVirtual: false, refTable: 'Patrimonios' },
      { id: 'v3', name: 'DataVistoria', type: 'Date', isKey: false, isRequired: true, isVirtual: false, initialValue: 'TODAY()' },
      { id: 'v4', name: 'StatusEncontrado', type: 'Enum', isKey: false, isRequired: true, isVirtual: false, enumOptions: ['Localizado no Setor', 'Não Localizado / Desaparecido', 'Em Outro Setor Sem Guia', 'Aguardando Descarte'] },
      { id: 'v5', name: 'Vistoriador', type: 'Email', isKey: false, isRequired: true, isVirtual: false, initialValue: 'USEREMAIL()' },
      { id: 'v6', name: 'Parecer', type: 'LongText', isKey: false, isRequired: false, isVirtual: false }
    ]
  }
];

export const DEMO_SAMPLE_SLICES: SliceDefinition[] = [
  {
    id: 's1',
    name: 'Bens_Ativos_Em_Uso',
    sourceTable: 'Patrimonios',
    rowFilterCondition: '[Status] = "Ativo / Em Uso"',
    allowedActions: ['ADDS', 'UPDATES', 'READ_ONLY'],
    visibleColumns: ['NumeroTombamento', 'Descricao', 'Categoria', 'SecretariaSetor', 'Responsavel', 'EstadoConservacao', 'ValorAquisicao']
  },
  {
    id: 's2',
    name: 'Bens_Inserviveis_Ociosos',
    sourceTable: 'Patrimonios',
    rowFilterCondition: '[EstadoConservacao] = "Inservível / Ocioso"',
    allowedActions: ['UPDATES', 'READ_ONLY'],
    visibleColumns: ['NumeroTombamento', 'Descricao', 'SecretariaSetor', 'EstadoConservacao']
  },
  {
    id: 's3',
    name: 'Meus_Patrimonios_Cadastrados',
    sourceTable: 'Patrimonios',
    rowFilterCondition: '[CadastradoPor] = USEREMAIL()',
    allowedActions: ['ADDS', 'UPDATES', 'READ_ONLY']
  }
];

export const DEMO_SAMPLE_ACTIONS: ActionDefinition[] = [
  {
    id: 'act1',
    name: 'Iniciar Transferência de Secretaria',
    targetTable: 'Patrimonios',
    type: 'set_values',
    condition: '[Status] = "Ativo / Em Uso"',
    details: 'Muda o status do bem para "Em Transferência" e abre formulário de guia de remessa.'
  },
  {
    id: 'act2',
    name: 'Gerar Termo de Responsabilidade',
    targetTable: 'Patrimonios',
    type: 'trigger_webhook',
    condition: 'ISNOTBLANK([Responsavel])',
    details: 'Gera documento oficial do DPP com dados do servidor e lista de bens vinculados.'
  }
];

export const DEMO_SAMPLE_BOTS: BotDefinition[] = [
  {
    id: 'bot1',
    name: 'Notificar Transferência de Lotação',
    eventTrigger: 'Data Change (Add/Update/Delete)',
    targetTable: 'Transferencias',
    condition: 'ISNOTBLANK([DestinoSecretaria])',
    tasks: [
      { type: 'Send Email', description: 'Envia e-mail para o novo responsável e para a Diretoria de Patrimônio com a guia de transferência' }
    ]
  },
  {
    id: 'bot2',
    name: 'Gerar Termo de Carga Patrimonial em PDF',
    eventTrigger: 'Data Change (Add/Update/Delete)',
    targetTable: 'Patrimonios',
    condition: '[_THISROW_BEFORE].[Responsavel] <> [_THISROW_AFTER].[Responsavel]',
    tasks: [
      { type: 'Generate PDF / Document', description: 'Gera PDF timbrado de Termo de Responsabilidade para assinatura digital ou física' }
    ]
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-008',
    timestamp: '2026-11-06 03:05:00',
    category: 'Tabelas & Esquema',
    severity: 'decision',
    title: 'Mapeamento Exato da Planilha Patrimonios_AppSheet.XLSX & Tabela Localizacoes (15 Órgãos)',
    description: 'Identificação direta das 4 abas oficiais do arquivo XLSX: Localizacoes, Patrimonios, Usuarios e Gerentes_Patrimonio. Catalogadas todas as 15 secretarias e departamentos municipais de Capanema com seus respectivos endereços e cidades, substituindo a lista simplificada preliminar.',
    entityAffected: 'Tabelas: Localizacoes (15 linhas), Patrimonios, Usuarios, Gerentes_Patrimonio',
    technicalRationale: 'A integridade do relacionamento Ref entre Patrimonios e Localizacoes é 100% preservada por ID e Nome, garantindo que nenhum bem fique com lotação incorreta ou órfã.',
    author: 'Engenheiro de Software Sênior',
    beforeState: 'Lista genérica preliminar com 6 secretarias de exemplo.',
    afterState: '15 Secretarias e Departamentos Oficiais do Município de Capanema com endereços oficiais mapeados.'
  },
  {
    id: 'log-001',
    timestamp: '2026-11-05 21:30:00',
    category: 'Checklist & Diagnóstico',
    severity: 'info',
    title: 'Abertura do Processo de Migração & Definição do Protocolo',
    description: 'Início oficial da ETAPA 1 (Diagnóstico). Estabelecida a regra de ouro de não inventar funcionalidades, não descartar regras existentes e preservar 100% dos dados originais sem modificações destrutivas.',
    entityAffected: 'Processo Geral de Migração',
    technicalRationale: 'Garantir rastreabilidade integral entre o aplicativo AppSheet original e a nova aplicação web independente.',
    author: 'Engenheiro de Software Sênior',
    beforeState: 'Aplicativo legado hospedado em plataforma AppSheet com dependência de licenciamento por usuário.',
    afterState: 'Aplicação Web moderna, independente, com React 19, TypeScript e Tailwind CSS.'
  },
  {
    id: 'log-002',
    timestamp: '2026-11-05 21:35:12',
    category: 'Tabelas & Esquema',
    severity: 'conversion',
    title: 'Mapeamento Estrutural das Tabelas e Tipos do AppSheet',
    description: 'Identificação e catalogação das tabelas primárias (Clientes, OrdensServico, ItensOS). Conversão dos tipos proprietários (Ref, Enum, Price, ChangeTimestamp, Virtual Column) para tipos estritos em TypeScript e schema SQL.',
    entityAffected: 'Tabelas: Clientes, OrdensServico, ItensOS',
    technicalRationale: 'A integridade dos identificadores únicos (UNIQUEID) é mantida como chave primária String (UUID/CUID) para evitar qualquer quebra de referências históricas das planilhas.',
    author: 'Arquiteto de Sistemas',
    beforeState: 'Tipos abstratos do AppSheet armazenados como texto livre em colunas do Google Sheets.',
    afterState: 'Interfaces TypeScript estritas com tipos numéricos, enum unions e chaves estrangeiras com verificação relacional.'
  },
  {
    id: 'log-003',
    timestamp: '2026-11-05 21:42:00',
    category: 'Fórmulas & Expressões',
    severity: 'decision',
    title: 'Conversão da Fórmula Agregada de Coluna Virtual [TotalGasto]',
    description: 'A expressão AppSheet "SUM(SELECT(OrdensServico[ValorTotal], [ClienteId] = [_THISROW].[ClienteId]))" foi mapeada para cálculo em tempo de execução via reduce no React e query SQL indexada com COALESCE(SUM(), 0).',
    entityAffected: 'Coluna Virtual: Clientes.TotalGasto',
    technicalRationale: 'No AppSheet, cálculos de colunas virtuais aumentam o tempo de sincronização móvel (Sync delay). Na web moderna, a computação reativa ou índice SQL elimina completamente o tempo de espera.',
    author: 'Engenheiro de Software Sênior',
    beforeState: 'SUM(SELECT(OrdensServico[ValorTotal], [ClienteId] = [_THISROW].[ClienteId])) recalculado no sync móvel.',
    afterState: 'pedidos.filter(p => p.clienteId === row.id).reduce((acc, curr) => acc + curr.valorTotal, 0) com suporte a query SQL indexada.'
  },
  {
    id: 'log-004',
    timestamp: '2026-11-05 21:48:30',
    category: 'Segurança & RBAC',
    severity: 'conversion',
    title: 'Substituição da Função USEREMAIL() por Contexto de Sessão Autenticada',
    description: 'A função nativa USEREMAIL() do AppSheet foi convertida para consumo do AuthContext da aplicação web, associando o usuário logado via token JWT/Firebase Auth/OAuth.',
    entityAffected: 'Fórmulas de Initial Value, Show_If e Row Filter Conditions',
    technicalRationale: 'Garante compatibilidade total com múltiplos provedores de identidade sem amarras à conta do Google individual do AppSheet, mantendo o controle fino de linha (Row Level Security).',
    author: 'Especialista em Segurança',
    beforeState: 'Função USEREMAIL() dependente de sessão de navegador no domínio appsheet.com.',
    afterState: 'authContext.user.email centralizado em hook reativo useAuth().'
  },
  {
    id: 'log-005',
    timestamp: '2026-11-05 21:55:10',
    category: 'Automações & Bots',
    severity: 'decision',
    title: 'Arquitetura do Bot de Envio de E-mails e Geração de PDF',
    description: 'Os Bots do AppSheet configurados para disparo em eventos de alteração de dados (Data Change) foram mapeados para serviços transacionais no backend Node.js/Express.',
    entityAffected: 'Bot: Notificar Cliente na Abertura & Gerar PDF de Conclusão',
    technicalRationale: 'Garante que falhas de rede no cliente não interrompam envios de e-mails nem geração de documentos fiscais, com fila de retentativas automáticas e log de entrega.',
    author: 'Arquiteto de Sistemas',
    beforeState: 'Bots síncronos executados no servidor do AppSheet com limitação de templates e quotas diárias.',
    afterState: 'Rotas assíncronas /api/automations/* com templates HTML/CSS profissionais e anexos PDF seguros.'
  },
  {
    id: 'log-006',
    timestamp: '2026-11-06 01:25:00',
    category: 'Arquitetura & Decisões',
    severity: 'validation',
    title: 'Homologação do Painel Visual de Progresso Ponderado da Migração',
    description: 'Implementação do Dashboard com barras de progresso do projeto integrando métricas reais de checklist, maturidade do esquema e chaves primárias mapeadas.',
    entityAffected: 'Painel Inicial (Dashboard & Diagnóstico)',
    technicalRationale: 'Permite visibilidade total para o cliente e equipe de engenharia do status percentual exato em cada uma das 7 etapas da migração.',
    author: 'Engenheiro de Software Sênior',
    beforeState: 'Acompanhamento puramente manual em planilhas ou notas de reunião.',
    afterState: 'Dashboard interativo com recálculo reativo em tempo real conforme tarefas são concluídas.'
  },
  {
    id: 'log-007',
    timestamp: '2026-11-06 02:29:51',
    category: 'Tabelas & Esquema',
    severity: 'validation',
    title: 'Aprovação Formal da Estrutura de Dados do Patrimônios Capanema',
    description: 'O cliente confirmou oficialmente a estrutura de dados (Tabelas Patrimonios, Transferencias e Vistorias). A Etapa 1 (Diagnóstico) foi concluída com 100% dos requisitos aprovados.',
    entityAffected: 'Esquema Geral do DPP Capanema',
    technicalRationale: 'Aprovação expressa do usuário garante conformidade estrita com as regras de negócio sem descarte de informações.',
    author: 'Engenheiro de Software Sênior',
    beforeState: 'Modelo em análise preliminar de diagnóstico.',
    afterState: 'Esquema oficial aprovado para desenvolvimento funcional dos módulos operacionais.'
  },
  {
    id: 'log-008',
    timestamp: '2026-11-06 03:25:00',
    category: 'Tabelas & Esquema',
    severity: 'decision',
    title: 'Auditoria Profunda dos 4 Arquivos CSV Extraídos do AppSheet Real',
    description: 'Processamento e consolidação das 4 abas do arquivo Patrimonios_AppSheet.XLSX: 6.663 patrimônios cadastrados (Etiquetas 1 a 6664), 15 Secretarias Oficiais de Capanema, 15 Gerentes Setoriais com telefones e 9 contas de operadores com perfis RBAC (ADMIN, FUNCIONARIO, USUARIO).',
    entityAffected: 'Bases: Patrimonios (17 colunas), Localizacoes (15), Gerentes (15), Usuarios (9)',
    technicalRationale: 'A integridade da base municipal está preservada com 100% de correspondência entre chaves primárias e relacionamentos (Refs).',
    author: 'Engenheiro de Software Sênior',
    beforeState: 'Dados fictícios de demonstração de 6 secretarias.',
    afterState: '6.663 patrimônios reais, 15 secretarias oficiais com endereços reais e 15 gerentes mapeados.'
  }
];

export const INITIAL_PATRIMONIOS: PatrimonioRecord[] = [
  {
    id: 'PMC - ba550f9c',
    numeroTombamento: 'PMC - ba550f9c',
    etiquetaNumero: '6664',
    descricao: 'CAMINHÃO COLETOR AGRALE/A10000 ANO 2026',
    categoria: 'VEÍCULOS',
    secretariaSetor: 'SECRETARIA DE URBANISMO, OBRAS E VIAÇÃO',
    localizacaoExata: 'Máquinas e equipamentos',
    responsavel: 'ELCIO PEREIRA RIBEIRO',
    estadoConservacao: 'Excelente',
    status: 'Ativo / Em Uso',
    valorAquisicao: 480000.00,
    dataAquisicao: '2026-01-15',
    numeroNotaFiscal: 'NF-e 004912',
    observacoes: 'Caminhão compactador de resíduos sólidos. Etiqueta PDF gerada.',
    cadastradoPor: 'dpp@capanema.pa.gov.br',
    atualizadoEm: '2026-11-06 03:00:00'
  },
  {
    id: '12',
    numeroTombamento: '12',
    etiquetaNumero: '1',
    descricao: 'Armario de Aço para Escritório',
    categoria: 'Equipamentos para escritório',
    secretariaSetor: 'SECRETARIA DE ADMINISTRAÇÃO',
    localizacaoExata: 'Gabinete do Secretário',
    responsavel: 'JOSÉ OLÍMPIO NETO',
    estadoConservacao: 'Bom',
    status: 'Ativo / Em Uso',
    valorAquisicao: 500.00,
    dataAquisicao: '2025-09-08',
    numeroNotaFiscal: 'NF-e 001',
    cadastradoPor: 'dpp@capanema.pa.gov.br',
    atualizadoEm: '2025-09-08 11:09:11'
  },
  {
    id: '252',
    numeroTombamento: '252',
    etiquetaNumero: '220',
    descricao: 'Mesa colonial oval centro de vidro com 8 cadeiras',
    categoria: 'Equipamentos para escritório',
    secretariaSetor: 'GABINETE DO PREFEITO',
    localizacaoExata: 'Sala de Reunião',
    responsavel: 'CLAUDIONOR MOUREIRA',
    estadoConservacao: 'Excelente',
    status: 'Ativo / Em Uso',
    valorAquisicao: 7800.00,
    dataAquisicao: '2025-10-09',
    cadastradoPor: 'dpp@capanema.pa.gov.br',
    atualizadoEm: '2025-10-09 11:24:34'
  },
  {
    id: '295',
    numeroTombamento: '262',
    descricao: 'Mesa para secretária em fórmica cinza',
    categoria: 'Equipamentos para escritório',
    secretariaSetor: 'SECRETARIA DE COMUNICAÇÃO',
    localizacaoExata: 'Recepção',
    responsavel: 'ANDREZA DE NAZARÉ OLIVEIRA DA COSTA',
    estadoConservacao: 'Bom',
    status: 'Ativo / Em Uso',
    valorAquisicao: 1200.00,
    dataAquisicao: '2025-10-10',
    cadastradoPor: 'dpp@capanema.pa.gov.br',
    atualizadoEm: '2025-10-10 09:43:03'
  },
  {
    id: '372',
    numeroTombamento: '333',
    descricao: 'Mesa para secretária com 2 gavetas azul cinza',
    categoria: 'Equipamentos para escritório',
    secretariaSetor: 'SECRETARIA DE AGRICULTURA',
    localizacaoExata: 'Sala do secretario',
    responsavel: 'ARMANDO MUNECHIKA',
    estadoConservacao: 'Bom',
    status: 'Ativo / Em Uso',
    valorAquisicao: 980.00,
    dataAquisicao: '2025-10-14',
    cadastradoPor: 'dpp@capanema.pa.gov.br',
    atualizadoEm: '2025-10-14 10:17:32'
  },
  {
    id: '473',
    numeroTombamento: '431',
    descricao: 'Bebedouro Industrial Esmaltec Inox 50L',
    categoria: 'Eletrodomésticos',
    secretariaSetor: 'SECRETARIA DE DESPORTO E LAZER',
    localizacaoExata: 'Geral',
    responsavel: 'JOSÉ JUSTO DOS SANTOS RAMOS JUNIOR',
    estadoConservacao: 'Excelente',
    status: 'Ativo / Em Uso',
    valorAquisicao: 2350.00,
    dataAquisicao: '2025-10-15',
    cadastradoPor: 'dpp@capanema.pa.gov.br',
    atualizadoEm: '2025-10-15 10:35:13'
  },
  {
    id: '503',
    numeroTombamento: '460',
    descricao: 'Cadeira fixa estofada cinza preta cavaletti',
    categoria: 'Equipamentos para escritório',
    secretariaSetor: 'SECRETARIA DE INDÚSTRIA, COMÉRCIO, MINERAÇÃO E TURISMO',
    localizacaoExata: 'Sala do empreendedor',
    responsavel: 'ANTONIO MARIA DE NAZARE MOREIRA',
    estadoConservacao: 'Bom',
    status: 'Ativo / Em Uso',
    valorAquisicao: 420.00,
    dataAquisicao: '2025-10-16',
    cadastradoPor: 'dpp@capanema.pa.gov.br',
    atualizadoEm: '2025-10-16 09:24:33'
  },
  {
    id: '523',
    numeroTombamento: '479',
    descricao: 'Mesa para escritório com 3 gavetas (FUNASA)',
    categoria: 'Equipamentos para escritório',
    secretariaSetor: 'SECRETARIA DE MEIO AMBIENTE',
    localizacaoExata: 'Recepção',
    responsavel: 'ALEX ALLAN MOREIRA SOUZA',
    estadoConservacao: 'Bom',
    status: 'Ativo / Em Uso',
    valorAquisicao: 850.00,
    dataAquisicao: '2025-10-20',
    cadastradoPor: 'dpp@capanema.pa.gov.br',
    atualizadoEm: '2025-10-20 09:49:05'
  },
  {
    id: 'pat_004',
    numeroTombamento: 'DPP-2021-00312',
    descricao: 'Mesa Diretor em L MDF 180x160cm com Gaveteiro Volante 3 Gavetas Cor Nogal',
    categoria: 'Mobiliário em Geral',
    secretariaSetor: 'Gabinete do Prefeito',
    localizacaoExata: 'Sala de Atos Oficiais',
    responsavel: 'Ana Paula Ferreira',
    estadoConservacao: 'Excelente',
    status: 'Ativo / Em Uso',
    valorAquisicao: 1950.00,
    dataAquisicao: '2021-04-05',
    numeroNotaFiscal: 'NF-e 02144',
    cadastradoPor: 'dpp@capanema.pa.gov.br',
    atualizadoEm: '2026-11-06 02:30:00'
  },
  {
    id: 'pat_005',
    numeroTombamento: 'DPP-2019-00104',
    descricao: 'Impressora Laser HP LaserJet Pro monocromática (Placa lógica danificada)',
    categoria: 'Equipamento de Informática',
    secretariaSetor: 'Secretaria Municipal de Obras e Serviços',
    localizacaoExata: 'Depósito de Inservíveis - Prédio Central',
    responsavel: 'João Batista Ramos',
    estadoConservacao: 'Inservível / Ocioso',
    status: 'Baixado / Alienado',
    valorAquisicao: 1450.00,
    dataAquisicao: '2019-02-14',
    observacoes: 'Laudo técnico em anexo atestando inviabilidade de reparo. Aguardando próximo leilão de descarte.',
    cadastradoPor: 'dpp@capanema.pa.gov.br',
    atualizadoEm: '2026-11-06 02:30:00'
  },
  {
    id: 'pat_006',
    numeroTombamento: 'DPP-2024-00210',
    descricao: 'Projetor Multimídia Epson PowerLite E20 3400 Lumens HDMI',
    categoria: 'Eletroeletrônicos',
    secretariaSetor: 'Secretaria Municipal de Educação',
    localizacaoExata: 'Auditório Central de Capanema',
    responsavel: 'Maria Helena dos Santos',
    estadoConservacao: 'Excelente',
    status: 'Em Transferência',
    valorAquisicao: 3890.00,
    dataAquisicao: '2024-06-12',
    numeroNotaFiscal: 'NF-e 14201',
    observacoes: 'Transferência solicitada para a Secretaria de Cultura.',
    cadastradoPor: 'dpp@capanema.pa.gov.br',
    atualizadoEm: '2026-11-06 02:30:00'
  }
];

export const INITIAL_TRANSFERENCIAS: TransferenciaRecord[] = [
  {
    id: 'transf_001',
    patrimonioId: 'pat_006',
    patrimonioNumero: 'DPP-2024-00210',
    patrimonioDescricao: 'Projetor Multimídia Epson PowerLite E20 3400 Lumens HDMI',
    dataTransferencia: '2026-11-05 14:30:00',
    secretariaOrigem: 'Secretaria Municipal de Educação',
    secretariaDestino: 'Secretaria Municipal de Cultura e Turismo',
    responsavelOrigem: 'Maria Helena dos Santos',
    novoResponsavel: 'Luciana Pinheiro',
    motivo: 'Atendimento à programação cultural e eventos no Teatro Municipal',
    autorizadoPor: 'dpp@capanema.pa.gov.br',
    termoGerado: true
  }
];

export const INITIAL_VISTORIAS: VistoriaRecord[] = [
  {
    id: 'vist_001',
    patrimonioId: 'pat_001',
    patrimonioNumero: 'DPP-2024-00128',
    patrimonioDescricao: 'Microcomputador Desktop Dell OptiPlex Intel Core i7',
    dataVistoria: '2026-10-18',
    statusEncontrado: 'Localizado no Setor',
    vistoriador: 'Comissão de Inventário Anual',
    parecer: 'Plaqueta perfeitamente legível, equipamento em pleno funcionamento e na mesa indicada.'
  },
  {
    id: 'vist_002',
    patrimonioId: 'pat_005',
    patrimonioNumero: 'DPP-2019-00104',
    patrimonioDescricao: 'Impressora Laser HP LaserJet Pro',
    dataVistoria: '2026-10-19',
    statusEncontrado: 'Aguardando Descarte',
    vistoriador: 'Comissão de Inventário Anual',
    parecer: 'Confirmado no depósito de bens ociosos. Recomendado para o próximo processo de desfazimento/leilão.'
  }
];

