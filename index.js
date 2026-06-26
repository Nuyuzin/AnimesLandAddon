const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://animesland.net";
// Base de stream observada
const STREAM_BASE = "https://cdn-s01.mywallpaper-4k-image.net/stream/k";

const manifest = {
    id: "org.animesland.addon.v3",
    version: "3.0.0",
    name: "AnimesLand FHD",
    description: "Assista animes do AnimesLand em FHD. Compatível com Stremio e Nuvio.",
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
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': BASE_URL
            }
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
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);
        
        const title = $(".data h1").text().trim() || $("h1").first().text().trim();
        const poster = $(".poster img").attr("src");
        const description = $(".wp-content p").first().text().trim() || title;

        const episodes = [];
        
        // Seletor para a lista de episódios
        $(".episode-card").each((i, el) => {
            const epLink = $(el).find("a.episode-link").attr("href");
            const epTitle = $(el).find(".episode-title").text().trim();
            const epNumberMatch = epTitle.match(/(\d+)/);
            const episodeNumber = epNumberMatch ? parseInt(epNumberMatch[1]) : (i + 1);
            
            episodes.push({
                id: `${id}:1:${episodeNumber}:${Buffer.from(epLink).toString('base64')}`,
                title: epTitle,
                season: 1,
                number: episodeNumber,
                released: new Date().toISOString()
            });
        });

        // Fallback
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
        return { meta: null };
    }
});

builder.defineStreamHandler(async ({ type, id }) => {
    const parts = id.split(":");
    if (parts.length < 4) return { streams: [] };

    const slug = parts[0].replace("al_", "");
    const episode = parts[2];
    const epUrl = Buffer.from(parts[3], 'base64').toString('ascii');

    // Link de stream baseado no padrão FHD
    const streamUrl = `${STREAM_BASE}/${slug}/${episode}.mp4/index.m3u8`;

    return {
        streams: [
            {
                name: "AnimesLand FHD",
                title: `Opção 1 - HLS Player`,
                url: streamUrl,
                behaviorHints: {
                    notWebReady: false,
                    proxyHeaders: {
                        "request": {
                            "Referer": "https://animesland.net/",
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                        }
                    }
                }
            },
            {
                name: "AnimesLand FHD",
                title: `Opção 2 - Link Direto`,
                url: streamUrl
            },
            {
                name: "AnimesLand",
                title: "Assistir no Navegador",
                externalUrl: epUrl
            }
        ]
    };
});

module.exports = builder.getInterface();
