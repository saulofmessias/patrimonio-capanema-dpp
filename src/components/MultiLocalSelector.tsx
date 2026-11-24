import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, X, MapPin, CheckSquare, Square } from 'lucide-react';

interface Props {
  locais: string[];
  selectedLocais: string[];
  onChange: (selected: string[]) => void;
  bensCountMap?: Record<string, number>;
  className?: string;
}

export const MultiLocalSelector: React.FC<Props> = ({
  locais,
  selectedLocais,
  onChange,
  bensCountMap = {},
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

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

  const filteredList = locais.filter(l =>
    l.toLowerCase().includes(search.toLowerCase())
  );

  const toggleLocal = (loc: string) => {
    if (selectedLocais.includes(loc)) {
      onChange(selectedLocais.filter(l => l !== loc));
    } else {
      onChange([...selectedLocais, loc]);
    }
  };

  const areAllFilteredSelected = filteredList.length > 0 && filteredList.every(l => selectedLocais.includes(l));

  const handleToggleAllFiltered = () => {
    if (areAllFilteredSelected) {
      const toRemove = new Set(filteredList);
      onChange(selectedLocais.filter(l => !toRemove.has(l)));
    } else {
      const currentSet = new Set(selectedLocais);
      for (const l of filteredList) {
        currentSet.add(l);
      }
      onChange(Array.from(currentSet));
    }
  };

  const handleSelectAllGlobal = () => {
    onChange([...locais]);
  };

  const handleClear = () => {
    onChange([]);
  };

  const getButtonLabel = () => {
    if (selectedLocais.length === 0) {
      return `Todos os Locais (${locais.length})`;
    }
    if (selectedLocais.length === 1) {
      return selectedLocais[0];
    }
    if (selectedLocais.length === locais.length) {
      return `Todos os Locais (${locais.length})`;
    }
    return `${selectedLocais.length} Locais incluídos`;
  };

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      {/* Botão de Disparo / Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full py-2 px-2.5 text-xs bg-slate-50 border rounded-xl font-medium transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
          selectedLocais.length > 0
            ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 font-bold ring-1 ring-indigo-500/30'
            : 'border-slate-300 text-slate-700 hover:border-slate-400'
        }`}
        title="Escolher quais Locais / Unidades incluir"
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <MapPin className={`w-3.5 h-3.5 shrink-0 ${selectedLocais.length > 0 ? 'text-indigo-700' : 'text-slate-400'}`} />
          <span className="truncate">{getButtonLabel()}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedLocais.length > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
              {selectedLocais.length}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Painel Suspenso de Seleção */}
      {isOpen && (
        <div className="absolute z-50 left-0 sm:right-0 mt-1.5 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
          {/* Cabeçalho do Painel */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Incluir / Filtrar Locais:
              </span>
              <span className={`font-mono text-[11px] px-2 py-0.5 rounded-full font-bold ${
                selectedLocais.length > 0
                  ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {selectedLocais.length === 0
                  ? 'Todos os Locais ativos'
                  : `${selectedLocais.length} incluído${selectedLocais.length > 1 ? 's' : ''}`}
              </span>
            </div>

            {/* Campo de Busca Rápida de Locais */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar escola, posto, prédio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

            {/* Ação Rápida */}
            {search.trim() ? (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="font-medium text-[11px] text-indigo-900">
                  {filteredList.length} encontrado{filteredList.length !== 1 ? 's' : ''} para "{search}"
                </span>
                {filteredList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleAllFiltered}
                    className="font-bold text-[11px] text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded border border-indigo-300 shadow-2xs"
                  >
                    {areAllFilteredSelected ? (
                      <>
                        <Square className="w-3 h-3 text-indigo-600" />
                        Desmarcar da busca ({filteredList.length})
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-3 h-3 text-indigo-600" />
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
                  className="text-indigo-700 hover:text-indigo-900 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CheckSquare className="w-3 h-3 text-indigo-600" />
                  Marcar todos ({locais.length})
                </button>
                {selectedLocais.length > 0 && (
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
            {!search && (
              <button
                type="button"
                onClick={handleClear}
                className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  selectedLocais.length === 0
                    ? 'bg-indigo-50 text-indigo-950 font-bold'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span>TODOS OS LOCAIS / UNIDADES (Geral)</span>
                {selectedLocais.length === 0 && <Check className="w-4 h-4 text-indigo-600 stroke-[2.5]" />}
              </button>
            )}

            {filteredList.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Nenhum local encontrado para "{search}".
              </div>
            ) : (
              filteredList.map((loc) => {
                const isSelected = selectedLocais.includes(loc);
                const count = bensCountMap[loc];

                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => toggleLocal(loc)}
                    className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/90 text-indigo-950 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate text-left" title={loc}>{loc}</span>
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

          {/* Rodapé */}
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
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Confirmar ({selectedLocais.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
