const path = require("path");
const fetch = require("node-fetch");
const express = require("express");
const expressProxy = require("express-http-proxy");
const jsdom = require("jsdom");
const FuzzySearch = require("fuzzy-search");

const { cuss } = require('./cuss.js');
const { getRhymeForWord } = require("./rhymes.js");

const { JSDOM } = jsdom;
const URL_BASE = "http://www.karaokeden.com";
const PROXY_PATH = "/files";
const ENTITIES = {
  amp: "&",
  apos: "'",
  "#x27": "'",
  "#x2F": "/",
  "#39": "'",
  "#47": "/",
  lt: "<",
  gt: ">",
  nbsp: " ",
  quot: '"'
};

function decodeHTMLEntities(text) {
  return text.replace(/&([^;]+);/gm, function(match, entity) {
    return ENTITIES[entity] || match;
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), "g"), replace);
}

async function getURLHTML(url) {
  const response = await fetch(url);
  const body = await response.text();
  const dom = new JSDOM(body);
  return dom.window.document;
}

async function getLinksFromPage(englishPage) {
  const songs = [];
  const document = await getURLHTML(`${URL_BASE}${englishPage}`);
  const karLinks = [...document.querySelectorAll("a")].forEach(link => {
    const url = link.getAttribute("href");
    if (url.includes(".kar")) {
      const text = link.innerHTML;
      songs.push({ url, text });
    }
  });
  return songs;
}

function decodeText(text) {
  try {
    return decodeURIComponent(text);
  } catch (e) {
    return text;
  }
}

function getSongTitle(title = "") {
  title = replaceAll(title, ".kar", "");
  title = decodeHTMLEntities(title);
  title = replaceAll(title, ">", "");
  title = replaceAll(title, "<", "");
  title = replaceAll(title, ":", "");

  // remove malformed content
  title = title.replace("(words & Music", "");
  title = title.replace("(lyrics & Music", "");

  title = title.trim();

  if (title.startsWith("-")) {
    title = title.substring(1);
  }

  title = title.trim();

  return title;
}

async function getAllSongs() {
    const document = await getURLHTML(`${URL_BASE}/karaoke`);

    const englishPages = [...document.querySelectorAll("a")]
      .map(link => {
        return link.getAttribute("href");
      })
      .filter(link => {
        return link.includes("/karaoke/browse/English");
      });

  // temporary
  // const englishPages = ["/karaoke/browse/English"];

  const songLinks = await Promise.all(
    englishPages.map(page => {
      return getLinksFromPage(page);
    })
  );

  const allSongs = songLinks.flat().map(songLink => {
    return {
      title: getSongTitle(songLink.text),
      url: `${PROXY_PATH}${songLink.url.replace("/lyrics/", "/download/")}`
    };
  });

  return allSongs;
}

async function findSong(query) {
  const songs = await getAllSongs();
  const searcher = new FuzzySearch(songs, ["title"]);
  const results = searcher.search(query);

  if (!results || results.length === 0) {
    return { error: `No results found for "${query}"` };
  }

  return results[0];
}

async function downloadSong(song) {
  return fetch(song.url);
}

const app = express();
const port = 3000;

app.use(express.static("public"));

app.get("/api/song", async (request, response) => {
  const { name } = request.query;

  const song = await findSong(name);

  return response.json(song);
});

app.get("/api/rhymes", async (request, response) => {
  const { word } = request.query;

  const rhyme = await getRhymeForWord(word);

  if (!rhyme) {
    return response.json({ error: 'No rhyme' });
  }
  
  if (cuss[rhyme.word] && cuss[rhyme.word] === 2) {
    return response.json({ error: 'No rhyme' });
  }
  
  return response.json(rhyme);
});

app.use(PROXY_PATH, expressProxy(URL_BASE));

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
