(async function () {
  const list = document.getElementById("pub-list");
  if (!list) return;

  let bib;
  try {
    const res = await fetch("publications.bib");
    if (!res.ok) throw new Error("Failed to load publications.bib");
    bib = await res.text();
  } catch (e) {
    console.error(e);
    return;
  }

  const entries = parseBibtex(bib);
  entries.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
  list.innerHTML = entries.map(renderEntry).join("");
})();

function parseBibtex(text) {
  const entries = [];
  const entryStart = /@(\w+)\s*\{([^,\n]+),/g;
  let m;
  while ((m = entryStart.exec(text)) !== null) {
    const type = m[1].toLowerCase();
    if (type === "comment" || type === "string" || type === "preamble") continue;
    const key = m[2].trim();
    // Walk forward to find the closing brace of the entry
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      i++;
    }
    const body = text.slice(m.index + m[0].length, i - 1);
    const fields = parseFields(body);
    entries.push({ type, key, ...fields });
  }
  return entries;
}

function parseFields(body) {
  const fields = {};
  let i = 0;
  const len = body.length;
  while (i < len) {
    // Skip whitespace and commas
    while (i < len && /[\s,]/.test(body[i])) i++;
    if (i >= len) break;

    // Read field name
    const nameStart = i;
    while (i < len && /\w/.test(body[i])) i++;
    const name = body.slice(nameStart, i).toLowerCase();
    if (!name) { i++; continue; }

    // Skip whitespace and =
    while (i < len && /[\s=]/.test(body[i])) i++;

    // Read value
    let value = "";
    if (i < len && body[i] === "{") {
      let depth = 0;
      const start = i + 1;
      while (i < len) {
        if (body[i] === "{") depth++;
        else if (body[i] === "}") { depth--; if (depth === 0) { value = body.slice(start, i); i++; break; } }
        i++;
      }
    } else if (i < len && body[i] === '"') {
      i++;
      const start = i;
      while (i < len && body[i] !== '"') i++;
      value = body.slice(start, i);
      i++;
    } else {
      const start = i;
      while (i < len && body[i] !== "," && body[i] !== "\n") i++;
      value = body.slice(start, i).trim();
    }

    if (name) fields[name] = value.trim();
  }
  return fields;
}

function formatAuthors(authorStr) {
  if (!authorStr) return "";
  return authorStr.split(/\s+and\s+/i).map((a) => a.trim()).join(", ");
}

function formatMeta(entry) {
  const { type, booktitle, journal, volume, number, pages, publisher } = entry;
  const p = pages ? pages.replace("--", "\u2013") : "";
  if (type === "article") {
    let meta = journal || "";
    if (volume) meta += `, ${volume}`;
    if (number) meta += `(${number})`;
    if (p) meta += `, ${p}`;
    return meta;
  } else {
    let meta = booktitle || "";
    if (p) meta += `, ${p}`;
    if (publisher) meta += `. ${publisher}`;
    return meta;
  }
}

function renderEntry(entry) {
  const { title, author, pdf, url, video, slides } = entry;
  const meta = formatMeta(entry);
  const authors = formatAuthors(author);

  const linkItems = [];
  const paperUrl = pdf || url;
  if (paperUrl) {
    linkItems.push(
      `<a class="icon-link" href="${paperUrl}" target="_blank" rel="noopener noreferrer">` +
      `<span class="material-symbols-outlined icon" aria-hidden="true">draft</span>` +
      `<span>Paper</span></a>`
    );
  }
  if (video) {
    linkItems.push(
      `<a class="icon-link" href="${video}" target="_blank" rel="noopener noreferrer">` +
      `<span class="material-symbols-outlined icon" aria-hidden="true">video_library</span>` +
      `<span>Video</span></a>`
    );
  }
  if (slides) {
    linkItems.push(
      `<a class="icon-link" href="${slides}" target="_blank" rel="noopener noreferrer">` +
      `<span class="material-symbols-outlined icon" aria-hidden="true">co_present</span>` +
      `<span>Presentation</span></a>`
    );
  }

  const sep = `<span class="pub-separator">/</span>`;
  const linksHtml = linkItems.join(sep);

  return (
    `<li class="pub-item">` +
    `<p class="pub-title"><strong>${title}</strong></p>` +
    `<p class="pub-meta">${meta}<br>${authors}</p>` +
    (linksHtml ? `<p class="pub-links">${linksHtml}</p>` : "") +
    `</li>`
  );
}
