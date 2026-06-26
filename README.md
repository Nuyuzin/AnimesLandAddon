# AnimesLand Stremio Addon

Este é um addon funcional para o Stremio que consome conteúdos do site AnimesLand.

## Como hospedar no Render

1.  Crie um repositório no GitHub e envie todos os arquivos deste ZIP para lá.
2.  Crie uma conta no [Render](https://render.com/).
3.  Clique em **New +** e selecione **Web Service**.
4.  Conecte seu repositório do GitHub.
5.  Configurações:
    *   **Runtime:** `Node`
    *   **Build Command:** `npm install`
    *   **Start Command:** `node server.js`
6.  Após o deploy, o Render fornecerá uma URL (ex: `https://meu-addon.onrender.com`).
7.  No Stremio, vá em Addons -> Adicionar Addon -> Cole a URL terminando em `/manifest.json` (ex: `https://meu-addon.onrender.com/manifest.json`).

## Funcionalidades
*   Catálogos de Recentes, Legendados e Dublados.
*   Busca funcional.
*   Organização correta de episódios (Série -> Temporada -> Episódios).
*   Streaming direto via HLS (quando disponível).

---
Desenvolvido para uso pessoal.
