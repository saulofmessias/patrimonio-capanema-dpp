import React, { useState } from 'react';
import { TableDefinition, ColumnDefinition, AppSheetDataType } from '../types/appsheet';
import { 
  Plus, Trash2, Key, Link2, Sparkles, Code2, Database, 
  HelpCircle, CheckCircle, FileText, Download, Upload
} from 'lucide-react';

interface Props {
  tables: TableDefinition[];
  onUpdateTables: (tables: TableDefinition[]) => void;
  onLoadSample: () => void;
}

const APPSHEET_TYPES: AppSheetDataType[] = [
  'Text', 'LongText', 'Number', 'Decimal', 'Price', 'Percent', 
  'Date', 'Time', 'DateTime', 'Yes/No', 'Ref', 'Enum', 'EnumList', 
  'Image', 'File', 'LatLong', 'Address', 'Email', 'Phone', 'Url', 
  'ChangeTimestamp', 'Progress', 'Signature'
];

export const SchemaManager: React.FC<Props> = ({ tables, onUpdateTables, onLoadSample }) => {
  const [selectedTableId, setSelectedTableId] = useState<string>(tables[0]?.id || '');
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newSheetSource, setNewSheetSource] = useState('');
  const [exportModalType, setExportModalType] = useState<'ts' | 'sql' | 'json' | null>(null);

  const activeTable = tables.find(t => t.id === selectedTableId) || tables[0];

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;

    const newTable: TableDefinition = {
      id: `tbl_${Date.now()}`,
      name: newTableName.trim(),
      sheetSource: newSheetSource.trim() || `Planilha_${newTableName.trim()}`,
      primaryKey: 'Id',
      labelColumn: 'Nome',
      columns: [
        {
          id: `c_${Date.now()}`,
          name: 'Id',
          type: 'Text',
          isKey: true,
          isRequired: true,
          isVirtual: false,
          initialValue: 'UNIQUEID()',
          description: 'Identificador único do registro'
        }
      ]
    };

    const updated = [...tables, newTable];
    onUpdateTables(updated);
    setSelectedTableId(newTable.id);
    setNewTableName('');
    setNewSheetSource('');
    setShowAddTableModal(false);
  };

  const handleRemoveTable = (tableId: string) => {
    if (confirm('Tem certeza que deseja remover esta tabela do mapeamento?')) {
      const updated = tables.filter(t => t.id !== tableId);
      onUpdateTables(updated);
      if (selectedTableId === tableId && updated.length > 0) {
        setSelectedTableId(updated[0].id);
      }
    }
  };

  const handleAddColumn = () => {
    if (!activeTable) return;

    const newCol: ColumnDefinition = {
      id: `c_${Date.now()}`,
      name: `NovaColuna_${activeTable.columns.length + 1}`,
      type: 'Text',
      isKey: false,
      isRequired: false,
      isVirtual: false,
    };

    const updatedTable: TableDefinition = {
      ...activeTable,
      columns: [...activeTable.columns, newCol]
    };

    onUpdateTables(tables.map(t => t.id === activeTable.id ? updatedTable : t));
  };

  const handleUpdateColumn = (colId: string, updates: Partial<ColumnDefinition>) => {
    if (!activeTable) return;

    const updatedColumns = activeTable.columns.map(c => {
      if (c.id === colId) {
        return { ...c, ...updates };
      }
      return c;
    });

    const updatedTable: TableDefinition = {
      ...activeTable,
      columns: updatedColumns
    };

    onUpdateTables(tables.map(t => t.id === activeTable.id ? updatedTable : t));
  };

  const handleRemoveColumn = (colId: string) => {
    if (!activeTable) return;
    const updatedColumns = activeTable.columns.filter(c => c.id !== colId);
    const updatedTable: TableDefinition = { ...activeTable, columns: updatedColumns };
    onUpdateTables(tables.map(t => t.id === activeTable.id ? updatedTable : t));
  };

  // Type mapping helper
  const mapTypeToWeb = (t: AppSheetDataType) => {
    switch (t) {
      case 'Text':
      case 'LongText':
      case 'Address':
      case 'Email':
      case 'Phone':
      case 'Url':
      case 'Signature':
        return { ts: 'string', sql: 'VARCHAR(255) / TEXT', firestore: 'string' };
      case 'Number':
        return { ts: 'number (integer)', sql: 'INTEGER', firestore: 'number' };
      case 'Decimal':
      case 'Price':
      case 'Percent':
      case 'Progress':
        return { ts: 'number (float)', sql: 'NUMERIC(12, 2)', firestore: 'number' };
      case 'Date':
      case 'Time':
      case 'DateTime':
      case 'ChangeTimestamp':
        return { ts: 'string (ISO) | Date', sql: 'TIMESTAMP WITH TIME ZONE', firestore: 'Timestamp' };
      case 'Yes/No':
        return { ts: 'boolean', sql: 'BOOLEAN', firestore: 'boolean' };
      case 'Ref':
        return { ts: 'string (ID de Ref)', sql: 'FOREIGN KEY REFERENCES ...', firestore: 'DocumentReference | string' };
      case 'Enum':
        return { ts: 'string (Union)', sql: 'VARCHAR(50) / ENUM', firestore: 'string' };
      case 'EnumList':
        return { ts: 'string[]', sql: 'TEXT[] / JSONB', firestore: 'array' };
      case 'Image':
      case 'File':
        return { ts: 'string (URL do Bucket)', sql: 'TEXT (Cloud Storage URL)', firestore: 'string' };
      case 'LatLong':
        return { ts: '{ lat: number; lng: number }', sql: 'POINT / JSONB', firestore: 'GeoPoint' };
      default:
        return { ts: 'unknown', sql: 'TEXT', firestore: 'any' };
    }
  };

  // Code generation
  const generateTypeScriptInterfaces = () => {
    return tables.map(t => {
      const fields = t.columns.map(c => {
        const optional = c.isRequired ? '' : '?';
        const typeInfo = mapTypeToWeb(c.type);
        let tsType = typeInfo.ts.split(' ')[0];
        if (c.type === 'Enum' && c.enumOptions?.length) {
          tsType = c.enumOptions.map(o => `'${o}'`).join(' | ');
        }
        return `  ${c.name}${optional}: ${tsType}; // AppSheet: ${c.type}${c.appFormula ? ` [Formula: ${c.appFormula}]` : ''}`;
      }).join('\n');

      return `export interface ${t.name} {\n${fields}\n}`;
    }).join('\n\n');
  };

  const generateSQLSchema = () => {
    return tables.map(t => {
      const cols = t.columns
        .filter(c => !c.isVirtual) // Virtual columns are computed, not stored
        .map(c => {
          const typeInfo = mapTypeToWeb(c.type);
          const pk = c.isKey ? ' PRIMARY KEY' : '';
          const notNull = c.isRequired && !c.isKey ? ' NOT NULL' : '';
          const fk = c.type === 'Ref' && c.refTable ? ` REFERENCES ${c.refTable}(id)` : '';
          return `  ${c.name.toLowerCase()} ${typeInfo.sql.split('/')[0].trim()}${pk}${notNull}${fk}`;
        }).join(',\n');

      return `CREATE TABLE ${t.name.toLowerCase()} (\n${cols}\n);`;
    }).join('\n\n');
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Mapeador de Tabelas e Esquema do AppSheet
          </h3>
          <p className="text-xs text-slate-500">
            Cadastre as tabelas do seu AppSheet para gerarmos o banco de dados fiel com tipos e chaves preservados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddTableModal(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar Tabela
          </button>
          <button
            onClick={onLoadSample}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Carregar Exemplo Modelo
          </button>
          <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />
          <button
            onClick={() => setExportModalType('ts')}
            className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5 text-blue-600" />
            TS Interfaces
          </button>
          <button
            onClick={() => setExportModalType('sql')}
            className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            SQL DDL
          </button>
        </div>
      </div>

      {/* Main layout: Sidebar with tables + Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table Selector */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tabelas Identificadas ({tables.length})
            </span>
            <span className="text-[11px] text-slate-400">Origem: Sheets / DB</span>
          </div>

          <div className="space-y-1.5">
            {tables.map(t => {
              const isSelected = t.id === activeTable?.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTableId(t.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'hover:bg-slate-100 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="truncate">
                    <div className="truncate">{t.name}</div>
                    <div className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                      {t.columns.length} colunas • PK: {t.primaryKey || 'Id'}
                    </div>
                  </div>
                  {t.rowCountEstimate && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                    }`}>
                      ~{t.rowCountEstimate} rows
                    </span>
                  )}
                </button>
              );
            })}

            {tables.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs">
                Nenhuma tabela cadastrada ainda.
                <button
                  onClick={() => setShowAddTableModal(true)}
                  className="mt-2 block mx-auto text-blue-600 hover:underline font-semibold"
                >
                  + Criar primeira tabela
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Column details editor */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          {activeTable ? (
            <>
              {/* Table header info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold text-slate-900">{activeTable.name}</h4>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                      Origem: {activeTable.sheetSource || 'Planilha Google'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chave Primária (Key): <span className="font-semibold text-slate-700">{activeTable.primaryKey}</span> • 
                    Coluna de Exibição (Label): <span className="font-semibold text-slate-700">{activeTable.labelColumn}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddColumn}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-blue-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Coluna
                  </button>
                  <button
                    onClick={() => handleRemoveTable(activeTable.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                    title="Excluir Tabela"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Columns Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">Nome da Coluna</th>
                      <th className="py-2.5 px-3 font-semibold">Tipo AppSheet</th>
                      <th className="py-2.5 px-3 font-semibold">Mapeamento Web</th>
                      <th className="py-2.5 px-2 text-center font-semibold">Key</th>
                      <th className="py-2.5 px-2 text-center font-semibold">Obrig.</th>
                      <th className="py-2.5 px-2 text-center font-semibold">Virtual</th>
                      <th className="py-2.5 px-3 font-semibold">Ref / Fórmula / Validação</th>
                      <th className="py-2.5 px-2 text-center font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeTable.columns.map((col) => {
                      const webType = mapTypeToWeb(col.type);

                      return (
                        <tr key={col.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Column Name */}
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) => handleUpdateColumn(col.id, { name: e.target.value })}
                              className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1.5 py-1 text-xs font-semibold"
                            />
                            {col.description && (
                              <div className="text-[10px] text-slate-400 pl-1.5">{col.description}</div>
                            )}
                          </td>

                          {/* AppSheet Type */}
                          <td className="py-2.5 px-3">
                            <select
                              value={col.type}
                              onChange={(e) => handleUpdateColumn(col.id, { type: e.target.value as AppSheetDataType })}
                              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 font-medium"
                            >
                              {APPSHEET_TYPES.map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </td>

                          {/* Target Web Type */}
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              {webType.ts}
                            </span>
                          </td>

                          {/* Is Key */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={col.isKey}
                              onChange={(e) => {
                                handleUpdateColumn(col.id, { isKey: e.target.checked });
                                if (e.target.checked) {
                                  onUpdateTables(tables.map(t => t.id === activeTable.id ? { ...t, primaryKey: col.name } : t));
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>

                          {/* Is Required */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={col.isRequired}
                              onChange={(e) => handleUpdateColumn(col.id, { isRequired: e.target.checked })}
                              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>

                          {/* Is Virtual */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={col.isVirtual}
                              onChange={(e) => handleUpdateColumn(col.id, { isVirtual: e.target.checked })}
                              className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                          </td>

                          {/* Ref Table or Formula details */}
                          <td className="py-2.5 px-3">
                            {col.type === 'Ref' ? (
                              <div className="flex items-center gap-1.5">
                                <Link2 className="w-3 h-3 text-blue-500" />
                                <input
                                  type="text"
                                  placeholder="Tabela de Ref (ex: Clientes)"
                                  value={col.refTable || ''}
                                  onChange={(e) => handleUpdateColumn(col.id, { refTable: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] font-mono text-blue-700"
                                />
                              </div>
                            ) : col.isVirtual || col.appFormula ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  placeholder="App Formula (ex: [Qtd] * [Preco])"
                                  value={col.appFormula || ''}
                                  onChange={(e) => handleUpdateColumn(col.id, { appFormula: e.target.value })}
                                  className="w-full bg-purple-50 border border-purple-200 rounded px-1.5 py-1 text-[11px] font-mono text-purple-800"
                                />
                              </div>
                            ) : col.type === 'Enum' ? (
                              <input
                                type="text"
                                placeholder="Opções separadas por vírgula"
                                value={col.enumOptions?.join(', ') || ''}
                                onChange={(e) => handleUpdateColumn(col.id, { 
                                  enumOptions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                                })}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px]"
                              />
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Campo padrão</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => handleRemoveColumn(col.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                              title="Remover coluna"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              Selecione uma tabela à esquerda ou crie uma nova para configurar os campos.
            </div>
          )}
        </div>
      </div>

      {/* Modal Adicionar Tabela */}
      {showAddTableModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h4 className="text-base font-bold text-slate-900 mb-1">Nova Tabela do AppSheet</h4>
            <p className="text-xs text-slate-500 mb-4">
              Informe o nome da tabela exatamente como configurado no AppSheet ou no Google Sheets.
            </p>

            <form onSubmit={handleAddTable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Tabela</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Fornecedores, Produtos, Atendimentos"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Planilha de Origem (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Planilha_Geral!Aba_Produtos"
                  value={newSheetSource}
                  onChange={(e) => setNewSheetSource(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTableModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                >
                  Salvar Tabela
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualização de Código Gerado */}
      {exportModalType && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-2xl p-6 max-w-3xl w-full shadow-2xl border border-slate-700 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Code2 className="w-4 h-4 text-blue-400" />
                {exportModalType === 'ts' ? 'Interfaces TypeScript Geradas' : 'Script SQL DDL Gerado'}
              </h4>
              <button
                onClick={() => setExportModalType(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                Fechar
              </button>
            </div>

            <div className="flex-1 overflow-auto my-4 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-blue-300">
              <pre>
                {exportModalType === 'ts' ? generateTypeScriptInterfaces() : generateSQLSchema()}
              </pre>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Gerado automaticamente a partir das definições de tabelas e colunas.</span>
              <button
                onClick={() => {
                  const content = exportModalType === 'ts' ? generateTypeScriptInterfaces() : generateSQLSchema();
                  navigator.clipboard.writeText(content);
                  alert('Código copiado para a área de transferência!');
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg"
              >
                Copiar Código
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
