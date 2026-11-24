import React, { useState } from 'react';
import { TableDefinition } from '../types/appsheet';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X, ShieldAlert, ArrowRight, Download } from 'lucide-react';

interface Props {
  tables: TableDefinition[];
  onClose: () => void;
}

interface ValidationResult {
  totalRows: number;
  validRows: number;
  duplicateKeys: string[];
  missingRequired: { row: number; column: string }[];
  orphanRefs: { row: number; column: string; value: string }[];
  sampleData: Record<string, string>[];
}

export const DataImporterModal: React.FC<Props> = ({ tables, onClose }) => {
  const [selectedTableId, setSelectedTableId] = useState<string>(tables[0]?.id || '');
  const [rawText, setRawText] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const targetTable = tables.find(t => t.id === selectedTableId) || tables[0];

  const handleParseAndValidate = () => {
    if (!rawText.trim() || !targetTable) return;

    // Detect delimiter (tab for Google Sheets copy-paste, comma or semicolon for CSV)
    const lines = rawText.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      alert('É necessário ao menos 1 linha de cabeçalho e 1 linha de dados.');
      return;
    }

    const firstLine = lines[0];
    let delimiter = '\t';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';')) delimiter = ';';
    else if (firstLine.includes(',')) delimiter = ',';

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1);

    const keyColName = targetTable.primaryKey || 'Id';
    const keyColIndex = headers.findIndex(h => h.toLowerCase() === keyColName.toLowerCase());

    const keySet = new Set<string>();
    const duplicateKeys: string[] = [];
    const missingRequired: { row: number; column: string }[] = [];
    const orphanRefs: { row: number; column: string; value: string }[] = [];
    const sampleData: Record<string, string>[] = [];

    // Identify required columns
    const requiredCols = targetTable.columns.filter(c => c.isRequired && !c.isVirtual);

    rows.forEach((line, rowIdx) => {
      const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
      const record: Record<string, string> = {};

      headers.forEach((h, colIdx) => {
        record[h] = values[colIdx] || '';
      });

      if (rowIdx < 5) {
        sampleData.push(record);
      }

      // Check primary key
      if (keyColIndex !== -1) {
        const keyVal = values[keyColIndex];
        if (!keyVal) {
          missingRequired.push({ row: rowIdx + 2, column: keyColName });
        } else if (keySet.has(keyVal)) {
          duplicateKeys.push(keyVal);
        } else {
          keySet.add(keyVal);
        }
      }

      // Check required fields
      requiredCols.forEach(req => {
        const val = record[req.name];
        if (val === undefined || val === '') {
          missingRequired.push({ row: rowIdx + 2, column: req.name });
        }
      });
    });

    setValidationResult({
      totalRows: rows.length,
      validRows: rows.length - (duplicateKeys.length + missingRequired.length),
      duplicateKeys: Array.from(new Set(duplicateKeys)),
      missingRequired,
      orphanRefs,
      sampleData
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Central de Importação e Validação de Dados (Google Sheets / CSV)
              </h3>
              <p className="text-xs text-slate-500">
                Transfira dados com segurança, preservando chaves primárias e checando integridade.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selecione a Tabela de Destino
              </label>
              <select
                value={selectedTableId}
                onChange={(e) => {
                  setSelectedTableId(e.target.value);
                  setValidationResult(null);
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
              >
                {tables.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} (PK: {t.primaryKey || 'Id'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Formato Suportado
              </label>
              <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
                Copiar e colar diretamente do <strong>Google Sheets</strong> (TSV) ou arquivo CSV com cabeçalhos.
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cole os Dados da Planilha ou CSV (com a 1ª linha de cabeçalhos)
            </label>
            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Exemplo colado do Sheets:&#10;Id	NomeRazaoSocial	CpfCnpj	Status&#10;c_101	Empresa Alpha	12345678000199	Ativo&#10;c_102	Beta Serviços	98765432000188	Ativo"
              className="w-full font-mono text-xs border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleParseAndValidate}
              disabled={!rawText.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              Executar Validação de Integridade
            </button>
          </div>

          {/* Validation Results Report */}
          {validationResult && (
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs text-slate-500">Total de Linhas</div>
                  <div className="text-lg font-bold text-slate-900">{validationResult.totalRows}</div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                  <div className="text-xs text-emerald-700 font-semibold">Linhas Válidas</div>
                  <div className="text-lg font-bold text-emerald-800">{validationResult.validRows}</div>
                </div>
                <div className={`p-3 rounded-xl border text-center ${
                  validationResult.duplicateKeys.length > 0 || validationResult.missingRequired.length > 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="text-xs text-amber-700 font-semibold">Inconsistências</div>
                  <div className="text-lg font-bold text-amber-800">
                    {validationResult.duplicateKeys.length + validationResult.missingRequired.length}
                  </div>
                </div>
              </div>

              {/* Alert if duplicates or missing */}
              {validationResult.duplicateKeys.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <strong>Chaves duplicadas detectadas:</strong> {validationResult.duplicateKeys.join(', ')}.
                    O AppSheet requer chaves primárias 100% únicas para não corromper referências.
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">
                  Amostra dos Dados Validados (Primeiras linhas)
                </span>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-700 font-semibold">
                      <tr>
                        {Object.keys(validationResult.sampleData[0] || {}).map(h => (
                          <th key={h} className="py-2 px-3 border-b">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validationResult.sampleData.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="py-1.5 px-3 font-mono text-slate-700">{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Regra do Projeto: Nunca alterar nem apagar os dados da planilha original durante a migração.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
          >
            Concluir / Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
