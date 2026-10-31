// Builds dist/coach-<id>.html for every coach in coaches.json. The header, footer, icons and
// the coach's slide are copied from dist/index.html so the profile pages always match the home page.
// Render runs this on every deploy; run it locally with `npm run build`.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const home = read('dist/index.html');
const data = JSON.parse(read('coaches.json'));

const between = (html, start, end) => {
  const from = html.indexOf(start);
  const to = from < 0 ? -1 : html.indexOf(end, from);
  if (to < 0) throw new Error(`index.html is missing ${start}…${end}`);
  return html.slice(from, to + end.length);
};
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const toHome = (html) => html
  .replace(/href="#home"/g, 'href="index.html"')
  .replace(/href="#(trainers|products|membership|programs|visit|contact)"/g, 'href="index.html#$1"');
const markTrainersActive = (html) => html
  .replace(' class="is-active"', '')
  .replace('href="index.html#trainers">', 'href="index.html#trainers" class="is-active">');

const head = home.slice(0, home.indexOf('<body>')).replace(/\s*<link rel="preload"[^>]*fitlife-mural[^>]*>/g, '');
const sprite = between(home, '<svg class="sprite"', '</svg>');
const header = markTrainersActive(toHome(between(home, '<header class="site-header">', '</header>')));
const menu = toHome(between(home, '<nav class="menu-panel"', '</nav>'));
const cta = toHome(between(home, '<section class="cta"', '</section>'));
const footer = markTrainersActive(toHome(between(home, '<footer class="footer">', '</footer>')));
const dialog = between(home, '<dialog', '</dialog>');

const whatsapp = (text) => `https://wa.me/971567704523?text=${encodeURIComponent(text)}`;

for (const coach of data.coaches) {
  const slideMatch = home.match(new RegExp(`<article class="trainer-slide[^"]*"[^>]*data-coach="${coach.id}"[^>]*>[\\s\\S]*?</article>`));
  if (!slideMatch) throw new Error(`index.html has no trainer slide for "${coach.id}"`);
  const slide = slideMatch[0]
    .replace(/<article class="trainer-slide[^"]*"[^>]*>/, (tag) => tag
      .replace(/class="trainer-slide[^"]*"/, 'class="trainer-slide is-active"')
      .replace(/ aria-roledescription="slide"| data-href="[^"]*"/g, '')
      .replace(/aria-label="[^"]*"/, `aria-label="${escape(coach.role)}"`));

  const display = coach.name || coach.role;
  const others = data.coaches.filter((other) => other.id !== coach.id);
  const statsEmpty = coach.stats.every((stat) => !stat.value);
  const title = `${display} — FitLife Fitness`;
  const description = `${coach.role} at FitLife Fitness, Al Bustan, Ajman: ${coach.specialties.join(', ')}.`;

  const pageHead = head
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escape(description)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escape(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escape(description)}">`);

  const body = `<body class="coach-page">
  <a class="skip-link" href="#main">Skip to content</a>
  ${sprite}
  ${header}
  ${menu}
  <main id="main">
    <section class="trainers is-page" aria-labelledby="coach-crumb">
      <div class="container trainers-head">
        <nav class="coach-crumbs" aria-label="Breadcrumb"><a href="index.html#trainers">Our trainers</a><span aria-hidden="true">/</span><span id="coach-crumb" aria-current="page">${escape(coach.role)}</span></nav>
        <a class="trainer-profile is-back" href="index.html#trainers"><svg aria-hidden="true"><use href="#i-arrow"/></svg>All trainers</a>
      </div>
      <div class="trainer-stage">
        <div class="trainer-shape" aria-hidden="true"></div>
        ${slide}
        <div class="trainer-cut" aria-hidden="true"></div>
      </div>
    </section>
${data.preview ? `
    <div class="container coach-notice"><p><strong>Preview profile.</strong> The coach's name and results will be added soon.</p></div>
` : ''}
    <section class="coach-intro" aria-labelledby="coach-name">
      <div class="container coach-intro-grid">
        <div>
          <p class="section-label">Meet your coach</p>
          <h1 class="coach-name" id="coach-name">${escape(display)}</h1>
          ${coach.name ? `<p class="coach-role">${escape(coach.role)}</p>` : ''}
          <p class="coach-place">FitLife Fitness · Al Bustan, Ajman</p>
          <ul class="coach-skills">${coach.specialties.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>
        </div>
        <div class="coach-bio">
          ${coach.bio.map((paragraph) => `<p>${escape(paragraph)}</p>`).join('\n          ')}
          <div class="coach-actions">
            <button class="btn btn-red" data-join data-goal="${escape(coach.goal)}">Book a session <span aria-hidden="true">+</span></button>
            <a class="btn btn-dark" href="${escape(whatsapp(`Hello FitLife Fitness! I would like to book a session with the ${coach.role.toLowerCase()}.`))}" target="_blank" rel="noopener noreferrer"><svg aria-hidden="true"><use href="#i-whatsapp"/></svg>Chat on WhatsApp</a>
          </div>
        </div>
      </div>
    </section>

    <section class="coach-results texture" aria-labelledby="coach-results-title">
      <div class="container">
        <div class="coach-head"><p class="section-label light">Coach results</p><h2 id="coach-results-title">Experience &amp; achievements</h2></div>
        <ul class="coach-stats">${coach.stats.map((stat) => `<li><strong${stat.value ? '' : ' class="is-empty"'}>${escape(stat.value || '—')}</strong><span>${escape(stat.label)}</span></li>`).join('')}</ul>
        ${statsEmpty ? '<p class="coach-soon">Details coming soon.</p>' : ''}
      </div>
    </section>

    <section class="coach-work" aria-labelledby="coach-work-title">
      <div class="container">
        <div class="coach-head"><p class="section-label">How sessions work</p><h2 id="coach-work-title">Your plan, step by step</h2></div>
        <ol class="coach-steps">${data.steps.map((step, i) => `<li><span class="coach-step-no">${String(i + 1).padStart(2, '0')}</span><svg aria-hidden="true"><use href="#${step.icon}"/></svg><h3>${escape(step.title)}</h3><p>${escape(step.text)}</p></li>`).join('')}</ol>
      </div>
    </section>

    <section class="coach-members" aria-labelledby="coach-members-title">
      <div class="container">
        <div class="coach-head"><p class="section-label">Member results</p><h2 id="coach-members-title">Progress with the ${escape(coach.role.toLowerCase())}</h2></div>
        <ul class="member-cards">${coach.memberResults.map((member) => `<li class="member-card">
          <div class="member-media" aria-hidden="true"><span class="member-half"><svg><use href="#${coach.figure}"/></svg><em>Before</em></span><span class="member-half is-after"><svg><use href="#${coach.figure}"/></svg><em>After</em></span></div>
          <h3>${escape(member.title || 'Member story')}</h3>
          <p class="member-result">${escape(member.result || 'Result coming soon')}</p>
          <p class="member-story">${escape(member.story || 'Photos and the member’s story will be shared here with their permission.')}</p>
        </li>`).join('')}</ul>
      </div>
    </section>

    <section class="coach-more" aria-labelledby="coach-more-title">
      <div class="container">
        <div class="coach-head"><p class="section-label">More trainers</p><h2 id="coach-more-title">Meet the team</h2></div>
        <ul class="more-cards">${others.map((other) => `<li><a class="more-card" href="coach-${other.id}.html">
          <span class="more-art" aria-hidden="true"><span class="more-word">${escape(other.word)}</span>${other.photo ? `<img class="more-figure" src="${escape(other.photo)}" alt="" width="1024" height="1536" loading="lazy" style="object-fit:contain">` : `<svg class="more-figure"><use href="#${other.figure}"/></svg>`}</span>
          <span class="more-role">${escape(other.name || other.role)}</span>
          <span class="more-link">View profile <svg aria-hidden="true"><use href="#i-arrow"/></svg></span>
        </a></li>`).join('')}</ul>
      </div>
    </section>

    ${cta}
  </main>

  ${footer}

  ${dialog}
</body>
</html>
`;
  writeFileSync(new URL(`dist/coach-${coach.id}.html`, root), `${pageHead}${body}`.replace(/[ \t]+$/gm, ''));
  console.log(`dist/coach-${coach.id}.html`);
}
