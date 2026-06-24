# WaSockets - API do WhatsApp Web em TypeScript/JavaScript

<div align="center">
  <p><strong>Uma modificação otimizada e de alta performance da API do WhatsApp (baseada no Baileys), mantida e aprimorada pela Áreum Tecnologia.</strong></p>
</div>

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
| **Estabilidade** | Versão Web Estabilizada | Integração com o protocolo Web `v2.3000.1038819500` e restauração da função `fetchLatestWaWebVersion` para buscar sempre a versão de compatibilidade mais recente e funcional do WhatsApp. |
| **Eventos** | Buffer de Eventos Corrigido | Adicionada a propriedade `shouldIncrementChatUnread` no buffer de eventos para garantir um controle preciso e confiável de mensagens não lidas no chat. |
| **Segurança** | Sessões de Autenticação Seguras | Remoção de adaptadores de autenticação inseguros/obsoletos (arquivo único ou MongoDB que causavam corrupção de estado), unificando e otimizando o uso do `useMultiFileAuthState`. |
| **Comunidades** | Suporte a Comunidades | Implementação nativa para escutar e processar comentários em canais de comunidades (`handle comment message`) e reações em comunidades. |
| **Eventos do WhatsApp** | Manipulação de Eventos e Respostas | Suporte a reações de edição de eventos (`handle event edit`) e decodificação das respostas de presença em eventos (`getAggregateResponsesInEventMessage`). |
| **Mídia** | Correções de Miniaturas e Status | Correção de falhas na extração de miniaturas (`extractImageThumb`), na geração de previews de links, no envio de mídias em álbuns/vídeos e na publicação de mídias em status de grupos. |
| **Newsletters (Canais)** | Consulta de Canais Inscritos | Adicionado o método exclusivo `newsletterSubscribed` que lista todos os canais de transmissão (Newsletters) aos quais o usuário está inscrito. |
| **Mensagens de Negócios** | Botões Interativos & PIX | Suporte avançado para layouts de botões interativos, botões Cards (com imagem/vídeo), suporte para botões PIX estáticos e fluxos completos de checkout e pagamento (`review_and_pay`). |

---

## 📌 Índice

- [Instalação](#-instalação)
- [Conectando a Conta](#-conectando-a-conta)
  - [Conexão via QR Code](#conexão-via-qr-code)
  - [Conexão via Código de Emparelhamento (Pairing Code)](#conexão-via-código-de-emparelhamento-pairing-code)
  - [Recebendo Histórico Completo](#recebendo-histórico-completo)
- [Salvando e Restaurando Sessões](#-salvando-e-restaurando-sessões)
- [Configurações Importantes do Socket](#-configurações-importantes-do-socket)
- [Exemplo Prático Inicial (Bootstrap)](#-exemplo-prático-inicial-bootstrap)
- [Tratamento de Eventos](#-tratamento-de-eventos)
  - [Decifrar Votos de Enquetes](#decifrar-votos-de-enquetes)
  - [Decifrar Respostas de Eventos](#decifrar-respostas-de-eventos)
- [Enviando Mensagens](#-enviando-mensagens)
  - [Mensagens de Texto e Menções](#mensagens-de-texto-e-menções)
  - [Mensagens de Mídia](#mensagens-de-mídia)
  - [Botões Interativos](#botões-interativos)
  - [Botão de Pagamento PIX](#botão-de-pagamento-pix)
  - [Fluxos de Checkout (PAY)](#fluxos-de-checkout-pay)
  - [Menção em Status](#menção-em-status)
- [Modificando Mensagens e Chats](#-modificando-mensagens-e-chats)
- [Gerenciamento de Grupos](#-gerenciamento-de-grupos)
- [Newsletters (Canais)](#-newsletters-canais)
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

---

## 🚀 Exemplo Prático Inicial (Bootstrap)

Aqui está um arquivo funcional completo em JavaScript (CommonJS) para iniciar a sua integração:

```javascript
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@areumtecnologia/wasockets')
const { Boom } = require('@hapi/boom')

async function connectToWhatsApp() {
    // 1. Inicializa o estado de autenticação baseado em arquivos
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys')
    
    // 2. Cria o Socket de Conexão
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    })

    // 3. Monitora o status da conexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true
            
            console.log('Conexão fechada devido a:', lastDisconnect.error, '. Reconectando:', shouldReconnect)
            
            if (shouldReconnect) {
                connectToWhatsApp() // Reconexão automática se não tiver feito logout
            }
        } else if (connection === 'open') {
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

## 📡 Tratamento de Eventos

O **WaSockets** utiliza um sistema de eventos tipado baseado no `EventEmitter`.

```javascript
sock.ev.on('messages.upsert', ({ messages, type }) => {
    // type pode ser 'notify' (nova notificação) ou 'append' (carregamento histórico)
    console.log('Novas mensagens:', messages)
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
            name: 'cta_call',
            buttonParamsJson: JSON.stringify({
                display_text: 'Ligar Agora',
                phone_number: '5511999999999'
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

// Fixar chat na lista
await sock.chatModify({ pin: true }, jid)
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

// Obter o código/link de convite do grupo
const codigoConvite = await sock.groupInviteCode(grupo.id)
console.log(`Link: https://chat.whatsapp.com/${codigoConvite}`)

// Revogar link de convite anterior e gerar um novo
const novoCodigo = await sock.groupRevokeInvite(grupo.id)

// Entrar em um grupo usando um código de convite (apenas o código, sem o domínio completo)
const resposta = await sock.groupAcceptInvite('ABcdEFghIJklMnOpQrStUv')

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

## 📢 Newsletters (Canais)

O **WaSockets** traz suporte avançado para a criação e monitoramento de Newsletters (Canais de Transmissão públicos do WhatsApp).

```javascript
// Criar uma Newsletter (Canal)
const canal = await sock.newsletterCreate('Notícias Tecnológicas Áreum', 'Canal oficial de novidades')
console.log('Canal criado com ID:', canal.id)

// Obter metadados de um Canal público pelo ID
const metadadosCanal = await sock.newsletterMetadata('JID', canal.id)
console.log('Nome do Canal:', metadadosCanal.name)

// Listar todas as Newsletters em que a conta atual está inscrita (Exclusivo Áreum!)
const canaisInscritos = await sock.newsletterSubscribed()
console.log('Canais que eu sigo:', canaisInscritos)

// Seguir / Parar de Seguir um canal
await sock.newsletterFollow(canal.id)
await sock.newsletterUnfollow(canal.id)

// Silenciar / Ativar notificações de um canal
await sock.newsletterMute(canal.id)
await sock.newsletterUnmute(canal.id)
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

As mensagens são trocadas em formato binário encapsuladas em estruturas chamadas `BinaryNode`. Cada nó possui três atributos:
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
