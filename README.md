# WaSockets - API do WhatsApp Web em TypeScript/JavaScript

<div align="center">
  <p><strong>Uma modificação otimizada e de alta performance da API do WhatsApp (baseada no Baileys), mantida e aprimorada pela Áreum Tecnologia.</strong></p>
</div>

---

> 💡 **Nota:** Esta é a documentação padrão da biblioteca (mensagens, mídias, comunidades, canais, grupos, botões e gerenciamento de conta). Para a documentação técnica detalhada de arquitetura e módulos adicionais, consulte o [README_DETALHADO.md](./README_DETALHADO.md).

---

### ⚠️ Nota Importante e Licença

Esta biblioteca é uma modificação independente e não é de forma alguma afiliada, endossada ou associada ao WhatsApp ou à Meta Inc. O uso desta ferramenta é de sua inteira responsabilidade. Desencorajamos fortemente o uso para spam, envio em massa não solicitado ou qualquer prática que viole os Termos de Serviço do WhatsApp.

O projeto é licenciado sob a licença **MIT** e incorpora componentes sob a licença **GPL-3.0** (devido ao uso de criptografia do `libsignal`).

---

## 🚀 Diferenciais e Correções da Áreum Tecnologia

O **WaSockets** foi criado para resolver problemas crônicos de estabilidade e adicionar recursos ausentes na versão original do Baileys. Abaixo estão as principais melhorias implementadas:

| Categoria | Recurso / Correção | Descrição |
| :--- | :--- | :--- |
| **Criptografia & Sessão** | Correção de descriptografia em grupos (`pn/lid mismatch`) | Corrige a falha crítica que impedia a descriptografia correta de mensagens quando a identidade de um participante alternava entre o número de telefone (PN) e o ID interno (LID). |
| **Criptografia & Sessão** | Descriptografia robusta de Enquetes/Eventos | Resolve o erro AES-GCM `Unsupported state or unable to authenticate data` garantindo que o autor original seja extraído do objeto de mensagem persistido. |
| **Arquitetura & Performance** | Substituição Definitiva do UnityChat | Drop-in replacement transparente do @areumtecnologia/unitychat na abstração WaClient: suporta todos os 25+ eventos legados com despacho zero-overhead, aliases em todos os managers e método itsMe(). |
| **Arquitetura & Performance** | ContactManager com Cache LRU Reativo | Elimina o gargalo crítico do UnityChat (que fazia 4 chamadas de rede bloqueantes por mensagem recebida). Normalização instantânea de contatos (1)$ sem congelamento de event loop. |
| **Arquitetura & Performance** | StorageAdapter & HistoryEngine Cooperativo | Armazenamento modular (MemoryStorageAdapter e FileStorageAdapter atômico) e sincronização de histórico não-bloqueante em batches de 50 via setImmediate, com injeção automática de getMessage para decodificação perfeita. |
| **Estabilidade** | Versão Web Estabilizada | Integração com o protocolo Web `v2.3000.1038819500` e restauração da função `fetchLatestWaWebVersion` para buscar sempre a versão de compatibilidade mais recente e funcional do WhatsApp. |
| **Eventos** | Buffer de Eventos Corrigido | Adicionada a propriedade `shouldIncrementChatUnread` no buffer de eventos para garantir um controle preciso e confiável de mensagens não lidas no chat. |
| **Segurança** | Sessões de Autenticação Seguras | Remoção de adaptadores de autenticação inseguros/obsoletos (arquivo único ou MongoDB que causavam corrupção de estado), unificando e otimizando o uso do `useMultiFileAuthState`. |
| **Comunidades** | Suporte a Comunidades | Implementação nativa para escutar e processar comentários em canais de comunidades (`handle comment message`) e reações em comunidades. |
| **Eventos do WhatsApp** | Manipulação de Eventos e Respostas | Suporte a reações de edição de eventos (`handle event edit`) e decodificação das respostas de presença em eventos (`getAggregateResponsesInEventMessage`). |
| **Mídia** | Correções de Miniaturas e Status | Correção de falhas na extração de miniaturas (`extractImageThumb`), na geração de previews de links, no envio de mídias em álbuns/vídeos e na publicação de mídias em status de grupos. |
| **Newsletters (Canais)** | Consulta de Canais Inscritos | Adicionado o método exclusivo `newsletterSubscribed` que lista todos os canais de transmissão (Newsletters) aos quais o usuário está inscrito. |
| **Mensagens de Negócios** | Botões Interativos & PIX | Suporte avançado para layouts de botões interativos, botões Cards (com imagem/vídeo), suporte para botões PIX estáticos e fluxos completos de checkout e pagamento (`review_and_pay`). |
| **Recursos Web (v1.1.6)** | Fixação com Duração | Fixação de mensagens com durações configuráveis (24h, 7d, 30d) usando `pinInChatMessage` e `messageAddOnDurationInSecs`. |
| **Recursos Web (v1.1.6)** | Reação a Status | Método nativo `reactToStatus` para curtir e reagir diretamente a publicações de Status. |
| **Recursos Web (v1.1.6)** | Eventos & RSVP | Criação, cancelamento (`cancelEvent`) e confirmação de presença (`sendEventResponse`) em eventos de grupo. |
| **Recursos Web (v1.1.6)** | Favoritos & Notas de Contato | Sincronização via App State de chats favoritos (`updateFavorite`) e anotações internas de contatos (`updateChatNote`). |
| **Recursos Web (v1.1.6)** | Resolução Reversa de LID | Consulta reversa USync para obter o número de telefone a partir de um identificador `@lid` (`getPnUser`). |
| **Transição LID (Pilar 2)** | Store Unificado (LID & PN) | `store.getContact(jid)` e `store.getChat(jid)` com indexação cruzada e resolução automática de apelidos LID/PN. |
| **Transição LID (Pilar 2)** | Roteamento & Resolução JID | Métodos `sock.toPn()`, `sock.toLid()`, `sock.resolveJid()` e auto-aprendizado de chaves no cache do Signal. |
| **Multimídia & Canais (Pilar 3)** | Álbum Nativo & Waveforms | Envio de álbuns (`sendAlbumMessage`), ordenação indexada e suporte a waveforms PTT customizadas. |
| **Multimídia & Canais (Pilar 3)** | Newsletters (Canais) v2 | Consulta de reações (`newsletterFetchReactions`), mensagens individuais (`newsletterFetchMessage`) e lista parseada. |
| **Conectividade & Histórico** | Plataforma Nativa `WIN_HYBRID` | Substitui o `WIN32` depreciado pelo `WIN_HYBRID` nativo em `Browsers.windows('Desktop')`, eliminando o erro 428 e desbloqueando a sincronização de histórico completo (`syncFullHistory: true`). |
| **Multimídia & ViewOnce** | Emulação de Browser Android | Introdução do preset `Browsers.android('Chrome')` permitindo à sessão receber mensagens e mídias de visualização única (*View Once*). |
| **Alta Performance** | Cache WeakMap em Nós Binários | Indexação de tags filhas com `WeakMap` em `getBinaryNodeChildren` e `getBinaryNodeChild` gerando aceleração de até 30x no processamento de pacotes XML sem vazamento de memória. |
| **Privacidade & Contatos** | TC Token Nesting em Fotos de Perfil | Aninhamento do nó `<tctoken>` diretamente na query `<picture>` para atender ao protocolo `profilePicPrivacyToken`, suportando busca em alta resolução (`image`) e miniatura (`preview`). |

---

## 📌 Índice

- [🌟 Camada de Abstração de Alto Nível (WaClient) — Recomendado](#-camada-de-abstração-de-alto-nível-waclient--recomendado)
  - [Por que usar o WaClient?](#por-que-usar-o-waclient)
  - [Guia Rápido (Quick Start)](#guia-rápido-quick-start)
  - [Eventos Semânticos](#eventos-semânticos)
  - [O Contexto de Mensagem (MessageContext / ctx)](#o-contexto-de-mensagem-messagecontext--ctx)
  - [Builders de Botões Interativos (InteractiveMessage)](#builders-de-botões-interativos-interactivemessage)
  - [Controle de Presença Fluente (Typing / Recording)](#controle-de-presença-fluente-typing--recording)
  - [Os 13 Submódulos Especializados](#os-12-submódulos-especializados)
  - [Guia Detalhado da Abstração (docs/CLIENT_GUIDE.md)](./docs/CLIENT_GUIDE.md)
  - [Opções de Configuração (WaClientOptions)](#opções-de-configuração-waclientoptions)
- [Instalação](#-instalação)
- [API de Baixo Nível (makeWASocket Legado)](#-conectando-a-conta)
  - [Conexão via QR Code](#conexão-via-qr-code)
  - [Conexão via Código de Emparelhamento (Pairing Code)](#conexão-via-código-de-emparelhamento-pairing-code)
  - [Recebendo Histórico Completo](#recebendo-histórico-completo)
- [Salvando e Restaurando Sessões](#-salvando-e-restaurando-sessões)
- [Configurações Importantes do Socket](#-configurações-importantes-do-socket)
- [Exemplo Prático Inicial (Bootstrap)](#-exemplo-prático-inicial-bootstrap)
- [Tratamento de Eventos e Mídia](#-tratamento-de-eventos-e-mídia)
  - [Download de Mídias Recebidas](#download-de-mídias-recebidas)
  - [Decifrar Votos de Enquetes](#decifrar-votos-de-enquetes)
  - [Decifrar Respostas de Eventos](#decifrar-respostas-de-eventos)
- [Verificação de Contatos e Presença](#-verificação-de-contatos-e-presença)
  - [Verificação de Números no WhatsApp (onWhatsApp)](#verificação-de-números-no-whatsapp-onwhatsapp)
  - [Presença e Digitando / Gravando Áudio](#presença-e-digitando--gravando-áudio)
- [Enviando Mensagens](#-enviando-mensagens)
  - [Mensagens de Texto, Menções e Links](#mensagens-de-texto-e-menções)
  - [Mensagens de Mídia](#mensagens-de-mídia)
  - [Documentos e Arquivos](#documentos-e-arquivos)
  - [Figurinhas (Stickers)](#figurinhas-stickers)
  - [Localização Fixa e Tempo Real](#localização-fixa-e-em-tempo-real)
  - [Contatos e Cartões vCard](#contatos-e-cartões-vcard)
  - [Reações a Mensagens](#reações-a-mensagens)
  - [Criação de Enquetes](#criação-de-enquetes)
  - [Listas Interativas de Opções](#listas-interativas-de-opções-sections)
  - [Botões Interativos](#botões-interativos)
  - [Botão de Pagamento PIX](#botão-de-pagamento-pix)
  - [Fluxos de Checkout (PAY)](#fluxos-de-checkout-pay)
  - [Encaminhamento de Mensagens](#encaminhamento-de-mensagens)
  - [Menção em Status e Reações](#menção-em-status)
  - [Comentários em Canais e Comunidades](#comentários-em-canais-e-comunidades)
- [Modificando Mensagens e Chats](#-modificando-mensagens-e-chats)
  - [Confirmação de Leitura (readMessages)](#confirmação-de-leitura-readmessages)
  - [Mensagens com Estrela (star)](#mensagens-com-estrela-star)
  - [Fixação de Mensagens com Duração](#fixação-de-mensagens-com-duração)
  - [Favoritos e Anotações de Contato](#favoritos-e-anotações-de-contato)
- [Perfil do Usuário e Foto](#-perfil-do-usuário-e-foto)
- [Eventos em Grupos e RSVP](#-eventos-em-grupos-e-rsvp)
- [Resolução de Usuários (LID e Telefone)](#-resolução-de-usuários--transição-lid-pilar-2)
- [Etiquetas e Respostas Rápidas (WhatsApp Business)](#-etiquetas-de-negócio-labels---whatsapp-business)
- [Gerenciamento de Grupos](#-gerenciamento-de-grupos)
- [Newsletters (Canais)](#-newsletters--canais-v2-pilar-3)
- [WhatsApp Business (Catálogo e Produtos)](#-whatsapp-business-catálogo-produtos-e-perfil-comercial)
- [Grupos e Comunidades v2](#-grupos-comunidades-v2-e-moderação-avançada)
- [Arquitetura de Plugins e Middlewares](#-arquitetura-de-plugins-e-middlewares)
- [Alta Performance, Cache e Memória](#-alta-performance-cache-e-controle-de-memória)
- [Configurações de Privacidade](#-configurações-de-privacidade)
- [Logs e Protocolo](#-logs-e-protocolo)

---

## 📦 Instalação

Adicione o pacote ao seu projeto via Yarn ou NPM:

**Versão Estável (Recomendado):**
```bash
yarn add @areumtecnologia/wasockets
# ou
npm install @areumtecnologia/wasockets
```

**Versão de Desenvolvimento (Edge):**
```bash
yarn add github:areumtecnologia/WaSockets
```

---

## 🌟 Camada de Abstração de Alto Nível (WaClient) — Recomendado

> **Novo no WaSockets!** A classe `WaClient` é uma camada de abstração de alto nível que elimina mais de **85% do boilerplate** comum de integrações com WhatsApp. Ela gerencia automaticamente autenticação multi-arquivos, reconexões inteligentes, normalização instantânea de mensagens e mídias, oferece builders fluentes de botões interativos e divide todas as funcionalidades em **13 submódulos especializados**.

### Por que usar o WaClient?

| Recurso | `makeWASocket` (Baixo Nível) | `WaClient` (Alto Nível) |
| :--- | :--- | :--- |
| **Autenticação & Sessão** | Configurar `useMultiFileAuthState`, gerenciar pastas e `creds.update` manualmente. | **Automático:** apenas defina `sessionName` e o cliente gerencia tudo. |
| **Reconexão** | Analisar códigos do `Boom`, verificar `DisconnectReason` e agendar timeouts. | **Automático:** reconexão inteligente em quedas transitórias sem loopings. |
| **Tratamento de Mensagens** | Escutar `messages.upsert`, iterar arrays brutos, extrair nós Proto profundamente. | **`ctx` Enriquecido:** objeto limpo com `ctx.reply()`, `ctx.react()`, `ctx.delete()`, etc. |
| **Download de Mídias** | Importar `downloadContentFromMessage`, gerenciar streams e conversão de Buffers. | **`MediaObject`:** métodos diretos `ctx.media.save()`, `toBase64()`, `toStream()`, `toSharp()`. |
| **Botões Interativos & PIX** | Montar estruturas JSON aninhadas e complexas de `interactiveMessage`. | **Builders Fluentes:** `new InteractiveMessage().addButton(new PixButton(...))`. |
| **Presença (Digitando)** | Disparar `sendPresenceUpdate` manual e lembrar de cancelar com timeout. | **Lifecycle Automático:** `const typing = client.startTyping(jid); ... typing.stop()`. |
| **Validação de Destinatário** | Erros de envio quando número não existe no WhatsApp. | **`isOnWhatsApp` Embutido:** validação prévia transparente sem quebrar sua aplicação. |

---

### Guia Rápido (Quick Start)

```javascript
const { WaClient, Events } = require('@areumtecnologia/wasockets/client');

// 1. Inicializa o cliente com configurações simplificadas
const client = new WaClient({
    sessionName: 'atendimento-sac',
    dataPath: './sessions',
    printQRInTerminal: true,
    restartOnClose: true
});

// 2. Eventos Semânticos
client.on(Events.CONNECTED, ({ user }) => {
    console.log(`✓ Bot online com sucesso como: ${user.name} (${user.id})`);
});

// 3. Recepção de Mensagens com Contexto Enriquecido
client.on(Events.MESSAGE_RECEIVED, async (ctx) => {
    // Ignora mensagens do próprio bot
    if (ctx.isFromMe) return;

    console.log(`[${ctx.senderName}]: ${ctx.body}`);

    // Resposta automática com citação
    if (ctx.body === '!ping') {
        await ctx.react('🏓');
        return ctx.reply('Pong! 🚀');
    }

    // Se receber mídia (foto, áudio, vídeo, doc)
    if (ctx.media) {
        console.log(`Mídia recebida: ${ctx.media.mimetype} (${ctx.media.fileLength} bytes)`);
        await ctx.media.save(`./downloads/${ctx.id}.${ctx.media.mimetype.split('/')[1]}`);
        await ctx.reply('Arquivo salvo com sucesso!');
    }
});

// 4. Inicia a conexão
client.connect();
```

---

### Eventos Semânticos

A classe `WaClient` emite eventos limpos, tipados e intuitivos através do enum `Events`:

```javascript
const { Events, ConnectionStatus } = require('@areumtecnologia/wasockets/client');

// 1. Mudança de Estado de Conexão
client.on(Events.STATUS_CHANGE, (status) => {
    // Acesso às propriedades ou desestruturação:
    console.log(`De: ${status.previous} -> Para: ${status.current}`);
    // Ou interpolação direta (serializa JSON limpo automaticamente, sem [object Object]):
    console.log(`Status: ${status}`); 
});

// 2. Ciclo de Vida da Sessão
client.on(Events.QR_CODE, (data) => {
    // Interpolação direta retorna a string do QR puro:
    console.log(`Escaneie o QR: ${data}`); // ou data.qr
});

client.on(Events.PAIRING_CODE, (data) => {
    // Interpolação direta retorna o código de 8 dígitos puro:
    console.log(`Código de pareamento: ${data}`); // ou data.code
});

client.on(Events.CONNECTED, (data) => {
    console.log(`✓ Conectado: ${data}`); // ou data.user
});

client.on(Events.DISCONNECTED, (data) => {
    console.warn(`Desconectado: ${data}`); // exibe motivo, tentativa e delay
    // Propriedades: data.error, data.willReconnect, data.attempt, data.delayMs
});

client.on(Events.LOGGED_OUT, () => {
    console.error('Sessão revogada permanentemente no celular.');
});

// 3. Mensagens
client.on(Events.MESSAGE_RECEIVED, async (ctx) => {
    console.log(`Mensagem recebida: ${ctx}`); // "[Message 123] Alice: Olá!"
});

client.on(Events.MESSAGE_SENT, async (ctx) => {
    console.log(`Mensagem enviada: ${ctx}`);
});

client.on(Events.MESSAGE_DELETE, (item) => {
    console.log(`Mensagens apagadas: ${item}`); // ex: "[MessageDelete: MSG_001]"
});

// 4. VoIP / Chamadas
client.on(Events.CALL_INCOMING, async (call) => {
    console.log(`Chamada recebida: ${call}`); // "[Call 123] 5511... (Vídeo)"
});

// 5. Grupos e Presença
client.on(Events.GROUP_PARTICIPANTS_UPDATE, (update) => {
    console.log(`Atualização de grupo: ${update}`); // "[GroupParticipantsUpdate add: ...]"
});

client.on(Events.PRESENCE_UPDATE, (presence) => {
    console.log(`Presença: ${presence}`);
});
```

#### 🛡️ Formatação Inteligente (DX Amigável — Sem `[object Object]`)
Todos os eventos e contextos do `WaClient` implementam métodos nativos `.toString()`, `.toJSON()` e `[Symbol.toPrimitive]`. Isso significa que:
- **Desestruturação:** Funciona 100% como antes (`({ qr })`, `({ current, previous })`, `({ user })`).
- **Logs e Interpolação:** Você pode usar `console.log(evento)`, `console.log("evento: " + evento)` ou `\`evento: \${evento}\`` que a saída será sempre legível e semântica, **eliminando completamente o infame `[object Object]`** em logs de produção, Winston, Morgan ou terminal do VSCode.

| Evento | Payload Retornado | Interpolação em String (`` ${data} ``) |
| :--- | :--- | :--- |
| `STATUS_CHANGE` | `ConnectionStatusChange` | `{"current":"connecting","previous":"idle"}` |
| `QR_CODE` | `QrCodeEvent` | String bruta do QR Code (`data.qr`) |
| `PAIRING_CODE` | `PairingCodeEvent` | Código de 8 dígitos puro (`data.code`) |
| `CONNECTED` | `ConnectedEvent` | `[Connected: <Nome> (<JID>)]` |
| `DISCONNECTED` | `DisconnectedEvent` | `[Disconnected: <Motivo> (Reconnecting: ...)]` |
| `LOGGED_OUT` | `LoggedOutEvent` | `[LoggedOut: Session logged out on WhatsApp device]` |
| `MESSAGE_RECEIVED` | `MessageContext` | `[Message <ID>] <Autor>: "<Texto>"` |
| `MESSAGE_SENT` | `MessageContext` | `[Message <ID>] <Autor>: "<Texto>"` |
| `MESSAGE_DELETE` | `MessageDeleteEvent` | `[MessageDelete: <ID_1>, <ID_2>]` |
| `CALL_INCOMING` | `CallContext` | `[Call <ID>] <Número> (<Vídeo/Voz>) - <Status>]` |
| `GROUP_PARTICIPANTS_UPDATE`| `GroupParticipantsUpdateEvent` | `[GroupParticipantsUpdate <ação>: <participantes> in <grupo>]` |
| `PRESENCE_UPDATE` | `PresenceUpdateEvent` | `[PresenceUpdate <JID>: <status>]` |

---

### O Contexto de Mensagem (`MessageContext` / `ctx`)

Ao escutar `Events.MESSAGE_RECEIVED`, você recebe um objeto `ctx` que já contém todos os dados mastigados e métodos de ação vinculados diretamente àquela mensagem:

#### Propriedades de `ctx`:
- `ctx.id`: ID único da mensagem (se for mensagem editada, preserva o ID original rastreável).
- `ctx.chatId`: JID do chat (usuário, grupo ou canal).
- `ctx.fromMe` / `ctx.isFromMe`: Booleano se a mensagem foi enviada pelo próprio bot.
- `ctx.from`: JID de origem (remetente em recebidas, ou JID do bot em enviadas).
- `ctx.to`: JID de destino (bot em recebidas, ou JID do chat/destinatário em enviadas).
- `ctx.fromPushName` / `ctx.senderName`: Nome de exibição formatado ou pushName ('Você' se `fromMe`).
- `ctx.fromNumber` / `ctx.senderNumber`: Apenas os números de telefone do remetente (sem sufixos ou `@s.whatsapp.net`).
- `ctx.sender`: JID de quem enviou a mensagem no chat.
- `ctx.isGroup`: Booleano indicando se é grupo (`@g.us`).
- `ctx.isChannel`: Booleano indicando se é newsletter/canal (`@newsletter`).
- `ctx.isBroadcast`: Booleano se é lista de transmissão ou status.
- `ctx.body`: Texto principal da mensagem (já desempacotado recursivamente de `viewOnce`, `ephemeral`, botões, listas, etc.).
- `ctx.type`: Tipo normalizado e amigável (28 tipos identificados: `text`, `image`, `video`, `voice`, `document`, `sticker`, `native_flow_response`, `poll_creation`, `event`, etc.).
- `ctx.isEdited`: Booleano indicando se a mensagem é uma edição de mensagem prévia (`protocolMessage.editedMessage`).
- `ctx.editTimestamp`: Instância de `Date` informando quando a mensagem foi editada (ou `null`).
- `ctx.interactiveReply`: Resposta estruturada de botões, listas e fluxos nativos (`{ id, text, params, flowName, type }`).
- `ctx.contacts`: Array com contatos e vCards parseados (`[{ name, number, org, vcard }]`), com suporte a `waid` e fallback `TEL`.
- `ctx.location`: Coordenadas e endereço (`{ latitude, longitude, name, address, url, isLive }`).
- `ctx.reaction`: Detalhes de reação (`{ emoji, reactedMessageId, targetKey, isRemoval, senderTimestamp }`).
- `ctx.poll`: Dados completos de enquetes (`{ name, options, selectableOptionsCount, allowsMultipleAnswers }`).
- `ctx.mediaDetails`: Metadados da mídia (`{ mimetype, fileName, caption, duration, isPtt, isGif, isViewOnce }`).
- `ctx.media`: Instância de `MediaObject` para conversão rápida para buffer, base64, salvamento em disco ou Sharp.
- `ctx.isMentioningMe`: Booleano indicando se o bot foi mencionado diretamente no texto (suporta Phone JID e LID JID).
- `ctx.mentions` / `ctx.mentionedJids`: Array de JIDs mencionados na mensagem.
- `ctx.isForwarded` & `ctx.forwardingScore`: Rastreamento de encaminhamento.
- `ctx.isReply`: Booleano indicando se esta mensagem está citando outra.
- `ctx.quoted`: Instância recursiva de `MessageContext` da mensagem citada/respondida (com controle de profundidade).
- `ctx.raw`: O nó bruto original do WhatsApp/Baileys para casos de baixo nível.

#### Ações Disponíveis em `ctx`:
```javascript
// Responde citando a mensagem automaticamente
await ctx.reply('Olá! Em que posso ajudar?');

// Reage com emoji
await ctx.react('👍');

// Remove reação anterior
await ctx.removeReaction();

// Apaga a mensagem para todos no chat
await ctx.delete();

// Edita o texto da mensagem (quando enviada anteriormente pelo próprio bot)
await ctx.edit('Texto corrigido');

// Encaminha para outro destinatário
await ctx.forward('5511999999999@s.whatsapp.net');

// Marca a mensagem como lida (ticks azuis)
await ctx.markRead();

// Fixa a mensagem no topo da conversa (duração em segundos: 24h, 7d, 30d)
await ctx.pin(86400);

// Desafixa a mensagem
await ctx.unpin();

// Favorita ou desfavorita a mensagem com estrela
await ctx.star();
await ctx.unstar();
```

#### Utilitários de Mídia (`MediaObject`):
Se a mensagem contiver imagem, vídeo, áudio, figurinha ou documento, `ctx.media` centraliza todos os metadados e métodos de manipulação em uma única instância:

##### Propriedades de `ctx.media`:
- `ctx.media.mimetype`: Tipo MIME real (ex: `'image/jpeg'`, `'audio/ogg; codecs=opus'`).
- `ctx.media.extension`: Extensão inferida do arquivo (ex: `'jpg'`, `'ogg'`, `'pdf'`, `'mp4'`).
- `ctx.media.fileLength`: Tamanho do arquivo em bytes.
- `ctx.media.fileName`: Nome original do arquivo (se enviado como documento).
- `ctx.media.caption`: Legenda de texto anexada à mídia.
- `ctx.media.seconds` / `duration`: Duração em segundos (para áudios e vídeos).
- `ctx.media.isVoice` / `isPtt`: Booleano se é áudio gravado no WhatsApp (Push-To-Talk).
- `ctx.media.isGif`: Booleano se é vídeo reproduzido como GIF animado.
- `ctx.media.isViewOnce`: Booleano se é mídia de visualização única.

##### Métodos de `ctx.media`:
```javascript
if (ctx.media) {
    // 1. Salva diretamente em disco (cria diretórios se não existirem)
    await ctx.media.save('./pasta/comprovante.pdf');

    // 2. Obtém como Buffer em memória (com cache automático)
    const buffer = await ctx.media.toBuffer();

    // 3. Converte para Base64 (ideal para LLMs como Gemini / OpenAI)
    const base64 = await ctx.media.toBase64();
    const dataUri = await ctx.media.toDataUri(); // 'data:image/jpeg;base64,...'

    // 4. Obtém como Stream legível (Node Readable)
    const stream = await ctx.media.toStream();

    // 5. Integração nativa com Sharp (se instalado) para recorte/redimensionamento
    const sharpInstance = await ctx.media.toSharp();
}
```

---

### Builders de Botões Interativos (`InteractiveMessage`)

Crie botões nativos de alta conversão para WhatsApp sem precisar montar árvores JSON complexas:

```javascript
const {
    InteractiveMessage,
    QuickReplyButton,
    UrlButton,
    CopyCodeButton,
    PixButton,
    ListButton,
    ListSection,
    ListRow
} = require('@areumtecnologia/wasockets/client');

// 1. Menu com Resposta Rápida, Link, Cupom e Chave PIX Estática
const interactive = new InteractiveMessage()
    .setTitle('Plano Pro - Áreum Tecnologia')
    .setText('Escolha a forma de prosseguir com a sua assinatura:')
    .setFooter('Pagamento seguro via WhatsApp')
    .addButton(new QuickReplyButton('Ativar Teste Grátis', 'btn_trial'))
    .addButton(new UrlButton('Ver Recursos', 'https://areumtecnologia.com.br'))
    .addButton(new CopyCodeButton('Copiar Cupom 20%', 'DESCONTO20'))
    .addButton(new PixButton('Pagar via PIX', '12345678900', 'CPF', 'Áreum Tecnologia'));

await client.sendInteractive('5511999999999@s.whatsapp.net', interactive);

// 2. Menu com Lista de Opções (Dropdown / Sections)
const lista = new InteractiveMessage()
    .setTitle('Cardápio Digital')
    .setText('Selecione uma categoria de produtos:')
    .addButton(new ListButton('Ver Cardápio', [
        new ListSection('Bebidas', [
            new ListRow('Suco de Laranja 500ml', 'R$ 9,90', 'item_suco'),
            new ListRow('Refrigerante Lata', 'R$ 6,50', 'item_refri')
        ]),
        new ListSection('Pratos Principais', [
            new ListRow('Hambúrguer Artesanal', 'Pão brioche, 180g blend', 'item_burger'),
            new ListRow('Pizza Individual', 'Mussarela e tomate', 'item_pizza')
        ])
    ]));

await client.sendInteractive('5511999999999@s.whatsapp.net', lista);
```

---

### Enquetes (PollBuilder) e Eventos (EventBuilder)

Crie enquetes interativas e convites de eventos para grupos de forma declarativa:

`javascript
const { PollBuilder, EventBuilder } = require('@areumtecnologia/wasockets/client');

// 1. Enquete com contagem de votos configurável
const enquete = new PollBuilder()
    .setName('Qual recurso você mais utiliza no WaSockets?')
    .addOption('VoIP e Ligações WebAssembly')
    .addOption('Botões Interativos e PIX')
    .addOption('Canais / Newsletters v2')
    .setSelectableCount(1);

await client.sendPoll('5511999999999', enquete);

// 2. Convite de Evento com RSVP para Grupo
const evento = new EventBuilder()
    .setName('Reunião de Alinhamento Trimestral')
    .setDescription('Apresentação de resultados e novos objetivos')
    .setStartDate(new Date(2026, 11, 20, 10, 0))
    .setEndDate(new Date(2026, 11, 20, 12, 0))
    .setLocation('Sala Virtual / Meet', -23.55052, -46.633308)
    .setCall('voice');

await client.sendEvent('120363000000000000@g.us', evento);
`

---

### Controle de Chamadas VoIP (CallContext)

Gerencie chamadas ativas ou recebidas com facilidade via WebAssembly:

`javascript
const { Events } = require('@areumtecnologia/wasockets/client');

// 1. Receber e atender chamada recebida
client.on(Events.CALL_INCOMING, async (call) => {
    console.log(Chamada recebida de:  ());

    if (call.isVideo) {
        await call.reject('Não aceitamos chamadas de vídeo');
    } else {
        await call.accept();
        await call.playAudio('./audios/atendimento-ura.opus');
    }
});

// 2. Realizar chamada ativa de voz ou vídeo
const call = await client.voip.call('5511999999999');
await call.playAudio('./alerta.opus');
await call.hangup();
`

---

### Controle de Presença Fluente (Typing / Recording)

Indique que o bot está digitando ou gravando áudio de forma segura, com cancelamento automático ao enviar ou via objeto retornado:

```javascript
// Inicia estado digitando ('composing')
const typing = client.startTyping(jid);

// Realiza processamento pesado (ex: consulta LLM / banco de dados)
await processarRequisicao();

// Para a digitação manualmente
await typing.stop();

// Ou para gravação de áudio ('recording')
const recording = client.startRecording(jid);
await sintetizarVoz();
await recording.stop();
```

---

### Os 12 Submódulos Especializados

O WaClient divide as operações em 13 módulos focados, acessíveis diretamente na instância (consulte o [Guia Completo da Abstração](./docs/CLIENT_GUIDE.md) para a documentação detalhada de cada método):

| Submódulo | Acesso | Descrição e Principais Métodos |
| :--- | :--- | :--- |
| **Mensagens** | client.messages | Envio inteligente com validação isOnWhatsApp, textos, mídias, álbuns (sendAlbum), enquetes, vCards, localizações, reações e encaminhamento. |
| **VoIP / Chamadas** | client.voip | Chamadas ativas de voz e vídeo (call/callVideo), controle de chamada em andamento (ctiveCall), atender e rejeitar. |
| **Grupos** | client.groups | Criar grupos, adicionar/remover membros, promover/rebaixar admins, convites, permissões de grupo e menção em massa (mentionAll). |
| **Canais / Newsletters** | client.channels | Criação e gestão de Newsletters v2, seguir, deixar de seguir, silenciar, listar inscritos (listSubscribed) e buscar reações. |
| **WhatsApp Business** | client.business | Gestão de catálogo comercial, cadastro de produtos (createProduct), coleções, perfil da empresa e detalhes de pedidos (getOrderDetails). |
| **Comunidades** | client.communities | Criação de comunidades, vinculação de subgrupos (createSubgroup/linkSubgroup), desvinculação e gestão de subgrupos. |
| **Etiquetas / Labels** | client.labels | CRUD completo de etiquetas do WhatsApp Business, associação de etiquetas a chats e mensagens específicas. |
| **Presença** | client.presence | startTyping(), startRecording(), marcar conta como online/offline e assinar atualizações de presença de contatos específicos. |
| **Perfil** | client.profile | Atualizar nome de exibição (updateName), recado/status (updateAbout), foto de perfil (updatePicture com TC Token) e obter foto em alta resolução. |
| **Privacidade** | client.privacy | Bloquear/desbloquear contatos, gerenciar lista de bloqueio (getBlocklist) e configurar privacidade de Visto por Último, Online, Foto e Recado. |
| **Usuários** | client.users | Verificação de existência no WhatsApp (isOnWhatsApp), perfil comercial e resolução bidirecional de LID para PN (getPnForLid/getLidForPn). |
| **Chats** | client.chat | Fixar conversas no topo (pin/unpin), silenciar (mute/unmute), arquivar (archive/unarchive), favoritos e anotações privadas de contato. |
| **Contatos** | client.contacts | Cache LRU de contatos em memória (1)$, normalização sem I/O de rede bloqueante, enriquecimento sob demanda e mapeamento reverso LID ↔ PN. |
| **Armazenamento** | client.store | Armazenamento modular de mensagens (Memory/File), HistoryEngine cooperativo não-bloqueante e injeção automática para decodificação de enquetes e mensagens citadas. |

---

### Opções de Configuração (`WaClientOptions`)

Ao instanciar `new WaClient(options)`, você pode customizar:

```typescript
interface WaClientOptions {
    /** Nome da sessão (cria a pasta em dataPath/sessionName) - Padrão: 'default' */
    sessionName?: string;
    /** Diretório base de armazenamento das credenciais - Padrão: './sessions' */
    dataPath?: string;
    /** Auth state customizado (opcional, se desejar gerenciar externamente) */
    auth?: { state: AuthenticationState; saveCreds: () => Promise<void> };
    /** Número de telefone para iniciar autenticação por Pairing Code ao invés de QR */
    phoneNumber?: string;
    /** Imprimir QR Code formatado no terminal - Padrão: true */
    printQRInTerminal?: boolean;
    /** Reconectar automaticamente em quedas transitórias de rede - Padrão: true */
    restartOnClose?: boolean;
    /** Sincronizar histórico completo de mensagens antigas - Padrão: false */
    syncFullHistory?: boolean;
    /** Marcar a conta como online assim que conectar - Padrão: true */
    markOnlineOnConnect?: boolean;
    /** Sobrescrever ou adicionar opções do makeWASocket subjacente */
    socketOptions?: any;
    /** Logger customizado (compatível com Pino ou Console) */
    logger?: any;
}
```

---




## 🔑 Conectando a Conta

O WhatsApp fornece uma API multi-dispositivo que permite ao **WaSockets** se autenticar como um segundo cliente web. Isso pode ser feito via **QR Code** ou **Código de Emparelhamento**.

### Conexão via QR Code

```javascript
const { default: makeWASocket, Browsers } = require('@areumtecnologia/wasockets')

const sock = makeWASocket({
    // Configurações do navegador exibidas no WhatsApp do celular
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: true
})
```

### Conexão via Código de Emparelhamento (Pairing Code)

Ideal para servidores sem interface gráfica ou fluxos onde você não deseja escanear o QR Code, usando apenas o número do telefone. O número deve conter o código do país (ex: `55` para Brasil) e DDD, apenas com números.

```javascript
const { default: makeWASocket } = require('@areumtecnologia/wasockets')

const sock = makeWASocket({
    printQRInTerminal: false // Deve ser false
})

if (!sock.authState.creds.registered) {
    const numeroTelefone = '5511999999999' // Insira o número completo
    const codigo = await sock.requestPairingCode(numeroTelefone)
    console.log(`Digite este código no seu WhatsApp: ${codigo}`)
}
```

### Recebendo Histórico Completo

Por padrão, a conexão emula um cliente leve. Para receber um histórico maior de mensagens anteriores, configure o navegador para emular um Desktop (macOS ou Windows) e ative a sincronização:

```javascript
const sock = makeWASocket({
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: true
})
```

---

## 💾 Salvando e Restaurando Sessões

Para evitar a necessidade de escanear o QR Code a cada reinicialização, utilize a função `useMultiFileAuthState` para salvar as chaves de criptografia e credenciais em uma pasta local.

```javascript
const { default: makeWASocket, useMultiFileAuthState } = require('@areumtecnologia/wasockets')

async function iniciar() {
    // Carrega o estado da pasta especificada
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')

    const sock = makeWASocket({
        auth: state
    })

    // Salva as credenciais sempre que forem atualizadas
    sock.ev.on('creds.update', saveCreds)
}
iniciar()
```

> [!IMPORTANT]
> Quando mensagens são enviadas ou recebidas, as chaves de criptografia são atualizadas para segurança. É crucial que o evento `creds.update` chame a função `saveCreds` para persistir o novo estado. Caso contrário, a sessão será desconectada e as mensagens falharão.

---

## ⚙️ Configurações Importantes do Socket

### 1. Cache de Metadados de Grupo (Altamente Recomendado)
Se a sua aplicação gerencia grupos, buscar metadados diretamente no WhatsApp para cada mensagem recebida causa lentidão e risco de banimento por limite de requisições. Implemente um cache temporário:

```javascript
const NodeCache = require('@cacheable/node-cache') // ou similar
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })

const sock = makeWASocket({
    cachedGroupMetadata: async (jid) => groupCache.get(jid)
})

sock.ev.on('groups.update', async ([event]) => {
    const metadata = await sock.groupMetadata(event.id)
    groupCache.set(event.id, metadata)
})

sock.ev.on('group-participants.update', async (event) => {
    const metadata = await sock.groupMetadata(event.id)
    groupCache.set(event.id, metadata)
})
```

### 2. Recuperação de Mensagens e Enquetes
Para descriptografar respostas de enquetes antigas ou gerenciar tentativas de reenvio automáticas do WhatsApp, configure a função `getMessage`:

```javascript
const sock = makeWASocket({
    getMessage: async (key) => {
        // Busque a mensagem salva no seu banco de dados ou store local
        return await buscarMensagemSalva(key.id)
    }
})
```

### 3. Fila Inteligente de Mensagens Durante Quedas Transitórias
Quando a conexão com o WhatsApp cai momentaneamente, o **WaSockets** armazena mensagens em buffer de espera e as envia automaticamente assim que a conexão se restabelece:

```javascript
const sock = makeWASocket({
    enableMessageQueue: true, // Ativado por padrão (evita perda de mensagens durante reconexão)
    messageQueueTtlMs: 5 * 60 * 1000 // TTL de expiração na fila (padrão: 5 minutos)
})
```

### 4. Auto-Reparo de Sessão E2E / Signal (`repairSession`)
Se uma conversa específica apresentar erros de chave ou falhas de descriptografia (`Bad MAC` ou `Session Corrupted`), não é mais necessário deletar a pasta inteira de autenticação. Use o método `repairSession`:

```javascript
// Remove a sessão danificada e força a renegociação de chaves E2E com o contato
await sock.repairSession('5511999999999@s.whatsapp.net')
```

---

## 🚀 Exemplo Prático Inicial (Bootstrap)

Aqui está um arquivo funcional completo em JavaScript (CommonJS) para iniciar a sua integração:

```javascript
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeReconnectManager, shouldReconnect } = require('@areumtecnologia/wasockets')
const { Boom } = require('@hapi/boom')

async function connectToWhatsApp() {
    // 1. Inicializa o estado de autenticação baseado em arquivos
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys')
    
    // 2. Cria o Socket de Conexão com fila de mensagens inteligente ativada por padrão
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        enableMessageQueue: true // Fila de envio automático durante reconexões transitórias
    })

    // Gerenciador de reconexão adaptativa com Backoff Exponencial e Full Jitter (evita banimentos)
    const reconnectManager = makeReconnectManager({
        onReconnect: async (attempt) => {
            console.log(`Reconectando ao WhatsApp (tentativa #${attempt})...`)
            await connectToWhatsApp()
        }
    })

    // 3. Monitora o status da conexão
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        
        if (connection === 'close') {
            await reconnectManager.handleDisconnect(lastDisconnect?.error)
        } else if (connection === 'open') {
            reconnectManager.reset()
            console.log('Conexão com o WhatsApp estabelecida com sucesso!')
        }
    })

    // 4. Salva credenciais atualizadas
    sock.ev.on('creds.update', saveCreds)

    // 5. Escuta e responde a novas mensagens recebidas
    sock.ev.on('messages.upsert', async (event) => {
        for (const m of event.messages) {
            // Ignora mensagens que não sejam do tipo padrão ou geradas pelo próprio bot
            if (!m.message || m.key.fromMe) continue

            console.log('Mensagem recebida de:', m.key.remoteJid)
            console.log('Conteúdo:', JSON.stringify(m, null, 2))

            // Responde à mensagem
            await sock.sendMessage(m.key.remoteJid, { text: 'Olá! Recebi sua mensagem com sucesso.' })
        }
    })
}

// Inicia o processo
connectToWhatsApp()
```

---

## 📡 Tratamento de Eventos e Mídia

O **WaSockets** utiliza um sistema de eventos tipado baseado no `EventEmitter`.

```javascript
sock.ev.on('messages.upsert', ({ messages, type }) => {
    // type pode ser 'notify' (nova notificação) ou 'append' (carregamento histórico)
    console.log('Novas mensagens recebidas:', messages)
})
```

### Download de Mídias Recebidas

Para baixar mídias (fotos, vídeos, áudios, documentos ou stickers) recebidas no evento `messages.upsert`, utilize a função utilitária `downloadMediaMessage`:

```javascript
const { downloadMediaMessage } = require('@areumtecnologia/wasockets')
const fs = require('fs')

sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue

        const isMedia = msg.message.imageMessage || 
                        msg.message.videoMessage || 
                        msg.message.audioMessage || 
                        msg.message.documentMessage || 
                        msg.message.stickerMessage

        if (isMedia) {
            // Baixa o arquivo diretamente em formato Buffer
            const buffer = await downloadMediaMessage(msg, 'buffer', {})
            
            // Exemplo: Salvar no disco
            const ext = msg.message.imageMessage ? 'jpg' : msg.message.audioMessage ? 'ogg' : 'bin'
            fs.writeFileSync(`./download_${msg.key.id}.${ext}`, buffer)
            console.log(`Mídia baixada com sucesso (${buffer.length} bytes)!`)

            // Ou baixar como stream de leitura para processamento em tempo real:
            // const stream = await downloadMediaMessage(msg, 'stream', {})
        }
    }
})
```

### Decifrar Votos de Enquetes

Os votos em enquetes chegam como mensagens criptografadas no evento `messages.update`. É preciso usar o helper `getAggregateVotesInPollMessage` passando a mensagem original da enquete.

```javascript
const { getAggregateVotesInPollMessage } = require('@areumtecnologia/wasockets')

sock.ev.on('messages.update', async (updates) => {
    for (const { key, update } of updates) {
        if (update.pollUpdates) {
            // 1. Busca a mensagem original da enquete que foi criada anteriormente
            const pollCreationMessage = await obterMensagemSalva(key)
            if (pollCreationMessage) {
                // 2. Agrega os votos
                const pollVotes = await getAggregateVotesInPollMessage({
                    message: pollCreationMessage,
                    pollUpdates: update.pollUpdates
                })
                
                // 3. Exibe as opções votadas e os respectivos eleitores
                console.log('Resultado da Enquete Atualizado:', pollVotes)
            }
        }
    }
})
```

### Decifrar Respostas de Eventos

A mesma lógica se aplica a eventos criados no chat (como convites de reuniões). O **WaSockets** fornece o helper `getAggregateResponsesInEventMessage` para analisar as presenças.

```javascript
const { getAggregateResponsesInEventMessage } = require('@areumtecnologia/wasockets')

sock.ev.on('messages.update', async (updates) => {
    for (const { key, update } of updates) {
        if (update.eventResponses) {
            const eventCreationMessage = await obterMensagemSalva(key)
            if (eventCreationMessage) {
                const responses = await getAggregateResponsesInEventMessage({
                    message: eventCreationMessage,
                    eventResponses: update.eventResponses
                })
                console.log('Respostas ao evento atualizadas:', responses)
            }
        }
    }
})
```

---

## 🔍 Verificação de Contatos e Presença

### Verificação de Números no WhatsApp (onWhatsApp)

Valide se um ou vários números de telefone possuem contas ativas registradas no WhatsApp antes de disparar mensagens:

```javascript
// Aceita um ou vários números (com DDI e DDD)
const resultados = await sock.onWhatsApp('5511999999999', '5511888888888', '5521977777777')

for (const { jid, exists } of resultados) {
    if (exists) {
        console.log(`O número ${jid} está ativo no WhatsApp!`)
    } else {
        console.log(`O número ${jid} NÃO possui conta no WhatsApp.`)
    }
}
```

### Presença e Digitando / Gravando Áudio

Simule atividade humana enviando estados de presença ou monitore o status de contatos:

```javascript
// 1. Indicar que está digitando...
await sock.sendPresenceUpdate('composing', jid)

// 2. Indicar que está gravando áudio...
await sock.sendPresenceUpdate('recording', jid)

// 3. Pausar status de digitação/gravação
await sock.sendPresenceUpdate('paused', jid)

// 4. Alterar presença geral da conta ('available' = Online, 'unavailable' = Offline)
await sock.sendPresenceUpdate('available')

// 5. Inscrever-se para escutar presença de um contato específico
await sock.presenceSubscribe(jid)

// 6. Monitorar atualizações de presença recebidas
sock.ev.on('presence.update', ({ id, presences }) => {
    console.log(`Atualização de presença de ${id}:`, presences)
})
```

---

## ✉️ Enviando Mensagens

### Mensagens de Texto e Menções

```javascript
// Mensagem de texto simples
await sock.sendMessage(jid, { text: 'Olá Mundo!' })

// Mensagem citando (respondendo a) outra mensagem
await sock.sendMessage(jid, { text: 'Esta é uma resposta.' }, { quoted: mensagemOriginal })

// Mensagem mencionando contatos no grupo
await sock.sendMessage(jid, {
    text: 'Olá @5511999999999 e @5511888888888!',
    mentions: ['5511999999999@s.whatsapp.net', '5511888888888@s.whatsapp.net']
})
```

### Mensagens de Mídia

É possível passar caminhos de arquivos locais (`url`), links da internet (`url`), buffers ou streams de leitura.

```javascript
const fs = require('fs')

// Imagem com legenda
await sock.sendMessage(jid, {
    image: { url: './foto.jpg' }, // ou { url: 'https://example.com/foto.jpg' } ou Buffer
    caption: 'Minha foto legal!'
})

// Álbum de mídias (Múltiplas fotos/vídeos no mesmo bloco)
await sock.sendMessage(jid, {
    album: [
        { image: { url: './foto1.jpg' }, caption: 'Foto 1' },
        { image: { url: './foto2.jpg' }, caption: 'Foto 2' },
        { video: { url: './video.mp4' }, caption: 'Vídeo do Álbum' }
    ]
})

// GIF (vídeo mp4 simulado como reprodução contínua)
await sock.sendMessage(jid, {
    video: fs.readFileSync('./video-gif.mp4'),
    gifPlayback: true,
    caption: 'Olha esse gif!'
})

// Áudio Gravado (Simula o gravador de voz do WhatsApp - PTT)
await sock.sendMessage(jid, {
    audio: { url: './audio.ogg' },
    mimetype: 'audio/mp4', // obrigatório
    ptt: true // Define como mensagem de voz
})

// Mensagem de Visualização Única (View Once)
await sock.sendMessage(jid, {
    image: { url: './foto.jpg' },
    viewOnce: true,
    caption: 'Esta foto desaparecerá após ser aberta!'
})
```

> [!TIP]
> Para mensagens de áudio funcionarem perfeitamente em todos os dispositivos móveis e web, converta o áudio original para o formato OGG Opus (codec `libopus`) usando a ferramenta FFMpeg:
> `ffmpeg -i input.mp3 -c:a libopus -ac 1 -avoid_negative_ts make_zero output.ogg`

---

### Documentos e Arquivos

Envie qualquer formato de arquivo (PDF, planilhas, arquivos compactados) informando o `mimetype` e o `fileName` para exibição correta no aplicativo:

```javascript
await sock.sendMessage(jid, {
    document: { url: './fatura_setembro.pdf' }, // ou Buffer ou { url: 'https://exemplo.com/doc.pdf' }
    mimetype: 'application/pdf',
    fileName: 'Fatura_Setembro_2026.pdf'
})
```

### Figurinhas (Stickers)

Envie figurinhas estáticas ou animadas no formato WebP:

```javascript
await sock.sendMessage(jid, {
    sticker: fs.readFileSync('./minha_figurinha.webp') // aceita Buffer ou { url: './figurinha.webp' }
})
```

### Localização Fixa e em Tempo Real

Envie pontos no mapa ou compartilhe localização em tempo real com latitude e longitude:

```javascript
// Localização Fixa
await sock.sendMessage(jid, {
    location: {
        degreesLatitude: -23.55052,
        degreesLongitude: -46.633308,
        name: 'Sede da Áreum Tecnologia',
        address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP'
    }
})

// Localização em Tempo Real (Live Location)
await sock.sendMessage(jid, {
    location: {
        degreesLatitude: -23.55052,
        degreesLongitude: -46.633308
    },
    live: true
})
```

### Contatos e Cartões vCard

Envie um ou múltiplos contatos com cartão vCard formatado:

```javascript
const vcard = 'BEGIN:VCARD\n'
            + 'VERSION:3.0\n' 
            + 'FN:Suporte Técnico Áreum\n'
            + 'ORG:Áreum Tecnologia;\n'
            + 'TEL;type=CELL;type=VOICE;waid=5511999999999:+55 11 99999-9999\n'
            + 'END:VCARD'

await sock.sendMessage(jid, {
    contacts: {
        displayName: 'Suporte Técnico Áreum',
        contacts: [{ vcard }]
    }
})
```

### Reações a Mensagens

Reaja com emojis a qualquer mensagem enviada ou recebida (ou remova a reação enviando string vazia `''`):

```javascript
// Reagir à mensagem com um emoji
await sock.sendMessage(jid, {
    react: {
        text: '🔥', // Emoji da reação
        key: msg.key // Chave da mensagem original que receberá a reação
    }
})

// Remover reação anterior
await sock.sendMessage(jid, {
    react: {
        text: '',
        key: msg.key
    }
})
```

### Criação de Enquetes

Crie enquetes interativas com contagem configurável de seleção (voto único ou múltiplo):

```javascript
await sock.sendMessage(jid, {
    poll: {
        name: 'Qual o melhor diferencial do WaSockets?',
        values: [
            'Resolução Transparente de LID',
            'Envio Nativo de Álbuns',
            'Newsletters v2 e Canais',
            'Fila Inteligente de Reconexão'
        ],
        selectableCount: 1 // 1 para escolha única; > 1 para permitir múltiplas escolhas
    }
})
```

### Listas Interativas de Opções (Sections)

Envie menus organizados por categorias e linhas para navegação intuitiva:

```javascript
await sock.sendMessage(jid, {
    text: 'Selecione o setor desejado para atendimento:',
    footer: 'Áreum Tecnologia • Atendimento Automatizado',
    title: 'Central de Relacionamento',
    buttonText: 'Ver Departamentos',
    sections: [
        {
            title: 'Atendimento Comercial',
            rows: [
                { title: 'Novas Contratações', rowId: 'row_vendas', description: 'Conheça nossos planos e soluções' },
                { title: 'Upgrade de Plano', rowId: 'row_upgrade', description: 'Amplie os limites da sua conta' }
            ]
        },
        {
            title: 'Suporte & Operações',
            rows: [
                { title: 'Suporte Técnico', rowId: 'row_suporte', description: 'Dúvidas de integração e bugs' },
                { title: 'Financeiro', rowId: 'row_financeiro', description: '2ª via de boleto e notas fiscais' }
            ]
        }
    ]
})
```

---

### Botões Interativos

Os botões nativos do WhatsApp são suportados através da propriedade `interactiveButtons`.

```javascript
await sock.sendMessage(jid, {
    text: 'Olá! Escolha uma das opções abaixo:',
    title: 'Painel Interativo',
    subtitle: 'Selecione com um clique',
    footer: 'Áreum Tecnologia',
    interactiveButtons: [
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: 'Suporte Técnico',
                id: 'btn_suporte'
            })
        },
        {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text: 'Acessar Site',
                url: 'https://areum.com.br',
                merchant_url: 'https://areum.com.br'
            })
        },
        {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
                display_text: 'Copiar Cupom',
                id: 'btn_cupom',
                copy_code: 'DESCONTO20'
            })
        }
    ]
})
```

---

### Botão de Pagamento PIX

O **WaSockets** permite o envio de chaves estáticas de PIX diretamente integradas na interface de pagamento nativa do WhatsApp pelo botão `payment_info`.

```javascript
await sock.sendMessage(jid, {
    text: 'Efetue o pagamento do pedido abaixo clicando em Pagar:',
    interactiveButtons: [
        {
            name: 'payment_info',
            buttonParamsJson: JSON.stringify({
                payment_settings: [{
                    type: 'pix_static_code',
                    pix_static_code: {
                        merchant_name: 'Áreum Tecnologia LTDA',
                        key: 'financeiro@areum.com.br', // Chave PIX (E-mail, CPF/CNPJ, Telefone ou EVP)
                        key_type: 'EMAIL' // Tipos suportados: PHONE, EMAIL, CPF, EVP
                    }
                }]
            })
        }
    ]
})
```

---

### Fluxos de Checkout (PAY)

É possível enviar solicitações de checkout com itens detalhados de faturamento para pagamentos eletrônicos integrados no aplicativo através da ação `review_and_pay`.

```javascript
await sock.sendMessage(jid, {
    text: 'Fatura gerada com sucesso!',
    interactiveButtons: [
        {
            name: 'review_and_pay',
            buttonParamsJson: JSON.stringify({
                currency: 'BRL',
                payment_type: 'physical-goods',
                total_amount: {
                    value: '15000', // R$ 150,00 (representado sem decimais, multiplicado pelo offset)
                    offset: '100'
                },
                reference_id: 'REF_PEDIDO_12345',
                payment_method: 'confirm',
                payment_status: 'captured',
                payment_timestamp: Math.floor(Date.now() / 1000),
                order: {
                    status: 'completed',
                    order_type: 'PAYMENT_REQUEST',
                    subtotal: { value: '15000', offset: '100' },
                    items: [{
                        retailer_id: 'item_01',
                        name: 'Licença Anual WaSockets',
                        amount: { value: '15000', offset: '100' },
                        quantity: '1'
                    }]
                },
                additional_note: 'Agradecemos a sua preferência!'
            })
        }
    ]
})
```

---

### Menção em Status

Permite publicar status (stories) e marcar diretamente contatos/grupos específicos (máximo de 5 menções por status).

```javascript
const contatosParaMencionar = [
    '5511999999999@s.whatsapp.net',
    '5511888888888@s.whatsapp.net'
]

// Envia um status em formato de texto mencionando os contatos acima
await sock.sendStatusMentions(
    {
        text: 'Novidade incrível para vocês! 🚀',
        backgroundColor: '#1c1c1c',
        textColor: '#ffffff'
    },
    contatosParaMencionar
)

// Curtir / Reagir diretamente a uma publicação de Status (Stories)
await sock.reactToStatus(statusMsgKey, '❤️')
```

### Comentários em Canais e Comunidades

Envie respostas e comentários estruturados em postagens de canais (Newsletters) ou mensagens de aviso em comunidades:

```javascript
await sock.sendMessage(jid, {
    comment: {
        targetMessageKey: mensagemOriginal.key,
        message: { text: 'Excelente atualização! 👏' }
    }
})
```

### Envio Nativo de Álbuns de Fotos e Vídeos (Pilar 3)

Envie múltiplos arquivos de imagem e vídeo agrupados nativamente em um container de álbum (layout de grade no WhatsApp Web e Celular) com ordenação indexada e suporte a legendas:

```javascript
// Método direto e simplificado
await sock.sendAlbumMessage(jid, [
    { image: { url: 'https://exemplo.com/foto1.jpg' }, caption: 'Foto 1 do produto' },
    { image: { url: 'https://exemplo.com/foto2.jpg' }, caption: 'Foto 2 em outro ângulo' },
    { video: { url: 'https://exemplo.com/demonstracao.mp4' }, caption: 'Vídeo explicativo' }
])

// Ou através de sendMessage com a propriedade album:
await sock.sendMessage(jid, {
    album: [
        { image: { url: './local/foto1.jpg' } },
        { image: { url: './local/foto2.jpg' } }
    ]
})
```

### Mensagens de Áudio PTT com Waveform Customizada (Pilar 3)

Você pode enviar notas de voz (Push-To-Talk) com geração automática de ondas sonoras ou fornecer uma forma de onda predefinida (array ou Buffer):

```javascript
// Áudio PTT com waveform automática gerada a partir do arquivo
await sock.sendMessage(jid, {
    audio: { url: './audio.mp3' },
    mimetype: 'audio/ogg; codecs=opus',
    ptt: true
})

// Áudio PTT com waveform predefinida (evita decodificação intensiva de CPU)
await sock.sendMessage(jid, {
    audio: { url: './audio.mp3' },
    mimetype: 'audio/ogg; codecs=opus',
    ptt: true,
    waveform: [0, 15, 30, 75, 100, 80, 45, 20, 10, 0] // 64 barras de amplitude
})
```

### Encaminhamento de Mensagens

Encaminhe mensagens para outros chats preservando ou forçando o status de encaminhado:

```javascript
// Encaminhar uma mensagem recebida para outro destinatário
await sock.sendMessage(outroJid, {
    forward: mensagemOriginal,
    force: true // Exibe o selo de mensagem encaminhada
})
```

---

## 📝 Modificando Mensagens e Chats

```javascript
// Apagar uma mensagem para todos
const msg = await sock.sendMessage(jid, { text: 'Mensagem enviada com erro!' })
await sock.sendMessage(jid, { delete: msg.key })

// Editar uma mensagem enviada
await sock.sendMessage(jid, {
    text: 'Esta é a mensagem com o texto corrigido.',
    edit: msg.key
})

// Arquivar um chat
await sock.chatModify({ archive: true, lastMessages: [msg] }, jid)

// Silenciar um chat por 8 horas
await sock.chatModify({ mute: 8 * 60 * 60 * 1000 }, jid)

// Remover silenciamento de um chat
await sock.chatModify({ mute: null }, jid)

// Marcar chat como Não Lido
await sock.chatModify({ markRead: false, lastMessages: [msg] }, jid)

// Fixar chat na lista de conversas
await sock.chatModify({ pin: true }, jid)
```

### Confirmação de Leitura (readMessages)

Envie confirmações de leitura explícitas para exibir os ticks azuis ao remetente:

```javascript
// Marca uma ou mais mensagens recebidas como lidas
await sock.readMessages([msg.key])
```

### Mensagens com Estrela (star)

Marque mensagens importantes com estrela (favoritas) na conversa:

```javascript
// Adicionar estrela à mensagem
await sock.star(jid, [{ id: msg.key.id, fromMe: msg.key.fromMe }], true)

// Remover estrela da mensagem
await sock.star(jid, [{ id: msg.key.id, fromMe: msg.key.fromMe }], false)
```

### Fixação de Mensagens com Duração

Fixe mensagens em conversas individuais ou grupos escolhendo a duração desejada:

```javascript
// Fixar mensagem por 7 dias (604800 segundos)
// Durações padrão: 86400 (24h), 604800 (7 dias), 2592000 (30 dias)
await sock.sendMessage(jid, {
    pin: {
        key: msg.key,
        type: 1, // 1: Fixar, 2: Desafixar
        time: 604800
    }
})

// Desafixar mensagem
await sock.sendMessage(jid, {
    pin: {
        key: msg.key,
        type: 2
    }
})
```

### Favoritos e Anotações de Contato

Organize suas conversas sincronizando com o WhatsApp Web e celular:

```javascript
// Marcar conversa como Favorita
await sock.updateFavorite(jid, true)

// Desmarcar conversa como Favorita
await sock.updateFavorite(jid, false)

// Adicionar ou atualizar nota interna no contato (Chat Note)
await sock.updateChatNote(jid, 'Cliente solicitou proposta para 50 atendentes.')

// Remover nota interna do contato
await sock.removeChatNote(jid)
```

---

## 👤 Perfil do Usuário e Foto

Gerencie fotos de perfil, recados e nome de exibição (PushName) diretamente pelo socket:

```javascript
// 1. Obter a URL da foto de perfil de um contato ou grupo
const pfpUrl = await sock.profilePictureUrl(jid, 'image') // ou 'preview' para miniatura
console.log('Foto de Perfil:', pfpUrl)

// 2. Atualizar a sua própria foto de perfil (ou a foto de um grupo do qual você é admin)
await sock.updateProfilePicture(jid, { url: './nova_foto.jpg' }) // Aceita caminho, URL ou Buffer

// 3. Remover a foto de perfil
await sock.removeProfilePicture(jid)

// 4. Consultar o recado / About (Status) de um contato
const statusInfo = await sock.fetchStatus(jid)
console.log(`Recado de ${jid}: ${statusInfo?.status} (Definido em: ${statusInfo?.setAt})`)

// 5. Atualizar o seu próprio recado / About
await sock.updateProfileStatus('Disponível apenas para atendimentos prioritários 🚀')

// 6. Atualizar o seu nome público de exibição (PushName)
await sock.updateProfileName('Áreum Tecnologia - Suporte Oficial')
```

---

## 📅 Eventos em Grupos e RSVP

Crie eventos colaborativos, responda confirmações de presença e cancele eventos:

```javascript
// 1. Criar um novo evento no grupo
const evento = await sock.sendMessage(grupoJid, {
    event: {
        name: 'Reunião de Planejamento de Sprints',
        description: 'Alinhamento estratégico dos projetos da Áreum Tecnologia.',
        startTime: Math.floor(Date.now() / 1000) + 86400, // Amanhã
        extraGuestsAllowed: true
    }
})

// 2. Responder ao Evento (RSVP)
// Tipos de resposta: 'GOING' (1), 'NOT_GOING' (2), 'MAYBE' (3)
await sock.sendEventResponse(grupoJid, evento.key, 'GOING', 1 /* +1 convidado extra */)

// 3. Cancelar o Evento
await sock.cancelEvent(grupoJid, evento.key)
```

---

## 🔍 Resolução de Usuários & Transição LID (Pilar 2)

Com a evolução da privacidade no WhatsApp, participantes de grupos e canais frequentemente utilizam identificadores `@lid`. O **WaSockets** oferece um conjunto completo de ferramentas de alto desempenho com cache automático em memória e no banco de chaves Signal:

### Métodos de Resolução Transparente no Socket

```javascript
// 1. Converter LID para número de telefone (PN) com busca em cache/DB
const pnJid = await sock.toPn('12345678901234@lid')
console.log('JID com número real:', pnJid) // '5511999999999@s.whatsapp.net'

// Caso não esteja em cache local, pode passar true para consultar o servidor via USync:
const pnJidFromNetwork = await sock.toPn('12345678901234@lid', true)

// 2. Converter número de telefone (PN) para LID
const lidJid = await sock.toLid('5511999999999@s.whatsapp.net')
console.log('LID correspondente:', lidJid) // '12345678901234@lid'

// 3. Resolução completa e unificada (retorna ambos)
const resolved = await sock.resolveJid(authorJid)
console.log(resolved) // { pn: '5511999999999@s.whatsapp.net', lid: '12345678901234@lid', jid: ... }

// 4. Registrar manualmente um mapeamento conhecido
await sock.storeLidPnMapping('5511999999999@s.whatsapp.net', '12345678901234@lid')

// 5. Consultas diretas via protocolo USync (baixo nível)
const [lidUser] = await sock.getLidUser('5511999999999@s.whatsapp.net')
const [pnUser] = await sock.getPnUser('12345678901234@lid')
```

### Store Unificado de Contatos e Conversas (`makeInMemoryStore`)

Tradicionalmente, quando o WhatsApp chaveia as mensagens para `@lid`, consultas como `store.contacts[jid]` ou `store.messages[jid]` falhavam por incompatibilidade de identificadores. O **WaSockets** resolve isso unificando o catálogo em tempo de execução:

```javascript
import { makeInMemoryStore } from '@areumtecnologia/wasockets'

const store = makeInMemoryStore({})
store.bind(sock.ev)

// Busca unificada: localiza o contato quer você passe o número (@s.whatsapp.net), o @lid ou apenas os dígitos
const contact = store.getContact('12345678901234@lid') 
// Retorna o contato completo contendo .id, .lid, .phoneNumber, .name, etc.

// Busca unificada de chat: localiza a conversa mesmo se foi iniciada com PN ou com LID
const chat = store.getChat('12345678901234@lid')

// Carregamento de mensagens com fallback cruzado automático entre LID e PN
const messages = await store.loadMessages('12345678901234@lid', 25)
```

---

## 🏷️ Etiquetas de Negócio (Labels - WhatsApp Business)

O **WaSockets** permite que você gerencie etiquetas e organize contatos ou mensagens diretamente pelo aplicativo WhatsApp Business.

### Criando, Editando e Deletando Etiquetas (CRUD de Sistema)

Você pode criar, editar e excluir as etiquetas globais da sua conta:

```javascript
// Criar uma nova etiqueta com cor específica
// Cores suportadas: de 0 a 19 correspondentes à paleta do WhatsApp Business
const novaLabel = await sock.createLabel('Lead Qualificado', 5)

// Atualizar o nome e a cor de uma etiqueta existente
await sock.updateLabel('label_id_123', 'Pagamento Aprovado', 2)

// Deletar uma etiqueta definitivamente da conta
await sock.deleteLabel('label_id_123')
```

### Associando Etiquetas a Conversas e Mensagens

Para categorizar chats específicos ou marcar mensagens individuais dentro de uma conversa:

```javascript
// Associar etiqueta a uma conversa (JID)
await sock.addChatLabel(jid, 'label_id_123')

// Remover etiqueta de uma conversa (JID)
await sock.removeChatLabel(jid, 'label_id_123')

// Associar etiqueta a uma mensagem específica
await sock.addMessageLabel(jid, 'mensagem_id_456', 'label_id_123')

// Remover etiqueta de uma mensagem específica
await sock.removeMessageLabel(jid, 'mensagem_id_456', 'label_id_123')
```

### Respostas Rápidas (Quick Replies)

Para contas WhatsApp Business, gerencie respostas rápidas acessíveis via atalhos:

```javascript
// Criar ou atualizar resposta rápida
await sock.addOrEditQuickReply({
    id: 'qr_ola',
    shortcut: '/ola',
    message: 'Olá! Seja muito bem-vindo à Áreum Tecnologia. Como podemos te ajudar hoje?',
    keywords: ['ola', 'ajuda', 'suporte', 'inicio']
})

// Remover resposta rápida pelo ID
await sock.removeQuickReply('qr_ola')
```

---

## 👥 Gerenciamento de Grupos

As operações de alteração estrutural em grupos requerem que a conta conectada seja administradora do grupo correspondente.

```javascript
// Criar um novo grupo
const grupo = await sock.groupCreate('Equipe de Suporte Áreum', ['5511999999999@s.whatsapp.net'])
console.log('Grupo criado com ID:', grupo.id)

// Adicionar/Remover/Promover participantes
// Parâmetros de ação: 'add' | 'remove' | 'promote' | 'demote'
await sock.groupParticipantsUpdate(grupo.id, ['5511888888888@s.whatsapp.net'], 'add')

// Obter dados/metadados de um grupo ANTES de entrar usando o código de convite
const infoConvite = await sock.groupGetInviteInfo('ABcdEFghIJklMnOpQrStUv')
console.log(`Nome do grupo no convite: ${infoConvite.subject}`)

// Obter o código/link de convite do grupo
const codigoConvite = await sock.groupInviteCode(grupo.id)
console.log(`Link: https://chat.whatsapp.com/${codigoConvite}`)

// Revogar link de convite anterior e gerar um novo
const novoCodigo = await sock.groupRevokeInvite(grupo.id)

// Entrar em um grupo usando um código de convite (apenas o código, sem o domínio completo)
const resposta = await sock.groupAcceptInvite('ABcdEFghIJklMnOpQrStUv')

// Alterar o assunto (título) do grupo
await sock.groupUpdateSubject(grupo.id, 'Novo Nome do Grupo')

// Alterar a descrição do grupo
await sock.groupUpdateDescription(grupo.id, 'Regras do grupo e links importantes.')

// Sair do grupo
await sock.groupLeave(grupo.id)

// Obter a lista de pessoas aguardando aprovação para entrar no grupo
const solicitacoes = await sock.groupRequestParticipantsList(grupo.id)
console.log(solicitacoes)

// Aprovar entrada pendente
await sock.groupRequestParticipantsUpdate(grupo.id, ['5511777777777@s.whatsapp.net'], 'approve') // ou 'reject'

// Obter metadados do grupo (participantes, título, regras, descrição)
const metadados = await sock.groupMetadata(grupo.id)
console.log(`Título: ${metadados.subject}, Membros: ${metadados.participants.length}`)
```

---

## 👥 Etiquetas de Membro (Member Tags) em Grupos

O WhatsApp permite que os participantes de um grupo criem um rótulo ou descrição curta de até 30 caracteres para si mesmos (ex: definir seu papel ou cargo no grupo).

### Definindo sua própria Etiqueta de Membro no Grupo

```javascript
// Define a sua etiqueta como "Suporte Técnico" no grupo especificado
await sock.updateMemberLabel(grupoJid, "Suporte Técnico")
```

### Monitorando Atualizações de Etiquetas de Outros Membros

Você pode escutar o evento `group.member-tag.update` para monitorar quando qualquer participante alterar a etiqueta de membro dele no grupo:

```javascript
sock.ev.on('group.member-tag.update', (update) => {
    const { groupId, label, participant } = update
    console.log(`O usuário ${participant} definiu a etiqueta "${label}" no grupo ${groupId}`)
})
```

---

## 📢 Newsletters / Canais v2 (Pilar 3)

O **WaSockets** traz suporte avançado para a criação, monitoramento, consumo e interação em Newsletters (Canais de Transmissão públicos do WhatsApp):

```javascript
// 1. Criar uma Newsletter (Canal)
const canal = await sock.newsletterCreate('Notícias Tecnológicas Áreum', 'Canal oficial de novidades')
console.log('Canal criado com ID:', canal.id)

// 2. Obter metadados de um Canal público pelo ID ou Invite Code
const metadadosCanal = await sock.newsletterMetadata('JID', canal.id)
console.log('Nome do Canal:', metadadosCanal.name)

// 3. Listar todos os Canais inscritos
const canaisInscritos = await sock.newsletterSubscribed()
console.log('Canais que eu sigo:', canaisInscritos)

// 4. Buscar e decodificar mensagens do Canal (com contagem de visualizações e reações)
const { messages } = await sock.newsletterFetchMessages(canal.id, 20)
for (const msg of messages) {
    console.log(`[ID: ${msg.server_id}] Visualizações: ${msg.views}`)
    console.log('Conteúdo:', msg.message?.conversation || msg.message?.extendedTextMessage?.text)
    console.log('Reações:', msg.reactions) // [{ code: '👍', count: 12 }, { code: '❤️', count: 5 }]
}

// 5. Buscar mensagem individual do Canal
const singleMsg = await sock.newsletterFetchMessage(canal.id, '12345')

// 6. Consultar contadores de reações de uma postagem
const reacoes = await sock.newsletterFetchReactions(canal.id, '12345')
console.log('Reações do post:', reacoes)

// 7. Reagir a uma postagem do Canal (suporta server_id, id ou chave da mensagem)
await sock.newsletterReactMessage(canal.id, '12345', '🔥')

// 8. Seguir / Deixar de Seguir
await sock.newsletterFollow(canal.id)
await sock.newsletterUnfollow(canal.id)

// 9. Silenciar / Ativar notificações
await sock.newsletterMute(canal.id)
await sock.newsletterUnmute(canal.id)
await sock.newsletterToggleMute(canal.id, true) // ou false para desativar

// 10. Atualizar nome, descrição ou foto do Canal (Admins)
await sock.newsletterUpdateName(canal.id, 'Novo Nome do Canal')
await sock.newsletterUpdateDescription(canal.id, 'Nova descrição detalhada do canal')
await sock.newsletterUpdatePicture(canal.id, './novo_avatar_canal.jpg')
await sock.newsletterRemovePicture(canal.id)

// 11. Consultar inscritos e administradores
const inscritos = await sock.newsletterSubscribers(canal.id)
const totalAdmins = await sock.newsletterAdminCount(canal.id)

// 12. Transferir propriedade ou excluir o Canal
await sock.newsletterChangeOwner(canal.id, '5511888888888@s.whatsapp.net')
await sock.newsletterDelete(canal.id)
```

---

## 💼 WhatsApp Business (Catálogo, Produtos e Perfil Comercial)

Caso a conta conectada seja comercial (WhatsApp Business), o **WaSockets** oferece suporte para interagir com o catálogo de produtos, obter detalhes de pedidos e gerenciar o perfil público e as mídias da empresa.

### Gerenciamento de Perfil e Capa Comercial

Você pode atualizar dados públicos de endereço, e-mail, descrição, websites, horários de funcionamento e foto de capa:

```javascript
// Atualizar o perfil comercial do usuário
await sock.updateBussinesProfile({
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    email: 'contato@suaempresa.com.br',
    description: 'Empresa especializada em soluções de tecnologia.',
    websites: ['https://suaempresa.com.br', 'https://blog.suaempresa.com.br'],
    hours: {
        timezone: 'America/Sao_Paulo',
        days: [
            { day: '1', mode: 'open_24_h' }, // Segunda-feira (1=Segunda, 7=Domingo)
            { 
                day: '2', 
                mode: 'specific_hours', 
                openTimeInMinutes: 540,  // 09:00 (9h * 60)
                closeTimeInMinutes: 1080 // 18:00 (18h * 60)
            }
        ]
    }
})

// Atualizar ou definir a foto de capa comercial
const coverPhotoId = await sock.updateCoverPhoto('./capa_empresa.jpg')

// Remover a foto de capa atual
await sock.removeCoverPhoto(coverPhotoId)
```

### Consulta de Catálogo, Coleções e Pedidos

```javascript
// Obter a lista de produtos do catálogo de um contato (ou do seu próprio)
const catalogo = await sock.getCatalog({
    jid: '5511999999999@s.whatsapp.net',
    limit: 15
})
console.log('Produtos:', catalogo.products)

// Obter as coleções de produtos organizadas do catálogo
const colecoes = await sock.getCollections('5511999999999@s.whatsapp.net', 10)

// Obter os detalhes completos de um pedido comercial a partir do ID e do Token da mensagem de carrinho
const detalhesPedido = await sock.getOrderDetails('ID_DO_PEDIDO', 'TOKEN_DO_PEDIDO')
console.log('Itens do Pedido:', detalhesPedido.items)
```

### Cadastro e Modificação de Produtos no Catálogo

```javascript
// Adicionar um novo produto no catálogo
const novoProduto = await sock.productCreate({
    name: 'Caneca Personalizada WaSockets',
    description: 'Caneca de cerâmica de alta qualidade.',
    price: 4990, // R$ 49,90 (valor representado sem decimais, multiplicado por 100)
    currency: 'BRL',
    isHidden: false,
    image: { url: './caneca.jpg' } // Caminho local, buffer ou stream
})
console.log('Produto Criado com ID:', novoProduto.id)

// Atualizar dados de um produto existente
await sock.productUpdate(novoProduto.id, {
    name: 'Caneca Personalizada WaSockets (Edição Especial)',
    price: 5990
})

// Obter detalhes de um único produto
const produto = await sock.getProduct(sock.user.id, novoProduto.id)
console.log('Detalhes do Produto:', produto)

// Remover produtos do catálogo (aceita um array de IDs de produtos)
await sock.productDelete([novoProduto.id])
```

---

## 👥 Grupos, Comunidades v2 e Moderação Avançada

O **WaSockets** oferece um conjunto completo e modernizado para gerenciamento profissional de Grupos e Comunidades no WhatsApp.

### Gestão e Moderação de Entrada (Approval Mode)

Controle quem pode entrar no grupo através do fluxo oficial de aprovação de membros:

```javascript
const groupJid = '1234567890-987654@g.us'

// Ativar modo de aprovação obrigatória de novos membros
await sock.groupMembershipApprovalMode(groupJid, 'on') // ou true / 'off'

// Listar participantes aguardando aprovação
const pendentes = await sock.groupRequestParticipantsList(groupJid)
console.log('Solicitações pendentes:', pendentes)

// Aprovar participantes pendentes (aceita string única ou array)
await sock.groupApprovePendingParticipants(groupJid, ['5511999999999@s.whatsapp.net'])

// Rejeitar participantes pendentes
await sock.groupRejectPendingParticipants(groupJid, ['5511888888888@s.whatsapp.net'])
```

### Configuração Unificada de Políticas do Grupo

Altere facilmente todas as diretrizes de segurança e permissões do grupo em uma única operação:

```javascript
await sock.groupUpdatePermissions(groupJid, {
    announce: true,              // true: apenas admins enviam mensagens; false: todos
    restrict: true,              // true: apenas admins editam dados do grupo; false: todos
    memberAddMode: 'admin_add',  // 'admin_add' ou 'all_member_add'
    approvalMode: true,          // Exigir aprovação de admin para novos participantes
    ephemeral: 86400             // Mensagens temporárias (24h = 86400s, 7 dias = 604800s, false = desativar)
})
```

### Menção a Todos os Membros (@everyone / Mention All)

Notifique ou mencione todos os participantes de um grupo de forma prática e sem boilerplate:

```javascript
// Método direto
await sock.groupSendMentionAll(groupJid, '📢 Atenção a todos os membros: reunião às 15h!')

// Ou apenas para administradores, excluindo a si próprio:
await sock.groupSendMentionAll(groupJid, 'Aviso importante aos administradores', {
    adminsOnly: true,
    excludeMe: true
})

// Ou diretamente através do sendMessage usando o parâmetro mentionAll:
await sock.sendMessage(groupJid, {
    text: 'Olá a todos!',
    mentionAll: true
})
```

### Extração Rápida de Administradores e Membros

```javascript
// Retorna array de JIDs apenas de administradores e criador
const adminJids = await sock.groupGetAdminJids(groupJid)

// Retorna lista completa normalizada de participantes com status de admin e LID
const participantes = await sock.groupGetParticipants(groupJid)
```

### Comunidades v2 (Subgrupos e Anúncios)

Gerencie Comunidades do WhatsApp com suporte a separação de subgrupos e grupo de avisos geral:

```javascript
// Criar uma comunidade
const comunidade = await sock.communityCreate('Minha Comunidade', 'Descrição da comunidade')

// Vincular um grupo existente como subgrupo da comunidade
await sock.communityLinkGroup(groupJid, comunidade.id)

// Desvincular um subgrupo da comunidade
await sock.communityUnlinkGroup(groupJid, comunidade.id)

// Obter subgrupos organizados (grupo padrão de anúncios vs subgrupos comuns)
const { defaultSubGroup, subGroups, allGroups } = await sock.communityFetchSubGroups(comunidade.id)
console.log('Grupo Geral de Anúncios:', defaultSubGroup)
console.log('Subgrupos de discussão:', subGroups)

// Gerenciar aprovações de entrada na Comunidade
await sock.communityMembershipApprovalMode(comunidade.id, 'on')
await sock.communityApprovePendingParticipants(comunidade.id, ['5511999999999@s.whatsapp.net'])
```

### Mensagens de Visualização Única (View Once)

Envie imagens, vídeos ou mídias efêmeras com a flag `viewOnce: true`:

```javascript
await sock.sendMessage(jid, {
    image: { url: './comprovante.jpg' },
    caption: 'Comprovante confidencial',
    viewOnce: true
})
```

---

## 🧩 Arquitetura de Plugins e Middlewares

O **WaSockets** introduz uma arquitetura modular de plugins e ciclo de vida de middlewares que permite estender o socket de maneira limpa, sem monkey-patching.

### Criando e Instalando Plugins

Um plugin pode ser uma função simples ou um objeto estruturado:

```javascript
// Exemplo de Plugin de Boas-Vindas ou Auto-Resposta
const meuPluginBot = {
    name: 'auto-reply-plugin',
    version: '1.0.0',
    description: 'Responde automaticamente a palavras-chave',
    install(sock, options, manager) {
        console.log('Plugin instalado com opções:', options)

        // Escuta eventos normais da conexão
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return
            for (const msg of messages) {
                if (!msg.key.fromMe && msg.message?.conversation === '!ping') {
                    await sock.sendMessage(msg.key.remoteJid, { text: '🏓 Pong via Plugin!' })
                }
            }
        })
    }
}

// Instalação do plugin no socket
sock.use(meuPluginBot, { prefix: '!' })

// Listar plugins ativos
console.log('Plugins ativos:', sock.listPlugins())
```

### Middlewares de Interceptação de Mensagens

Intercepte ou cancele envios e recebimentos antes que cheguem à rede:

```javascript
// Intercepta qualquer mensagem antes do envio (retornar false cancela o envio)
sock.registerMiddleware('beforeSendMessage', async ({ jid, content, options }, socket) => {
    console.log(`Enviando mensagem para ${jid}...`)
    
    // Bloquear envio se contiver palavras proibidas
    if (typeof content?.text === 'string' && content.text.includes('palavra_bloqueada')) {
        console.warn('Mensagem bloqueada por política de segurança.')
        return false // Cancela o disparo
    }
})

// Executa após a mensagem ser enviada com sucesso
sock.registerMiddleware('afterSendMessage', async ({ jid, content, fullMsg }, socket) => {
    console.log(`Mensagem ${fullMsg.key.id} entregue ao servidor com sucesso!`)
})
```

---

## ⚡ Alta Performance, Cache e Controle de Memória

### Cache Integrado de Metadados de Grupo (TTL LRU)

Por padrão, o **WaSockets** ativa um cache inteligente com expiração por tempo (TTL de 5 minutos e limite de grupos em memória). Ao enviar mensagens para grupos ou listar participantes, as requisições repetidas ao WhatsApp são evitadas, acelerando disparos em massa em até 10x:

```javascript
const sock = makeWASocket({
    enableGroupCache: true // Ativado por padrão com TTL de 5 minutos
})
```

### Proteção de Memória na Store (`makeInMemoryStore`)

Evite vazamento de memória em bots de alta demanda com limpeza automática e limite configurável de mensagens por chat:

```javascript
const store = makeInMemoryStore({
    maxMessagesPerChat: 200 // Limita o histórico a 200 mensagens por chat em RAM (padrão: 500)
})

// Limpeza manual sob demanda
store.pruneMessages(groupJid, 50) // Mantém apenas as últimas 50 mensagens do chat especificado
store.pruneMessages(undefined, 100) // Trunca todos os chats para no máximo 100 mensagens

// Obter contagem de mensagens armazenadas
const qtdTotal = store.getMessageCount()
const qtdChat = store.getMessageCount(groupJid)

// Limpar mensagens de um chat ou resetar toda a memória
store.clear(groupJid)
```

---

## 🔷 Suporte Completo a TypeScript

O **WaSockets** inclui definições de tipo completas em `lib/index.d.ts` e exporta a tipagem de todos os métodos dos 5 pilares, interfaces de mensagens, eventos e plugins:

```typescript
import makeWASocket, { WASocket, AnyMessageContent, DisconnectReason, GroupMetadata } from '@areumtecnologia/wasockets'

const sock: WASocket = makeWASocket({
    printQRInTerminal: true
})
```

---

## 🔒 Configurações de Privacidade

```javascript
// Bloquear ou desbloquear um usuário
await sock.updateBlockStatus('5511999999999@s.whatsapp.net', 'block') // ou 'unblock'

// Obter lista de usuários bloqueados
const listaBloqueados = await sock.fetchBlocklist()

// Atualizar privacidade do "Visto por Último"
// Valores aceitos: 'all' | 'contacts' | 'contact_blacklist' | 'none'
await sock.updateLastSeenPrivacy('contacts')

// Atualizar privacidade do "Visto Online"
// Valores aceitos: 'all' | 'match_last_seen'
await sock.updateOnlinePrivacy('match_last_seen')

// Atualizar privacidade das confirmações de leitura (ticks azuis)
// Valores aceitos: 'all' | 'none'
await sock.updateReadReceiptsPrivacy('none')

// Atualizar privacidade da Foto de Perfil
// Valores aceitos: 'all' | 'contacts' | 'contact_blacklist' | 'none'
await sock.updateProfilePicturePrivacy('contacts')

// Atualizar privacidade do Recado/Status (About)
// Valores aceitos: 'all' | 'contacts' | 'contact_blacklist' | 'none'
await sock.updateStatusPrivacy('contacts')

// Atualizar quem pode adicionar você a grupos
// Valores aceitos: 'all' | 'contacts' | 'contact_blacklist'
await sock.updateGroupsAddPrivacy('contacts')

// Consultar todas as configurações de privacidade ativas da conta
const privacySettings = await sock.fetchPrivacySettings()
console.log('Configurações de privacidade atuais:', privacySettings)
```

---

## 🛡️ Logs e Protocolo

Para habilitar a depuração detalhada e ver o tráfego bruto do Websocket trocado com o WhatsApp, inicialize o logger no nível `debug` ou `trace`. O **WaSockets** usa a biblioteca estruturada `pino` para logs ultra rápidos:

```javascript
const pino = require('pino')

const sock = makeWASocket({
    logger: pino({ level: 'debug' })
})
```

### Como o WhatsApp se comunica (BinaryNodes)

As mensagens são trocadas em formato binário encapsuladas em estruturas denominadas `BinaryNode`. Cada nó possui três atributos:
- **`tag`**: Nome da ação (ex: `message`, `ib`, `presence`, `iq`)
- **`attrs`**: Objeto contendo propriedades em string/chave-valor (ID, timestamp, remetente, etc.)
- **`content`**: O corpo de dados do nó (geralmente outro array de nós ou um buffer criptografado)

Você pode interagir diretamente com o tráfego do Websocket do WhatsApp registrando callbacks específicos:

```javascript
// Monitora todos os pacotes recebidos que possuem a tag 'edge_routing'
sock.ws.on('CB:edge_routing', (node) => {
    console.log('Recebido nó de roteamento:', node)
})

// Monitora pacotes 'message' específicos
sock.ws.on('CB:message', (node) => {
    console.log('Mensagem de protocolo bruta:', node)
})
```
