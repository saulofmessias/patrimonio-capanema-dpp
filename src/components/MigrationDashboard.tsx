import React from 'react';
import { MigrationStep, TableDefinition, ActionDefinition, BotDefinition } from '../types/appsheet';
import { 
  TrendingUp, CheckCircle2, Clock, AlertCircle, Database, 
  Layers, Bot, Calculator, KeyRound, ArrowRight, ShieldCheck,
  Sparkles, FileSpreadsheet
} from 'lucide-react';

interface Props {
  steps: MigrationStep[];
  tables: TableDefinition[];
  actions: ActionDefinition[];
  bots: BotDefinition[];
  selectedArchitecture: string;
  onNavigateTab: (tab: 'checklist' | 'schema' | 'formulas' | 'automations' | 'architecture' | 'audit') => void;
}

export const MigrationDashboard: React.FC<Props> = ({
  steps,
  tables,
  actions,
  bots,
  selectedArchitecture,
  onNavigateTab,
}) => {
  // 1. Checklist metrics
  const totalChecklistItems = steps.reduce((acc, s) => acc + s.checklist.length, 0);
  const completedChecklistItems = steps.reduce(
    (acc, s) => acc + s.checklist.filter(c => c.completed).length, 
    0
  );
  const checklistPercentage = totalChecklistItems > 0 
    ? Math.round((completedChecklistItems / totalChecklistItems) * 100) 
    : 0;

  // 2. Table / Schema metrics
  const totalTables = tables.length;
  const totalColumns = tables.reduce((acc, t) => acc + t.columns.length, 0);
  const tablesWithPk = tables.filter(t => t.primaryKey && t.columns.some(c => c.isKey)).length;
  const totalRefs = tables.reduce((acc, t) => acc + t.columns.filter(c => c.type === 'Ref').length, 0);
  const virtualCols = tables.reduce((acc, t) => acc + t.columns.filter(c => c.isVirtual).length, 0);

  // Schema progress: based on tables presence, PK definition, and column mapping
  let schemaScore = 0;
  if (totalTables > 0) {
    const tablePresenceScore = Math.min(30, totalTables * 10); // up to 30% for having tables
    const pkScore = totalTables > 0 ? (tablesWithPk / totalTables) * 40 : 0; // 40% for primary keys
    const colsScore = totalColumns >= totalTables * 3 ? 20 : (totalColumns / (totalTables * 3)) * 20; // 20% for fields
    const refScore = totalRefs > 0 ? 10 : 5; // 10% for references
    schemaScore = Math.min(100, Math.round(tablePresenceScore + pkScore + colsScore + refScore));
  }

  // 3. Overall Weighted Completion
  // 55% from checklist tasks + 35% from schema configuration + 10% from automations/architecture
  const automationsScore = Math.min(100, (bots.length * 25) + (actions.length * 15) + (selectedArchitecture ? 20 : 0));
  const overallPercentage = Math.round(
    (checklistPercentage * 0.55) + 
    (schemaScore * 0.35) + 
    (automationsScore * 0.10)
  );

  // Status message based on percentage
  const getStatusBadge = () => {
    if (overallPercentage >= 90) return { label: 'Pronto para Homologação Final', color: 'bg-emerald-500 text-white' };
    if (overallPercentage >= 60) return { label: 'Desenvolvimento Avançado', color: 'bg-blue-600 text-white' };
    if (overallPercentage >= 30) return { label: 'Arquitetura e Mapeamento em Curso', color: 'bg-indigo-600 text-white' };
    return { label: 'Etapa 1: Diagnóstico e Coleta', color: 'bg-amber-500 text-white' };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Painel Geral de Progresso da Migração
              </h3>
              <p className="text-xs text-slate-500">
                Progresso em tempo real calculado a partir das tabelas configuradas, chaves primárias e checklist do projeto.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Main Big Metric Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Overall Percentage Display */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 text-white shadow-md relative overflow-hidden flex flex-col justify-between h-full">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between text-xs text-blue-300 font-semibold mb-2">
              <span>CONCLUSÃO GLOBAL DO PROJETO</span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" /> Ponderado
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white font-mono">
                {overallPercentage}%
              </span>
              <span className="text-xs text-slate-300 font-medium">concluído</span>
            </div>

            {/* Overall Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-3.5 mt-4 overflow-hidden border border-slate-700/60 p-0.5">
              <div 
                className="bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(4, overallPercentage)}%` }}
              />
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <span>Checklist: <strong>{completedChecklistItems}/{totalChecklistItems}</strong></span>
            <span>Tabelas: <strong>{totalTables}</strong></span>
            <span>Banco: <strong>{selectedArchitecture.toUpperCase()}</strong></span>
          </div>
        </div>

        {/* Detailed 3 Progress Bars */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Bar 1: Checklist */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between hover:border-blue-300 transition-colors">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                <span className="font-bold flex items-center gap-1.5 text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Itens do Checklist
                </span>
                <span className="font-mono font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded text-[11px]">
                  {checklistPercentage}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                {completedChecklistItems} de {totalChecklistItems} tarefas validadas nas 7 etapas.
              </p>
            </div>

            <div className="mt-4">
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${checklistPercentage}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1.5">
                <span>0%</span>
                <span>Alvo: 100%</span>
              </div>
            </div>
          </div>

          {/* Bar 2: Tabelas & Esquema */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-300 transition-colors">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                <span className="font-bold flex items-center gap-1.5 text-slate-800">
                  <Database className="w-4 h-4 text-emerald-600" />
                  Esquema de Dados
                </span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded text-[11px]">
                  {schemaScore}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                {totalTables} tabelas, {tablesWithPk} chaves primárias e {totalRefs} relações mapeadas.
              </p>
            </div>

            <div className="mt-4">
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${schemaScore}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1.5">
                <span>{tablesWithPk}/{totalTables} com PK</span>
                <button 
                  onClick={() => onNavigateTab('schema')}
                  className="text-emerald-700 font-semibold hover:underline flex items-center gap-0.5"
                >
                  Configurar <ArrowRight className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Bar 3: Automações & Regras */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-300 transition-colors">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                <span className="font-bold flex items-center gap-1.5 text-slate-800">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  Bots & Automações
                </span>
                <span className="font-mono font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded text-[11px]">
                  {automationsScore}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                {bots.length} bots e {actions.length} ações configuradas para o backend.
              </p>
            </div>

            <div className="mt-4">
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${automationsScore}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1.5">
                <span>{bots.length} Bots</span>
                <button 
                  onClick={() => onNavigateTab('automations')}
                  className="text-indigo-700 font-semibold hover:underline flex items-center gap-0.5"
                >
                  Ver <ArrowRight className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Breakdown by the 7 Stages */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Progresso por Etapa de Migração (1 a 7)
          </span>
          <span className="text-[11px] text-slate-400">
            Atualizado automaticamente com as marcações de validação
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {steps.map((st) => {
            const stepTotal = st.checklist.length;
            const stepDone = st.checklist.filter(c => c.completed).length;
            const stepPercent = stepTotal > 0 ? Math.round((stepDone / stepTotal) * 100) : 0;
            const isCurrent = st.status === 'in_progress';
            const isCompleted = st.status === 'completed';

            return (
              <div
                key={st.id}
                className={`rounded-xl p-3 border text-xs flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'border-blue-400 bg-blue-50/50 shadow-xs'
                    : isCompleted
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-300 text-slate-700'
                    }`}>
                      Etapa {st.id}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-700">
                      {stepPercent}%
                    </span>
                  </div>

                  <div className="font-semibold text-slate-800 text-[11px] truncate mt-1" title={st.title}>
                    {st.title}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${stepPercent}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                    <span>{stepDone}/{stepTotal} ok</span>
                    <span className={isCurrent ? 'text-blue-700 font-bold' : ''}>
                      {isCompleted ? '✓ Feito' : isCurrent ? 'Em Curso' : 'Pendente'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
