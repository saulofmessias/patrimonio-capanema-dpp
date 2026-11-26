import React, { useState, useEffect, useRef } from 'react';
import { lazyImport } from '../utils/lazyImport';
import { 
  FolderArchive, Upload, Image as ImageIcon, CheckCircle2, AlertCircle, 
  X, RefreshCw, Sparkles, FolderUp, Link as LinkIcon, Database, 
  HelpCircle, ExternalLink, HardDrive, Check, Eye, Cloud, CloudUpload, StopCircle
} from 'lucide-react';
import { PatrimonioRecord } from '../types/appsheet';
import {
  savePhotosBatch,
  countStoredPhotos,
  getAllPhotosMap,
  getAllStoredPhotoEntries,
  validateAndCompressImageDataUrl,
  validateAndCompressImageFile
} from '../utils/photoStorage';
import {
  uploadCloudPhotosBatch,
  getUploadedCloudPhotoSet,
  clearMissingCloudPhotoCache,
  getCloudPhotosCount,
  normalizePhotoDocId
} from '../utils/cloudPhotoSync';
import { useAuth } from '../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patrimonios: PatrimonioRecord[];
  onPhotosUpdated: (photosMap: Record<string, string>) => void;
}

export const AppSheetPhotoSyncModal: React.FC<Props> = ({
  isOpen,
  onClose,
  patrimonios,
  onPhotosUpdated
}) => {
  const { firebaseUser, profile } = useAuth();
  const canUploadCloud = Boolean(
    firebaseUser &&
      profile &&
      !profile.isSimulated &&
      (profile.role === 'admin' || profile.role === 'gerente')
  );

  const [activeTab, setActiveTab] = useState<'zip' | 'pasta' | 'link'>('zip');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [importedCount, setImportedCount] = useState<number>(0);
  const [storedCount, setStoredCount] = useState<number>(0);
  const [cloudUploadedTotal, setCloudUploadedTotal] = useState<number>(() => getUploadedCloudPhotoSet().size);
  const [realCloudCount, setRealCloudCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [autoCompress, setAutoCompress] = useState<boolean>(true);
  const [syncToCloud, setSyncToCloud] = useState<boolean>(true);
  const [onlyCatalogPhotos, setOnlyCatalogPhotos] = useState<boolean>(true);
  const [samplePreviews, setSamplePreviews] = useState<{ id: string; tombo: string; descricao: string; dataUrl: string }[]>([]);
  const cancelRequestedRef = useRef<boolean>(false);

  // Configuração via URL do AppSheet
  const [appSheetAppName, setAppSheetAppName] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('capanema_appsheet_app_name') || '';
    }
    return '';
  });
  const [testingUrl, setTestingUrl] = useState<boolean>(false);
  const [urlTestStatus, setUrlTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [testSampleUrl, setTestSampleUrl] = useState<string | null>(null);
  const [extractedAppName, setExtractedAppName] = useState<string>('');

  // Contagem de bens que possuem foto no AppSheet
  const totalComFotoAppSheet = patrimonios.filter(p => !!p.fotoBem).length;

  useEffect(() => {
    if (isOpen) {
      countStoredPhotos().then(setStoredCount);
      setCloudUploadedTotal(getUploadedCloudPhotoSet().size);
      if (canUploadCloud) {
        getCloudPhotosCount().then((cnt) => {
          if (cnt !== null) setRealCloudCount(cnt);
        });
      }
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('capanema_appsheet_app_name');
        if (saved) setAppSheetAppName(saved);
      }
    }
  }, [isOpen, canUploadCloud]);

  if (!isOpen) return null;

  // Conjunto normalizado dos nomes exatos das fotos referenciadas nos bens cadastrados
  const buildCatalogPhotoNameSet = (): Set<string> => {
    const set = new Set<string>();
    patrimonios.forEach((p) => {
      if (p.fotoBem) {
        const onlyName = (p.fotoBem.trim().toLowerCase().split('/').pop() || '').trim();
        if (onlyName) set.add(onlyName);
      }
    });
    return set;
  };

  // Enviar para a nuvem as fotos que já estão salvas localmente neste aparelho (1 clique)
  const handleUploadLocalPhotosToCloud = async () => {
    if (!canUploadCloud) {
      setErrorMessage('Entre com uma conta Google de Administrador ou Gerente para enviar fotos à nuvem.');
      return;
    }

    cancelRequestedRef.current = false;
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProgressPercent(3);
    setProgressText('Lendo fotos válidas já salvas neste aparelho...');

    try {
      const allEntries = await getAllStoredPhotoEntries();
      if (allEntries.length === 0) {
        throw new Error('Nenhuma foto local encontrada neste aparelho. Importe primeiro a pasta ou o arquivo ZIP abaixo.');
      }

      const catalogSet = buildCatalogPhotoNameSet();
      const entries = onlyCatalogPhotos && catalogSet.size > 0
        ? allEntries.filter((e) => catalogSet.has((e.key.split('/').pop() || e.key).trim().toLowerCase()))
        : allEntries;

      if (entries.length === 0) {
        throw new Error('Nenhuma foto local corresponde aos bens cadastrados.');
      }

      const uploadedBy = profile?.email || firebaseUser?.email || 'dpp@capanema.pa.gov.br';
      const alreadyUploadedSet = getUploadedCloudPhotoSet();
      const pendingEntries = entries.filter((e) => !alreadyUploadedSet.has(normalizePhotoDocId(e.key)));
      const preSkipped = entries.length - pendingEntries.length;

      const CHUNK = 12;
      let uploadedNow = 0;
      let skippedNow = preSkipped;
      let invalidNow = 0;

      if (pendingEntries.length === 0) {
        setProgressPercent(100);
        setProgressText(`Todas as ${entries.length} fotos já estavam sincronizadas na nuvem.`);
      }

      for (let i = 0; i < pendingEntries.length; i += CHUNK) {
        if (cancelRequestedRef.current) break;

        const slice = pendingEntries.slice(i, i + CHUNK).map((e) => ({
          fileName: e.key,
          dataUrl: e.dataUrl,
        }));

        const doneBefore = preSkipped + i;
        setProgressText(
          `Enviando lote ${doneBefore + 1}–${Math.min(entries.length, doneBefore + slice.length)} de ${entries.length} • ${uploadedNow} novas enviadas (${skippedNow} já estavam)...`
        );

        const res = await uploadCloudPhotosBatch(slice, uploadedBy, true);
        uploadedNow += res.uploaded;
        skippedNow += res.skipped;
        invalidNow += res.invalid;
        setCloudUploadedTotal(getUploadedCloudPhotoSet().size);

        const done = Math.min(entries.length, preSkipped + i + slice.length);
        setProgressPercent(Math.min(98, Math.max(5, Math.floor((done / entries.length) * 98))));
        setProgressText(
          `Enviando para a Nuvem: ${done} de ${entries.length} (${uploadedNow} novas enviadas, ${skippedNow} já estavam${invalidNow > 0 ? `, ${invalidNow} ignoradas` : ''})...`
        );
      }

      clearMissingCloudPhotoCache();
      setProgressPercent(100);
      setCloudUploadedTotal(getUploadedCloudPhotoSet().size);
      getCloudPhotosCount().then((cnt) => {
        if (cnt !== null) setRealCloudCount(cnt);
      });

      const invalidNote = invalidNow > 0 ? ` • ${invalidNow} arquivo(s) vazio(s)/corrompido(s) ignorado(s)` : '';
      if (cancelRequestedRef.current) {
        setSuccessMessage(
          `Envio pausado com segurança! ${uploadedNow.toLocaleString('pt-BR')} novas fotos foram enviadas para a nuvem até agora${invalidNote}. Quando clicar novamente, ele continua de onde parou.`
        );
      } else {
        setSuccessMessage(
          `Nuvem atualizada! ${uploadedNow.toLocaleString('pt-BR')} novas fotos enviadas (${skippedNow.toLocaleString('pt-BR')} já estavam sincronizadas)${invalidNote}. Agora todos os celulares da equipe exibem as fotos automaticamente ao bipar.`
        );
      }
    } catch (err: unknown) {
      console.error('Erro ao subir fotos locais para nuvem:', err);
      setCloudUploadedTotal(getUploadedCloudPhotoSet().size);
      getCloudPhotosCount().then((cnt) => {
        if (cnt !== null) setRealCloudCount(cnt);
      });
      const rawMsg = err instanceof Error ? err.message : String(err);
      const lower = rawMsg.toLowerCase();
      if (lower.includes('quota') || lower.includes('resource-exhausted') || lower.includes('resource_exhausted')) {
        setErrorMessage(
          'Limite diário gratuito do Firebase atingido durante o envio. As fotos já enviadas permanecem salvas; amanhã basta clicar novamente para continuar de onde parou.'
        );
      } else {
        setErrorMessage(`Falha ao enviar fotos para a nuvem: ${rawMsg}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Processar 1 ou vários arquivos ZIP baixados do Google Drive (em lotes leves + envio opcional à nuvem)
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length === 0) return;

    cancelRequestedRef.current = false;
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProgressPercent(2);
    setProgressText(`Preparando ${selectedFiles.length} arquivo(s) ZIP...`);

    const shouldUploadCloud = Boolean(syncToCloud && canUploadCloud);
    const uploadedBy = profile?.email || firebaseUser?.email || 'dpp@capanema.pa.gov.br';
    let cloudUploadedNow = 0;
    let cloudSkippedNow = 0;
    let cloudWarning: string | null = null;

    try {
      // Mapear bens para busca rápida de amostras e filtro de catálogo
      const mapBensByFileName: Record<string, PatrimonioRecord> = {};
      const catalogSet = buildCatalogPhotoNameSet();

      patrimonios.forEach(p => {
        if (p.fotoBem) {
          const raw = p.fotoBem.toLowerCase().trim();
          mapBensByFileName[raw] = p;
          const onlyName = raw.split('/').pop() || '';
          if (onlyName) mapBensByFileName[onlyName] = p;
        }
      });

      const newPreviews: { id: string; tombo: string; descricao: string; dataUrl: string }[] = [];
      const seenPreviewBemIds = new Set<string>();
      let totalImportedAcrossZips = 0;
      let totalIgnoredExtra = 0;
      let totalInvalidCorrupt = 0;
      const FLUSH_BATCH_SIZE = 24;

      for (let zIdx = 0; zIdx < selectedFiles.length; zIdx++) {
        if (cancelRequestedRef.current) break;

        const file = selectedFiles[zIdx];
        const zipLabel = selectedFiles.length > 1 ? `ZIP ${zIdx + 1}/${selectedFiles.length}: ` : '';
        setProgressText(`${zipLabel}Lendo ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`);

        const { default: JSZip } = await lazyImport('jszip', () => import('jszip'));
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        const allImagePaths = Object.keys(zipContent.files).filter(name => {
          const lower = name.toLowerCase();
          const base = lower.split('/').pop() || '';
          return (
            !zipContent.files[name].dir &&
            !lower.includes('__macosx/') &&
            !base.startsWith('._') &&
            (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp'))
          );
        });

        const fileNames = onlyCatalogPhotos && catalogSet.size > 0
          ? allImagePaths.filter((name) => {
              const base = (name.toLowerCase().split('/').pop() || '').trim();
              const keep = catalogSet.has(base);
              if (!keep) totalIgnoredExtra++;
              return keep;
            })
          : allImagePaths;

        if (fileNames.length === 0 && selectedFiles.length === 1) {
          throw new Error('Nenhuma foto compatível com os bens cadastrados foi encontrada dentro do arquivo ZIP.');
        }

        let batchBuffer: { key: string; dataUrl: string }[] = [];
        let processed = 0;

        for (const filePath of fileNames) {
          if (cancelRequestedRef.current) break;

          const fileEntry = zipContent.files[filePath];
          const base64Data = await fileEntry.async('base64');
          const lowerPath = filePath.toLowerCase();
          const ext = lowerPath.endsWith('.png') ? 'png' : lowerPath.endsWith('.webp') ? 'webp' : 'jpeg';
          const rawDataUrl = `data:image/${ext};base64,${base64Data}`;

          const finalDataUrl = await validateAndCompressImageDataUrl(rawDataUrl, {
            maxDimension: shouldUploadCloud ? 720 : autoCompress ? 800 : 1600,
            quality: shouldUploadCloud ? 0.68 : autoCompress ? 0.72 : 0.85,
            skipIfSmallerThanBytes: shouldUploadCloud ? 65 * 1024 : autoCompress ? 95 * 1024 : 99999999,
          });

          processed++;

          if (!finalDataUrl) {
            totalInvalidCorrupt++;
          } else {
            const baseFileName = (filePath.split('/').pop() || filePath).toLowerCase().trim();
            batchBuffer.push({ key: baseFileName, dataUrl: finalDataUrl });
            totalImportedAcrossZips++;

            if (newPreviews.length < 8) {
              const bem =
                mapBensByFileName[baseFileName] ||
                mapBensByFileName[`patrimonios_images/${baseFileName}`];

              if (bem && !seenPreviewBemIds.has(bem.id)) {
                seenPreviewBemIds.add(bem.id);
                newPreviews.push({
                  id: bem.id,
                  tombo: bem.etiquetaNumero || bem.numeroTombamento,
                  descricao: bem.descricao,
                  dataUrl: finalDataUrl
                });
              }
            }
          }

          if (batchBuffer.length >= FLUSH_BATCH_SIZE || processed === fileNames.length) {
            if (batchBuffer.length > 0) {
              await savePhotosBatch(batchBuffer);

              if (shouldUploadCloud && !cloudWarning) {
                try {
                  const cloudRes = await uploadCloudPhotosBatch(
                    batchBuffer.map((b) => ({ fileName: b.key, dataUrl: b.dataUrl })),
                    uploadedBy,
                    true
                  );
                  cloudUploadedNow += cloudRes.uploaded;
                  cloudSkippedNow += cloudRes.skipped;
                  totalInvalidCorrupt += cloudRes.invalid;
                  setCloudUploadedTotal(getUploadedCloudPhotoSet().size);
                } catch (cloudErr: unknown) {
                  const msg = cloudErr instanceof Error ? cloudErr.message : String(cloudErr);
                  cloudWarning = msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')
                    ? 'Limite diário gratuito do Firebase atingido durante o envio. As fotos já enviadas permanecem salvas; amanhã basta continuar de onde parou.'
                    : `Envio à nuvem interrompido (${msg}); o restante continua salvo localmente neste aparelho.`;
                  setErrorMessage(cloudWarning);
                }
              }

              batchBuffer = [];
            }

            const zipFraction = (zIdx + processed / Math.max(1, fileNames.length)) / selectedFiles.length;
            setProgressPercent(Math.min(95, Math.max(5, Math.floor(zipFraction * 92))));
            setProgressText(
              shouldUploadCloud && !cloudWarning
                ? `${zipLabel}${processed}/${fileNames.length} fotos • Nuvem: ${cloudUploadedNow} enviadas (${cloudSkippedNow} já estavam)`
                : `${zipLabel}Otimizando e salvando no aparelho: ${processed} de ${fileNames.length} fotos...`
            );
          }
        }
      }

      if (totalImportedAcrossZips === 0) {
        throw new Error('Nenhuma foto válida foi encontrada nos arquivos ZIP selecionados.');
      }

      clearMissingCloudPhotoCache();
      setProgressText('Atualizando índice visual das fotos carregadas...');
      setProgressPercent(96);

      const allMap = await getAllPhotosMap();
      onPhotosUpdated(allMap);

      const totalArmazenado = await countStoredPhotos();
      setStoredCount(totalArmazenado);
      setImportedCount(totalImportedAcrossZips);
      setSamplePreviews(newPreviews);
      setProgressPercent(100);
      setCloudUploadedTotal(getUploadedCloudPhotoSet().size);

      if (cloudWarning) {
        setErrorMessage(cloudWarning);
      }

      const cloudSummary = shouldUploadCloud
        ? ` • ${cloudUploadedNow.toLocaleString('pt-BR')} enviadas para a Nuvem (visíveis em todos os celulares)`
        : '';
      const filterNotes: string[] = [];
      if (totalIgnoredExtra > 0) filterNotes.push(`${totalIgnoredExtra} extras ignorados`);
      if (totalInvalidCorrupt > 0) filterNotes.push(`${totalInvalidCorrupt} vazios/corrompidos descartados`);
      const extraInfo = filterNotes.length > 0 ? ` (${filterNotes.join(', ')})` : '';
      setSuccessMessage(
        `${cancelRequestedRef.current ? 'Importação pausada!' : 'Sucesso!'} ${totalImportedAcrossZips.toLocaleString('pt-BR')} fotos válidas salvas localmente${cloudSummary}${extraInfo}.`
      );
    } catch (err: unknown) {
      console.error('Erro ao processar ZIP:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao processar arquivo ZIP.');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  // Processar seleção direta de Pasta (webkitdirectory) em lotes leves + nuvem opcional
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    cancelRequestedRef.current = false;
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProgressPercent(5);
    setProgressText(`Lendo ${files.length} arquivos da pasta selecionada...`);

    const shouldUploadCloud = Boolean(syncToCloud && canUploadCloud);
    const uploadedBy = profile?.email || firebaseUser?.email || 'dpp@capanema.pa.gov.br';
    let cloudUploadedNow = 0;
    let cloudWarning: string | null = null;

    try {
      const catalogSet = buildCatalogPhotoNameSet();
      const allImageFiles = Array.from(files).filter(f => {
        const lower = f.name.toLowerCase();
        return (
          !lower.startsWith('._') &&
          (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp'))
        );
      });

      let ignoredExtra = 0;
      const imageFiles = onlyCatalogPhotos && catalogSet.size > 0
        ? allImageFiles.filter((f) => {
            const keep = catalogSet.has(f.name.toLowerCase().trim());
            if (!keep) ignoredExtra++;
            return keep;
          })
        : allImageFiles;

      if (imageFiles.length === 0) {
        throw new Error('Nenhuma imagem compatível com os bens cadastrados foi encontrada na pasta selecionada.');
      }

      const mapBensByFileName: Record<string, PatrimonioRecord> = {};
      patrimonios.forEach(p => {
        if (p.fotoBem) {
          const raw = p.fotoBem.toLowerCase().trim();
          mapBensByFileName[raw] = p;
          const onlyName = raw.split('/').pop() || '';
          if (onlyName) mapBensByFileName[onlyName] = p;
        }
      });

      const newPreviews: { id: string; tombo: string; descricao: string; dataUrl: string }[] = [];
      const seenPreviewBemIds = new Set<string>();
      const alreadyUploadedSet = shouldUploadCloud ? getUploadedCloudPhotoSet() : new Set<string>();
      let batchBuffer: { key: string; dataUrl: string }[] = [];
      const FLUSH_BATCH_SIZE = 12;
      let processed = 0;
      let validSaved = 0;
      let invalidCorrupt = 0;
      let cloudSkippedNow = 0;

      for (const file of imageFiles) {
        if (cancelRequestedRef.current) break;

        const baseFileName = file.name.toLowerCase().trim();
        const docId = normalizePhotoDocId(baseFileName);

        // Se já foi enviada para a nuvem em execução anterior, pula instantaneamente sem reprocessar Canvas/Disco
        if (shouldUploadCloud && docId && alreadyUploadedSet.has(docId)) {
          processed++;
          cloudSkippedNow++;
          if (processed % 120 === 0 || processed === imageFiles.length) {
            setProgressPercent(Math.min(95, Math.floor(5 + (processed / imageFiles.length) * 88)));
            setProgressText(
              `Pulando já enviadas: ${processed}/${imageFiles.length} fotos • Nuvem: ${cloudUploadedNow} novas (${cloudSkippedNow} já estavam)`
            );
          }
          continue;
        }

        const dataUrl = await validateAndCompressImageFile(file, {
          maxDimension: shouldUploadCloud ? 600 : autoCompress ? 800 : 1600,
          quality: shouldUploadCloud ? 0.62 : autoCompress ? 0.72 : 0.85,
          skipIfSmallerThanBytes: shouldUploadCloud ? 45 * 1024 : autoCompress ? 95 * 1024 : 99999999,
        });

        processed++;

        if (!dataUrl) {
          invalidCorrupt++;
        } else {
          batchBuffer.push({ key: baseFileName, dataUrl });
          validSaved++;

          if (newPreviews.length < 8) {
            const bem =
              mapBensByFileName[baseFileName] ||
              mapBensByFileName[`patrimonios_images/${baseFileName}`];
            if (bem && !seenPreviewBemIds.has(bem.id)) {
              seenPreviewBemIds.add(bem.id);
              newPreviews.push({
                id: bem.id,
                tombo: bem.etiquetaNumero || bem.numeroTombamento,
                descricao: bem.descricao,
                dataUrl
              });
            }
          }
        }

        if (batchBuffer.length >= FLUSH_BATCH_SIZE || processed === imageFiles.length) {
          if (batchBuffer.length > 0) {
            await savePhotosBatch(batchBuffer);

            if (shouldUploadCloud && !cloudWarning) {
              setProgressText(
                `Enviando lote (${processed}/${imageFiles.length}) • Nuvem: ${cloudUploadedNow} novas (${cloudSkippedNow} já estavam)...`
              );
              try {
                const cloudRes = await uploadCloudPhotosBatch(
                  batchBuffer.map((b) => ({ fileName: b.key, dataUrl: b.dataUrl })),
                  uploadedBy,
                  true
                );
                cloudUploadedNow += cloudRes.uploaded;
                cloudSkippedNow += cloudRes.skipped;
                invalidCorrupt += cloudRes.invalid;
                setCloudUploadedTotal(getUploadedCloudPhotoSet().size);
              } catch (cloudErr: unknown) {
                const msg = cloudErr instanceof Error ? cloudErr.message : String(cloudErr);
                cloudWarning = msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')
                  ? 'Limite diário gratuito do Firebase atingido durante o envio. As fotos já enviadas permanecem salvas; amanhã basta continuar de onde parou.'
                  : `Envio à nuvem interrompido (${msg}); o restante continua salvo localmente.`;
                setErrorMessage(cloudWarning);
              }
            }

            batchBuffer = [];
          }

          setProgressPercent(Math.min(95, Math.floor(5 + (processed / imageFiles.length) * 88)));
          setProgressText(
            shouldUploadCloud && !cloudWarning
              ? `Processando ${processed}/${imageFiles.length} fotos • Nuvem: ${cloudUploadedNow} novas (${cloudSkippedNow} já estavam${invalidCorrupt > 0 ? `, ${invalidCorrupt} ignoradas` : ''})`
              : `Otimizando e salvando fotos: ${processed} de ${imageFiles.length}...`
          );
        }
      }

      clearMissingCloudPhotoCache();
      setProgressText('Atualizando índice visual das fotos carregadas...');
      setProgressPercent(96);

      const allMap = await getAllPhotosMap();
      onPhotosUpdated(allMap);

      const totalArmazenado = await countStoredPhotos();
      setStoredCount(totalArmazenado);
      if (canUploadCloud) {
        getCloudPhotosCount().then((cnt) => {
          if (cnt !== null) setRealCloudCount(cnt);
        });
      }
      setImportedCount(validSaved);
      setSamplePreviews(newPreviews);
      setProgressPercent(100);
      setCloudUploadedTotal(getUploadedCloudPhotoSet().size);

      if (cloudWarning) {
        setErrorMessage(cloudWarning);
      }

      const cloudSummary = shouldUploadCloud
        ? ` • ${cloudUploadedNow.toLocaleString('pt-BR')} enviadas para a Nuvem`
        : '';
      const filterNotes: string[] = [];
      if (ignoredExtra > 0) filterNotes.push(`${ignoredExtra} extras ignorados`);
      if (invalidCorrupt > 0) filterNotes.push(`${invalidCorrupt} vazios/corrompidos descartados`);
      const extraInfo = filterNotes.length > 0 ? ` (${filterNotes.join(', ')})` : '';
      setSuccessMessage(
        `${cancelRequestedRef.current ? 'Importação pausada!' : 'Sucesso!'} ${validSaved.toLocaleString('pt-BR')} fotos válidas da pasta salvas no aparelho${cloudSummary}${extraInfo}.`
      );
    } catch (err: unknown) {
      console.error('Erro ao ler pasta:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao processar arquivos da pasta.');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  // Conectar com URL pública ou ID do AppSheet
  const handleConnectAppSheetUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appSheetAppName.trim()) return;

    // Parser inteligente: extrai o appName de URLs completas ou strings brutas
    let appName = appSheetAppName.trim();
    if (appName.includes('appsheet.com')) {
      const urlMatch = appName.match(/[?&]appName=([^&]+)/i);
      if (urlMatch && urlMatch[1]) {
        appName = decodeURIComponent(urlMatch[1]);
      } else {
        const startMatch = appName.match(/\/start\/([^/?#]+)/i);
        if (startMatch && startMatch[1]) {
          appName = decodeURIComponent(startMatch[1]);
        } else {
          const hashMatch = appName.match(/#.*appName=([^&]+)/i);
          if (hashMatch && hashMatch[1]) {
            appName = decodeURIComponent(hashMatch[1]);
          }
        }
      }
    }

    // Se o usuário informou o caminho da pasta padrão do AppSheet (ex: /appsheet/data/PatrimôniosCapanema-729224800)
    if (appName.includes('appsheet/data/')) {
      appName = appName.split('appsheet/data/')[1] || appName;
      appName = appName.replace(/^\/+|\/+$/g, '');
    }
    appName = appName.replace(/^appName=/i, '').trim();

    setExtractedAppName(appName);
    setTestingUrl(true);
    setUrlTestStatus('idle');
    setErrorMessage(null);
    setSuccessMessage(null);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('capanema_appsheet_app_name', appName);
    }

    // Amostra de teste usando a primeira foto do catálogo
    const firstBemWithPhoto = patrimonios.find(p => !!p.fotoBem);
    const sampleFileName = firstBemWithPhoto?.fotoBem || 'Patrimonios_Images/12.Foto.194551.jpg';
    const testUrl = `https://www.appsheet.com/template/gettablefileurl?appName=${encodeURIComponent(appName)}&tableName=Patrimonios&fileName=${encodeURIComponent(sampleFileName)}`;

    setTestSampleUrl(testUrl);

    // Mapear fotos
    const photosMap: Record<string, string> = {};
    let count = 0;
    patrimonios.forEach(p => {
      if (p.fotoBem) {
        const cleanPath = p.fotoBem.trim();
        const fullUrl = `https://www.appsheet.com/template/gettablefileurl?appName=${encodeURIComponent(appName)}&tableName=Patrimonios&fileName=${encodeURIComponent(cleanPath)}`;
        photosMap[cleanPath.toLowerCase()] = fullUrl;
        const onlyName = cleanPath.split('/').pop()?.toLowerCase();
        if (onlyName) photosMap[onlyName] = fullUrl;
        count++;
      }
    });

    onPhotosUpdated(photosMap);

    // Testar carregamento da imagem em tempo real
    const img = new Image();
    img.onload = () => {
      setTestingUrl(false);
      setUrlTestStatus('success');
      setSuccessMessage(`Conexão validada com sucesso! ${count} bens agora estão carregando as fotos direto do servidor do AppSheet (${appName}).`);
    };

    img.onerror = () => {
      setTestingUrl(false);
      setUrlTestStatus('failed');
      setErrorMessage(`A URL foi configurada para ${count} bens, mas o servidor do AppSheet bloqueou o carregamento direto da foto de teste.`);
    };

    img.src = testUrl;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Importador de Fotos do AppSheet</h3>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-400/30 font-semibold">
                  {totalComFotoAppSheet.toLocaleString('pt-BR')} Fotos no Acervo
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Vincule os arquivos de fotos reais aos {patrimonios.length.toLocaleString('pt-BR')} patrimônios da Prefeitura de Capanema
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostic Overview */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          
          <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200/90 text-xs text-blue-900 space-y-2">
            <div className="flex items-start gap-2.5 font-semibold text-blue-950">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>Entenda por que as fotos não vieram automaticamente na planilha:</span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed pl-6">
              O arquivo <strong>Patrimonios_AppSheet.xlsx</strong> exportado do AppSheet contém apenas os <em>caminhos de texto</em> (ex: <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-950 font-mono">Patrimonios_Images/12.Foto.194551.jpg</code>). 
              Os <strong>arquivos reais de imagem (.jpg)</strong> ficam guardados na sua pasta do <strong>Google Drive</strong> (dentro da pasta chamada <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-950 font-mono">Patrimonios_Images</code> ao lado da planilha original).
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pl-6 pt-1 text-[11px] font-bold text-blue-950">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                  <span>Neste aparelho: {storedCount.toLocaleString('pt-BR')}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-800">
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Na Nuvem (todos os celulares):{' '}
                    {(realCloudCount !== null ? realCloudCount : cloudUploadedTotal).toLocaleString('pt-BR')}
                  </span>
                </span>
              </div>
              {canUploadCloud && storedCount > 0 && (
                <button
                  type="button"
                  onClick={handleUploadLocalPhotosToCloud}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  title="Enviar fotos que já estão salvas neste aparelho para a nuvem de todos os celulares"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Subir fotos locais p/ Nuvem</span>
                </button>
              )}
            </div>
          </div>

          {canUploadCloud && (
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToCloud}
                  onChange={(e) => setSyncToCloud(e.target.checked)}
                  disabled={isProcessing}
                  className="mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="space-y-0.5">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CloudUpload className="w-4 h-4 text-emerald-600" />
                    Enviar automaticamente para a Nuvem (Todos os celulares da equipe)
                  </span>
                  <p className="text-[11px] text-emerald-800 leading-snug">
                    Importe a pasta ou o <strong>.ZIP uma única vez no seu computador</strong>. Todas as fotos serão comprimidas e salvas na nuvem para aparecerem automaticamente quando qualquer fiscal bipar a etiqueta no celular.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyCatalogPhotos}
                  onChange={(e) => setOnlyCatalogPhotos(e.target.checked)}
                  disabled={isProcessing}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  Filtrar somente as {totalComFotoAppSheet.toLocaleString('pt-BR')} fotos vinculadas aos bens cadastrados (ignora arquivos extras, QR Codes e arquivos vazios)
                </span>
              </label>
            </div>
          )}

          {/* Abas de Opções */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('zip')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'zip'
                  ? 'bg-white text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5 text-blue-600" />
              Opção 1: Arquivo ZIP do Google Drive
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pasta')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'pasta'
                  ? 'bg-white text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderUp className="w-3.5 h-3.5 text-emerald-600" />
              Opção 2: Pasta do Computador
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('link')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'link'
                  ? 'bg-white text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />
              Opção 3: Conexão Direta AppSheet
            </button>
          </div>

          {/* Opção 1: Upload de ZIP */}
          {activeTab === 'zip' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-6 bg-blue-50/30 text-center transition-colors space-y-3">
                <FolderArchive className="w-12 h-12 text-blue-600 mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Arraste ou Selecione o arquivo ZIP das Fotos
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                    Sua pasta de fotos do Google Drive foi identificada! Siga os 3 passos simples abaixo:
                  </p>
                </div>

                {/* Atalho direto para a pasta do usuário no Google Drive */}
                <div className="p-3 bg-white rounded-xl border border-blue-200 text-left space-y-2 max-w-lg mx-auto shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                      <FolderArchive className="w-4 h-4 text-blue-600" />
                      Sua Pasta de Fotos no Google Drive:
                    </span>
                    <a
                      href="https://drive.google.com/drive/folders/1J6qHrg4WLXC504BSHYw21Hj8Oh_dI2WL"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Abrir Pasta no Drive
                    </a>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-1 pl-1 border-l-2 border-blue-400">
                    <p><strong>Passo 1:</strong> Clique no botão acima <em>&quot;Abrir Pasta no Drive&quot;</em>.</p>
                    <p><strong>Passo 2:</strong> Se estiver dentro da pasta de fotos, clique no nome da pasta no topo ou selecione os arquivos → <strong>Fazer Download</strong> (o Drive vai baixar o arquivo compactado <strong>.zip</strong>).</p>
                    <p><strong>Passo 3:</strong> Arraste ou selecione o arquivo <strong>.zip</strong> no botão abaixo:</p>
                  </div>
                </div>

                <div className="pt-2 space-y-2.5">
                  <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCompress}
                      onChange={(e) => setAutoCompress(e.target.checked)}
                      disabled={isProcessing}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Comprimir fotos automaticamente ao importar (ideal para {totalComFotoAppSheet.toLocaleString('pt-BR')} fotos no celular)</span>
                  </label>

                  <div>
                    <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md transition-colors">
                      <Upload className="w-4 h-4" />
                      <span>Selecionar Arquivo(s) .ZIP Baixado(s)</span>
                      <input 
                        type="file" 
                        accept=".zip,application/zip" 
                        multiple
                        className="hidden" 
                        onChange={handleZipUpload}
                        disabled={isProcessing}
                      />
                    </label>
                    <p className="text-[10.5px] text-slate-500 mt-1.5">
                      Se o Google Drive dividir o download em mais de um .zip, você pode selecionar todos de uma vez.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Opção 2: Upload de Pasta Direta */}
          {activeTab === 'pasta' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-6 bg-emerald-50/30 text-center transition-colors">
                <FolderUp className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-900 mb-1">
                  Selecionar a pasta descompactada no Computador
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                  Se você já tem a pasta <strong>Patrimonios_Images</strong> descompactada no seu computador, você pode selecioná-la inteira de uma só vez:
                </p>

                <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm transition-colors">
                  <FolderUp className="w-4 h-4" />
                  <span>Selecionar a Pasta Inteira</span>
                  <input 
                    type="file" 
                    /* @ts-expect-error webkitdirectory is standard in Chromium/Safari/Firefox */
                    webkitdirectory="" 
                    directory="" 
                    multiple 
                    className="hidden" 
                    onChange={handleFolderUpload}
                    disabled={isProcessing}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Opção 3: Conexão via AppSheet URL */}
          {activeTab === 'link' && (
            <form onSubmit={handleConnectAppSheetUrl} className="space-y-4">
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />
                  Carregar Fotos Diretamente do Servidor do AppSheet
                </h4>
                <p className="text-xs text-indigo-900 leading-relaxed">
                  Cole abaixo a <strong>URL completa do seu aplicativo no AppSheet</strong> (o link que você usa para abrir o app no navegador) ou apenas o código após <code className="bg-white px-1 py-0.5 rounded font-mono text-[11px]">appName=</code>:
                </p>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    URL ou Nome do App no AppSheet:
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder="Ex: https://www.appsheet.com/start/f58a74e1-... ou PatrimoniosPMC-853611"
                      value={appSheetAppName}
                      onChange={(e) => setAppSheetAppName(e.target.value)}
                      className="flex-1 text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={!appSheetAppName.trim() || testingUrl}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {testingUrl ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Testando...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Conectar & Testar Foto</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Detecção inteligente de caminho de pasta do Google Drive */}
                {appSheetAppName.includes('appsheet/data') && (
                  <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-2 animate-fadeIn">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <FolderArchive className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Caminho da Pasta do Google Drive Identificado!</span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      Você inseriu o endereço da pasta onde o AppSheet guarda os arquivos no seu Google Drive: <code className="bg-white/90 px-1 py-0.5 rounded font-mono font-bold text-amber-950">{appSheetAppName}</code>.
                    </p>
                    <div className="bg-white p-2.5 rounded-lg border border-amber-200 text-[11px] text-slate-800 space-y-1">
                      <span className="font-bold text-amber-900 block">Como baixar todas as {totalComFotoAppSheet.toLocaleString('pt-BR')} fotos reais em 1 minuto:</span>
                      <p>
                        1. Abra o seu <strong>Google Drive</strong> e vá na pasta <strong>appsheet &gt; data &gt; PatrimôniosCapanema-729224800</strong>.
                      </p>
                      <p>
                        2. Dentro dela, clique com o botão direito na pasta <strong>Patrimonios_Images</strong> e clique em <strong>Fazer Download</strong>.
                      </p>
                      <p>
                        3. O Google Drive vai baixar um arquivo <strong>.zip</strong>. Basta voltar aqui na <strong>Opção 1</strong> deste modal e soltar o ZIP. Todas as {totalComFotoAppSheet.toLocaleString('pt-BR')} fotos entrarão no sistema na hora!
                      </p>
                    </div>
                  </div>
                )}

                {/* Resultado do Teste de Conexão */}
                {urlTestStatus === 'success' && testSampleUrl && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 animate-fadeIn">
                    <div className="w-14 h-14 rounded-lg bg-emerald-100 overflow-hidden shrink-0 border border-emerald-300">
                      <img src={testSampleUrl} alt="Foto Teste" className="w-full h-full object-cover" />
                    </div>
                    <div className="text-xs text-emerald-900 space-y-0.5">
                      <p className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Conexão Validada com Sucesso!
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        O AppSheet autorizou o acesso e a foto de teste carregou perfeitamente. As {totalComFotoAppSheet.toLocaleString('pt-BR')} fotos já estão ativas na tabela.
                      </p>
                    </div>
                  </div>
                )}

                {urlTestStatus === 'failed' && (
                  <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs text-amber-900 animate-fadeIn">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-950">
                          A URL foi configurada, mas o AppSheet bloqueou a visualização pública da foto.
                        </p>
                        <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                          Por padrão, o AppSheet ativa a opção de segurança <strong>&quot;Require Image and File URL Signing&quot;</strong>, que impede que outros sites carreguem as fotos sem autenticação.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 space-y-1.5 text-[11px]">
                      <span className="font-bold text-slate-800 block">Como resolver:</span>
                      <p className="text-slate-700">
                        • <strong>Solução Rápida (Opção 1):</strong> No seu Google Drive, clique com o botão direito na pasta <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-900">Patrimonios_Images</code> → <strong>Fazer Download</strong> e arraste o ZIP para cá. Essa opção não depende do AppSheet e funciona 100%!
                      </p>
                      <p className="text-slate-700">
                        • <strong>Ou no AppSheet:</strong> Vá em <em>Security → Options</em> e desmarque <em>&quot;Require Image and File URL Signing&quot;</em>.
                      </p>
                    </div>

                    {testSampleUrl && (
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-mono truncate max-w-xs">App ID: {extractedAppName}</span>
                        <a 
                          href={testSampleUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-blue-700 hover:underline font-bold flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Testar link direto da foto
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          )}

          {/* Barra de Progresso durante processamento */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                <span className="flex items-center gap-2 min-w-0">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
                  <span className="truncate">{progressText}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-blue-400">{progressPercent}%</span>
                  <button
                    type="button"
                    onClick={() => { cancelRequestedRef.current = true; }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    Pausar
                  </button>
                </div>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-emerald-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Mensagens de Sucesso ou Erro */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* Previews de Fotos Correspondidas */}
          {samplePreviews.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Amostra de Fotos Vinculadas Automaticamente:
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {samplePreviews.length} bens
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {samplePreviews.map((p, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2 space-y-1.5 shadow-2xs">
                    <div className="w-full h-24 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                      <img src={p.dataUrl} alt={p.descricao} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-[11px]">
                      <span className="font-mono font-bold text-blue-900">Tombo #{p.tombo}</span>
                      <p className="text-[10px] text-slate-600 truncate font-medium">{p.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            {totalComFotoAppSheet.toLocaleString('pt-BR')} bens com foto referenciada no AppSheet
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
