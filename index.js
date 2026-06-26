const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://animesland.net";
const STREAM_BASE = "https://cdn-s01.mywallpaper-4k-image.net/stream/k";

const manifest = {
    id: "org.animesland.addon",
    version: "1.0.0",
    name: "AnimesLand",
    description: "Assista animes diretamente do AnimesLand no Stremio.",
    resources: ["catalog", "meta", "stream"],
    types: ["series", "anime"],
    idPrefixes: ["al_"],
    catalogs: [
        {
            type: "series",
            id: "al_latest",
            name: "AnimesLand - Recentes",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "series",
            id: "al_legendado",
            name: "AnimesLand - Legendados"
        },
        {
            type: "series",
            id: "al_dublado",
            name: "AnimesLand - Dublados"
        }
    ]
};

const builder = new addonBuilder(manifest);

// Helper para scraping da lista de animes
async function scrapeAnimes(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);
        const results = [];

        $("article.item").each((i, el) => {
            const title = $(el).find("h3").text().trim();
            const link = $(el).find("a").attr("href");
            const img = $(el).find("img").attr("src");
            
            if (link && link.includes("/animes/")) {
                const slug = link.split("/animes/")[1].replace("/", "");
                results.push({
                    id: `al_${slug}`,
                    type: "series",
                    name: title,
                    poster: img,
                    description: title
                });
            }
        });
        return results;
    } catch (e) {
        return [];
    }
}

// Catalogs
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    let url = BASE_URL;
    
    if (extra.search) {
        url = `${BASE_URL}/?s=${encodeURIComponent(extra.search)}`;
    } else if (id === "al_legendado") {
        url = `${BASE_URL}/categoria/legendado/`;
    } else if (id === "al_dublado") {
        url = `${BASE_URL}/categoria/dublado/`;
    } else {
        url = `${BASE_URL}/animes/`;
    }

    const metas = await scrapeAnimes(url);
    return { metas };
});

// Meta (Animes e Episódios)
builder.defineMetaHandler(async ({ type, id }) => {
    const slug = id.replace("al_", "");
    const url = `${BASE_URL}/animes/${slug}/`;
    
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);
        
        const title = $(".data h1").text() || $("h1").text();
        const poster = $(".poster img").attr("src");
        const description = $(".wp-content p").text() || title;

        const episodes = [];
        $(".episodios li").each((i, el) => {
            const epLink = $(el).find("a").attr("href");
            const epTitle = $(el).find(".numerando").text() + " - " + $(el).find("a").text();
            
            // Extrair temporada e episódio do link ou texto
            // Exemplo: .../one-piece-1x1/ -> S1 E1
            const match = epLink.match(/(\d+)x(\d+)/);
            const season = match ? parseInt(match[1]) : 1;
            const episode = match ? parseInt(match[2]) : (i + 1);

            episodes.push({
                id: `${id}:${season}:${episode}:${epLink}`,
                title: epTitle,
                season: season,
                number: episode,
                released: new Date().toISOString()
            });
        });

        // Ordenar episódios
        episodes.sort((a, b) => (a.season - b.season) || (a.number - b.number));

        return {
            meta: {
                id,
                type: "series",
                name: title,
                poster,
                background: poster,
                description,
                videos: episodes
            }
        };
    } catch (e) {
        return { meta: null };
    }
});

// Streams
builder.defineStreamHandler(async ({ type, id }) => {
    // ID format: al_slug:season:episode:url
    const parts = id.split(":");
    if (parts.length < 4) return { streams: [] };

    const slug = parts[0].replace("al_", "");
    const season = parts[1];
    const episode = parts[2];
    const epUrl = parts.slice(3).join(":");

    // Baseado na dica do usuário: https://cdn-s01.mywallpaper-4k-image.net/stream/k/koori-no-jouheki/12.mp4/index.m3u8
    // Vamos tentar construir o link direto
    const streamUrl = `${STREAM_BASE}/${slug}/${episode}.mp4/index.m3u8`;

    return {
        streams: [
            {
                title: "AnimesLand Direct HLS",
                url: streamUrl
            },
            {
                title: "AnimesLand Page",
                externalUrl: epUrl
            }
        ]
    };
});

module.exports = builder.getInterface();
