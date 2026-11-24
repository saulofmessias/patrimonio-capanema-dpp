import type jsPDF from 'jspdf';
import { PatrimonioRecord } from '../types/appsheet';
import {
  buildEtiquetaQrPayload,
  QrPayloadMode
} from './etiquetaQr';
import { BRASAO_CAPANEMA_PNG_BASE64 } from './brasaoBase64';

export type FormatoEtiquetaPdf =
  | 'capanema-50x35'
  | 'a4-capanema-50x35'
  | 'termica-50x30'
  | 'termica-70x40'
  | 'termica-100x50'
  | 'a4-pimaco-6180'
  | 'a4-pimaco-6182';

export type EstiloVisualPdf =
  | 'capanema-azul-oficial'
  | 'capanema-mono-termica'
  | 'detalhado-completo';

export interface FormatoPdfMeta {
  tipo: 'termica' | 'a4';
  colunas: number;
  linhas: number;
  etiquetasPorFolha: number;
  larguraMm: number;
  alturaMm: number;
}

export interface GerarPdfEtiquetasOptions {
  etiquetas: (PatrimonioRecord | null)[];
  formato: FormatoEtiquetaPdf;
  formatoInfo: FormatoPdfMeta;
  estiloVisual: EstiloVisualPdf;
  qrMode: QrPayloadMode;
  qrBaseUrl?: string;
  qrCodeUrls?: Record<string, string>;
  onProgress?: (percent: number) => void;
}

interface LoadedBrasao {
  colorDataUrl: string;
  monoDataUrl: string;
  aspectRatio: number;
}

function getNumeroEtiquetaExibicao(bem: PatrimonioRecord): string {
  const raw = (bem.etiquetaNumero || bem.numeroTombamento || bem.id || '').trim();
  if (!raw) return '0';
  if (raw.includes('-')) {
    const parts = raw.split('-');
    const lastDigits = parts[parts.length - 1].replace(/\D/g, '');
    if (lastDigits) return parseInt(lastDigits, 10).toString();
  }
  const digits = raw.replace(/\D/g, '');
  if (digits) {
    if (digits.length <= 6) return parseInt(digits, 10).toString();
    return digits;
  }
  return raw;
}

async function loadBrasaoImages(): Promise<LoadedBrasao> {
  const tryLoad = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  let img: HTMLImageElement;
  try {
    img = await tryLoad('/assets/aistudio/brasao_capanema_limpo.png');
  } catch {
    img = await tryLoad(BRASAO_CAPANEMA_PNG_BASE64);
  }

  const w = img.naturalWidth || 400;
  const h = img.naturalHeight || 600;
  const aspectRatio = w / h;

  const canvasColor = document.createElement('canvas');
  canvasColor.width = w;
  canvasColor.height = h;
  const ctxColor = canvasColor.getContext('2d');
  if (ctxColor) {
    ctxColor.drawImage(img, 0, 0, w, h);
  }
  const colorDataUrl = canvasColor.toDataURL('image/png');

  const canvasMono = document.createElement('canvas');
  canvasMono.width = w;
  canvasMono.height = h;
  const ctxMono = canvasMono.getContext('2d');
  if (ctxMono) {
    ctxMono.filter = 'grayscale(100%) contrast(150%)';
    ctxMono.drawImage(img, 0, 0, w, h);
  }
  const monoDataUrl = canvasMono.toDataURL('image/png');

  return { colorDataUrl, monoDataUrl, aspectRatio };
}

function drawEtiquetaNoPdf(
  doc: jsPDF,
  bem: PatrimonioRecord,
  qrDataUrl: string,
  brasao: LoadedBrasao,
  estiloVisual: EstiloVisualPdf,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const numeroApenas = getNumeroEtiquetaExibicao(bem);
  const scale = Math.min(w / 50, h / 35);

  if (estiloVisual === 'capanema-azul-oficial' || estiloVisual === 'capanema-mono-termica') {
    const isAzul = estiloVisual === 'capanema-azul-oficial';
    const pad = 1.6 * scale;

    if (isAzul) {
      doc.setFillColor(8, 12, 68); // #080c44
      doc.setDrawColor(8, 12, 68);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, w, h, 0.8, 0.8, 'FD');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.45);
      doc.roundedRect(x, y, w, h, 0.8, 0.8, 'FD');
    }

    // Coluna Esquerda: Brasão Oficial
    const brasaoH = h - 2 * pad;
    const brasaoW = Math.min(brasaoH * brasao.aspectRatio, w * 0.44);
    const actualBrasaoH = brasaoW / brasao.aspectRatio;
    const brasaoY = y + (h - actualBrasaoH) / 2;
    doc.addImage(
      isAzul ? brasao.colorDataUrl : brasao.monoDataUrl,
      'PNG',
      x + pad,
      brasaoY,
      brasaoW,
      actualBrasaoH,
      undefined,
      'FAST'
    );

    // Coluna Direita: PATRIMÔNIO + QR Code + Nº
    const rightX = x + pad + brasaoW + 1.2 * scale;
    const rightW = x + w - pad - rightX;
    const rightCenterX = rightX + rightW / 2;

    if (isAzul) {
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setTextColor(0, 0, 0);
    }

    // Título PATRIMÔNIO no topo
    doc.setFont('times', 'bold');
    const titleFontPt = Math.max(6.5, Math.min(11, 8.2 * scale));
    doc.setFontSize(titleFontPt);
    doc.text('PATRIMÔNIO', rightCenterX, y + pad + 2.6 * scale, {
      align: 'center',
      charSpace: 0.35 * scale
    });

    // QR Code central
    const maxQrByW = rightW - 1.4 * scale;
    const maxQrByH = h - 2 * pad - 10.2 * scale;
    const qrSize = Math.max(8, Math.min(20.5 * scale, maxQrByW, maxQrByH));
    const qrBoxPad = 0.5 * scale;
    const qrBoxSize = qrSize + qrBoxPad * 2;
    const qrBoxX = rightCenterX - qrBoxSize / 2;
    const availableTop = y + pad + 3.6 * scale;
    const availableBottom = y + h - pad - 5.0 * scale;
    const qrBoxY = availableTop + Math.max(0, (availableBottom - availableTop - qrBoxSize) / 2);

    if (isAzul) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 0.5, 0.5, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(140, 140, 140);
      doc.setLineWidth(0.2);
      doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 0.5, 0.5, 'FD');
    }

    if (qrDataUrl) {
      doc.addImage(
        qrDataUrl,
        'PNG',
        qrBoxX + qrBoxPad,
        qrBoxY + qrBoxPad,
        qrSize,
        qrSize,
        undefined,
        'FAST'
      );
    }

    // Número inferior: Nº XXX
    const numFontPt = Math.max(8, Math.min(14, 10.6 * scale));
    const supFontPt = numFontPt * 0.68;
    const baseY = y + h - pad - 0.9 * scale;

    doc.setFont('times', 'bold');
    doc.setFontSize(numFontPt);
    const nWidth = doc.getTextWidth('N');
    const spaceAfterOrdinal = 0.7 * scale;
    const numWidth = doc.getTextWidth(numeroApenas);
    doc.setFontSize(supFontPt);
    const supWidth = doc.getTextWidth('º');

    const totalNumWidth = nWidth + supWidth + spaceAfterOrdinal + numWidth;
    let cursorX = rightCenterX - totalNumWidth / 2;

    doc.setFontSize(numFontPt);
    doc.text('N', cursorX, baseY);
    cursorX += nWidth + 0.15 * scale;

    doc.setFontSize(supFontPt);
    doc.text('º', cursorX, baseY - 1.05 * scale);
    cursorX += supWidth + spaceAfterOrdinal;

    doc.setFontSize(numFontPt);
    doc.text(numeroApenas, cursorX, baseY);
    return;
  }

  // Estilo 3: Detalhado com Secretaria
  const pad = 1.6 * scale;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.45);
  doc.roundedRect(x, y, w, h, 0.8, 0.8, 'FD');

  // Cabeçalho
  const logoH = 5.4 * scale;
  const logoW = logoH * brasao.aspectRatio;
  doc.addImage(brasao.colorDataUrl, 'PNG', x + pad, y + pad, logoW, logoH, undefined, 'FAST');

  const headerTextX = x + pad + logoW + 1.4 * scale;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.max(5.5, 6.2 * scale));
  doc.text('PREFEITURA DE CAPANEMA', headerTextX, y + pad + 2.2 * scale);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(Math.max(4.5, 4.9 * scale));
  doc.text('PATRIMÔNIO PÚBLICO', headerTextX, y + pad + 4.4 * scale);

  doc.setTextColor(30, 58, 138);
  doc.setFont('times', 'bold');
  doc.setFontSize(Math.max(7.5, 9 * scale));
  doc.text(`Nº ${numeroApenas}`, x + w - pad, y + pad + 3.6 * scale, { align: 'right' });

  const lineTopY = y + pad + logoH + 0.8 * scale;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.2);
  doc.line(x + pad, lineTopY, x + w - pad, lineTopY);

  // Centro: QR + Descrição / Secretaria / Setor
  const footerLineY = y + h - pad - 3.0 * scale;
  const centerAvailH = footerLineY - lineTopY - 1.6 * scale;
  const qrSize = Math.max(9, Math.min(15 * scale, centerAvailH));
  const qrY = lineTopY + (centerAvailH - qrSize) / 2 + 0.8 * scale;

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', x + pad, qrY, qrSize, qrSize, undefined, 'FAST');
  }

  const infoX = x + pad + qrSize + 1.8 * scale;
  const infoMaxW = x + w - pad - infoX;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.max(5.5, 6.2 * scale));
  const descLines = doc.splitTextToSize((bem.descricao || '').toUpperCase(), infoMaxW).slice(0, 2);
  doc.text(descLines, infoX, lineTopY + 3.4 * scale);

  const secY = lineTopY + 3.4 * scale + descLines.length * 2.5 * scale + 0.6 * scale;
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(Math.max(4.8, 5.2 * scale));
  const secText = doc.splitTextToSize(bem.secretariaSetor || '', infoMaxW).slice(0, 1);
  doc.text(secText, infoX, secY);

  if (bem.departamento) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(Math.max(4.4, 4.8 * scale));
    const depText = doc.splitTextToSize(`Setor: ${bem.departamento}`, infoMaxW).slice(0, 1);
    doc.text(depText, infoX, secY + 2.3 * scale);
  }

  // Rodapé legal
  doc.setDrawColor(203, 213, 225);
  doc.line(x + pad, footerLineY, x + w - pad, footerLineY);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.max(4.5, 4.8 * scale));
  doc.text('PATRIMÔNIO PÚBLICO', x + pad, y + h - pad - 0.5 * scale);
  doc.text('LEI 4.320/64', x + w - pad, y + h - pad - 0.5 * scale, { align: 'right' });
}

export async function gerarPdfEtiquetas({
  etiquetas,
  formato,
  formatoInfo,
  estiloVisual,
  qrMode,
  qrBaseUrl,
  qrCodeUrls = {},
  onProgress
}: GerarPdfEtiquetasOptions): Promise<void> {
  if (etiquetas.length === 0) return;

  // jspdf e qrcode sob demanda: carregam so quando o PDF e realmente gerado,
  // tirando ~250 KB do pacote inicial do app.
  const [{ default: JsPDF }, { default: QRCode }] = await Promise.all([
    import('jspdf'),
    import('qrcode'),
  ]);

  const brasao = await loadBrasaoImages();
  const payloadCache = new Map<string, string>();

  // Garantir que todos os QR Codes existam (mesmo em lotes grandes recém-carregados)
  const bensUnicos: PatrimonioRecord[] = [];
  const seenIds = new Set<string>();
  etiquetas.forEach(item => {
    if (item && !seenIds.has(item.id)) {
      seenIds.add(item.id);
      bensUnicos.push(item);
    }
  });

  const resolvedQrById: Record<string, string> = { ...qrCodeUrls };
  for (let i = 0; i < bensUnicos.length; i++) {
    const bem = bensUnicos[i];
    const payload = buildEtiquetaQrPayload(bem, qrMode, qrBaseUrl);

    if (!resolvedQrById[bem.id]) {
      const cached = payloadCache.get(payload);
      if (cached) {
        resolvedQrById[bem.id] = cached;
      } else {
        const url = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 320,
          color: { dark: '#000000', light: '#ffffff' }
        });
        payloadCache.set(payload, url);
        resolvedQrById[bem.id] = url;
      }
    }

    if (onProgress && i % 25 === 0) {
      onProgress(Math.round(((i + 1) / Math.max(1, bensUnicos.length)) * 45));
    }
  }

  const isTermica = formatoInfo.tipo === 'termica';
  const w = formatoInfo.larguraMm;
  const h = formatoInfo.alturaMm;

  const doc = isTermica
    ? new JsPDF({
        orientation: w >= h ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [w, h],
        compress: true
      })
    : new JsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

  if (isTermica) {
    const itensReais = etiquetas.filter((b): b is PatrimonioRecord => b !== null);
    for (let i = 0; i < itensReais.length; i++) {
      if (i > 0) {
        doc.addPage([w, h], w >= h ? 'landscape' : 'portrait');
      }
      const bem = itensReais[i];
      drawEtiquetaNoPdf(doc, bem, resolvedQrById[bem.id] || '', brasao, estiloVisual, 0, 0, w, h);

      if (onProgress && i % 20 === 0) {
        onProgress(45 + Math.round(((i + 1) / Math.max(1, itensReais.length)) * 55));
      }
    }
  } else {
    const pageW = 210;
    const pageH = 297;
    const cols = formatoInfo.colunas;
    const rows = formatoInfo.linhas;
    const perPage = formatoInfo.etiquetasPorFolha;

    const gapX = cols >= 4 ? 1.8 : 2.5;
    const totalGridW = cols * w + (cols - 1) * gapX;
    const marginX = Math.max(1.5, (pageW - totalGridW) / 2);

    const gapY = rows >= 10 ? 1.5 : 2.5;
    const totalGridH = rows * h + (rows - 1) * gapY;
    const marginY = Math.max(4, (pageH - totalGridH) / 2);

    const totalPages = Math.ceil(etiquetas.length / perPage) || 1;
    for (let p = 0; p < totalPages; p++) {
      if (p > 0) {
        doc.addPage('a4', 'portrait');
      }

      const slice = etiquetas.slice(p * perPage, (p + 1) * perPage);
      slice.forEach((bem, idx) => {
        if (!bem) return;
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = marginX + col * (w + gapX);
        const y = marginY + row * (h + gapY);

        drawEtiquetaNoPdf(doc, bem, resolvedQrById[bem.id] || '', brasao, estiloVisual, x, y, w, h);
      });

      if (onProgress) {
        onProgress(45 + Math.round(((p + 1) / totalPages) * 55));
      }
    }
  }

  onProgress?.(100);

  const qtdReais = etiquetas.filter(Boolean).length;
  const sufFormato = formato === 'a4-capanema-50x35' ? 'A4-28porFolha' : formato;
  doc.save(`Etiquetas_Capanema_${sufFormato}_${qtdReais}itens.pdf`);
}
