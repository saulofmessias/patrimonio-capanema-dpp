import type jsPDF from 'jspdf';
import { PatrimonioRecord } from '../types/appsheet';
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
  incluirColunaConservacao?: boolean;
  incluirColunaConferencia?: boolean;
  patrimonios: PatrimonioRecord[];
  nomeDiretorDpp?: string;
  cargoDiretorDpp?: string;
  nomeEmissor?: string;
}

function resumirConservacao(estado?: string): string {
  const s = (estado || '').trim();
  if (!s) return '—';
  if (s.toLowerCase().startsWith('inserv')) return 'Inservível';
  if (s.toLowerCase().startsWith('ruim')) return 'Ruim';
  return s;
}

function truncarTexto(texto: string, maxChars: number): string {
  if (texto.length <= maxChars) return texto;
  return `${texto.slice(0, maxChars - 1)}…`;
}

/**
 * Gera e faz download de um PDF oficial da Prefeitura Municipal de Capanema
 * contendo o Número do Tombamento, Descrição do Bem e colunas opcionais
 * (Local, Departamento, Estado de Conservação e Conferência física),
 * com suporte ao modo contínuo ou página individual por departamento.
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
  incluirColunaConservacao = false,
  incluirColunaConferencia = false,
  patrimonios,
  nomeEmissor,
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

  // 2. Instanciar jsPDF (orientação portrait A4) sob demanda.
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc: jsPDF = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const agora = new Date();
  const dataHoje = agora.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const horaEmissao = agora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const labelSecretaria = secretaria === 'Todas' ? 'TODAS AS SECRETARIAS REUNIDAS' : secretaria.toUpperCase();
  const labelLocal = listaLocais.length === 0
    ? 'TODOS OS LOCAIS / UNIDADES'
    : listaLocais.length === 1
    ? listaLocais[0].toUpperCase()
    : `${listaLocais.length} LOCAIS SELECIONADOS`;

  const deveExibirColunaLocal = incluirColunaLocal !== false;
  const deveExibirColunaDepartamento = incluirColunaDepartamento !== false;
  const startY = deveExibirColunaLocal ? 49 : 44;

  // Helper para desenhar o cabeçalho oficial em todas as páginas
  const desenharCabecalho = (
    nomeDeptoAtual?: string,
    totalBensDepto?: number,
    indiceDepto?: number,
    totalDeptos?: number
  ) => {
    try {
      doc.addImage(BRASAO_CAPANEMA_PNG_BASE64, 'PNG', 14, 7.5, 11, 14);
    } catch {
      // continua sem imagem se houver incompatibilidade
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('PREFEITURA MUNICIPAL DE CAPANEMA', 28, 13.5);

    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('DIRETORIA DE PATRIMÔNIO PÚBLICO (DPP) • RELATÓRIO OFICIAL DE BENS', 28, 18.5);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(14, 23.5, pageWidth - 14, 23.5);

    const cardHeight = deveExibirColunaLocal ? 20 : 14.5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 26, pageWidth - 28, cardHeight, 1.5, 1.5, 'FD');

    // Linha 1: SECRETARIA / ÓRGÃO (esquerda) e Total de Bens (direita)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(truncarTexto(`SECRETARIA / ÓRGÃO: ${labelSecretaria}`, 72), 17, 31);

    const qtdExibir = totalBensDepto !== undefined ? totalBensDepto : bensDaSecretaria.length;
    doc.text(
      `Total de Bens: ${qtdExibir.toLocaleString('pt-BR')} ${qtdExibir === 1 ? 'item' : 'itens'}`,
      pageWidth - 17,
      31,
      { align: 'right' }
    );

    const tagLote = totalDeptos && totalDeptos > 1 ? ` (${indiceDepto} de ${totalDeptos})` : '';
    const labelDepto = nomeDeptoAtual ? `${nomeDeptoAtual.toUpperCase()}${tagLote}` : 'TODOS OS DEPARTAMENTOS';

    if (deveExibirColunaLocal) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 58, 138);
      doc.text(truncarTexto(`LOCAL / UNIDADE: ${labelLocal}`, 68), 17, 36.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Data: ${dataHoje}`, pageWidth - 17, 36.5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(truncarTexto(`DEPARTAMENTO / SETOR: ${labelDepto}`, 92), 17, 42);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(truncarTexto(`DEPARTAMENTO / SETOR: ${labelDepto}`, 66), 17, 36.5);

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
    return (a.numeroTombamento || a.etiquetaNumero || a.id).localeCompare(
      b.numeroTombamento || b.etiquetaNumero || b.id
    );
  };

  const ordenarBens = (lista: PatrimonioRecord[]) => {
    return [...lista].sort((a, b) => {
      const locA = (a.local || a.localizacaoExata || 'Sede / Geral').trim();
      const locB = (b.local || b.localizacaoExata || 'Sede / Geral').trim();
      const cmpLoc = locA.localeCompare(locB, 'pt-BR', { sensitivity: 'base' });
      if (cmpLoc !== 0) return cmpLoc;
      return compararTombamento(a, b);
    });
  };

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

  // Construtor dinâmico de cabeçalho, linhas e larguras de coluna (compatível com todas as combinações)
  const montarEstruturaTabela = (
    bens: PatrimonioRecord[],
    mostrarLocal: boolean,
    mostrarDepto: boolean,
    mensagemVazia: string
  ) => {
    const headCols: string[] = ['Item', 'Nº Tombamento', 'Descrição do Bem Patrimonial'];
    const colStyles: Record<number, Record<string, unknown>> = {
      0: { halign: 'center', cellWidth: 11, textColor: [100, 116, 139] },
      1: { halign: 'center', cellWidth: 24, fontStyle: 'bold', textColor: [30, 58, 138] },
      2: { halign: 'left' },
    };

    let colIdx = 3;
    const extrasCount =
      (mostrarLocal ? 1 : 0) +
      (mostrarDepto ? 1 : 0) +
      (incluirColunaConservacao ? 1 : 0) +
      (incluirColunaConferencia ? 1 : 0);

    if (mostrarLocal) {
      headCols.push('Local / Unidade');
      colStyles[colIdx++] = {
        halign: 'left',
        cellWidth: extrasCount >= 3 ? 32 : 40,
        textColor: [30, 58, 138],
        fontSize: 7.5,
      };
    }
    if (mostrarDepto) {
      headCols.push('Departamento / Setor');
      colStyles[colIdx++] = {
        halign: 'left',
        cellWidth: extrasCount >= 3 ? 30 : 40,
        textColor: [71, 85, 105],
        fontSize: 7.5,
      };
    }
    if (incluirColunaConservacao) {
      headCols.push('Estado');
      colStyles[colIdx++] = {
        halign: 'center',
        cellWidth: 19,
        textColor: [51, 65, 85],
        fontSize: 7.5,
      };
    }
    if (incluirColunaConferencia) {
      headCols.push('Conf.');
      colStyles[colIdx++] = {
        halign: 'center',
        cellWidth: 12,
        textColor: [100, 116, 139],
        fontSize: 8,
      };
    }

    const rows = bens.map((bem, idx) => {
      const row: string[] = [
        (idx + 1).toString(),
        bem.numeroTombamento || bem.etiquetaNumero || '—',
        bem.descricao ? bem.descricao.trim() : 'Sem descrição cadastrada',
      ];
      if (mostrarLocal) row.push(bem.local || bem.localizacaoExata || 'Sede / Geral');
      if (mostrarDepto) row.push(bem.departamento || bem.localizacaoExata || 'Setor Geral');
      if (incluirColunaConservacao) row.push(resumirConservacao(bem.estadoConservacao));
      if (incluirColunaConferencia) row.push('[   ]');
      return row;
    });

    const emptyRow = ['—', '—', mensagemVazia];
    while (emptyRow.length < headCols.length) emptyRow.push('—');

    return {
      head: [headCols],
      body: rows.length > 0 ? rows : [emptyRow],
      columnStyles: colStyles,
    };
  };

  // =========================================================================
  // CENÁRIO 1: MODO CONTÍNUO (ECONOMIA DE PAPEL)
  // =========================================================================
  if (modoOrganizacao === 'continuo' && listaDeptos.length > 0) {
    const departamentosSet = new Set(listaDeptos.map(d => d.trim().toLowerCase()));
    const bensFiltrados = bensDaSecretaria.filter(p => {
      const d = (p.departamento || p.localizacaoExata || '').trim().toLowerCase();
      return departamentosSet.has(d);
    });
    const bensOrdenados = ordenarBensHierarquia(bensFiltrados);
    const totalBensLote = bensOrdenados.length;

    const { head, body, columnStyles } = montarEstruturaTabela(
      bensOrdenados,
      false,
      deveExibirColunaDepartamento,
      'Nenhum bem tombado registrado para os departamentos selecionados'
    );

    const labelDeptoHeader = listaDeptos.length === 1
      ? listaDeptos[0].toUpperCase()
      : `${listaDeptos.length} DEPARTAMENTOS SELECIONADOS`;

    autoTable(doc, {
      startY,
      margin: { left: 14, right: 14, top: startY, bottom: 14 },
      head,
      body,
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
        fontSize: 7.8,
        halign: 'left',
        cellPadding: 2.3
      },
      columnStyles,
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

      const { head, body, columnStyles } = montarEstruturaTabela(
        bensDoDepto,
        false,
        false,
        'Nenhum bem tombado registrado para este departamento'
      );

      autoTable(doc, {
        startY,
        margin: { left: 14, right: 14, top: startY, bottom: 14 },
        head,
        body,
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
          fontSize: 7.8,
          halign: 'left',
          cellPadding: 2.3
        },
        columnStyles,
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        didDrawPage: () => {
          desenharCabecalho(deptoNome, bensDoDepto.length, idx + 1, listaDeptos.length);
        }
      });
    });

  // =========================================================================
  // CENÁRIO 3: TODOS OS DEPARTAMENTOS REUNIDOS
  // =========================================================================
  } else {
    const bensOrdenados = ordenarBensHierarquia(bensDaSecretaria);

    const { head, body, columnStyles } = montarEstruturaTabela(
      bensOrdenados,
      false,
      deveExibirColunaDepartamento,
      'Nenhum bem tombado registrado para os filtros selecionados'
    );

    autoTable(doc, {
      startY,
      margin: { left: 14, right: 14, top: startY, bottom: 14 },
      head,
      body,
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
        fontSize: 7.8,
        halign: 'left',
        cellPadding: 2.3
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
  // 4. RODAPÉ OFICIAL COM EMISSOR, DATA/HORA E NUMERAÇÃO ("Página X de Y")
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  const emissorStr = nomeEmissor ? ` • Emitido por: ${truncarTexto(nomeEmissor, 30)}` : '';
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);

    const textoRodape = `Prefeitura de Capanema • DPP • Emissão: ${dataHoje} às ${horaEmissao}${emissorStr}`;
    doc.text(textoRodape, 14, pageHeight - 6);

    const paginaStr = `Página ${i} de ${totalPages}`;
    doc.text(paginaStr, pageWidth - 14, pageHeight - 6, { align: 'right' });
  }

  // =========================================================================
  // 5. SALVAR O ARQUIVO PDF COM NOME TRATADO
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
