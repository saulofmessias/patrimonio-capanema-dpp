/**
 * Utilitário de tradução e mapeamento de fórmulas do Google AppSheet
 * para equivalentes em TypeScript / SQL / Firestore
 */

export interface FormulaTranslation {
  appSheetFormula: string;
  category: 'Consulta / Seleção' | 'Lógica / Condicional' | 'Cálculo / Agregação' | 'Texto / Manipulação' | 'Data / Hora' | 'Segurança / Usuário';
  description: string;
  typescriptEquivalent: string;
  sqlEquivalent: string;
  explanation: string;
}

export const KNOWN_FORMULA_PATTERNS: FormulaTranslation[] = [
  {
    appSheetFormula: 'SELECT(Pedidos[ValorTotal], [ClienteId] = [_THISROW].[ClienteId])',
    category: 'Consulta / Seleção',
    description: 'Filtra uma lista de valores de uma tabela com base em condição',
    typescriptEquivalent: `pedidos.filter(p => p.clienteId === currentRow.clienteId).map(p => p.valorTotal)`,
    sqlEquivalent: `SELECT valor_total FROM pedidos WHERE cliente_id = $1`,
    explanation: 'No AppSheet, SELECT retorna uma lista (List). No frontend/backend mapeamos para .filter() seguido de .map(), ou uma cláusula WHERE no banco relacional.'
  },
  {
    appSheetFormula: 'LOOKUP([_THISROW].[ClienteId], "Clientes", "Id", "NomeCompleto")',
    category: 'Consulta / Seleção',
    description: 'Busca um campo específico em outra tabela pela chave',
    typescriptEquivalent: `clientes.find(c => c.id === currentRow.clienteId)?.nomeCompleto ?? ''`,
    sqlEquivalent: `SELECT nome_completo FROM clientes WHERE id = $1 LIMIT 1`,
    explanation: 'Substitui o LOOKUP por consulta direta indexada na memória ou JOIN no banco de dados para evitar N+1 queries.'
  },
  {
    appSheetFormula: 'IFS([Status] = "Pendente", "Amarelo", [Status] = "Aprovado", "Verde", [Status] = "Cancelado", "Vermelho")',
    category: 'Lógica / Condicional',
    description: 'Condicionais múltiplos ordenados',
    typescriptEquivalent: `(() => {
  if (row.status === 'Pendente') return 'Amarelo';
  if (row.status === 'Aprovado') return 'Verde';
  if (row.status === 'Cancelado') return 'Vermelho';
  return 'Cinza';
})()`,
    sqlEquivalent: `CASE 
  WHEN status = 'Pendente' THEN 'Amarelo'
  WHEN status = 'Aprovado' THEN 'Verde'
  WHEN status = 'Cancelado' THEN 'Vermelho'
  ELSE 'Cinza'
END`,
    explanation: 'O IFS do AppSheet avalia pares condição/valor. Convertemos para estrutura switch/if-else ou instrução CASE no SQL.'
  },
  {
    appSheetFormula: 'SUM(SELECT(ItensPedido[Subtotal], [PedidoId] = [_THISROW].[Id]))',
    category: 'Cálculo / Agregação',
    description: 'Soma itens relacionados a uma linha pai',
    typescriptEquivalent: `itensPedido
  .filter(i => i.pedidoId === currentRow.id)
  .reduce((acc, curr) => acc + (Number(curr.subtotal) || 0), 0)`,
    sqlEquivalent: `SELECT COALESCE(SUM(subtotal), 0) FROM itens_pedido WHERE pedido_id = $1`,
    explanation: 'Coluna virtual de cálculo agregado. Pode ser computada na exibição no React ou persistida via trigger no backend para alto desempenho.'
  },
  {
    appSheetFormula: 'USEREMAIL()',
    category: 'Segurança / Usuário',
    description: 'Identifica o e-mail do usuário autenticado no sistema',
    typescriptEquivalent: `authContext.user?.email || ''`,
    sqlEquivalent: `current_setting('app.current_user_email', true) /* ou via JWT session */`,
    explanation: 'Mapeado para o contexto de autenticação global da aplicação web (ex: Firebase Auth / Supabase Auth / Sessão JWT).'
  },
  {
    appSheetFormula: 'CONCATENATE([Codigo], " - ", [Descricao], " (", [Unidade], ")")',
    category: 'Texto / Manipulação',
    description: 'Concatenação de textos e campos',
    typescriptEquivalent: `\`\${row.codigo} - \${row.descricao} (\${row.unidade})\``,
    sqlEquivalent: `CONCAT(codigo, ' - ', descricao, ' (', unidade, ')')`,
    explanation: 'Substituído por template strings em TypeScript com verificação opcional de nulos.'
  },
  {
    appSheetFormula: 'ISNOTBLANK([DataEntrega])',
    category: 'Lógica / Condicional',
    description: 'Verifica se um campo possui valor preenchido',
    typescriptEquivalent: `row.dataEntrega !== null && row.dataEntrega !== undefined && String(row.dataEntrega).trim() !== ''`,
    sqlEquivalent: `data_entrega IS NOT NULL AND data_entrega <> ''`,
    explanation: 'Garante validação estrita sem falhas com valores vazios ou espaços em branco.'
  },
  {
    appSheetFormula: 'IN([Status], LIST("Em Aberto", "Em Andamento", "Aguardando Peças"))',
    category: 'Consulta / Seleção',
    description: 'Verifica se um valor pertence a uma lista',
    typescriptEquivalent: `['Em Aberto', 'Em Andamento', 'Aguardando Peças'].includes(row.status)`,
    sqlEquivalent: `status IN ('Em Aberto', 'Em Andamento', 'Aguardando Peças')`,
    explanation: 'Implementado com includes em arrays ou enum types tipados.'
  },
  {
    appSheetFormula: 'TODAY() - [DataNascimento] / 365.25',
    category: 'Data / Hora',
    description: 'Cálculo de idade ou diferença entre datas',
    typescriptEquivalent: `Math.floor((Date.now() - new Date(row.dataNascimento).getTime()) / (1000 * 60 * 60 * 24 * 365.25))`,
    sqlEquivalent: `DATE_PART('year', AGE(CURRENT_DATE, data_nascimento))`,
    explanation: 'Manipulação padronizada com timezone UTC e formatação local.'
  },
  {
    appSheetFormula: 'AND([Ativo] = TRUE, [SaldoDevedor] > 0)',
    category: 'Lógica / Condicional',
    description: 'Conjunção lógica múltipla (AND)',
    typescriptEquivalent: `Boolean(row.ativo) && (Number(row.saldoDevedor) > 0)`,
    sqlEquivalent: `ativo = TRUE AND saldo_devedor > 0`,
    explanation: 'Operador lógico estrito com coerção segura de tipos numéricos e booleanos.'
  }
];

export function translateCustomExpression(expr: string): {
  typeScript: string;
  sql: string;
  notes: string;
} {
  const clean = expr.trim();
  if (!clean) {
    return {
      typeScript: '// Nenhuma expressão informada',
      sql: '-- Nenhuma expressão informada',
      notes: 'Digite uma expressão válida do AppSheet acima.'
    };
  }

  // Exact or similar match from catalog
  const found = KNOWN_FORMULA_PATTERNS.find(p => p.appSheetFormula.toLowerCase() === clean.toLowerCase());
  if (found) {
    return {
      typeScript: found.typescriptEquivalent,
      sql: found.sqlEquivalent,
      notes: found.explanation
    };
  }

  // Heuristic rule translation
  if (clean.toUpperCase().startsWith('USEREMAIL()')) {
    return {
      typeScript: `currentUser?.email || ''`,
      sql: `current_user_email`,
      notes: 'Expressão de contexto de sessão de usuário autenticado.'
    };
  }

  if (clean.toUpperCase().startsWith('TODAY()')) {
    return {
      typeScript: `new Date().toISOString().split('T')[0]`,
      sql: `CURRENT_DATE`,
      notes: 'Data atual em formato padrão ISO AAAA-MM-DD.'
    };
  }

  if (clean.toUpperCase().startsWith('NOW()')) {
    return {
      typeScript: `new Date().toISOString()`,
      sql: `CURRENT_TIMESTAMP`,
      notes: 'Data e hora atual com precisão de timestamp.'
    };
  }

  if (clean.toUpperCase().includes('CONCATENATE(')) {
    return {
      typeScript: `// Extração de parâmetros para template literals
// Exemplo: \`\${campoA} - \${campoB}\``,
      sql: `CONCAT(...)`,
      notes: 'Fórmula de texto: converter os argumentos internos para template strings em TS.'
    };
  }

  return {
    typeScript: `// Expressão AppSheet detectada: ${clean}
// Implementar lógica equivalente usando funções puras com os dados do registro:
(row) => {
  /* Avaliar regra correspondente a: ${clean} */
  return true;
}`,
    sql: `-- Regra correspondente para a cláusula WHERE ou coluna gerada:
-- ${clean}`,
    notes: 'Expressão personalizada. Recomenda-se registrar a tabela e colunas de origem para validação exata.'
  };
}
