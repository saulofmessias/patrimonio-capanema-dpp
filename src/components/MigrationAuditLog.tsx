import React, { useState } from 'react';
import { AuditLogEntry, AuditCategory, AuditSeverity } from '../types/appsheet';
import { 
  History, Search, Filter, Plus, Download, ShieldCheck, 
  CheckCircle2, AlertTriangle, ArrowRight, Code2, Database, 
  Bot, Calculator, Calendar, User, FileText, Sparkles, Tag,
  Clock, Check
} from 'lucide-react';

interface Props {
  logs: AuditLogEntry[];
  onAddLog: (entry: AuditLogEntry) => void;
}

export const MigrationAuditLog: React.FC<Props> = ({ logs, onAddLog }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New log form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<AuditCategory>('Tabelas & Esquema');
  const [newSeverity, setNewSeverity] = useState<AuditSeverity>('decision');
  const [newEntity, setNewEntity] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRationale, setNewRationale] = useState('');
  const [newAuthor, setNewAuthor] = useState('Engenheiro de Software Sênior');
  const [newBeforeState, setNewBeforeState] = useState('');
  const [newAfterState, setNewAfterState] = useState('');

  const categories: (string | AuditCategory)[] = [
    'Todas',
    'Tabelas & Esquema',
    'Fórmulas & Expressões',
    'Automações & Bots',
    'Arquitetura & Decisões',
    'Segurança & RBAC',
    'Checklist & Diagnóstico',
  ];

  const severities = [
    { id: 'Todas', label: 'Todas Severidades' },
    { id: 'decision', label: 'Decisão Arquitetural' },
    { id: 'conversion', label: 'Conversão de Regra' },
    { id: 'validation', label: 'Validação / Homologação' },
    { id: 'warning', label: 'Ponto de Atenção' },
    { id: 'info', label: 'Registro Informativo' },
  ];

  // Filtering
  const filteredLogs = logs.filter(log => {
    const matchCat = selectedCategory === 'Todas' || log.category === selectedCategory;
    const matchSev = selectedSeverity === 'Todas' || log.severity === selectedSeverity;
    const q = searchQuery.toLowerCase();
    const matchSearch = !searchQuery || 
      log.title.toLowerCase().includes(q) ||
      log.description.toLowerCase().includes(q) ||
      (log.entityAffected && log.entityAffected.toLowerCase().includes(q)) ||
      (log.technicalRationale && log.technicalRationale.toLowerCase().includes(q)) ||
      log.author.toLowerCase().includes(q);

    return matchCat && matchSev && matchSearch;
  });

  const handleCreateLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    const newEntry: AuditLogEntry = {
      id: `log-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      title: newTitle.trim(),
      category: newCategory,
      severity: newSeverity,
      entityAffected: newEntity.trim() || undefined,
      description: newDescription.trim(),
      technicalRationale: newRationale.trim() || undefined,
      author: newAuthor.trim() || 'Engenheiro Sênior',
      beforeState: newBeforeState.trim() || undefined,
      afterState: newAfterState.trim() || undefined,
    };

    onAddLog(newEntry);
    setShowAddModal(false);

    // Reset form
    setNewTitle('');
    setNewEntity('');
    setNewDescription('');
    setNewRationale('');
    setNewBeforeState('');
    setNewAfterState('');
  };

  const getSeverityBadge = (sev: AuditSeverity) => {
    switch (sev) {
      case 'decision':
        return {
          bg: 'bg-purple-100 text-purple-800 border-purple-200',
          label: 'Decisão Técnica',
          icon: ShieldCheck,
        };
      case 'conversion':
        return {
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
          label: 'Conversão De-Para',
          icon: Code2,
        };
      case 'validation':
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          label: 'Homologação',
          icon: CheckCircle2,
        };
      case 'warning':
        return {
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
          label: 'Atenção / Impacto',
          icon: AlertTriangle,
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          label: 'Registro Geral',
          icon: FileText,
        };
    }
  };

  const getCategoryIcon = (cat: AuditCategory) => {
    switch (cat) {
      case 'Tabelas & Esquema':
        return <Database className="w-4 h-4 text-emerald-600" />;
      case 'Fórmulas & Expressões':
        return <Calculator className="w-4 h-4 text-purple-600" />;
      case 'Automações & Bots':
        return <Bot className="w-4 h-4 text-indigo-600" />;
      case 'Segurança & RBAC':
        return <ShieldCheck className="w-4 h-4 text-amber-600" />;
      default:
        return <History className="w-4 h-4 text-blue-600" />;
    }
  };

  const handleExportMarkdown = () => {
    const md = `# RELATÓRIO OFICIAL DE AUDITORIA DE MIGRAÇÃO
Gerado em: ${new Date().toLocaleString('pt-BR')}
Total de Decisões e Registros: ${logs.length}

---

${logs.map((l, idx) => `
### ${idx + 1}. [${l.timestamp}] ${l.title}
- **Categoria:** ${l.category}
- **Severidade / Tipo:** ${l.severity.toUpperCase()}
- **Responsável:** ${l.author}
${l.entityAffected ? `- **Entidade Afetada:** ${l.entityAffected}` : ''}
- **Descrição da Decisão:**
  ${l.description}
${l.technicalRationale ? `- **Justificativa Técnica:**\n  ${l.technicalRationale}` : ''}
${l.beforeState ? `- **Estado Anterior (AppSheet):**\n  \`\`\`\n  ${l.beforeState}\n  \`\`\`` : ''}
${l.afterState ? `- **Estado Novo (Aplicação Web):**\n  \`\`\`\n  ${l.afterState}\n  \`\`\`` : ''}
`).join('\n---\n')}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-migracao-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Auditoria & Histórico Cronológico de Migração
                </h3>
                <p className="text-xs text-slate-500">
                  Rastreabilidade completa de cada alteração de esquema, conversão de fórmula e decisão técnica tomada.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Registrar Decisão / Log
            </button>

            <button
              onClick={handleExportMarkdown}
              className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Exportar Auditoria (.md)
            </button>
          </div>
        </div>

        {/* Quick Counters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Total de Registros</span>
            <div className="text-lg font-extrabold text-slate-900 font-mono">{logs.length}</div>
          </div>
          <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
            <span className="text-[10px] text-emerald-700 uppercase font-semibold">Tabelas & Esquema</span>
            <div className="text-lg font-extrabold text-emerald-800 font-mono">
              {logs.filter(l => l.category === 'Tabelas & Esquema').length}
            </div>
          </div>
          <div className="bg-purple-50/60 p-2.5 rounded-xl border border-purple-100">
            <span className="text-[10px] text-purple-700 uppercase font-semibold">Fórmulas & Cálculos</span>
            <div className="text-lg font-extrabold text-purple-800 font-mono">
              {logs.filter(l => l.category === 'Fórmulas & Expressões').length}
            </div>
          </div>
          <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
            <span className="text-[10px] text-indigo-700 uppercase font-semibold">Bots & Automações</span>
            <div className="text-lg font-extrabold text-indigo-800 font-mono">
              {logs.filter(l => l.category === 'Automações & Bots').length}
            </div>
          </div>
          <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
            <span className="text-[10px] text-blue-700 uppercase font-semibold">Decisões Técnicas</span>
            <div className="text-lg font-extrabold text-blue-800 font-mono">
              {logs.filter(l => l.severity === 'decision').length}
            </div>
          </div>
          <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
            <span className="text-[10px] text-amber-700 uppercase font-semibold">Homologações</span>
            <div className="text-lg font-extrabold text-amber-800 font-mono">
              {logs.filter(l => l.severity === 'validation').length}
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por termo, tabela, fórmula, autor ou justificativa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500"
            >
              {severities.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Categories Pills */}
        <div className="flex flex-wrap gap-1.5 mt-3 pt-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Chronological Timeline List */}
      <div className="space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
            Nenhum registro de auditoria encontrado com os filtros selecionados.
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const sevBadge = getSeverityBadge(log.severity);
            const SevIcon = sevBadge.icon;

            return (
              <div
                key={log.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-200 hover:shadow-sm transition-all p-5 relative overflow-hidden"
              >
                {/* Lateral accent strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  log.severity === 'decision' ? 'bg-purple-500' :
                  log.severity === 'conversion' ? 'bg-blue-500' :
                  log.severity === 'validation' ? 'bg-emerald-500' :
                  log.severity === 'warning' ? 'bg-amber-500' : 'bg-slate-400'
                }`} />

                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-400 font-bold">
                      #{logs.length - index < 10 ? `0${logs.length - index}` : logs.length - index}
                    </span>

                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${sevBadge.bg}`}>
                      <SevIcon className="w-3 h-3" />
                      {sevBadge.label}
                    </span>

                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      {getCategoryIcon(log.category)}
                      {log.category}
                    </span>

                    {log.entityAffected && (
                      <span className="text-[11px] font-mono font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {log.entityAffected}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {log.timestamp}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      <User className="w-3 h-3 text-slate-500" />
                      {log.author}
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <div className="mt-3">
                  <h4 className="text-sm sm:text-base font-bold text-slate-900">
                    {log.title}
                  </h4>
                  <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
                    {log.description}
                  </p>
                </div>

                {/* De-Para: Before and After states diff box */}
                {(log.beforeState || log.afterState) && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {log.beforeState && (
                      <div className="rounded-xl border border-red-200 bg-red-50/40 p-3">
                        <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Estado no AppSheet (Legado)
                        </div>
                        <div className="font-mono text-[11px] text-slate-800 bg-white/80 p-2 rounded border border-red-100 whitespace-pre-wrap">
                          {log.beforeState}
                        </div>
                      </div>
                    )}

                    {log.afterState && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                        <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Estado na Aplicação Web (Moderno)
                        </div>
                        <div className="font-mono text-[11px] text-emerald-950 bg-white/80 p-2 rounded border border-emerald-100 whitespace-pre-wrap">
                          {log.afterState}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Technical Rationale */}
                {log.technicalRationale && (
                  <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-200/70 text-xs">
                    <span className="font-bold text-slate-700 mr-1.5">Justificativa Técnica:</span>
                    <span className="text-slate-600 leading-relaxed">{log.technicalRationale}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add New Audit Log Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h4 className="text-base font-bold text-slate-900 mb-1">
              Registrar Nova Decisão / Log de Auditoria
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              Documente a alteração realizada, justificativa técnica e o estado &quot;De ➔ Para&quot; para histórico auditável.
            </p>

            <form onSubmit={handleCreateLog} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título da Decisão / Registro
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Normalização da Chave Estrangeira em ItensOS"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as AuditCategory)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Tabelas & Esquema">Tabelas & Esquema</option>
                    <option value="Fórmulas & Expressões">Fórmulas & Expressões</option>
                    <option value="Automações & Bots">Automações & Bots</option>
                    <option value="Arquitetura & Decisões">Arquitetura & Decisões</option>
                    <option value="Segurança & RBAC">Segurança & RBAC</option>
                    <option value="Checklist & Diagnóstico">Checklist & Diagnóstico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Severidade / Tipo</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as AuditSeverity)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="decision">Decisão Técnica</option>
                    <option value="conversion">Conversão De-Para</option>
                    <option value="validation">Homologação / Validação</option>
                    <option value="warning">Ponto de Atenção</option>
                    <option value="info">Registro Informativo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Responsável / Autor</label>
                  <input
                    type="text"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Entidade Afetada (Tabela, Coluna, Bot ou View)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Tabela: ItensOS | Coluna: OrdemId"
                  value={newEntity}
                  onChange={(e) => setNewEntity(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição Detalhada da Alteração
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva o que foi alterado ou decidido..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Justificativa Técnica (Por que foi feito desta forma?)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Necessidade de integridade referencial nativa via chave estrangeira para evitar dados órfãos..."
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-red-700 mb-1">
                    Como era no AppSheet (Antes)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Expressão ou regra original no AppSheet"
                    value={newBeforeState}
                    onChange={(e) => setNewBeforeState(e.target.value)}
                    className="w-full font-mono text-xs border border-red-200 bg-red-50/20 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-700 mb-1">
                    Como ficou na Aplicação Web (Depois)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Código TypeScript, SQL ou regra equivalente"
                    value={newAfterState}
                    onChange={(e) => setNewAfterState(e.target.value)}
                    className="w-full font-mono text-xs border border-emerald-200 bg-emerald-50/20 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors"
                >
                  Salvar Registro de Auditoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
