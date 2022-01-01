const fetch = require("node-fetch");

const { JsonDB } = require("node-json-db");
const { Config } = require("node-json-db/dist/lib/JsonDBConfig");

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), "g"), replace);
}

function capitalizeString(str) {
  return str.replace(/\b\w/g, letter => letter.toUpperCase());
}

function getRandomArrayItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/*
  The first argument is the database filename. If no extension, '.json' is assumed and automatically added.
  The second argument is used to tell the DB to save after each push
  If you put false, you'll have to call the save() method.
  The third argument is to ask JsonDB to save the database in an human readable format. (default false)
  The last argument is the separator. By default it's slash 
*/
const db = new JsonDB(new Config("rhymes-database", true, true, "/"));

async function getRhymes(word) {
  const databaseWord = word.trim().toLowerCase();

  try {
    const existingRhymesData = db.getData(`/${databaseWord}`);
    if (existingRhymesData) {
      console.log(`Existing rhymes for "${databaseWord}". Returning...`);
      return existingRhymesData;
    }
  } catch (e) {
    // errors if no data
  }

  console.log(`Getting new rhymes for "${databaseWord}"`);

  try {
    const response = await fetch(
      `https://api.datamuse.com/words?rel_rhy=${word}`
    );
    const rhymes = await response.json();

    if (!rhymes || rhymes.length === 0) {
      return [];
    }

    const filteredRhymes = rhymes.filter(rhyme => {
      const isPerfectRhyme = rhyme.score >= 300;
      const isntOriginalWord = rhyme.word.toLowerCase() !== word.toLowerCase();
      return isntOriginalWord && isPerfectRhyme;
    });

    // add to cache
    db.push(`/${databaseWord}`, filteredRhymes);

    return filteredRhymes;
  } catch (e) {
    console.error(e.message);
    return [];
  }
}

async function getRhymeForWord(word) {
  if (!word || word.length === 0) {
    return null;
  }

  let processedWord = word.trim();
  processedWord = replaceAll(processedWord, ",", "");
  processedWord = replaceAll(processedWord, ".", "");
  processedWord = replaceAll(processedWord, "'", "");
  processedWord = replaceAll(processedWord, '"', "");

  const isCapitalised = processedWord[0] === processedWord[0].toUpperCase();

  const rhymes = await getRhymes(processedWord);
  if (!rhymes || rhymes.length === 0) {
    return null;
  }

  const rhyme = getRandomArrayItem(rhymes);

  const replacedWord = word.replace(
    processedWord,
    isCapitalised ? capitalizeString(rhyme.word) : rhyme.word
  );

  return { word: replacedWord };
}

module.exports = {
  getRhymeForWord
};
