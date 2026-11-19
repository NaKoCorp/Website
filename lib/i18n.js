// French punctuation rule: a no-break space (U+00A0) precedes : ; ? !
export const labels = {
  en: {
    home: "Home",
    blog: "Blog",
    navSections: "Sections",
    navHow: "How it works",
    navTransparency: "Transparency",
    navSecurity: "Security",
    navNode: "Run a node",
    navRoadmap: "Roadmap",
    minRead: "min read",
    updatedOn: "Updated",
    themeToggle: "Toggle theme",
    themeLight: "Light theme",
    themeDark: "Dark theme",
    readIn: "Read in French",
    prototypeTitle: "Barking is a prototype.",
    prototypeBody:
      "It has not been externally audited, relays can observe client IP addresses, and there is no public relay network yet. Do not rely on it for sensitive communications.",
    ctaStar: "Star Barking on GitHub",
    ctaRelay: "Run a relay",
    ctaSponsor: "Sponsor NakoCorp",
    previous: "Previous",
    next: "Next",
    frenchMark: "Made in France",
    blogTitle: "NakoCorp blog",
    blogDescription:
      "Technical notes on Barking, the end-to-end encrypted messenger with no phone number and no central server.",
    feedTitle: "NakoCorp blog (Atom feed)",
    rssTitle: "NakoCorp blog (RSS feed)",
    footerCopy: "© 2026 NakoCorp. Barking is free software under AGPL-3.0.",
    ctaTitle: "Help Barking get there",
    ctaBody: "Barking is open source and built in the open. Three ways to help:",
    noPosts: "No articles yet.",
    latest: "Latest article",
    readArticle: "Read the article",
    moreArticles: "More articles",
    onThisPage: "On this page",
    readingProgress: "Reading progress",
    articlesIn: "articles in English and French",
    articleIn: "article in English and French",
    privacy: "Privacy",
    privacyUrl: "/en/privacy/",
    support: "Support",
    supportUrl: "/en/support/",
  },
  fr: {
    home: "Accueil",
    blog: "Blog",
    navSections: "Sections",
    navHow: "Fonctionnement",
    navTransparency: "Transparence",
    navSecurity: "Sécurité",
    navNode: "Lancer un nœud",
    navRoadmap: "Feuille de route",
    minRead: "min de lecture",
    updatedOn: "Mis à jour le",
    themeToggle: "Changer de thème",
    themeLight: "Thème clair",
    themeDark: "Thème sombre",
    readIn: "Lire en anglais",
    prototypeTitle: "Barking est un prototype.",
    prototypeBody:
      "Il n’a pas fait l’objet d’un audit externe, les relais peuvent observer les adresses IP des clients et il n’existe pas encore de réseau public de relais. Ne vous y fiez pas pour des communications sensibles.",
    ctaStar: "Mettre une étoile sur GitHub",
    ctaRelay: "Lancer un relais",
    ctaSponsor: "Soutenir NakoCorp",
    previous: "Précédent",
    next: "Suivant",
    frenchMark: "Projet français",
    blogTitle: "Blog NakoCorp",
    blogDescription:
      "Notes techniques sur Barking, la messagerie chiffrée de bout en bout sans numéro de téléphone ni serveur central.",
    feedTitle: "Blog NakoCorp (flux Atom)",
    rssTitle: "Blog NakoCorp (flux RSS)",
    footerCopy: "© 2026 NakoCorp. Barking est un logiciel libre sous AGPL-3.0.",
    ctaTitle: "Aider Barking à avancer",
    ctaBody: "Barking est open source et se construit en public. Trois façons d’aider\u00a0:",
    noPosts: "Aucun article pour l’instant.",
    latest: "Dernier article",
    readArticle: "Lire l’article",
    moreArticles: "Autres articles",
    onThisPage: "Sur cette page",
    readingProgress: "Progression de la lecture",
    articlesIn: "articles en anglais et en français",
    articleIn: "article en anglais et en français",
    privacy: "Confidentialité",
    privacyUrl: "/fr/confidentialite/",
    support: "Assistance",
    supportUrl: "/fr/support/",
  },
};

const LOCALES = { en: "en-US", fr: "fr-FR" };

export function formatDate(date, lang) {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const WORDS_PER_MINUTE = 230;

export function readingTime(text) {
  const words = text.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
