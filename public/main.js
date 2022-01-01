/* global JZZ */

async function blobToData(blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      let data = "";
      const bytes = new Uint8Array(e.target.result);
      for (var i = 0; i < bytes.length; i++) {
        data += String.fromCharCode(bytes[i]);
      }
      resolve(data);
    };
    reader.readAsArrayBuffer(blob);
  });
}

function getSMF(data) {
  let smf = null;
  try {
    smf = new JZZ.MIDI.SYX(data);
  } catch (err) {}
  if (!smf) {
    smf = new JZZ.MIDI.SMF(data);
  }
  return smf;
}

async function getRhymesForWord(word) {
  const response = await fetch(`/api/rhymes?word=${word}`);
  return response.json();
}

const WORDS_TO_NEVER_REPLACE = ["and", "be", "the", "a"];

async function main() {
  console.log("Started...");
  
  const loadingElement = document.querySelector('.loading');

  const params = new URLSearchParams(window.location.search);
  const name = params.get("name");
  console.log("name", name);

  if (!name) {
    console.log("No name");
    return;
  }

  const response = await fetch(`/api/song?name=${name}`);
  const json = await response.json();
  
  console.log('json', json);

  const songResponse = await fetch(json.url);
  // const songResponse = await fetch(
  //   "/files/karaoke/download/English/%3E%3E%3E+%28words+%26+Music%3A+-+%3E%3E%3E+Abba+-+Dancing+Queen+%281976%29+%3C%3C%3C.kar"
  // );
  const blob = await songResponse.blob();
  const data = await blobToData(blob);

  JZZ.synth.Tiny.register("Web Audio");
  const midiOut = JZZ()
    .or("Cannot start MIDI engine!")
    .openMidiOut()
    .or("Cannot open MIDI Out!");

  const karaoke = new JZZ.gui.Karaoke("kar");
  const smf = getSMF(data);
  const player = smf.player();
  karaoke.load(smf);
  player.connect(karaoke);
  player.connect(midiOut);
  player.onEnd = () => karaoke.reset();

  const KARAOKE_ELEMENT_CLASSNAME = ".karaoke";
  const karaokeElement = document.querySelector(KARAOKE_ELEMENT_CLASSNAME);

  // hide kareoke until its fully loaded...
  karaokeElement.style.display = "none";

  const songParts = [
    ...document.querySelectorAll(`${KARAOKE_ELEMENT_CLASSNAME} span`)
  ];
  await Promise.all(
    songParts.map(async songPart => {
      const word = songPart.innerText;

      // dont replace certain words
      if (WORDS_TO_NEVER_REPLACE.includes(word.toLowerCase())) {
        return;
      }

      // random chance not to replace
      if (Math.random() > 0.5) {
        return;
      }

      console.log("Changing", word);

      try {
        const rhyme = await getRhymesForWord(word);

        if (!rhyme || !rhyme.word) {
          return;
        }

        console.log("Rhymed", rhyme.word);
        songPart.innerText = rhyme.word;
        songPart.classList.add("replaced");
      } catch (e) {
        console.error(e.message);
        return;
      }
    })
  );

  player.play();
  loadingElement.style.display = 'none'
  karaokeElement.style.display = "initial";
}

main();
