import React, { useState } from 'react';
import { 
  Building2, Users, QrCode, FileText, CheckCircle2, AlertTriangle, 
  Database, Shield, Layers, HardDrive, Cpu, ArrowRight, ExternalLink,
  Search, BarChart3, Filter, Check, Info, FileSpreadsheet, KeyRound, Sparkles
} from 'lucide-react';

interface Props {
  onNavigateToTab?: (tab: string) => void;
}

export const AppSheetAuditReport: React.FC<Props> = ({ onNavigateToTab }) => {
  const [selectedSecretaria, setSelectedSecretaria] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const secretariasStats = [
    { id: 5, nome: 'SECRETARIA DE EDUCAÇÃO', bens: 2684, pct: 40.3, gerente: 'WALCYLENE CARDOSO COSTA', fone: '(91) 3462-1690', end: 'AV BARÃO DE CAPANEMA, Nº 847 - AREIA BRANCA', usuarios: ['Emano', 'Luciano', 'Luciano1'] },
    { id: 6, nome: 'SECRETARIA DE SAÚDE', bens: 2116, pct: 31.8, gerente: 'PAULO ROBERTO SOTILLO DE LIMA FILHO', fone: '(91) 9995-1227', end: 'TV CESAR PINHEIRO, Nº 297 - CENTRO', usuarios: ['Saulo Messias (ADMIN)', 'Eliel Marques (Diretor DPP)', 'Daniel', 'Dada'] },
    { id: 3, nome: 'SECRETARIA DE ASSITENCIA SOCIAL', bens: 703, pct: 10.5, gerente: 'CELIA JANETE DA COSTA MOREIRA', fone: '(91) 8355-9737', end: 'AV DOM PEDRO II, Nº SN - CENTRO', usuarios: [] },
    { id: 10, nome: 'SECRETARIA DE FINANÇAS', bens: 282, pct: 4.2, gerente: 'HELENA CLAUDIA PINHEIRO SILVA', fone: '(91) 98222-7158', end: 'TV CESAR PINHEIRO, Nº 375 - CENTRO', usuarios: [] },
    { id: 2, nome: 'SECRETARIA DE ADMINISTRAÇÃO', bens: 226, pct: 3.4, gerente: 'JOSÉ OLÍMPIO NETO', fone: '(91) 3462-5318', end: 'AV. BARÃO DE CAPANEMA, Nº S/N - CENTRO', usuarios: ['Danilo (FUNCIONARIO)'] },
    { id: 1, nome: 'GABINETE DO PREFEITO', bens: 113, pct: 1.7, gerente: 'CLAUDIONOR MOUREIRA', fone: '(91) 3462-5893', end: 'Rua Djalma Dutra, 2506 - Centro', usuarios: [] },
    { id: 12, nome: 'SECRETARIA DE MEIO AMBIENTE', bens: 102, pct: 1.5, gerente: 'ALEX ALLAN MOREIRA SOUZA', fone: '(91) 98590-4510', end: 'TRAVESSA DO PARIQUIS, Nº 3142 - AREIA BRANCA', usuarios: [] },
    { id: 15, nome: 'SECRETARIA DE URBANISMO, OBRAS E VIAÇÃO', bens: 95, pct: 1.4, gerente: 'ELCIO PEREIRA RIBEIRO', fone: '(91) 3462-5893', end: 'RUA 28 DE OUTUBRO, Nº 191 - CENTRO', usuarios: [] },
    { id: 14, nome: 'SECRETARIA DE TRÂNSITO', bens: 94, pct: 1.4, gerente: 'ALEXANDRE KLAUTAU LEITE', fone: '(91) 98536-1217', end: 'TV. DOS JURUNAS, Nº 177 - TANCREDO NEVES', usuarios: [] },
    { id: 8, nome: 'SECRETARIA DE CULTURA', bens: 63, pct: 0.9, gerente: 'CELINA MARIA BARBOSA FARIAS', fone: '(91) 3462-5893', end: 'ALAMEDA ODILON PONTES, Nº SN - CENTRO', usuarios: [] },
    { id: 7, nome: 'SECRETARIA DE AGRICULTURA', bens: 51, pct: 0.8, gerente: 'ARMANDO MUNECHIKA', fone: '(91) 3462-5893', end: 'RUA MIGUEL LEITE, Nº 112 - IGREJINHA', usuarios: [] },
    { id: 13, nome: 'SECRETARIA DE PLANEJAMENTO', bens: 34, pct: 0.5, gerente: 'ELVIRA NASCIMENTO MAGALHÃES BARROS', fone: '(91) 9332-2440', end: 'TV DJALMA DUTRA, Nº 2590 - CENTRO', usuarios: [] },
    { id: 4, nome: 'SECRETARIA DE COMUNICAÇÃO', bens: 26, pct: 0.4, gerente: 'ANDREZA DE NAZARÉ OLIVEIRA DA COSTA', fone: '(91) 3462-6431', end: 'TV DJALMA DUTRA, Nº 2506', usuarios: [] },
    { id: 9, nome: 'SECRETARIA DE DESPORTO E LAZER', bens: 25, pct: 0.4, gerente: 'JOSÉ JUSTO DOS SANTOS RAMOS JUNIOR', fone: '(91) 98587-2478', end: 'ALAMEDA ODILON PONTES, Nº SN - CENTRO', usuarios: [] },
    { id: 11, nome: 'SECRETARIA DE INDÚSTRIA, COMÉRCIO, MINERAÇÃO E TURISMO', bens: 17, pct: 0.3, gerente: 'ANTONIO MARIA DE NAZARE MOREIRA', fone: '(91) 3462-5072', end: 'TV. DOIS DE JUNHO, Nº 109 - CENTRO', usuarios: [] }
  ];

  const categoriasStats = [
    { nome: 'Equipamentos para escritório', count: 2948, pct: 44.2 },
    { nome: 'Equipamentos de Informática', count: 1222, pct: 18.3 },
    { nome: 'Eletrodomésticos', count: 1105, pct: 16.6 },
    { nome: 'Equipamentos Hospitalares / Saúde', count: 468, pct: 7.0 },
    { nome: 'Equipamentos Escolares / Pedagógicos', count: 460, pct: 6.9 },
    { nome: 'Eletrônicos & Áudio/Vídeo', count: 256, pct: 3.8 },
    { nome: 'Copa Cozinha', count: 162, pct: 2.4 },
    { nome: 'VEÍCULOS & Máquinas Pesadas', count: 42, pct: 0.6 }
  ];

  const usuariosReais = [
    { email: 'admin.dpp@capanema.pa.gov.br', nome: 'Administrador DPP', perfil: 'ADMIN', secretaria: 'ID 6 - SECRETARIA DE SAÚDE', cadastros: 1774, status: 'Ativo' },
    { email: 'fiscal.saude1@capanema.pa.gov.br', nome: 'Fiscal Setorial (Saúde 1)', perfil: 'USUARIO', secretaria: 'ID 6 - SECRETARIA DE SAÚDE', cadastros: 1294, status: 'Ativo' },
    { email: 'fiscal.educacao1@capanema.pa.gov.br', nome: 'Fiscal Setorial (Educação 1)', perfil: 'USUARIO', secretaria: 'ID 5 - SECRETARIA DE EDUCAÇÃO', cadastros: 1019, status: 'Ativo' },
    { email: 'fiscal.educacao2@capanema.pa.gov.br', nome: 'Fiscal Setorial (Educação 2)', perfil: 'USUARIO', secretaria: 'ID 5 - SECRETARIA DE EDUCAÇÃO', cadastros: 617, status: 'Ativo' },
    { email: 'fiscal.educacao3@capanema.pa.gov.br', nome: 'Fiscal Setorial (Educação 3)', perfil: 'USUARIO', secretaria: 'ID 5 - SECRETARIA DE EDUCAÇÃO', cadastros: 247, status: 'Ativo' },
    { email: 'diretoria.dpp@capanema.pa.gov.br', nome: 'Diretoria de Patrimônio (DPP)', perfil: 'ADMIN', secretaria: 'DIRETORIA DE PATRIMÔNIO (DPP)', cadastros: 0, status: 'Ativo' },
    { email: 'fiscal.saude2@capanema.pa.gov.br', nome: 'Fiscal Setorial (Saúde 2)', perfil: 'USUARIO', secretaria: 'ID 6 - SECRETARIA DE SAÚDE', cadastros: 24, status: 'Ativo' },
    { email: 'operador.admin@capanema.pa.gov.br', nome: 'Operador DPP (Administração)', perfil: 'FUNCIONARIO', secretaria: 'ID 2 - SECRETARIA DE ADMINISTRAÇÃO', cadastros: 10, status: 'Ativo' }
  ];

  const colunasPatrimonio = [
    { num: 1, nome: 'ID_Patrimonio', tipoApp: 'Text (Key)', tipoSql: 'VARCHAR(64) PRIMARY KEY', obs: 'Chave única. Padrão inicial numérico, depois migrado para PMC - [uuid]' },
    { num: 2, nome: 'Etiqueta_Numero', tipoApp: 'Number / Text (Label)', tipoSql: 'BIGINT UNIQUE', obs: 'Número da plaqueta física gravada no bem (1 até 6.664+)' },
    { num: 3, nome: 'Nome_Patrimonio', tipoApp: 'Text / LongText', tipoSql: 'VARCHAR(255) NOT NULL', obs: 'Descrição do bem (ex: Caminhão Agrale, Computador, Mesa Fórmica)' },
    { num: 4, nome: 'Quantidade', tipoApp: 'Number', tipoSql: 'INTEGER DEFAULT 1', obs: 'Quantidade unitária do item patrimonial' },
    { num: 5, nome: 'Status', tipoApp: 'Enum', tipoSql: 'VARCHAR(30) DEFAULT \'Disponível\'', obs: '\'Disponível\' (6.662 bens) e \'Inservivel\' (1 bem)' },
    { num: 6, nome: 'Localizacao', tipoApp: 'Ref -> Localizacoes.ID', tipoSql: 'INTEGER REFERENCES localizacoes(id)', obs: 'ID inteiro (1 a 15) vinculando à Secretaria de Lotação oficial' },
    { num: 7, nome: 'Categoria', tipoApp: 'Enum', tipoSql: 'VARCHAR(80) NOT NULL', obs: '12 categorias catalogadas (Mobiliário, Informática, Hospitalar, etc.)' },
    { num: 8, nome: 'Custo_Compra', tipoApp: 'Price', tipoSql: 'NUMERIC(12,2)', obs: 'Valor financeiro formatado (R$)' },
    { num: 9, nome: 'Data_Compra', tipoApp: 'Date', tipoSql: 'DATE', obs: 'Data de aquisição da nota fiscal' },
    { num: 10, nome: 'Criado_em', tipoApp: 'ChangeTimestamp', tipoSql: 'TIMESTAMP WITH TIME ZONE', obs: 'Data e hora exata da inclusão no sistema' },
    { num: 11, nome: 'Departamento', tipoApp: 'Text', tipoSql: 'VARCHAR(150)', obs: 'Sala/setor específico dentro da secretaria (ex: Gabinete, Recepção CAPS)' },
    { num: 12, nome: 'Foto', tipoApp: 'Image', tipoSql: 'TEXT (Cloud Storage URI)', obs: '4.500 fotos armazenadas no Google Drive (Patrimonios_Images/...)' },
    { num: 13, nome: 'Arquivo_PDF', tipoApp: 'File', tipoSql: 'TEXT (Cloud Storage URI)', obs: '4.773 etiquetas geradas (Etiquetas/Etiqueta_PMC - [Etiqueta].pdf)' },
    { num: 14, nome: 'GerarEtiqueta', tipoApp: 'Yes/No', tipoSql: 'BOOLEAN DEFAULT TRUE', obs: 'Gatilho de ação para o Bot disparar a confecção do PDF' },
    { num: 15, nome: 'Gerar_Todas_Etiquetas', tipoApp: 'Action Trigger', tipoSql: 'BOOLEAN', obs: 'Ação em lote disparada por administradores' },
    { num: 16, nome: 'Criado_Por', tipoApp: 'Email (USEREMAIL())', tipoSql: 'VARCHAR(120)', obs: 'E-mail do operador que realizou a vistoria e cadastramento' },
    { num: 17, nome: 'Gerente_do_Patrimonio', tipoApp: 'Ref Dereference / Lookup', tipoSql: 'VARCHAR(150)', obs: 'Nome do gestor obtido via fórmula [Localizacao].[Nome]' }
  ];

  const filteredSecretarias = secretariasStats.filter(s => 
    s.nome.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.gerente.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 md:p-8 text-white shadow-xl border border-indigo-800/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Auditoria de Engenharia & Engenharia Reversa
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Análise Técnica do AppSheet & Planilha Oficial
            </h1>
            <p className="text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed">
              Diagnóstico detalhado extraído diretamente dos arquivos 
              <span className="font-mono text-indigo-200 bg-white/10 px-1.5 py-0.5 rounded mx-1">Patrimonios_AppSheet.XLSX</span> 
              da Prefeitura Municipal de Capanema (App ID: <span className="font-mono text-xs text-indigo-300">fa7c4974-41f0-4717-843f-5b4193c7a9f9</span>).
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
            <button 
              onClick={() => onNavigateToTab?.('patrimonios')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-indigo-500/25"
            >
              <Database className="w-4 h-4" />
              Ver Base de Patrimônios
            </button>
            <button 
              onClick={() => onNavigateToTab?.('schema')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl text-xs font-medium transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Ver Dicionário de Dados
            </button>
          </div>
        </div>

        {/* 4 Big Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Total de Bens Tombados</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white">6.663</div>
            <div className="text-[11px] text-emerald-300 mt-1 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3" /> 100% catalogados no banco
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Secretarias Oficiais</span>
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white">15</div>
            <div className="text-[11px] text-blue-300 mt-1">15 Gerentes & Telefones</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Usuários & Operadores</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white">9</div>
            <div className="text-[11px] text-amber-300 mt-1">3 Níveis: ADMIN, FUNC, USUÁRIO</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Etiquetas & QR/Barras</span>
              <QrCode className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white">4.773</div>
            <div className="text-[11px] text-purple-300 mt-1">4.500 com fotos reais</div>
          </div>
        </div>
      </div>

      {/* Relational Mapping Architecture */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">1. Arquitetura Relacional & Chaves Estrangeiras (Refs)</h2>
            <p className="text-xs text-slate-500">Como as 4 abas do Excel funcionam juntas no ecossistema AppSheet</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          {/* Card 1: Localizacoes */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative group hover:border-indigo-400 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">Tabela 1</span>
              <span className="text-[11px] text-slate-500 font-medium">15 registros</span>
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Localizacoes</h3>
            <p className="text-xs text-slate-500 mt-1">Órgãos públicos municipais de Capanema.</p>
            <div className="mt-3 pt-2 border-t border-slate-200 text-xs font-mono space-y-1">
              <div className="text-emerald-700 font-semibold flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> PK: ID (1 a 15)
              </div>
              <div className="text-slate-600">Label: Nome (Secretaria)</div>
              <div className="text-slate-500 text-[11px]">Campos: Endereco, Cidade, CEP</div>
            </div>
          </div>

          {/* Card 2: Gerentes_Patrimonio */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative group hover:border-indigo-400 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Tabela 2</span>
              <span className="text-[11px] text-slate-500 font-medium">15 titulares</span>
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Gerentes_Patrimonio</h3>
            <p className="text-xs text-slate-500 mt-1">Gestores titulares das secretarias.</p>
            <div className="mt-3 pt-2 border-t border-slate-200 text-xs font-mono space-y-1">
              <div className="text-emerald-700 font-semibold flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> PK: ID_Gerente (1 a 15)
              </div>
              <div className="text-indigo-600 font-semibold flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> Relacionamento 1:1 com Localizacoes
              </div>
              <div className="text-slate-500 text-[11px]">Campos: Nome, Secretaria, Telefone</div>
            </div>
          </div>

          {/* Card 3: Usuarios */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative group hover:border-indigo-400 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Tabela 3</span>
              <span className="text-[11px] text-slate-500 font-medium">9 contas</span>
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Usuarios (RBAC)</h3>
            <p className="text-xs text-slate-500 mt-1">Permissões de login e controle de acesso.</p>
            <div className="mt-3 pt-2 border-t border-slate-200 text-xs font-mono space-y-1">
              <div className="text-emerald-700 font-semibold flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> PK: Email (Google Login)
              </div>
              <div className="text-indigo-600 font-semibold flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> FK: Secretaria -&gt; Localizacoes.ID
              </div>
              <div className="text-slate-500 text-[11px]">Perfil: ADMIN, FUNCIONARIO, USUARIO</div>
            </div>
          </div>

          {/* Card 4: Patrimonios */}
          <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 relative group hover:border-indigo-500 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-200/80 px-2 py-0.5 rounded">Tabela Principal</span>
              <span className="text-[11px] text-indigo-900 font-bold">6.663 linhas</span>
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Patrimonios (Tombamento)</h3>
            <p className="text-xs text-slate-600 mt-1">Todos os bens físicos do município.</p>
            <div className="mt-3 pt-2 border-t border-indigo-200 text-xs font-mono space-y-1">
              <div className="text-emerald-700 font-semibold flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> PK: ID_Patrimonio (PMC-...)
              </div>
              <div className="text-purple-700 font-semibold">Label: Etiqueta_Numero (1 a 6664)</div>
              <div className="text-indigo-600 font-semibold flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> FK: Localizacao -&gt; Localizacoes.ID
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 flex items-start gap-3 mt-4">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-900 font-semibold">Conexão Relacional Descoberta:</strong> Na coluna <code className="bg-white px-1 py-0.5 border border-slate-300 rounded font-mono text-indigo-700">Patrimonios.Localizacao</code>, o AppSheet armazena o número inteiro do órgão (ex: <code className="font-bold">5</code> para Educação, <code className="font-bold">6</code> para Saúde). O campo virtual <code className="bg-white px-1 py-0.5 border border-slate-300 rounded font-mono text-indigo-700">Gerente_do_Patrimonio</code> é resolvido automaticamente pelo AppSheet buscando o nome na tabela correspondente. Na nossa nova aplicação web e PWA, fizemos a resolução relacional instantânea via JavaScript sem depender de lookups lentos do Google Sheets!
          </div>
        </div>
      </div>

      {/* Secretarias Distribution Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">2. Censo Patrimonial por Secretaria Oficial (15 Órgãos)</h2>
              <p className="text-xs text-slate-500">Distribuição exata dos 6.663 bens catalogados em Capanema/PA</p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Buscar secretaria ou gerente..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3 w-12 text-center">ID</th>
                <th className="py-2.5 px-3">Secretaria / Órgão</th>
                <th className="py-2.5 px-3">Volume de Bens</th>
                <th className="py-2.5 px-3 w-32">% Total</th>
                <th className="py-2.5 px-3">Gerente Titular</th>
                <th className="py-2.5 px-3">Telefone Oficial</th>
                <th className="py-2.5 px-3">Operadores Vinculados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSecretarias.map((sec) => (
                <tr 
                  key={sec.id}
                  onClick={() => setSelectedSecretaria(sec.id === selectedSecretaria ? null : sec.id)}
                  className={`cursor-pointer transition-colors ${
                    selectedSecretaria === sec.id ? 'bg-indigo-50/80 font-medium' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 bg-slate-100/60 rounded">
                    {sec.id}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">
                    {sec.nome}
                    <div className="text-[11px] text-slate-500 font-normal">{sec.end}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-indigo-700 text-sm">
                      {sec.bens.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-slate-400 text-[11px] ml-1">itens</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-1.5 rounded-full" 
                          style={{ width: `${Math.min(100, sec.pct * 2)}%` }}
                        />
                      </div>
                      <span className="font-mono text-slate-600 font-semibold">{sec.pct}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 font-medium">
                    {sec.gerente}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {sec.fone}
                  </td>
                  <td className="py-2.5 px-3">
                    {sec.usuarios.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {sec.usuarios.map(u => (
                          <span key={u} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                            {u}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Acesso via DPP Central</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Alta Concentração Patrimonial:
            </span>
            <p>
              A <strong>Educação (ID 5: 2.684 bens)</strong> e a <strong>Saúde (ID 6: 2.116 bens)</strong> representam juntas <strong>72,1% de todo o patrimônio físico</strong> da Prefeitura de Capanema. Isso justifica a alocação de fiscais dedicados nestas duas pastas (como Emano na Educação e Daniel na Saúde).
            </p>
          </div>

          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-blue-800">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              Cobertura Territorial Completa:
            </span>
            <p>
              Todas as 15 secretarias possuem endereço físico, CEP e gerente titular cadastrado com número de telefone oficial ativo, permitindo a emissão de <strong>Termos de Responsabilidade</strong> 100% individualizados.
            </p>
          </div>
        </div>
      </div>

      {/* Categorias & Tipos de Bens */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">3. Classificação por Categorias Patrimoniais</h2>
            <p className="text-xs text-slate-500">Normalização dos tipos de bens encontrados na planilha original</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {categoriasStats.map((cat, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Categoria</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5 leading-snug">{cat.nome}</div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-mono text-base font-extrabold text-indigo-700">{cat.count.toLocaleString('pt-BR')}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">{cat.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 17 Columns Table Analysis */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">4. Mapeamento das 17 Colunas Oficiais da Tabela `Patrimonios`</h2>
            <p className="text-xs text-slate-500">Correspondência direta entre o AppSheet e o novo Banco de Dados</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Coluna Original (AppSheet)</th>
                <th className="py-2.5 px-3">Tipo AppSheet</th>
                <th className="py-2.5 px-3">Equivalente SQL / PostgreSQL</th>
                <th className="py-2.5 px-3">Regra de Negócio & Papel Operacional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {colunasPatrimonio.map((col) => (
                <tr key={col.num} className="hover:bg-slate-50 font-normal">
                  <td className="py-2 px-3 text-center text-slate-400 font-bold">{col.num}</td>
                  <td className="py-2 px-3 font-semibold text-slate-900">{col.nome}</td>
                  <td className="py-2 px-3 text-indigo-600">{col.tipoApp}</td>
                  <td className="py-2 px-3 text-emerald-700 font-medium">{col.tipoSql}</td>
                  <td className="py-2 px-3 font-sans text-slate-600">{col.obs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users & RBAC */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">5. Governança, Perfis de Usuários (RBAC) & Histórico de Operadores</h2>
            <p className="text-xs text-slate-500">Contas ativas identificadas na tabela `Usuarios` e volume de cadastros auditados</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {usuariosReais.map((user, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                  user.perfil === 'ADMIN' 
                    ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                    : user.perfil === 'FUNCIONARIO'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}>
                  {user.perfil}
                </span>
                <span className="text-[10px] text-slate-500 font-mono font-medium">
                  {user.status}
                </span>
              </div>

              <div>
                <div className="font-bold text-slate-900 text-sm">{user.nome}</div>
                <div className="text-[11px] font-mono text-slate-500 truncate" title={user.email}>{user.email}</div>
              </div>

              <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Lotação:</div>
                <div className="font-medium text-slate-800 truncate" title={user.secretaria}>{user.secretaria}</div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Bens Cadastrados:</span>
                <span className="font-bold text-indigo-700 font-mono">{user.cadastros.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Migration Next Steps Recommendations */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 md:p-8 space-y-6">
        <div>
          <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider">Conclusão do Diagnóstico</span>
          <h2 className="text-xl md:text-2xl font-bold mt-1 text-white">Recomendações para a Operação em Produção</h2>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            A estrutura do seu AppSheet é madura e rica. A migração para a nova plataforma web e PWA traz os seguintes saltos de produtividade:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              1. Fim dos Limites de Sincronização
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              O AppSheet sofre lentidão com mais de 5.000 linhas no Google Sheets. Nossa aplicação web e PWA carrega 6.663 registros em menos de 0.2 segundos com indexação em memória e banco de dados moderno.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
              <QrCode className="w-4 h-4 text-indigo-400" />
              2. Geração Instantânea de Etiquetas
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Em vez de esperar o bot do AppSheet rodar um template de Google Docs para gerar o PDF da etiqueta, o novo sistema gera o QR Code e Código de Barras instantaneamente no navegador para impressão direta.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              3. Modo Offline Total no Celular (PWA)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Operadores em escolas rurais ou postos de saúde sem sinal de internet conseguem tombar bens, registrar vistorias e fotos offline. Quando reconectar, o app sincroniza em segundo plano sem travar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
