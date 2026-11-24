import React, { useState } from 'react';
import { KNOWN_FORMULA_PATTERNS, translateCustomExpression } from '../utils/appsheetFormulaParser';
import { Calculator, ArrowRight, Code2, Database, Info, Sparkles, Check, Copy } from 'lucide-react';

export const FormulaConverter: React.FC = () => {
  const [inputExpression, setInputExpression] = useState(
    'SELECT(OrdensServico[ValorTotal], [ClienteId] = [_THISROW].[ClienteId])'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const translation = translateCustomExpression(inputExpression);

  const categories = ['Todas', 'Consulta / Seleção', 'Lógica / Condicional', 'Cálculo / Agregação', 'Texto / Manipulação', 'Data / Hora', 'Segurança / Usuário'];

  const filteredPatterns = selectedCategory === 'Todas'
    ? KNOWN_FORMULA_PATTERNS
    : KNOWN_FORMULA_PATTERNS.filter(p => p.category === selectedCategory);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Interactive Expression Playground */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Conversor Interativo de Expressões do AppSheet</h3>
            <p className="text-xs text-slate-500">
              Converta qualquer fórmula do AppSheet para lógica pura em TypeScript e comandos SQL/Firestore equivalentes.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Expressão Original do AppSheet (App Formula, Valid_If, Show_If, Virtual Column)
          </label>
          <div className="relative">
            <input
              type="text"
              value={inputExpression}
              onChange={(e) => setInputExpression(e.target.value)}
              placeholder="Ex: LOOKUP([_THISROW].[ClienteId], 'Clientes', 'Id', 'Nome')"
              className="w-full font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none focus:bg-white transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Translation Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {/* TypeScript Result */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold text-blue-400">
                <span className="flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" />
                  Equivalente TypeScript / JavaScript
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Front / Backend</span>
              </div>
              <div className="mt-3 font-mono text-xs text-emerald-300 bg-slate-950 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {translation.typeScript}
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              {translation.notes}
            </div>
          </div>

          {/* SQL / Database Result */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Database className="w-4 h-4" />
                  Equivalente SQL / Query Relacional
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">PostgreSQL / Supabase</span>
              </div>
              <div className="mt-3 font-mono text-xs text-sky-300 bg-slate-950 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {translation.sql}
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              Garante execução indexada e otimizada com índices de chave estrangeira.
            </div>
          </div>
        </div>
      </div>

      {/* Catalog of Known AppSheet Formula Equivalencies */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Catálogo de Padrões do AppSheet</h3>
            <p className="text-xs text-slate-500">
              Consulte a conversão exata das principais funções e estruturas de regras de negócio.
            </p>
          </div>

          {/* Filter Categories */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === c
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-5">
          {filteredPatterns.map((pattern, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 p-4 hover:border-purple-300 transition-all bg-slate-50/50"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 font-mono bg-purple-100 text-purple-900 px-2 py-0.5 rounded">
                    {pattern.appSheetFormula}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-200 px-2 py-0.5 rounded">
                    {pattern.category}
                  </span>
                </div>
                <button
                  onClick={() => setInputExpression(pattern.appSheetFormula)}
                  className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 self-start sm:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Testar no Conversor
                </button>
              </div>

              <p className="text-xs text-slate-600 mb-3">{pattern.description}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-slate-900 text-emerald-400 p-3 rounded-lg relative group">
                  <div className="text-[10px] text-slate-400 font-sans mb-1 font-semibold flex items-center justify-between">
                    <span>TypeScript</span>
                    <button
                      onClick={() => handleCopy(pattern.typescriptEquivalent, idx * 2)}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedIndex === idx * 2 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="overflow-x-auto whitespace-pre-wrap">{pattern.typescriptEquivalent}</div>
                </div>

                <div className="bg-slate-900 text-sky-400 p-3 rounded-lg relative group">
                  <div className="text-[10px] text-slate-400 font-sans mb-1 font-semibold flex items-center justify-between">
                    <span>SQL / Relacional</span>
                    <button
                      onClick={() => handleCopy(pattern.sqlEquivalent, idx * 2 + 1)}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedIndex === idx * 2 + 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="overflow-x-auto whitespace-pre-wrap">{pattern.sqlEquivalent}</div>
                </div>
              </div>

              <div className="mt-2.5 text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-200">
                <strong className="text-slate-700">Explicação técnica:</strong> {pattern.explanation}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
