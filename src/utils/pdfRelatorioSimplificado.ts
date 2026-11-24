import type jsPDF from 'jspdf';
import { PatrimonioRecord } from '../types/appsheet';
import { GERENTES_LIST } from '../components/AppSheetPatrimonioForm';
import { BRASAO_CAPANEMA_PNG_BASE64 } from './brasaoBase64';

export interface GerarPdfOptions {
  secretaria: string;
  local?: string; // Local / Unidade único ('Todos' ou nome de 1 local)
  locais?: string[]; // Lista de Locais / Unidades selecionados (vazio = Todos)
  departamento?: string; // Para compatibilidade com filtro único ('Todos' ou nome de 1 depto)
  departamentos?: string[]; // Lista de departamentos selecionados
  modoOrganizacao?: 'continuo' | 'separado'; // 'continuo' economiza papel agrupando na mesma folha; 'separado' quebra 1 folha por setor
  incluirColunaLocal?: boolean;
  incluirColunaDepartamento?: boolean;
  patrimonios: PatrimonioRecord[];
  nomeDiretorDpp?: string;
  cargoDiretorDpp?: string;
}

/**
 * Gera e faz download de um PDF oficial da Prefeitura Municipal de Capanema
 * contendo o Número do Tombamento e a Descrição do Bem,
 * com suporte ao modo contínuo (economia drástica de papel) ou página individual por departamento.
 */
export async function gerarRelatorioPdfTombamentoDescricao({
  secretaria,
  local,
  locais = [],
  departamento = 'Todos',
  departamentos = [],
  modoOrganizacao = 'continuo',
  incluirColunaLocal,
  incluirColunaDepartamento,
  patrimonios,
  nomeDiretorDpp = 'Eliel da Silva Marques',
  cargoDiretorDpp = 'Diretor de Patrimônio Público (DPP)'
}: GerarPdfOptions): Promise<void> {
  // Normalizar lista de locais selecionados
  let listaLocais: string[] = [];
  if (locais && locais.length > 0) {
    const vistosLoc = new Set<string>();
    locais.forEach(l => {
      if (l && l !== 'Todos') {
        const chave = l.trim().toLowerCase();
        if (!vistosLoc.has(chave)) {
          vistosLoc.add(chave);
          listaLocais.push(l.trim());
        }
      }
    });
    listaLocais.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  } else if (local && local !== 'Todos') {
    listaLocais = [local.trim()];
  }
  const locaisSet = new Set(listaLocais.map(l => l.trim().toLowerCase()));

  // 1. Filtrar base geral pela secretaria e locais selecionados
  const bensDaSecretaria = (secretaria === 'Todas' || !secretaria
    ? patrimonios
    : patrimonios.filter(p => p.secretariaSetor === secretaria)
  ).filter(p => {
    if (locaisSet.size === 0) return true;
    const locBem = (p.local || p.localizacaoExata || '').trim().toLowerCase();
    return locaisSet.has(locBem);
  });

  // Normalizar lista de departamentos (sem duplicatas por maiúscula/minúscula, em ordem alfabética)
  let listaDeptos: string[] = [];
  if (departamentos && departamentos.length > 0) {
    const vistos = new Set<string>();
    departamentos.forEach(d => {
      if (d && d !== 'Todos') {
        const chave = d.trim().toLowerCase();
        if (!vistos.has(chave)) {
          vistos.add(chave);
          listaDeptos.push(d.trim());
        }
      }
    });
    listaDeptos.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  } else if (departamento && departamento !== 'Todos') {
    listaDeptos = [departamento.trim()];
  }

  // 2. Instanciar jsPDF (orientação portrait A4).
  // jsPDF e jspdf-autotable sao carregados sob demanda: sao ~250 KB e so
  // interessam no momento em que o servidor gera o PDF.
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Localizar gestor da secretaria
  const gerenteInfo = GERENTES_LIST.find(g => g.secretaria === secretaria);
  const nomeGestor = gerenteInfo?.nome || 'Responsável Setorial';
  const labelSecretaria = secretaria === 'Todas' ? 'TODAS AS SECRETARIAS REUNIDAS' : secretaria.toUpperCase();
  const labelLocal = listaLocais.length === 0
    ? 'TODOS OS LOCAIS / UNIDADES'
    : listaLocais.length === 1
    ? listaLocais[0].toUpperCase()
    : `${listaLocais.length} LOCAIS SELECIONADOS`;

  const deveExibirColunaLocal = incluirColunaLocal !== false;
  const deveExibirColunaDepartamento = incluirColunaDepartamento !== false;
  const startY = deveExibirColunaLocal ? 49 : 44;

  // Helper para desenhar o cabeçalho oficial minimalista conforme solicitado
  const desenharCabecalho = (
    nomeDeptoAtual?: string, 
    totalBensDepto?: number,
    indiceDepto?: number,
    totalDeptos?: number
  ) => {
    // Imagem do Brasão Oficial da Prefeitura de Capanema - PA
    try {
      doc.addImage(BRASAO_CAPANEMA_PNG_BASE64, 'PNG', 14, 7.5, 11, 14);
    } catch (e) {
      // continua sem imagem se houver incompatibilidade
    }

    // Títulos oficiais
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('PREFEITURA MUNICIPAL DE CAPANEMA', 28, 14);

    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('DIRETORIA DE PATRIMÔNIO PÚBLICO (DPP)', 28, 19);

    // Linha divisória
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(14, 23.5, pageWidth - 14, 23.5);

    // Caixa de Identificação (3 linhas se Local estiver incluído; 2 linhas se oculto)
    const cardHeight = deveExibirColunaLocal ? 20 : 14.5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 26, pageWidth - 28, cardHeight, 1.5, 1.5, 'FD');

    // Linha 1: SECRETARIA / ÓRGÃO (esquerda) e Total de Bens (direita)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`SECRETARIA / ÓRGÃO: ${labelSecretaria}`, 17, 31);

    const qtdExibir = totalBensDepto !== undefined ? totalBensDepto : bensDaSecretaria.length;
    doc.text(`Total de Bens: ${qtdExibir.toLocaleString('pt-BR')} ${qtdExibir === 1 ? 'item' : 'itens'}`, pageWidth - 17, 31, { align: 'right' });

    const tagLote = totalDeptos && totalDeptos > 1 ? ` (${indiceDepto} de ${totalDeptos})` : '';
    const labelDepto = nomeDeptoAtual ? `${nomeDeptoAtual.toUpperCase()}${tagLote}` : 'TODOS OS DEPARTAMENTOS';

    if (deveExibirColunaLocal) {
      // Linha 2: LOCAL / UNIDADE (esquerda) e Data (direita)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 58, 138); // blue-900
      doc.text(`LOCAL / UNIDADE: ${labelLocal}`, 17, 36.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Data: ${dataHoje}`, pageWidth - 17, 36.5, { align: 'right' });

      // Linha 3: DEPARTAMENTO / SETOR (esquerda)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`DEPARTAMENTO / SETOR: ${labelDepto}`, 17, 42);
    } else {
      // Linha 2: DEPARTAMENTO / SETOR (esquerda) e Data (direita)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`DEPARTAMENTO / SETOR: ${labelDepto}`, 17, 36.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Data: ${dataHoje}`, pageWidth - 17, 36.5, { align: 'right' });
    }
  };

  const compararTombamento = (a: PatrimonioRecord, b: PatrimonioRecord) => {
    const refA = (a.numeroTombamento || a.etiquetaNumero || '').replace(/\D/g, '');
    const refB = (b.numeroTombamento || b.etiquetaNumero || '').replace(/\D/g, '');
    const numA = parseInt(refA, 10);
    const numB = parseInt(refB, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return (a.numeroTombamento || a.etiquetaNumero || a.id).localeCompare(b.numeroTombamento || b.etiquetaNumero || b.id);
  };

  // Helper para ordenar bens dentro de um mesmo departamento (por Local / Unidade -> Nº Tombamento)
  const ordenarBens = (lista: PatrimonioRecord[]) => {
    return [...lista].sort((a, b) => {
      const locA = (a.local || a.localizacaoExata || 'Sede / Geral').trim();
      const locB = (b.local || b.localizacaoExata || 'Sede / Geral').trim();
      const cmpLoc = locA.localeCompare(locB, 'pt-BR', { sensitivity: 'base' });
      if (cmpLoc !== 0) return cmpLoc;
      return compararTombamento(a, b);
    });
  };

  // Helper para ordenar relatório geral em sequência hierárquica (Local -> Departamento -> Tombamento)
  const ordenarBensHierarquia = (lista: PatrimonioRecord[]) => {
    return [...lista].sort((a, b) => {
      const locA = (a.local || a.localizacaoExata || 'Sede / Geral').trim();
      const locB = (b.local || b.localizacaoExata || 'Sede / Geral').trim();
      const depA = (a.departamento || 'Setor Geral').trim();
      const depB = (b.departamento || 'Setor Geral').trim();

      if (deveExibirColunaLocal && listaLocais.length !== 1) {
        const cmpLoc = locA.localeCompare(locB, 'pt-BR', { sensitivity: 'base' });
        if (cmpLoc !== 0) return cmpLoc;
        const cmpDep = depA.localeCompare(depB, 'pt-BR', { sensitivity: 'base' });
        if (cmpDep !== 0) return cmpDep;
      } else {
        const cmpDep = depA.localeCompare(depB, 'pt-BR', { sensitivity: 'base' });
        if (cmpDep !== 0) return cmpDep;
        const cmpLoc = locA.localeCompare(locB, 'pt-BR', { sensitivity: 'base' });
        if (cmpLoc !== 0) return cmpLoc;
      }

      return compararTombamento(a, b);
    });
  };

  // =========================================================================
  // CENÁRIO 1: MODO CONTÍNUO (ECONOMIA DE PAPEL) - Tabela única corrida sem divisões
  // =========================================================================
  if (modoOrganizacao === 'continuo' && listaDeptos.length > 0) {
    const departamentosSet = new Set(listaDeptos.map(d => d.trim().toLowerCase()));
    const bensFiltrados = bensDaSecretaria.filter(p => {
      const d = (p.departamento || p.localizacaoExata || '').trim().toLowerCase();
      return departamentosSet.has(d);
    });
    const bensOrdenados = ordenarBensHierarquia(bensFiltrados);
    const totalBensLote = bensOrdenados.length;

    const headCols = ['Item', 'Nº Tombamento', 'Descrição do Bem Patrimonial'];
    if (deveExibirColunaLocal) headCols.push('Local / Unidade');
    if (deveExibirColunaDepartamento) headCols.push('Departamento / Setor');
    const headContinuo = [headCols];

    const tableBody = bensOrdenados.map((bem, idx) => {
      const row = [
        (idx + 1).toString(),
        bem.numeroTombamento || bem.etiquetaNumero || '—',
        bem.descricao ? bem.descricao.trim() : 'Sem descrição cadastrada'
      ];
      if (deveExibirColunaLocal) {
        row.push(bem.local || bem.localizacaoExata || 'Sede / Geral');
      }
      if (deveExibirColunaDepartamento) {
        row.push(bem.departamento || bem.localizacaoExata || 'Setor Geral');
      }
      return row;
    });

    const emptyRowCols = ['—', '—', 'Nenhum bem tombado registrado para os departamentos selecionados'];
    if (deveExibirColunaLocal) emptyRowCols.push('—');
    if (deveExibirColunaDepartamento) emptyRowCols.push('—');

    const labelDeptoHeader = listaDeptos.length === 1 
      ? listaDeptos[0].toUpperCase() 
      : `${listaDeptos.length} DEPARTAMENTOS SELECIONADOS`;

    const colStylesContinuo: Record<number, any> =
      deveExibirColunaLocal && deveExibirColunaDepartamento
        ? {
            0: { halign: 'center', cellWidth: 11, textColor: [100, 116, 139] },
            1: { halign: 'center', cellWidth: 25, fontStyle: 'bold', textColor: [30, 58, 138] },
            2: { halign: 'left' },
            3: { halign: 'left', cellWidth: 38, textColor: [30, 58, 138], fontSize: 7.5 },
            4: { halign: 'left', cellWidth: 34, textColor: [71, 85, 105], fontSize: 7.5 }
          }
        : deveExibirColunaLocal || deveExibirColunaDepartamento
        ? {
            0: { halign: 'center', cellWidth: 12, textColor: [100, 116, 139] },
            1: { halign: 'center', cellWidth: 28, fontStyle: 'bold', textColor: [30, 58, 138] },
            2: { halign: 'left' },
            3: { halign: 'left', cellWidth: 46, textColor: [71, 85, 105], fontSize: 7.5 }
          }
        : {
            0: { halign: 'center', cellWidth: 14, textColor: [100, 116, 139] },
            1: { halign: 'center', cellWidth: 32, fontStyle: 'bold', textColor: [30, 58, 138] },
            2: { halign: 'left' }
          };

    autoTable(doc, {
      startY,
      margin: { left: 14, right: 14, top: startY, bottom: 14 },
      head: headContinuo,
      body: tableBody.length > 0 ? tableBody : [emptyRowCols],
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
        cellPadding: 2.5
      },
      columnStyles: colStylesContinuo,
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didDrawPage: () => {
        desenharCabecalho(labelDeptoHeader, totalBensLote);
      }
    });

  // =========================================================================
  // CENÁRIO 2: MODO SEPARADO (1 Página por Departamento)
  // =========================================================================
  } else if (listaDeptos.length > 0) {
    const headSeparado = deveExibirColunaLocal
      ? [['Item', 'Nº Tombamento', 'Descrição do Bem Patrimonial', 'Local / Unidade']]
      : [['Item', 'Nº Tombamento', 'Descrição do Bem Patrimonial']];

    const colStylesSeparado: Record<number, any> = deveExibirColunaLocal
      ? {
          0: { halign: 'center', cellWidth: 12, textColor: [100, 116, 139] },
          1: { halign: 'center', cellWidth: 28, fontStyle: 'bold', textColor: [30, 58, 138] },
          2: { halign: 'left' },
          3: { halign: 'left', cellWidth: 46, textColor: [71, 85, 105], fontSize: 7.5 }
        }
      : {
          0: { halign: 'center', cellWidth: 14, textColor: [100, 116, 139] },
          1: { halign: 'center', cellWidth: 32, fontStyle: 'bold', textColor: [30, 58, 138] },
          2: { halign: 'left' }
        };

    listaDeptos.forEach((deptoNome, idx) => {
      if (idx > 0) {
        doc.addPage();
      }

      const bensDoDepto = ordenarBens(
        bensDaSecretaria.filter(p => {
          const d = (p.departamento || p.localizacaoExata || '').trim().toLowerCase();
          return d === deptoNome.trim().toLowerCase();
        })
      );

      const rows = bensDoDepto.map((bem, itemIdx) => {
        const itemNum = (itemIdx + 1).toString();
        const tombo = bem.numeroTombamento || bem.etiquetaNumero || '—';
        const desc = bem.descricao ? bem.descricao.trim() : 'Sem descrição cadastrada';
        const locNome = bem.local || bem.localizacaoExata || 'Sede / Geral';
        return deveExibirColunaLocal
          ? [itemNum, tombo, desc, locNome]
          : [itemNum, tombo, desc];
      });

      const emptyRow = deveExibirColunaLocal
        ? [['—', '—', 'Nenhum bem tombado registrado para este departamento', '—']]
        : [['—', '—', 'Nenhum bem tombado registrado para este departamento']];

      autoTable(doc, {
        startY,
        margin: { left: 14, right: 14, top: startY, bottom: 14 },
        head: headSeparado,
        body: rows.length > 0 ? rows : emptyRow,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 2,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
          cellPadding: 2.5
        },
        columnStyles: colStylesSeparado,
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        didDrawPage: () => {
          desenharCabecalho(deptoNome, bensDoDepto.length, idx + 1, listaDeptos.length);
        }
      });
    });

  // =========================================================================
  // CENÁRIO 3: TODOS OS DEPARTAMENTOS REUNIDOS (ORDENADOS EM SEQUÊNCIA POR LOCAL E DEPARTAMENTO)
  // =========================================================================
  } else {
    const bensOrdenados = ordenarBensHierarquia(bensDaSecretaria);

    const headCols = ['Item', 'Nº Tombamento', 'Descrição do Bem Patrimonial'];
    if (deveExibirColunaLocal) headCols.push('Local / Unidade');
    if (deveExibirColunaDepartamento) headCols.push('Departamento / Setor');
    const headColumns = [headCols];

    const rows = bensOrdenados.map((bem, idx) => {
      const row = [
        (idx + 1).toString(),
        bem.numeroTombamento || bem.etiquetaNumero || '—',
        bem.descricao ? bem.descricao.trim() : 'Sem descrição cadastrada'
      ];
      if (deveExibirColunaLocal) {
        row.push(bem.local || bem.localizacaoExata || 'Sede / Geral');
      }
      if (deveExibirColunaDepartamento) {
        row.push(bem.departamento || bem.localizacaoExata || 'Setor Geral');
      }
      return row;
    });

    const columnStyles: Record<number, any> =
      deveExibirColunaLocal && deveExibirColunaDepartamento
        ? {
            0: { halign: 'center', cellWidth: 11, textColor: [100, 116, 139] },
            1: { halign: 'center', cellWidth: 25, fontStyle: 'bold', textColor: [30, 58, 138] },
            2: { halign: 'left' },
            3: { halign: 'left', cellWidth: 38, textColor: [30, 58, 138], fontSize: 7.5 },
            4: { halign: 'left', cellWidth: 32, textColor: [71, 85, 105], fontSize: 7.5 }
          }
        : deveExibirColunaLocal || deveExibirColunaDepartamento
        ? {
            0: { halign: 'center', cellWidth: 12, textColor: [100, 116, 139] },
            1: { halign: 'center', cellWidth: 28, fontStyle: 'bold', textColor: [30, 58, 138] },
            2: { halign: 'left' },
            3: { halign: 'left', cellWidth: 46, textColor: [71, 85, 105], fontSize: 7.5 }
          }
        : {
            0: { halign: 'center', cellWidth: 14, textColor: [100, 116, 139] },
            1: { halign: 'center', cellWidth: 32, fontStyle: 'bold', textColor: [30, 58, 138] },
            2: { halign: 'left' }
          };

    autoTable(doc, {
      startY,
      margin: { left: 14, right: 14, top: startY, bottom: 14 },
      head: headColumns,
      body: rows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
        cellPadding: 2.5
      },
      columnStyles,
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didDrawPage: () => {
        desenharCabecalho();
      }
    });
  }

  // =========================================================================
  // 4. CORREÇÃO GLOBAL DA NUMERAÇÃO DE PÁGINAS NO RODAPÉ ("Página X de Y")
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    const descLocalRodape = deveExibirColunaLocal
      ? (listaLocais.length === 1
          ? `${listaLocais[0]} • `
          : listaLocais.length > 1
          ? `${listaLocais.length} Locais • `
          : '')
      : '';
    const descSetorRodape = listaDeptos.length === 1
      ? `(${descLocalRodape}${listaDeptos[0]})`
      : listaDeptos.length > 1
      ? `(${descLocalRodape}${listaDeptos.length} Departamentos)`
      : `(${descLocalRodape}Geral)`;

    const textoRodape = `Prefeitura Municipal de Capanema • DPP • Relatório Oficial ${descSetorRodape} • Emissão em ${dataHoje}`;
    doc.text(textoRodape, 14, pageHeight - 6);

    const paginaStr = `Página ${i} de ${totalPages}`;
    doc.text(paginaStr, pageWidth - 14, pageHeight - 6, { align: 'right' });
  }

  // =========================================================================
  // 5. SALVAR O ARQUIVO PDF COM NOME TRATADO (SEM ACENTOS CORROMPIDOS)
  // =========================================================================
  const secLimpa = (secretaria === 'Todas' ? 'Todas_Secretarias' : secretaria)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_');

  let sufixoLocal = '';
  if (listaLocais.length === 1) {
    const locLimpo = listaLocais[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
    sufixoLocal = `_${locLimpo}`;
  } else if (listaLocais.length > 1) {
    sufixoLocal = `_${listaLocais.length}_Locais`;
  }

  let sufixoDeptos = '';
  if (listaDeptos.length === 1) {
    const depLimpo = listaDeptos[0]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_');
    sufixoDeptos = `_${depLimpo}`;
  } else if (listaDeptos.length > 1) {
    sufixoDeptos = `_${listaDeptos.length}_Departamentos`;
  }

  const sufixoModo = modoOrganizacao === 'continuo' ? '_Continuo' : '_Paginado';
  const nomeArquivo = `Relatorio_Bens_${secLimpa}${sufixoLocal}${sufixoDeptos}${sufixoModo}_Tombamento_Descricao.pdf`;
  doc.save(nomeArquivo);
}
