<div align="center">
  <img width="1200" height="475" alt="Banner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Patrimônio Público — Capanema / PA

Aplicação web para gestão patrimonial do município de Capanema (PA), com
cerca de **6.700 bens** catalogados, geração de etiquetas com QR Code,
termos de transferência, relatórios PDF em lote e modo offline.

Gerada no **Google AI Studio** e otimizada para uso em campo com conexão
instável (3G/4G).

## Funcionalidades

- **Catálogo completo** carregado de um JSON local + cache em IndexedDB
- **Filtros** por secretaria, local, departamento, texto e status
- **Ordenação** por etiqueta, descrição, secretaria, data e valor
- **KPIs** em tempo real: total, ativos, em transferência, inservíveis, valor
- **Importação em lote** de fotos via ZIP do AppSheet
- **Etiquetas PDF** com QR Code e código de barras (formatos A4 e térmica)
- **Termos e relatórios** de transferência e vistoria em PDF
- **Scanner de QR Code** pela câmera do celular ou upload de imagem
- **Acesso por equipe** com perfis de Administrador, Gerente e Servidor
- **Sincronização** bidirecional com o Firestore (online + fila offline)

## Tecnologias

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) + [Vite](https://vitejs.dev/)
- [Firebase Auth](https://firebase.google.com/docs/auth) + [Cloud Firestore](https://firebase.google.com/docs/firestore)
- [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/)
- [qrcode](https://github.com/soldair/node-qrcode) + [jsbarcode](https://github.com/lindell/JsBarcode)
- [PWA](https://vite-pwa.netlify.app/) com Service Worker

## Como rodar localmente

```bash
# 1. Clonar o repositório
git clone <url-do-repositorio>
cd <pasta-do-projeto>

# 2. Instalar dependências
npm install

# 3. Configurar o Firebase
# Copie o arquivo firebase-applet-config.json gerado no AI Studio para a raiz
# do projeto. Ele contém apiKey, projectId, authDomain, etc.

# 4. Rodar em desenvolvimento
npm run dev
```

O app abre em `http://localhost:3000`.

## Build de produção

```bash
# Compila para a pasta dist/
npm run build

# Preview do build de produção
npm run preview
```

## Estrutura do projeto

```
src/
  components/    Componentes React (modais, formulários, gerenciadores)
  context/       Contextos (autenticação, tema)
  hooks/         Hooks customizados (useOnlineStatus)
  services/      Firebase (auth, firestore, storage)
  types/         Tipos TypeScript compartilhados
  utils/         Serializadores, formatadores, cache, PDF
  App.tsx        Ponto de entrada: estados globais, sync, rotas
  main.tsx       Montagem do React
```

## Acesso inicial

1. Abra o app no navegador
2. Clique em **Entrar com Google** e use uma conta do domínio autorizado
3. O primeiro acesso cria o perfil com papel **Servidor**
4. Um administrador deve acessar **Equipe** e promover os usuários

## Segurança

- Regras do Firestore restringem leitura e escrita por papel e secretaria
- Servidores só veem bens da sua secretaria
- Gerentes leem qualquer secretaria, mas não alteram papéis
- Administradores gerenciam a equipe e todas as secretarias
- Super-admin (hardcoded) tem acesso total

## Licença

Uso interno da Prefeitura Municipal de Capanema — PA.
