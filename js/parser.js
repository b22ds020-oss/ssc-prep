/* parser.js — turns pasted question/answer text into card pairs.
   Handles numbering styles like "Q1)", "1.", "Question 3:", "Answer. 1)", "Answers" header, etc.
   Also handles bare unnumbered lines as a fallback (one line = one item).
*/

function splitLines(text) {
  return (text || "").replace(/\r\n/g, "\n").split("\n");
}

function parseNumberedBlock(text, wordPattern) {
  const marker = new RegExp(`^\\s*(?:${wordPattern}\\.?\\s*)?(\\d{1,4})\\s*[\\).:]\\s*(.*)$`, "i");
  const lines = splitLines(text);
  const items = []; // {num, text}
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(marker);
    if (m) {
      if (current) items.push(current);
      current = { num: parseInt(m[1], 10), text: m[2].trim() };
    } else if (line.length) {
      if (current) {
        current.text = current.text ? `${current.text} ${line}` : line;
      }
      // if no current item yet, ignore stray header/blank text
    }
  }
  if (current) items.push(current);

  if (items.length === 0) {
    // Fallback: no numbering detected — treat every non-empty line as one item
    return lines.map((l) => l.trim()).filter(Boolean).map((t, i) => ({ num: i + 1, text: t }));
  }

  items.sort((a, b) => a.num - b.num);
  return items;
}

// Detect an "Answers" boundary inside one combined block of text.
function findAnswerBoundary(lines) {
  const re = /^\s*answers?\.?\s*:?\s*(.*)$/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(re);
    if (m) {
      return { index: i, inlineRemainder: m[1].trim() };
    }
  }
  return null;
}

// Parses one combined textarea containing both questions and answers,
// separated by an "Answers" header or an inline "Answer 1)" marker.
function parseCombined(text) {
  const lines = splitLines(text);
  const boundary = findAnswerBoundary(lines);

  if (!boundary) {
    // No answers section found — treat entire text as questions only.
    const qItems = parseNumberedBlock(text, "q(?:uestion)?");
    return { pairs: [], questions: qItems, answers: [], warning: "no_answers_section" };
  }

  const qBlock = lines.slice(0, boundary.index).join("\n");
  // If the boundary line itself carried content after "Answer(s)" (e.g. "Answer. 1) Akbar"),
  // include that remainder as the first line of the answers block.
  const aLinesTail = lines.slice(boundary.index + 1);
  const aBlockLines = boundary.inlineRemainder ? [boundary.inlineRemainder, ...aLinesTail] : aLinesTail;
  const aBlock = aBlockLines.join("\n");

  const qItems = parseNumberedBlock(qBlock, "q(?:uestion)?");
  const aItems = parseNumberedBlock(aBlock, "answers?");

  return buildPairs(qItems, aItems);
}

function parseTwoBoxes(qText, aText) {
  const qItems = parseNumberedBlock(qText, "q(?:uestion)?");
  const aItems = parseNumberedBlock(aText, "answers?");
  return buildPairs(qItems, aItems);
}

function buildPairs(qItems, aItems) {
  const n = Math.min(qItems.length, aItems.length);
  const pairs = [];
  for (let i = 0; i < n; i++) {
    if (qItems[i].text && aItems[i].text) {
      pairs.push({ question: qItems[i].text, answer: aItems[i].text });
    }
  }
  return {
    pairs,
    questions: qItems,
    answers: aItems,
    mismatch: qItems.length !== aItems.length,
  };
}

window.Parser = { parseCombined, parseTwoBoxes, parseNumberedBlock };
