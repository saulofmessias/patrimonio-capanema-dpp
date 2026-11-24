const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../public/data/patrimonios_capanema.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log(`Iniciando saneamento de Departamento e Local para ${data.length} bens...`);

// 1. Catálogo Completo de Locais / Unidades Oficiais de Capanema
const CANONICAL_LOCALS = [
  // Maximiana Menezes (já tratada)
  { name: 'EMEIF Maximiana Menezes', regex: /maximiana\s*menezes|macim\d?ana|maximiana|menezed|menex\ds|nenezes/i },

  // Escolas e Creches de Capanema (SEMED)
  { name: 'EMEIF Jorge Travassos', regex: /jorge\s*trava[sc]s?[do]?[sd]?|teavasso|jorgev?travassos|jorge\s*travesso/i },
  { name: 'EMEIF Euclides Cumaru', regex: /euclides\s*cuma?r[ui]/i },
  { name: 'EMEIF Risoneide Lima Braga', regex: /r[io]son?eide\s*lima\s*braga|r[io]sineide\s*braga/i },
  { name: 'EMEIF Joaquim da Costa Melo', regex: /joaquim\s*da\s*costa\s*melo/i },
  { name: 'EMEIF Frei Hermes Recanatti', regex: /frei\s*hermes\s*recanat?t?i/i },
  { name: 'EMEIF Maria Natividade da Silva', regex: /maria\s*natividade\s*da\s*silva/i },
  { name: 'EMEIF Professora Júlia Guerreiro Rocha', regex: /j[uú]lia\s*guerreiro\s*rocha|julia\s*guerreiro/i },
  { name: 'EMEIF Raimundo Rodrigues Moreira', regex: /raimundo\s*rodrigues\s*moreira/i },
  { name: 'EMEIF Olga Costa', regex: /olga\s*costa/i },
  { name: 'EMEIF Professora Terezinha de Jesus Souza', regex: /tere[sz]inha\s*de\s*jesus\s*sou[zs]a/i },
  { name: 'EMEIF Inácio Guilhon', regex: /in[aá]cio\s*guilhon/i },
  { name: 'EMEIF Inácio Ferreira da Silva', regex: /in[aá]cio\s*ferreira\s*da\s*silva/i },
  { name: 'Creche de Tempo Integral Professora Lucimar Santos', regex: /lucimar\s*(de\s*souza\s*)?santos/i },
  { name: 'Creche Professora Maria Vilmar da Silva Souza', regex: /maria\s*vilmar\s*da\s*silva\s*sou[zs]a/i },
  { name: 'EMEIF Tenente Severino de Menezes', regex: /tenente\s*severino\s*de\s*mene[sz]es/i },
  { name: 'Creche São João Batista', regex: /s[aã]o\s*jo[aã]o\s*batista/i },
  { name: 'EMEIF Creche João Eustaquilino Pessoa', regex: /jo[aã]o\s*eustaquilino\s*pessoa|estaquilino|eustaquio/i },
  { name: 'Creche Meirivaldo Jornalis de Paiva', regex: /meirivaldo\s*jorna(li)?s\s*de\s*paiva/i },
  { name: 'Creche Fernando Costa', regex: /creche\s*fernando\s*costa|fernando\s*costa/i },
  { name: 'EMEIF Dom Pedro II', regex: /dom\s*pedro\s*ii/i },
  { name: 'EMEIF Cristo Rei', regex: /cristo\s*rei/i },
  { name: 'EMEIF Santo Antônio', regex: /santo\s*ant[oô]nio/i },
  { name: 'EMEIF São José', regex: /s[aã]o\s*jos[eé]/i },
  { name: 'EMEIF Santa Maria', regex: /santa\s*maria/i },
  { name: 'EMEIF Otávio Bastos', regex: /ot[aá]vio\s*bastos/i },
  { name: 'EMEIF Francisco Nunes', regex: /francisco\s*nunes/i },
  { name: 'EMEIF Tancredo Neves', regex: /tancredo\s*neves/i },
  { name: 'EMEIF Dona Carmelita', regex: /dona\s*carmelita|carmelita/i },
  { name: 'EMEIF Cândido Miranda', regex: /c[aâ]ndido\s*miranda/i },
  { name: 'EMEIF Barão do Rio Branco', regex: /bar[aã]o\s*do\s*rio\s*branco/i },
  { name: 'EMEIF Alacid Nunes', regex: /alacid\s*nunes/i },
  { name: 'EMEIF Princesa Isabel', regex: /princesa\s*isabel/i },
  { name: 'EMEIF Duque de Caxias', regex: /duque\s*de\s*caxias/i },
  { name: 'EMEIF Getúlio Vargas', regex: /get[uú]lio\s*vargas/i },
  { name: 'EMEIF João Paulo II', regex: /jo[aã]o\s*paulo\s*ii/i },
  { name: 'EMEIF Tiradentes', regex: /tiradentes/i },
  { name: 'EMEIF São Francisco', regex: /s[aã]o\s*francisco/i },
  { name: 'Polo Universitário / Polo UAB', regex: /polo\s*uab|polo\s*universit[aá]rio/i },

  // Unidades de Saúde (SEMSA)
  { name: 'USF Maria Rosa Batista (Areia Branca)', regex: /maria\s*rosa\s*batista|areia\s*branca/i },
  { name: 'USF Francisco Carneiro de Oliveira', regex: /francisco\s*carneiro\s*de\s*oliveira/i },
  { name: 'Centro de Saúde do Trabalhador Dr. Neomar Varela', regex: /neomar\s*varela|trabalhador\s*dr\s*neomar|sa[uú]de\s*do\s*trabalhador/i },
  { name: 'Departamento de Vigilância Sanitária (DVS)', regex: /vigil[aâ]ncia\s*sanit[aá]ria|dvs/i },
  { name: 'USF Raimundo Sousa Reis / Fernando Mendes', regex: /raimund[ao]\s*(sousa\s*)?reis.*fernando\s*mendes|fernando\s*mendes|raimunda\s*reis/i },
  { name: 'USF José Valdo Peroti', regex: /jos[eé]\s*valdo\s*perot[it]/i },
  { name: 'USF Josepha Albuquerque Murrieta', regex: /josepha\s*albuquerque\s*murrieta/i },
  { name: 'USF Arnoldo Tavares', regex: /arnoldo\s*tavares/i },
  { name: 'USF Dr. Jorge Neto da Costa', regex: /jorge\s*neto\s*da\s*costa|dr\.?\s*jorge\s*costa/i },
  { name: 'USF Dr. Walter Pinheiro Lobato', regex: /walter\s*pinheiro\s*lobato/i },
  { name: 'USF Reginaldo Narciso Romariz', regex: /reginaldo\s*narciso\s*(v\.\s*)?romariz/i },
  { name: 'USF Maria Smith Santos (Bairro Fátima)', regex: /maria\s*smith\s*santos|maria\s*smith|bairro\s*f[aá]tima/i },
  { name: 'USF Manoel Serrão Valente', regex: /manoel\s*serr[aã]o\s*valente?/i },
  { name: 'USF Inussum', regex: /inussum/i },
  { name: 'USF Jorge Nogueira Figueiredo', regex: /jorge\s*nogueira\s*(de\s*)?figueiredo/i },
  { name: 'USF Alvorada', regex: /alvorada/i },
  { name: 'USF Tauari', regex: /tauari/i },
  { name: 'USF Miriti', regex: /miriti/i },
  { name: 'USF Nazaré', regex: /nazar[eé]/i },
  { name: 'Farmácia Municipal', regex: /farm[aá]cia\s*municipal/i },
  { name: 'Almoxarifado Central da Saúde', regex: /almoxarifado\s*central.*sa[uú]de|almoxarifado\s*sa[uú]de|caf|farm[aá]cia\s*b[aá]sica/i },
  { name: 'CAPS - Centro de Atenção Psicossocial', regex: /caps/i },
  { name: 'Policlínica Municipal', regex: /policl[ií]nica/i },
  { name: 'Hospital Municipal de Capanema', regex: /hospital\s*municipal/i },
  { name: 'SAMU 192', regex: /samu/i },
  { name: 'Centro de Endemias', regex: /endemias/i },

  // Assistência Social (SEMAS)
  { name: 'CRAS 2 Campinho', regex: /cras\s*(2\s*)?campinho/i },
  { name: 'CRAS 1 Miriti', regex: /cras\s*(1\s*)?miriti/i },
  { name: 'CRAS Santa Luzia', regex: /cras\s*santa\s*luzia/i },
  { name: 'CREAS Capanema', regex: /creas/i },
  { name: 'Centro de Convivência da Pessoa Idosa', regex: /centro\s*de\s*conviv[eê]ncia|idoso|pessoa\s*idosa/i },
  { name: 'PAA - Programa de Aquisição de Alimentos', regex: /\bpaa\b|aquisi[cç][aã]o\s*de\s*alimentos/i },
  { name: 'Vigilância Socioassistencial', regex: /vigil[aâ]ncia\s*s[oó]cio\s*assistencial/i },
  { name: 'Abrigo Institucional', regex: /abrigo/i },
  { name: 'Conselho Tutelar', regex: /conselho\s*tutelar/i },

  // Outras Secretarias e Órgãos
  { name: 'DEMUTRAN - Departamento de Trânsito', regex: /demutran|tr[aâ]nsito\s*jari|\bjari\b/i },
  { name: 'Gabinete do Prefeito', regex: /gabinete\s*do\s*prefeito|chefe\s*gabinete/i },
  { name: 'Gabinete do Vice-Prefeito', regex: /gabinete\s*do\s*vice/i },
  { name: 'Procuradoria Geral do Município', regex: /procuradoria|jur[ií]dico/i },
  { name: 'PROCON Capanema', regex: /procon/i },
  { name: 'Sala do Empreendedor', regex: /sala\s*do\s*empreendedor/i },
  { name: 'DECA - Controle Ambiental', regex: /\bdeca\b|controle\s*ambiental/i },
  { name: 'Garagem Municipal / Pátio de Obras', regex: /garagem|p[aá]tio\s*de\s*m[aá]quinas|m[aá]quinas\s*e\s*equipamentos/i },
  { name: 'Arquivo Público Municipal', regex: /arquivo\s*p[uú]blico|arquivo\s*municipal/i }
];

// 2. Mapeamento de Salas / Departamentos Padronizados
const ROOM_MAP = [
  // Recepção e Atendimento
  { match: /recep[cç][aã]o|recepc|portaria/i, standard: 'Recepção' },
  { match: /triagem/i, standard: 'Triagem' },

  // Secretaria e Gestão
  { match: /secret[aá]ria|secretaria/i, standard: 'Secretaria' },
  { match: /diretoria|dire[cç][aã]o|direito\b/i, standard: 'Diretoria' },
  { match: /coordena[cç][aã]o\s*pedag[oó]gica/i, standard: 'Coordenação Pedagógica' },
  { match: /coordena[cç][aã]o/i, standard: 'Coordenação' },
  { match: /gabinete\s*do\s*secret[aá]rio/i, standard: 'Gabinete do Secretário' },
  { match: /gabinete\s*do\s*prefeito/i, standard: 'Gabinete do Prefeito' },
  { match: /sala\s*do\s*secret[aá]rio/i, standard: 'Gabinete do Secretário' },
  { match: /sala\s*(do\s*)?gabinete/i, standard: 'Gabinete' },
  { match: /sala\s*de\s*reuni[aã]o/i, standard: 'Sala de Reunião' },

  // Salas de Aula Numeradas
  { match: /sala\s*0?(\d+)/i, standard: (m) => `Sala ${m[1].padStart(2, '0')}` },

  // Salas Pedagógicas e Especiais
  { match: /sala\s*(de\s*)?aee|\baee\b/i, standard: 'Sala AEE' },
  { match: /educa[cç][aã]o\s*infantil|sala\s*educa[cç][aã]o\s*infantil/i, standard: 'Educação Infantil' },
  { match: /sala\s*dos?\s*professores?|sala\s*professor/i, standard: 'Sala dos Professores' },
  { match: /sala\s*(de\s*)?inform[aá]tica|sala\s*inform[aá]tica/i, standard: 'Sala de Informática' },
  { match: /censo\s*escolar|senso\s*escolar/i, standard: 'Sala Censo Escolar' },
  { match: /laborat[oó]rio\s*de\s*ci[eê]ncias/i, standard: 'Laboratório de Ciências' },
  { match: /laborat[oó]rio/i, standard: 'Laboratório' },
  { match: /biblioteca/i, standard: 'Biblioteca' },
  { match: /audit[oó]rio/i, standard: 'Auditório' },

  // Saúde - Consultórios e Procedimentos
  { match: /consult[oó]rio\s*odonto/i, standard: 'Consultório Odontológico' },
  { match: /consult[oó]rio\s*m[eé]dico/i, standard: 'Consultório Médico' },
  { match: /consult[oó]rio\s*enfermagem/i, standard: 'Consultório de Enfermagem' },
  { match: /consult[oó]rio\s*0?(\d+)/i, standard: (m) => `Consultório ${m[1].padStart(2, '0')}` },
  { match: /consult[oó]rio|consultorio/i, standard: 'Consultório' },
  { match: /vacina|sala\s*de\s*vacina/i, standard: 'Sala de Vacina' },
  { match: /curativo|sala\s*de\s*curativo/i, standard: 'Sala de Curativo' },
  { match: /farm[aá]cia|dispens[aá]rio/i, standard: 'Farmácia' },
  { match: /nebuliza[cç][aã]o/i, standard: 'Sala de Nebulização' },
  { match: /enfermaria/i, standard: 'Enfermaria' },

  // Alimentação
  { match: /copa\s*cozinha|co0a\s*cozinha/i, standard: 'Copa Cozinha' },
  { match: /dep[oó]sito\s*merenda\s*escolar|depisito\s*merenda/i, standard: 'Depósito Merenda Escolar' },
  { match: /merenda\s*escolar/i, standard: 'Depósito Merenda Escolar' },
  { match: /refeit[oó]rio/i, standard: 'Refeitório' },
  { match: /\bcopa\b/i, standard: 'Copa' },
  { match: /\bcozinha\b/i, standard: 'Cozinha' },

  // Armazenamento, Arquivo e Apoio
  { match: /arquivo\s*passivo|zarwuovo\s*passivo/i, standard: 'Arquivo Passivo' },
  { match: /arquivo\s*p[uú]blico|arquivo\s*municipal|\barquivo\b/i, standard: 'Arquivo' },
  { match: /dep[oó]sito|depisito/i, standard: 'Depósito' },
  { match: /almoxarifado/i, standard: 'Almoxarifado' },
  { match: /corredor/i, standard: 'Corredor' },
  { match: /p[aá]tio/i, standard: 'Pátio' },
  { match: /banheiro|sanit[aá]rio/i, standard: 'Banheiro' },

  // Administrativo Geral
  { match: /recursos\s*humanos|\brh\b/i, standard: 'Recursos Humanos (RH)' },
  { match: /protocolo/i, standard: 'Protocolo' },
  { match: /tesouraria/i, standard: 'Tesouraria' },
  { match: /contabilidade/i, standard: 'Contabilidade' },
  { match: /tributos|receitas\s*e\s*tributos/i, standard: 'Setor de Tributos' },
  { match: /fiscaliza[cç][aã]o/i, standard: 'Fiscalização' },
  { match: /jur[ií]dico|assessoria\s*jur[ií]dica/i, standard: 'Assessoria Jurídica' },
  { match: /departamento\s*administrativo|setor\s*administrativo/i, standard: 'Departamento Administrativo' },
  { match: /departamento\s*t[eé]cnico/i, standard: 'Departamento Técnico' }
];

let countCleaned = 0;

const updatedData = data.map((item) => {
  // EMEIF Maximiana Menezes já está perfeitamente limpa
  if (item.local === 'EMEIF Maximiana Menezes') {
    return item;
  }

  const rawDepto = (item.departamento || '').trim();
  const rawLoc = (item.local || item.localizacaoExata || '').trim();
  const combined = `${rawDepto} ${rawLoc}`.trim();

  // 1. Identificar Local Canônico
  let detectedLocal = null;
  for (const loc of CANONICAL_LOCALS) {
    if (loc.regex.test(combined)) {
      detectedLocal = loc.name;
      break;
    }
  }

  if (!detectedLocal) {
    const sec = item.secretariaSetor || '';
    if (sec === 'SECRETARIA DE EDUCAÇÃO') {
      detectedLocal = 'Sede SEMED / Setor Central';
    } else if (sec === 'SECRETARIA DE SAÚDE') {
      detectedLocal = 'Sede SEMSA / Setor Central';
    } else if (sec === 'SECRETARIA DE ASSISTÊNCIA SOCIAL') {
      detectedLocal = 'Sede SEMAS / Setor Central';
    } else if (sec === 'GABINETE DO PREFEITO') {
      detectedLocal = 'Palácio Municipal / Gabinete';
    } else {
      detectedLocal = `${sec.replace(/^SECRETARIA\s+(MUNICIPAL\s+)?(DE\s+)?/i, '')} - Sede`;
      if (detectedLocal.length < 5) detectedLocal = 'Sede Administrativa';
    }
  }

  // 2. Extrair o Departamento / Sala e REMOVER o nome do Local
  let cleanDepto = null;
  for (const r of ROOM_MAP) {
    const match = rawDepto.match(r.match);
    if (match) {
      cleanDepto = typeof r.standard === 'function' ? r.standard(match) : r.standard;
      break;
    }
  }

  // Se não deu match direto nos padrões de sala, remove os nomes de escola/posto do departamento
  if (!cleanDepto) {
    let stripped = rawDepto;
    for (const loc of CANONICAL_LOCALS) {
      stripped = stripped.replace(loc.regex, ' ');
    }
    // Remove palavras-chave residuais de locais
    stripped = stripped
      .replace(/\b(EMEIF|EMEF|ESCOLA|USF|UBS|CRECHE|CENTRO\s+DE\s+SA[UÚ]DE|POSTO\s+DE\s+SA[UÚ]DE|POSTO)\b/gi, ' ')
      .replace(/\b(MAXIMIANA|MENEZES|JORGE|TRAVASSOS|EUCLIDES|CUMARU|RISONEIDE|BRAGA|LIMA|JOAQUIM|COSTA|MELO|FREI|HERMES|RECANATTI|NATIVIDADE|JULIA|GUERREIRO|ROCHA|RAIMUNDO|RODRIGUES|MOREIRA|OLGA|TEREZINHA|JESUS|SOUZA|INACIO|GUILHON|FERREIRA|LUCIMAR|VILMAR|SEVERINO|BATISTA|EUSTAQUILINO|PAIVA|MARIA|ROSA|FRANCISCO|CARNEIRO|OLIVEIRA|NEOMAR|VARELA|FERNANDO|MENDES|VALDO|PEROTI|JOSEPHA|MURRIETA|ARNOLDO|TAVARES|NETO|WALTER|LOBATO|ROMARIZ|SMITH|FATIMA|SERRAO|VALENTE|INUSSUM|CAMPINHO|MIRITI)\b/gi, ' ')
      .replace(/[\/\-\:\,\.\;\n\r\(\)]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (stripped.length >= 3 && !/^(sala|depto|setor)$/i.test(stripped)) {
      cleanDepto = stripped.charAt(0).toUpperCase() + stripped.slice(1);
    } else {
      cleanDepto = 'Setor Geral';
    }
  }

  countCleaned++;
  return {
    ...item,
    local: detectedLocal,
    localizacaoExata: detectedLocal,
    departamento: cleanDepto
  };
});

// Salvar no JSON da aplicação
fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf8');
console.log(`Sucesso: ${countCleaned} registros saneados com Local e Departamento separados!`);
