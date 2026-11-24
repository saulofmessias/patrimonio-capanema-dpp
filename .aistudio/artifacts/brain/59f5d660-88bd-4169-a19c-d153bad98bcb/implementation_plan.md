# Seleção Múltipla de até 5 Departamentos com Relatório PDF Paginado

Permite aos gestores do patrimônio selecionar de 1 a 5 departamentos simultaneamente na tela por meio de caixas de seleção com contador visual e gerar relatórios em PDF com cada departamento organizado em páginas oficiais individuais.

## Decisões Confirmadas com o Usuário

> [!IMPORTANT]
> Decisões alinhadas na Fase de Clarificação:
> - **Organização do PDF com Múltiplos Departamentos**: Quando 2 ou mais departamentos forem selecionados, o relatório em PDF gerará automaticamente **uma página separada para cada departamento**, contendo seu próprio cabeçalho institucional, totalizador de itens e bloco formal de assinatura.
> - **Interface de Seleção na Tela**: Implementação de **lista expansível com caixas de seleção (checkboxes) e contador visual dinâmico (ex: "3 de 5 selecionados")**, impedindo seleções excedentes a 5 de forma intuitiva e clara.

---

## 1. Visão Geral e Conceito

O sistema atualmente permite filtrar e emitir relatórios para uma Secretaria inteira ou para um único Departamento por vez. Com esta atualização:
- Os fiscais e gestores de patrimônio poderão selecionar **até 5 departamentos ou salas específicas** da mesma secretaria (ou de secretarias gerais) para vistorias combinadas ou conferências setoriais.
- A tela principal exibirá os bens de todos os departamentos marcados em conjunto.
- O gerador de PDF (`jspdf` + `jspdf-autotable`) produzirá um documento consolidado de alta qualidade onde cada departamento selecionado inicia em uma nova página A4 com cabeçalho completo e respectiva tabela de bens (Número de Tombamento e Descrição).

---

## 2. Experiência do Usuário e Design Visual

### Fluxo de Interação
1. **Seleção de Departamentos**:
   - Ao lado do filtro de Secretaria, o seletor de departamento se transforma em um botão seletor dinâmico que exibe o resumo (ex: *"Todos os Deptos"* ou *"3 Deptos Selecionados"*).
   - Ao clicar, abre-se um painel suspenso limpo e acessível com busca interna rápida de salas/setores e caixas de seleção (`checkboxes`).
   - Um contador destacado no topo do painel (`"Selecionados: X de 5"`) orienta o usuário. Ao atingir 5, as demais opções ficam suavemente desabilitadas com aviso amigável *"Limite de 5 departamentos atingido"*.
   - Botões de ação rápida: *"Limpar Seleção"* e *"Confirmar"*.

2. **Na Tabela da Tela Principal**:
   - A listagem de bens filtra instantaneamente os patrimônios pertencentes aos departamentos marcados.
   - Pequenas etiquetas de texto (`chips` de filtro funcionais com botão `x`) mostram quais departamentos estão ativos, permitindo remover qualquer um com um clique.

3. **No Modal de Relatórios e no Arquivo PDF**:
   - O modal de relatórios reconhece os departamentos selecionados.
   - O documento em tela e o PDF baixado geram uma quebra de página formal para cada departamento:
     - **Página 1**: Secretaria X • Departamento 1 (Total de bens e assinaturas)
     - **Página 2**: Secretaria X • Departamento 2 (Total de bens e assinaturas)
     - ... até o 5º departamento.

---

## 3. Decisões Técnicas e Arquitetura

### A. Estratégia de Filtragem e Estado
- **Estado de Departamentos**: Transição de `selectedDepartamento: string` para `selectedDepartamentos: string[]` (array com até 5 strings).
- **Validação de Limite**: Função pura `toggleDepartamento(dep: string)` que adiciona/remove itens travando em `length === 5`.

### B. Geração do Relatório PDF Paginado (`pdfRelatorioSimplificado.ts`)
- Suporte a `departamentos: string[]`.
- Itera sobre cada departamento selecionado:
  - Adiciona o cabeçalho oficial com o nome do departamento.
  - Desenha a tabela de itens do setor via `autoTable`.
  - Adiciona o bloco de assinaturas do responsável daquele setor.
  - Se houver próximo departamento na fila, invoca `doc.addPage()` para garantir o isolamento em páginas separadas solicitado pelo usuário.

### C. Diagrama de Arquitetura e Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                   PatrimoniosManager                        │
│                                                             │
│   ┌────────────────────────┐    ┌───────────────────────┐   │
│   │  Seletor Secretaria    │    │  Seletor Multi-Depto  │   │
│   │  (15 Órgãos Oficiais)  │    │  (Até 5 com Checkbox) │   │
│   └───────────┬────────────┘    └───────────┬───────────┘   │
│               │                             │               │
│               └──────────────┬──────────────┘               │
│                              ▼                              │
│               ┌─────────────────────────────┐               │
│               │   Filtro Reativo de Bens    │               │
│               │ (Secretaria + 1 a 5 Deptos) │               │
│               └──────────────┬──────────────┘               │
│                              │                              │
│                              ▼                              │
│             ┌────────────────────────────────┐              │
│             │   Botão "Relatório PDF"        │              │
│             └────────────────┬───────────────┘              │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 TermosERelatoriosModal                      │
│               & pdfRelatorioSimplificado                    │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Para cada Departamento selecionado (1 a 5):        │   │
│   │  1. Iniciar Nova Página A4                          │   │
│   │  2. Desenhar Cabeçalho PMC com Nome do Depto        │   │
│   │  3. Listar Bens: Nº Tombamento | Descrição          │   │
│   │  4. Desenhar Bloco de Assinaturas DPP & Setor       │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Status de Implementação Concluída

- [x] **Atualizado `src/utils/pdfRelatorioSimplificado.ts`**:
  - Aceita `departamentos?: string[]` para múltiplos departamentos.
  - Implementado loop com quebra de página automática (`doc.addPage()`), gerando cada departamento selecionado em uma folha separada com cabeçalho oficial, numeração de lote, tabela com Item, Tombamento e Descrição, e bloco de assinaturas DPP & Setor.

- [x] **Criado Componente `MultiDepartamentoSelector.tsx`**:
  - Popover intuitivo com caixas de seleção (checkboxes) e busca rápida de setores/salas.
  - Contador dinâmico com limite estrito de até 5 departamentos.
  - Bloqueio suave ao atingir 5 seleções e botões de ação rápida ("Limpar Todos" e "Confirmar").

- [x] **Atualizado `src/components/TermosERelatoriosModal.tsx`**:
  - Integrado o `MultiDepartamentoSelector` no painel de parâmetros do relatório simplificado.
  - Pré-visualização da folha A4 com alternador entre as páginas de cada departamento selecionado.
  - Bloco de assinaturas adaptado para exibir a chefia do departamento correspondente.

- [x] **Integrado na Tela Principal em `src/components/PatrimoniosManager.tsx`**:
  - Seletor de até 5 departamentos integrado à barra de filtros ao lado da Secretaria.
  - Etiquetas (chips) removíveis com botão "×" e contador visual "X/5".
  - Sincronização direta com a abertura do modal de relatórios oficiais.
  - Compilação e testes de lint validados com 100% de sucesso.
