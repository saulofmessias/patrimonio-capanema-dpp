import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, X, Building2, CheckSquare, Square } from 'lucide-react';

interface Props {
  departamentos: string[];
  selectedDepartamentos: string[];
  onChange: (selected: string[]) => void;
  bensCountMap?: Record<string, number>;
  maxLimit?: number;
  className?: string;
}

export const MultiDepartamentoSelector: React.FC<Props> = ({
  departamentos,
  selectedDepartamentos,
  onChange,
  bensCountMap = {},
  maxLimit,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredList = departamentos.filter(d => 
    d.toLowerCase().includes(search.toLowerCase())
  );

  const isLimitReached = maxLimit ? selectedDepartamentos.length >= maxLimit : false;

  const toggleDepartamento = (dep: string) => {
    if (selectedDepartamentos.includes(dep)) {
      onChange(selectedDepartamentos.filter(d => d !== dep));
    } else {
      if (!maxLimit || selectedDepartamentos.length < maxLimit) {
        onChange([...selectedDepartamentos, dep]);
      }
    }
  };

  const areAllFilteredSelected = filteredList.length > 0 && filteredList.every(d => selectedDepartamentos.includes(d));

  // Marcar ou desmarcar todos os itens filtrados na busca de uma só vez
  const handleToggleAllFiltered = () => {
    if (areAllFilteredSelected) {
      // Desmarca apenas os que estão no filtro atual
      const toRemove = new Set(filteredList);
      onChange(selectedDepartamentos.filter(d => !toRemove.has(d)));
    } else {
      // Adiciona todos os itens filtrados respeitando limite se houver
      const currentSet = new Set(selectedDepartamentos);
      for (const d of filteredList) {
        if (maxLimit && currentSet.size >= maxLimit) break;
        currentSet.add(d);
      }
      onChange(Array.from(currentSet));
    }
  };

  // Marcar todos os departamentos da lista completa
  const handleSelectAllGlobal = () => {
    if (maxLimit) {
      onChange(departamentos.slice(0, maxLimit));
    } else {
      onChange([...departamentos]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  // Texto do botão trigger
  const getButtonLabel = () => {
    if (selectedDepartamentos.length === 0) {
      return `Todos os Deptos (${departamentos.length})`;
    }
    if (selectedDepartamentos.length === 1) {
      return selectedDepartamentos[0];
    }
    if (selectedDepartamentos.length === departamentos.length) {
      return `Todos os Deptos (${departamentos.length})`;
    }
    return maxLimit 
      ? `${selectedDepartamentos.length} de ${maxLimit} Deptos`
      : `${selectedDepartamentos.length} Deptos selecionados`;
  };

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      {/* Botão de Disparo / Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full py-2 px-2.5 text-xs bg-slate-50 border rounded-xl font-medium transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
          selectedDepartamentos.length > 0
            ? 'border-blue-500 bg-blue-50/70 text-blue-900 font-bold ring-1 ring-blue-500/30'
            : 'border-slate-300 text-slate-700 hover:border-slate-400'
        }`}
        title="Filtrar por departamentos"
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <Building2 className={`w-3.5 h-3.5 shrink-0 ${selectedDepartamentos.length > 0 ? 'text-blue-700' : 'text-slate-400'}`} />
          <span className="truncate">{getButtonLabel()}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedDepartamentos.length > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
              {selectedDepartamentos.length}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Painel Suspenso de Seleção */}
      {isOpen && (
        <div className="absolute z-50 left-0 sm:right-0 mt-1.5 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
          {/* Cabeçalho do Painel com Contador */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                {maxLimit ? `Selecione até ${maxLimit} Deptos:` : 'Filtrar por Departamentos:'}
              </span>
              <span className={`font-mono text-[11px] px-2 py-0.5 rounded-full font-bold ${
                isLimitReached 
                  ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                  : selectedDepartamentos.length > 0
                  ? 'bg-blue-100 text-blue-900 border border-blue-200'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {maxLimit 
                  ? `${selectedDepartamentos.length} de ${maxLimit} selecionados`
                  : selectedDepartamentos.length === 0
                  ? 'Todos os Deptos ativos'
                  : `${selectedDepartamentos.length} selecionado${selectedDepartamentos.length > 1 ? 's' : ''}`
                }
              </span>
            </div>

            {/* Campo de Busca Rápida de Salas/Departamentos */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar sala, setor ou depto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Ação Rápida: Marcar todos os departamentos filtrados de uma só vez */}
            {search.trim() ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="font-medium text-[11px] text-blue-900">
                  {filteredList.length} encontrado{filteredList.length !== 1 ? 's' : ''} para "{search}"
                </span>
                {filteredList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleAllFiltered}
                    className="font-bold text-[11px] text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded border border-blue-300 shadow-2xs"
                  >
                    {areAllFilteredSelected ? (
                      <>
                        <Square className="w-3 h-3 text-blue-600" />
                        Desmarcar da busca ({filteredList.length})
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-3 h-3 text-blue-600" />
                        Marcar todos da busca ({filteredList.length})
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <button
                  type="button"
                  onClick={handleSelectAllGlobal}
                  className="text-blue-700 hover:text-blue-900 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CheckSquare className="w-3 h-3 text-blue-600" />
                  Marcar todos ({departamentos.length})
                </button>
                {selectedDepartamentos.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                  >
                    Desmarcar todos
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Lista com Checkboxes */}
          <div className="max-h-64 overflow-y-auto p-1.5 divide-y divide-slate-100">
            {/* Opção Todos os Departamentos (Sem filtro) */}
            {!search && (
              <button
                type="button"
                onClick={handleClear}
                className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  selectedDepartamentos.length === 0 
                    ? 'bg-blue-50 text-blue-900 font-bold' 
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span>TODOS OS DEPARTAMENTOS (Geral)</span>
                {selectedDepartamentos.length === 0 && <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />}
              </button>
            )}

            {filteredList.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Nenhum departamento encontrado para "{search}".
              </div>
            ) : (
              filteredList.map((dep) => {
                const isSelected = selectedDepartamentos.includes(dep);
                const isDisabled = !isSelected && isLimitReached;
                const count = bensCountMap[dep];

                return (
                  <button
                    key={dep}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => toggleDepartamento(dep)}
                    className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/90 text-blue-900 font-bold'
                        : isDisabled
                        ? 'opacity-40 cursor-not-allowed bg-slate-50/50 text-slate-400'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate text-left" title={dep}>{dep}</span>
                    </div>

                    {count !== undefined && (
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                        {count} {count === 1 ? 'bem' : 'bens'}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Rodapé com Ações */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold px-2 py-1 hover:bg-slate-200/60 rounded cursor-pointer"
            >
              Limpar Todos
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Confirmar ({selectedDepartamentos.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
