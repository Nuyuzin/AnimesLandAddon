const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://animesland.net";
const STREAM_BASE = "https://cdn-s01.mywallpaper-4k-image.net/stream/k";

const manifest = {
    id: "org.animesland.addon.v2",
    version: "2.0.0",
    name: "AnimesLand v2",
    description: "Assista animes diretamente do AnimesLand. Compatível com Stremio e Nuvio.",
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

async function scrapeAnimes(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const $ = cheerio.load(data);
        const results = [];

        $("article.item").each((i, el) => {
            const title = $(el).find(".titulonew").text().trim() || $(el).find("h3").text().trim();
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
        console.error("Error scraping animes:", e.message);
        return [];
    }
}

builder.defineCatalogHandler(async ({ type, id, extra }) => {
    let url = BASE_URL;
    if (extra && extra.search) {
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

builder.defineMetaHandler(async ({ type, id }) => {
    const slug = id.replace("al_", "");
    const url = `${BASE_URL}/animes/${slug}/`;
    
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const $ = cheerio.load(data);
        
        const title = $(".data h1").text().trim() || $("h1").first().text().trim();
        const poster = $(".poster img").attr("src");
        const description = $(".wp-content p").first().text().trim() || title;

        const episodes = [];
        
        // Novo seletor baseado na análise
        $(".episode-card").each((i, el) => {
            const epLink = $(el).find("a.episode-link").attr("href");
            const epTitle = $(el).find(".episode-title").text().trim();
            
            // Tentar extrair o número do episódio do título ou link
            const epNumberMatch = epTitle.match(/(\d+)/) || epLink.match(/-(\d+)\/$/);
            const episodeNumber = epNumberMatch ? parseInt(epNumberMatch[1]) : (i + 1);
            
            // Para animesland, geralmente é 1 temporada longa
            const season = 1;

            episodes.push({
                id: `${id}:${season}:${episodeNumber}:${Buffer.from(epLink).toString('base64')}`,
                title: epTitle,
                season: season,
                number: episodeNumber,
                released: new Date().toISOString()
            });
        });

        // Se não encontrou com episode-card, tenta o seletor antigo como fallback
        if (episodes.length === 0) {
            $(".episodios li").each((i, el) => {
                const epLink = $(el).find("a").attr("href");
                const epTitle = $(el).find("a").text().trim();
                const match = epLink.match(/(\d+)x(\d+)/);
                const season = match ? parseInt(match[1]) : 1;
                const episode = match ? parseInt(match[2]) : (i + 1);

                episodes.push({
                    id: `${id}:${season}:${episode}:${Buffer.from(epLink).toString('base64')}`,
                    title: epTitle,
                    season: season,
                    number: episode,
                    released: new Date().toISOString()
                });
            });
        }

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
        console.error("Error fetching meta:", e.message);
        return { meta: null };
    }
});

builder.defineStreamHandler(async ({ type, id }) => {
    const parts = id.split(":");
    if (parts.length < 4) return { streams: [] };

    const slug = parts[0].replace("al_", "");
    const season = parts[1];
    const episode = parts[2];
    const epUrlBase64 = parts[3];
    const epUrl = Buffer.from(epUrlBase64, 'base64').toString('ascii');

    // Construção do link de stream baseada no padrão observado
    // slug no site: koori-no-jouheki -> slug no stream: koori-no-jouheki
    const streamUrl = `${STREAM_BASE}/${slug}/${episode}.mp4/index.m3u8`;

    return {
        streams: [
            {
                name: "AnimesLand",
                title: `FHD Player - Ep ${episode}`,
                url: streamUrl,
                behaviorHints: {
                    notWebReady: false,
                    proxyHeaders: {
                        "Referer": BASE_URL,
                        "User-Agent": "Mozilla/5.0"
                    }
                }
            },
            {
                name: "AnimesLand",
                title: "Assistir no Site",
                externalUrl: epUrl
            }
        ]
    };
});

module.exports = builder.getInterface();
