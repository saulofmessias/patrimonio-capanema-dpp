const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../public/data/patrimonios_capanema.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log(`Iniciando saneamento de descrições para ${data.length} bens...`);

const RULES = [
  // 1. Erros graves de transcrição de voz / áudio do AppSheet
  { match: /\bPra\s+inox\s+vomitou\b/gi, fix: 'Pia inox com' },
  { match: /\bvomitou\s+1\s+torneira\b/gi, fix: 'com 1 torneira' },
  { match: /\bvomitou\b/gi, fix: 'com' },
  { match: /\bver-se\s+cinza\b/gi, fix: 'verde e cinza' },
  { match: /\bver-se\b/gi, fix: 'verde' },
  { match: /\bcentral\s+[ed][34]\s*ar\b/gi, fix: 'Central de ar' },
  { match: /\bcadeira\s+d3\s*rodas\b/gi, fix: 'Cadeira de rodas / giratória' },
  { match: /\bd3\s*rodas\b/gi, fix: 'de rodas' },

  // 2. Erros de digitação e letras grudadas em números
  { match: /\b(\d+)ccadeiras\b/gi, fix: '$1 cadeiras' },
  { match: /\b(\d+)bportas\b/gi, fix: '$1 portas' },
  { match: /\b(\d+)\s*pirtas\b/gi, fix: '$1 portas' },
  { match: /\bpirtas\b/gi, fix: 'portas' },
  { match: /\bdivisoriad\b/gi, fix: 'divisórias' },
  { match: /\bdividoriss\b/gi, fix: 'divisórias' },
  { match: /\bdivisorias\b/gi, fix: 'divisórias' },
  { match: /\brefeitotio\b/gi, fix: 'refeitório' },
  { match: /\bdevprolipropileno\b/gi, fix: 'de polipropileno' },
  { match: /\bdr\s+polipropileno\b/gi, fix: 'de polipropileno' },
  { match: /\bprolipropileno\b/gi, fix: 'polipropileno' },
  { match: /\bpoliproprileno\b/gi, fix: 'polipropileno' },
  { match: /\bestufad([ao]s?)\b/gi, fix: 'estofad$1' },
  { match: /\blemovo\b/gi, fix: 'Lenovo' },
  { match: /\bthinkcente\b/gi, fix: 'ThinkCentre' },
  { match: /\bthink\s+centre\b/gi, fix: 'ThinkCentre' },
  { match: /\blongoria\b/gi, fix: 'Longarina' },
  { match: /\blogarina\b/gi, fix: 'Longarina' },
  { match: /\bmarron\b/gi, fix: 'marrom' },
  { match: /\bbeje\b/gi, fix: 'bege' },

  // 3. Estruturas padronizadas de móveis e equipamentos
  { match: /\barm[aá]rio\s+alto\s+c\s+duas\s+portas\b/gi, fix: 'Armário alto com 2 portas' },
  { match: /\bmesa\s+arredondada\s+em\s+madeira\b/gi, fix: 'Mesa redonda em madeira' },
  { match: /\bguilhotina\s+papel\s+cutter\b/gi, fix: 'Guilhotina de papel refiladora' },
  { match: /\blaminador\s+plastificados\s+tander\b/gi, fix: 'Plastificadora / Laminadora Tander' },
  { match: /\bprovedor\s+para\s+internet\s+intelbras\b/gi, fix: 'Roteador / Provedor de Internet Intelbras' },

  // 4. Kits Escolares e Quantidades
  { match: /\bkits\s+escolares\s+(\d+)\s+verde\s+cinza\b/gi, fix: '$1 kits escolares verde e cinza' },
  { match: /\bkits\s+escolares\s+(\d+)\s+([a-zá-ú]+)\s+([a-zá-ú]+)\b/gi, fix: '$1 kits escolares $2 e $3' },
  { match: /\b(\d+)\s+kits?\s+escolar\s+vermelho\s+cinza\b/gi, fix: '$1 kits escolares vermelho e cinza' },
  { match: /\b(\d+)\s+kits?\s+escolar\s+([a-zá-ú]+)\s+([a-zá-ú]+)\b/gi, fix: '$1 kits escolares $2 e $3' },
  { match: /\b(\d+)\s+kits?\s+escolares\s+verde\s+cinza\b/gi, fix: '$1 kits escolares verde e cinza' },
  { match: /\b(\d+)\s+kits?\s+escolares\s+azul\s+cinza\b/gi, fix: '$1 kits escolares azul e cinza' },

  // 5. Cores compostas sem conectivo
  { match: /\bazul\s+cinza\b/gi, fix: 'azul e cinza' },
  { match: /\blaranja\s+cinza\b/gi, fix: 'laranja e cinza' },
  { match: /\bpreta\s+cinza\b/gi, fix: 'preta e cinza' },

  // 6. Marcas e Tecnologias
  { match: /\bagratto\b/gi, fix: 'Agratto' },
  { match: /\bphilco\b/gi, fix: 'Philco' },
  { match: /\bgree\b/gi, fix: 'Gree' },
  { match: /\btcl\b/gi, fix: 'TCL' },
  { match: /\besmaltec\b/gi, fix: 'Esmaltec' },
  { match: /\bfricon\b/gi, fix: 'Fricon' },
  { match: /\bpanasonic\b/gi, fix: 'Panasonic' },
  { match: /\bintelbras\b/gi, fix: 'Intelbras' },
  { match: /\bmdf\b/gi, fix: 'MDF' },
  { match: /\becotank\b/gi, fix: 'EcoTank' },
  { match: /\bI5\b/g, fix: 'i5' },
  { match: /\bI3\b/g, fix: 'i3' },
  { match: /\bI7\b/g, fix: 'i7' }
];

let totalModified = 0;
const examples = [];

const sanitizedData = data.map(item => {
  let desc = (item.descricao || '').trim();
  let wasModified = false;

  for (const r of RULES) {
    if (r.match.test(desc)) {
      desc = desc.replace(r.match, r.fix);
      wasModified = true;
    }
  }

  // Limpeza de espaços duplicados
  desc = desc.replace(/\s+/g, ' ').trim();

  // Garante primeira letra maiúscula
  if (desc.length > 0) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  if (wasModified && desc !== item.descricao) {
    totalModified++;
    if (examples.length < 35) {
      examples.push({ tomb: item.numeroTombamento, antes: item.descricao, depois: desc });
    }
  }

  return {
    ...item,
    descricao: desc
  };
});

fs.writeFileSync(filePath, JSON.stringify(sanitizedData, null, 2), 'utf8');

console.log(`Sucesso: ${totalModified} descrições saneadas e salvas com sucesso!`);
console.log('Exemplos de correções realizadas:');
examples.forEach(ex => {
  console.log(`[#${ex.tomb}] "${ex.antes}" ➔ "${ex.depois}"`);
});
