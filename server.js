const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./index");

serveHTTP(addonInterface, { port: process.env.PORT || 7000 });
console.log(`Addon rodando em http://localhost:${process.env.PORT || 7000}/manifest.json`);
