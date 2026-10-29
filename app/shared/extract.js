// Injecté à la demande (clic utilisateur) dans la page d'offre. Ne modifie rien dans la page.
(() => {
  const clean = (s) => (s || "").replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const firstLine = (s) => clean(s).split("\n")[0].trim();

  /* Certains sites (France Travail) affichent l'offre dans un composant à « shadow DOM » :
     on cherche aussi dans ces racines ouvertes, le document d'abord. */
  let shadowRoots;
  function roots() {
    if (shadowRoots) return shadowRoots;
    shadowRoots = [document];
    for (let i = 0; i < shadowRoots.length && i < 50; i++) {
      for (const el of shadowRoots[i].querySelectorAll("*")) if (el.shadowRoot) shadowRoots.push(el.shadowRoot);
    }
    return shadowRoots;
  }
  const query = (sel) => {
    for (const root of roots()) { const el = root.querySelector(sel); if (el) return el; }
    return null;
  };

  function fromJsonLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent);
        const items = Array.isArray(data) ? data : data["@graph"] || [data];
        const job = items.find((i) => i && (i["@type"] === "JobPosting" || (Array.isArray(i["@type"]) && i["@type"].includes("JobPosting"))));
        if (job) {
          const tmp = document.createElement("template");
          /* Retour à la ligne après chaque bloc, sinon les titres se collent au texte (« Les missions du posteVous… »). */
          const toText = (html) => {
            tmp.innerHTML = String(html || "").replace(/<br\s*\/?>|<\/(?:p|li|h[1-6]|div|ul|ol|tr)>/gi, "$&\n").replace(/<li\b[^>]*>/gi, "$&- ");
            return tmp.content.textContent;
          };
          let raw = toText(job.description);
          /* LinkedIn encode la description deux fois : après une lecture, il reste des balises en clair. */
          if (/<\/?(?:br|p|li|ul|strong|div|b|em)\b[^>]*>/i.test(raw)) raw = toText(raw);
          const loc = Array.isArray(job.jobLocation) ? job.jobLocation[0] : job.jobLocation;
          const text = clean(raw);
          if (text.length > 150) {
            /* Informations structurées de l'annonce (schema.org JobPosting) : contrat, lieu, salaire, attentes. */
            const kinds = { FULL_TIME: "temps plein", PART_TIME: "temps partiel", CONTRACTOR: "indépendant", TEMPORARY: "CDD ou intérim", INTERN: "stage", VOLUNTEER: "bénévolat", PER_DIEM: "à la journée" };
            const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
            const degrees = { "high school": "baccalauréat", "associate degree": "bac+2", "bachelor degree": "bac+3", "postgraduate degree": "bac+5", "professional certificate": "certificat ou titre professionnel" };
            const plain = (v) => { const t = typeof v === "string" ? v : v?.name || v?.credentialCategory || ""; return degrees[t.toLowerCase()] || t; };
            const salary = job.baseSalary?.value || {};
            const money = salary.minValue || salary.maxValue || salary.value ? [salary.minValue || salary.value, salary.maxValue].filter(Boolean).join(" à ") + " " + (job.baseSalary.currency || "") + (salary.unitText ? " par " + ({ YEAR: "an", MONTH: "mois", HOUR: "heure", DAY: "jour", WEEK: "semaine" }[salary.unitText] || salary.unitText) : "") : "";
            const facts = [
              list(job.employmentType).map((k) => kinds[k] || k).join(", ") && "Type de poste : " + list(job.employmentType).map((k) => kinds[k] || k).join(", "),
              [loc?.address?.addressLocality, loc?.address?.postalCode].filter(Boolean).join(" ") && "Lieu : " + [loc?.address?.addressLocality, loc?.address?.postalCode].filter(Boolean).join(" "),
              money && "Salaire : " + money.trim(),
              plain(job.experienceRequirements) && "Expérience demandée : " + clean(plain(job.experienceRequirements)),
              list(job.educationRequirements).map(plain).filter(Boolean).join(", ") && "Formation demandée : " + list(job.educationRequirements).map(plain).filter(Boolean).join(", "),
              list(job.skills).map(plain).filter(Boolean).join(", ") && "Compétences listées : " + list(job.skills).map(plain).filter(Boolean).join(", ")
            ].filter(Boolean);
            return {
              title: job.title || "",
              company: job.hiringOrganization?.name || "",
              location: loc?.address?.addressLocality || "",
              text: facts.length ? facts.join("\n") + "\n\n" + text : text,
              source: "jsonld"
            };
          }
        }
      } catch (_) {}
    }
    return null;
  }

  const SITES = {
    "indeed.com": {
      title: ["[data-testid='vj-job-title']", "h1.jobsearch-JobInfoHeader-title", "[data-testid='jobsearch-JobInfoHeader-title']", "h1"],
      company: ["[data-testid='inlineHeader-companyName']", "[data-testid='company-info-metadata']", "[data-company-name]", ".jobsearch-InlineCompanyRating div"],
      location: ["[data-testid='inlineHeader-companyLocation']", "[data-testid='job-location']"],
      body: ["#jobDescriptionText", "[data-testid='viewjob-job-content']", ".jobsearch-JobComponent-description"]
    },
    "linkedin.com": {
      title: [".job-details-jobs-unified-top-card__job-title h1", ".top-card-layout__title", "h1.t-24", "h1"],
      company: [".job-details-jobs-unified-top-card__company-name a", ".job-details-jobs-unified-top-card__company-name", ".topcard__org-name-link", ".top-card-layout__second-subline a", ".top-card-layout__card .topcard__flavor:not(.topcard__flavor--bullet)"],
      location: [".topcard__flavor--bullet"],
      body: ["#job-details", ".jobs-description__content", ".jobs-box__html-content", ".show-more-less-html__markup", ".description__text"]
    },
    "welcometothejungle.com": {
      title: ["[data-testid='job-metadata-block'] h1", "h1"],
      company: ["[data-testid='job-metadata-block'] a[href*='/companies/']", "header a[href*='/companies/']"],
      location: [],
      body: ["[data-testid='job-section-description']", "section[data-testid*='description']", "main section"]
    },
    "hellowork.com": {
      title: ["h1"],
      company: ["[data-cy='companyName']", "h1 + div a", ".tw-text-primary a"],
      location: [],
      body: ["[data-cy='jobDescription']", "section#offer-details", "section[data-cy='offerDescription']", "main"]
    },
    "francetravail.fr": {
      title: [".offer-detail-title", "h1[itemprop='title']", "h1:not(.modal-title)"],
      company: [".offer-detail-company", "[itemprop='hiringOrganization']", ".company-name"],
      location: [],
      body: [".offer-detail-description", "[itemprop='description']", "#detailOffreVolet .description"]
    },
    "apec.fr": {
      title: ["apec-poste-informations h1", ".card-offer__title", "h1"],
      company: [".card-offer__company"],
      location: [],
      body: ["apec-poste-informations", ".details-offer", ".details-post", "main"]
    },
    "jobteaser.com": {
      title: ["[data-testid='jobad-DetailView__Heading__title']", "[data-testid='jobad-title']", "h1"],
      company: ["[data-testid='jobad-DetailView__Heading__company_name']", "[data-testid='company-name']", "header a[href*='/companies/']"],
      location: ["[data-testid='jobad-DetailView__CandidacyDetails__Locations']"],
      body: ["[data-testid='jobad-DetailView__Description']", "[data-testid='jobad-description']", "main article", "main"]
    }
  };

  const pick = (sels) => {
    for (const sel of sels || []) {
      const t = firstLine(query(sel)?.innerText);
      if (t) return t.slice(0, 200);
    }
    return "";
  };

  function fromSelectors() {
    const host = location.hostname;
    const key = Object.keys(SITES).find((k) => host === k || host.endsWith("." + k));
    if (!key) return null;
    const S = SITES[key];
    const detailPage = /\/emplois\/|\/viewjob\b|\/jobs\/view\/|\/companies\/[^/]+\/jobs\/|\/offres\/recherche\/detail\/|detail-offre|\/(?:job-offers|jobad|offers)\/|[?&](?:jk|vjk|currentJobId)=/i.test(location.pathname + location.search);
    for (const sel of S.body) {
      /* Les conteneurs génériques ne servent que sur une page d'offre identifiée. */
      if (["main", "main section", "main article"].includes(sel) && !detailPage) continue;
      const text = clean(query(sel)?.innerText);
      if (text && text.length > 200) {
        return { title: pick(S.title), company: pick(S.company), location: pick(S.location), text, source: "selector:" + sel };
      }
    }
    return null;
  }

  const r = fromJsonLd() || fromSelectors();
  if (!r) return null;
  return {
    ...r,
    title: r.title || document.title.split(/[|–-]/)[0].trim(),
    url: location.href,
    host: location.hostname.replace(/^www\./, ""),
    text: r.text.slice(0, 12000)
  };
})();
