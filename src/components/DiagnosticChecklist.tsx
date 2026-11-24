import React from 'react';
import { MigrationStep } from '../types/appsheet';
import { CheckCircle2, Clock, AlertTriangle, ChevronRight, FileSpreadsheet, KeyRound, Calculator, Filter, Bot, ShieldCheck } from 'lucide-react';

interface Props {
  steps: MigrationStep[];
  onToggleChecklist: (stepId: number, itemIndex: number) => void;
  onOpenSchemaTab: () => void;
  onOpenArchitectureTab: () => void;
}

export const DiagnosticChecklist: React.FC<Props> = ({
  steps,
  onToggleChecklist,
  onOpenSchemaTab,
  onOpenArchitectureTab,
}) => {
  return (
    <div className="space-y-6">
      {/* Banner de Boas-vindas e Status Atual */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-blue-700/40">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Etapa 1 em Execução — Diagnóstico e Coleta
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Migração Fiel do AppSheet para Aplicação Web
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-3xl leading-relaxed">
              Preservação total de regras de negócio, integridade referencial, fórmulas e automações. 
              Nenhuma linha de código definitiva será gerada sem seu diagnóstico prévio e aprovação de arquitetura.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onOpenSchemaTab}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Mapeador de Tabelas
            </button>
            <button
              onClick={onOpenArchitectureTab}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Decisão de Banco
            </button>
          </div>
        </div>

        {/* 10 Pilares de Preservação */}
        <div className="mt-6 pt-6 border-t border-blue-800/60 grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Tabelas & Chaves', icon: KeyRound, desc: 'IDs e Refs preservados' },
            { label: 'Fórmulas & Cálculos', icon: Calculator, desc: 'Conversão TypeScript/SQL' },
            { label: 'Slices & Filtros', icon: Filter, desc: 'Visões seguras por perfil' },
            { label: 'Bots & Ações', icon: Bot, desc: 'Disparos e Webhooks' },
            { label: 'Controle de Acesso', icon: ShieldCheck, desc: 'RBAC e permissões de dados' },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold mb-1">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </div>
                <div className="text-[11px] text-slate-400">{item.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Protocolo das 7 Etapas de Desenvolvimento */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Roteiro Oficial de Migração (7 Etapas)</h3>
            <p className="text-xs text-slate-500">Acompanhamento transparente e validação a cada fase</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
            Progresso Geral: 1 de 7 em andamento
          </span>
        </div>

        <div className="space-y-4">
          {steps.map((step) => {
            const isCurrent = step.status === 'in_progress';
            const isCompleted = step.status === 'completed';

            return (
              <div
                key={step.id}
                className={`rounded-xl border transition-all ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50/30 shadow-sm'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-slate-200 bg-slate-50/50 opacity-90'
                } p-5`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        {step.name}
                        {isCurrent && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            Fase Atual
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-600">{step.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-blue-100 text-blue-700'
                          : isCompleted
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isCurrent ? (
                        <>
                          <Clock className="w-3.5 h-3.5 animate-spin" /> Em Execução
                        </>
                      ) : isCompleted ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
                        </>
                      ) : (
                        'Aguardando Etapa Anterior'
                      )}
                    </span>
                  </div>
                </div>

                {/* Subitens do checklist */}
                <div className="mt-3 pl-10 space-y-2 border-t border-slate-200/60 pt-3">
                  {step.checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs group cursor-pointer"
                      onClick={() => onToggleChecklist(step.id, idx)}
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => onToggleChecklist(step.id, idx)}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className={item.completed ? 'line-through text-slate-400' : 'text-slate-700'}>
                        {item.item}
                      </span>
                      {item.note && (
                        <span className="text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {item.note}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Orientações para Envio de Informações do AppSheet */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 mt-1">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Como fornecer os dados do seu aplicativo AppSheet</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Para prosseguirmos com a ETAPA 1 com 100% de precisão e sem inventar dados ou regras, você pode nos informar no chat ou nas abas acima:
            </p>
            <ul className="mt-3 space-y-2 text-xs text-slate-300 list-disc list-inside">
              <li>
                <strong className="text-white">Tabelas e Colunas:</strong> Os nomes das tabelas (ex: Clientes, Pedidos, OS) e os nomes de cada coluna com seu tipo no AppSheet.
              </li>
              <li>
                <strong className="text-white">Fórmulas e Expressões:</strong> Suas expressões AppSheet (ex: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-blue-300">SELECT(...)</code>, <code className="bg-slate-800 px-1.5 py-0.5 rounded text-blue-300">LOOKUP(...)</code>, <code className="bg-slate-800 px-1.5 py-0.5 rounded text-blue-300">IFS(...)</code>, Valid_If, Show_If).
              </li>
              <li>
                <strong className="text-white">Slices e Perfis:</strong> Condições de filtro de linhas e quem tem permissão para visualizar ou editar.
              </li>
              <li>
                <strong className="text-white">Ações e Bots:</strong> Quais automações rodam quando um registro é adicionado ou alterado (emails, geração de arquivos, mudanças de status).
              </li>
              <li>
                <strong className="text-white">Planilhas ou Export:</strong> Se desejar, você pode colar os cabeçalhos das suas planilhas do Google Sheets ou exportar CSVs para importação direta.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
