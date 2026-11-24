import React, { useState } from 'react';
import { Database, Shield, Zap, DollarSign, Layers, Check, CheckCircle2, ArrowRight, Server, Globe } from 'lucide-react';

interface Props {
  selectedArchitecture: string;
  onSelectArchitecture: (arch: string) => void;
}

export const ArchitectureAdvisor: React.FC<Props> = ({
  selectedArchitecture,
  onSelectArchitecture,
}) => {
  const [useCaseFilters, setUseCaseFilters] = useState({
    needRealtime: true,
    complexJoins: false,
    googleEcosystem: true,
    largeVolume: false,
  });

  return (
    <div className="space-y-6">
      {/* Introduction Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Planejamento de Arquitetura & Escolha do Banco de Dados</h3>
            <p className="text-xs text-slate-500">
              Análise comparativa criteriosa para decidir a melhor fundação para substituir o AppSheet com alta performance, baixo custo e facilidade de manutenção.
            </p>
          </div>
        </div>

        {/* Interactive requirement assessment */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">
            Critérios do seu Aplicativo AppSheet:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 'needRealtime', label: 'Precisa de Atualizações em Tempo Real (Sync)' },
              { id: 'complexJoins', label: 'Possui Consultas Relacionais Complexas (Muitos JOINs)' },
              { id: 'googleEcosystem', label: 'Integrado ao Google Sheets / Drive / Gmail' },
              { id: 'largeVolume', label: 'Volume superior a 100.000 registros por mês' },
            ].map(crit => (
              <label
                key={crit.id}
                className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={(useCaseFilters as any)[crit.id]}
                  onChange={(e) => setUseCaseFilters({ ...useCaseFilters, [crit.id]: e.target.checked })}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-medium text-slate-700 leading-snug">{crit.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 3 Architecture Options Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Opção 1: Firebase Firestore */}
        <div
          className={`bg-white rounded-2xl border-2 transition-all p-5 shadow-sm flex flex-col justify-between ${
            selectedArchitecture === 'firestore'
              ? 'border-emerald-600 ring-4 ring-emerald-50'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Google Cloud Nativo
              </span>
              {selectedArchitecture === 'firestore' && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Selecionada
                </span>
              )}
            </div>

            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-500" />
              Firebase Firestore + Auth
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Banco NoSQL com sincronização em tempo real, autenticação integrada e regras de segurança por documento.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-start gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Excelente integração com o ecossistema Google (Workspace, Drive, Auth)</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Escala automática sem gerenciamento de servidores ou instâncias</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Offline sync nativo para dispositivos móveis e tablets de campo</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Camada gratuita generosa (50k leituras/dia gratuitas)</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              <strong>Ponto de Atenção:</strong> Consultas agregadas (como SUM sobre 10.000 linhas) exigem contadores computados via Cloud Functions.
            </div>
          </div>

          <button
            onClick={() => onSelectArchitecture('firestore')}
            className={`mt-6 w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
              selectedArchitecture === 'firestore'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {selectedArchitecture === 'firestore' ? 'Arquitetura Selecionada' : 'Escolher Firebase Firestore'}
          </button>
        </div>

        {/* Opção 2: Cloud SQL PostgreSQL */}
        <div
          className={`bg-white rounded-2xl border-2 transition-all p-5 shadow-sm flex flex-col justify-between ${
            selectedArchitecture === 'postgresql'
              ? 'border-blue-600 ring-4 ring-blue-50'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                Máxima Integridade Relacional
              </span>
              {selectedArchitecture === 'postgresql' && (
                <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Selecionada
                </span>
              )}
            </div>

            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              Cloud SQL (PostgreSQL) + Node.js
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Banco relacional padrão de mercado com integridade referencial rígida, chaves estrangeiras e Drizzle ORM.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-start gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <span>Integridade referencial estrita (Foreign Keys e ON DELETE CASCADE)</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <span>Consultas SQL ricas, JOINs de alta velocidade e agregações nativas (SUM, AVG)</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <span>Migrações de esquema controladas via migrations TypeScript</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <span>Compatibilidade 100% com relatórios analíticos e BI</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              <strong>Ponto de Atenção:</strong> Requer backend Express/Node para intermediar chamadas com segurança.
            </div>
          </div>

          <button
            onClick={() => onSelectArchitecture('postgresql')}
            className={`mt-6 w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
              selectedArchitecture === 'postgresql'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {selectedArchitecture === 'postgresql' ? 'Arquitetura Selecionada' : 'Escolher Cloud SQL PostgreSQL'}
          </button>
        </div>

        {/* Opção 3: Supabase */}
        <div
          className={`bg-white rounded-2xl border-2 transition-all p-5 shadow-sm flex flex-col justify-between ${
            selectedArchitecture === 'supabase'
              ? 'border-indigo-600 ring-4 ring-indigo-50'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                PostgreSQL + Realtime
              </span>
              {selectedArchitecture === 'supabase' && (
                <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Selecionada
                </span>
              )}
            </div>

            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              Supabase (PostgreSQL BaaS)
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              PostgreSQL completo com APIs geradas automaticamente, Row Level Security (RLS) e sincronização websocket.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-start gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <span>Combina o poder do SQL relacional com APIs client-side diretas</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <span>Row Level Security (RLS) replica com exatidão as regras de Slices do AppSheet</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <span>Painel web amigável com visualizador de tabelas similar ao Sheets</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              <strong>Ponto de Atenção:</strong> Plataforma externa com limites na camada gratuita caso pausada por inatividade.
            </div>
          </div>

          <button
            onClick={() => onSelectArchitecture('supabase')}
            className={`mt-6 w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
              selectedArchitecture === 'supabase'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {selectedArchitecture === 'supabase' ? 'Arquitetura Selecionada' : 'Escolher Supabase'}
          </button>
        </div>
      </div>

      {/* Recommendation Summary */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800">
        <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Parecer Técnico do Especialista para o seu Caso
        </h4>
        <p className="text-xs text-slate-300 leading-relaxed">
          Para a grande maioria das aplicações migradas do AppSheet, o <strong>Firebase Firestore com Firebase Auth</strong> ou o <strong>Cloud SQL PostgreSQL</strong> oferecem a melhor estabilidade e zero risco de travamento de chaves. 
          Se o seu aplicativo possui tabelas com relação Pai-Filho forte (como Ordens de Serviço e Itens, ou Pedidos e Produtos com fórmulas agregadas tipo <code className="bg-slate-800 px-1 text-emerald-400">SUM(SELECT(...))</code>), recomendamos formalmente o <strong>Cloud SQL PostgreSQL</strong> para garantir integridade matemática e relacional sem complexidade de sincronização NoSQL.
        </p>
      </div>
    </div>
  );
};
