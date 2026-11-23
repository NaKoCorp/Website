(function () {
  // French strings. English lives in the HTML and is captured at load time.
  var fr = {
    meta_title: "Barking : la messagerie qui fonctionne sans internet",
    nav_how: "Fonctionnement",
    nav_transparency: "Transparence",
    nav_security: "Sécurité",
    nav_node: "Lancer un nœud",
    nav_roadmap: "Feuille de route",
    nav_blog: "Blog",
    french_mark: "Projet français",
    theme_dark: "Thème sombre",

    hero_pill: "Open source · AGPL-3.0 · prototype en cours",
    hero_h1: "Vos messages passent. <em>Même quand internet ne passe plus.</em>",
    hero_p: "Barking est une messagerie chiffrée de bout en bout, sans numéro de téléphone ni serveur central. Aujourd'hui, les messages traversent internet par des relais que chacun peut lancer, ou voyagent dans un fichier que vous transportez. Ensuite, les téléphones se les passeront par Bluetooth, Wi-Fi et LoRa.",
    hero_cta_primary: "Voir comment ça marche",
    hero_cta_secondary: "★ Star sur GitHub",
    hero_fact1: "Chiffré de bout en bout",
    hero_fact2: "Échange de clés post-quantique",
    hero_fact3: "Écrit en Rust",
    hero_fact4: "Builds reproductibles",
    chip1_t: "Chiffré de bout en bout",
    chip1_s: "hybride X25519 + ML-KEM-768",
    chip2_t: "Relais LoRa",
    chip2_s: "prévu · 12 km, sans internet",
    chip3_t: "Livré",
    chip3_s: "4 copies en transit effacées",
    ui_verified: "vérifié · code de sécurité confirmé",
    ui_banner: "Pas d'internet. Mode mesh (prévu) : les messages passent de téléphone en téléphone.",
    ui_msg1: "Plus de courant dans tout le quartier. Ça va chez vous ?",
    ui_msg2: "Tout va bien ! On va au gymnase de l'école.",
    ui_msg3: "On se retrouve là-bas 🙌",
    ui_msg4: "J'apporte de l'eau et la radio.",
    ui_queued: "⏳ en attente, part dès qu'un voisin est à portée",
    ui_composer: "Message",

    why_eyebrow: "// pourquoi barking",
    why_h2: "Une messagerie qui ne dépend de l'infrastructure de personne.",
    why_p: "Les messageries actuelles s'arrêtent quand une antenne tombe, qu'un pays coupe internet ou qu'une entreprise éteint un serveur. Barking est pensée pour discuter au quotidien, et pour le jour où cela arrive.",
    p1_t: "Confidentielle",
    p1_p: "Chiffrement de bout en bout, expéditeur caché et métadonnées minimales. Votre identité est une clé, pas un numéro de téléphone.",
    p2_t: "Résiliente",
    p2_p: "Relais internet aujourd'hui, ou un fichier de paquets transporté à la main ; Bluetooth, Wi-Fi et LoRa sont prévus. Les messages attendent en sécurité qu'une route apparaisse.",
    p3_t: "Décentralisée",
    p3_p: "Aucun serveur central à saisir, censurer ou éteindre. N'importe qui peut lancer un relais avec un seul binaire.",
    p4_t: "Transparente",
    p4_p: "Code ouvert, protocole publié, et une app qui montre le trajet de chaque message et ce que chaque intermédiaire a pu voir.",
    p5_t: "Simple",
    p5_p: "Vous envoyez un message, c'est tout. La complexité reste sous le capot, sauf si vous voulez regarder.",
    cmp_h1: "Messageries grand public",
    cmp_r1: "Fonctionne sans internet",
    cmp_r2: "Inscription sans numéro de téléphone",
    cmp_r3: "Aucun serveur central",
    cmp_r4: "Les serveurs ignorent qui écrit à qui",
    cmp_r5: "Client et serveur open source",
    cmp_r6: "Binaires reproductibles et attestés",
    cmp_yes: "Oui",
    cmp_no: "Non",
    cmp_rarely: "Rarement",
    cmp_varies: "Variable",
    cmp_partly: "En partie",
    cmp_r4_note: "les relais voient les IP",
    cmp_roadmap: "en préparation",

    how_eyebrow: "// fonctionnement",
    how_h2: "Un message, toutes les routes.",
    how_p: "Prévu : les téléphones et de petites bornes fixes forment un mesh, et dès que l'un d'eux trouve internet, il devient une passerelle vers le réseau ouvert de relais. Le même format de paquet chiffré sert déjà à tous les transports : aujourd'hui il passe par les relais ou par un fichier, et l'app choisira la meilleure route disponible.",
    scroll_hint: "← faites défiler le schéma →",
    mz_a: "QUARTIER · SANS INTERNET",
    mz_b: "VILLAGE · À 12 KM",
    mz_c: "RÉSEAU DE RELAIS · INTERNET",
    m_fetch: "relève",
    m_sends: "envoie",
    m_neighbor: "voisin",
    m_roof: "borne sur le toit",
    m_gateway: "passerelle",
    m_gateway_s: "trouve internet",
    m_ring1: "boîte 9f3a…",
    m_ring2: "gardée sur 3 nœuds",
    m_dht: "DHT S/Kademlia",
    m_bob: "déchiffre",
    m_legend_store: "relais qui gardent le paquet",
    t_ble: "Prévu : découvrira les téléphones proches et transportera texte, accusés de réception et signalisation, de saut en saut.",
    t_wifi: "Prévu : prendra le relais pour les photos, vidéos et synchronisations lourdes, sans aucun routeur.",
    t_lora: "Prévu : radio longue portée pour les textes courts et les alertes, pour relier deux mesh à des kilomètres l'un de l'autre.",
    t_net_t: "Internet",
    t_net_r: "mondial",
    t_net: "Un réseau ouvert de relais en QUIC. Chaque paquet est copié sur plusieurs nœuds : aucun n'est indispensable.",

    j_eyebrow: "// la vie d'un message",
    j_h2: "De votre pouce à leur écran, étape par étape.",
    j_p: "Chaque intermédiaire manipule une enveloppe scellée. Aucun ne peut l'ouvrir ni la falsifier, et l'enveloppe ne nomme pas son expéditeur.",
    j1_t: "Chiffré sur votre téléphone",
    j1_p: "Le message, et votre identité d'expéditeur, sont scellés pour chacun des appareils de votre contact avant de quitter le vôtre.",
    j2_t: "En file, jamais perdu",
    j2_p: "Le paquet attend dans une file locale chiffrée. Un crash, un redémarrage ou une zone blanche ne le perdent pas : il part à la prochaine occasion.",
    j3_t: "De saut en saut dans le mesh (prévu)",
    j3_p: "Les appareils proches le transmettront : l'en-tête du paquet porte déjà un nombre de sauts limité et une date d'expiration. Les doublons seront écartés, et les voisins n'échangeront que ce qui manque à l'autre.",
    j4_t: "Stocké sur plusieurs relais",
    j4_p: "Votre appareil le confie au réseau de relais (plus tard, une passerelle du mesh le pourra aussi). Il est copié sur les nœuds responsables d'une boîte aux lettres qui change chaque jour, et gardé 7 jours par défaut.",
    j5_t: "Relevé et ouvert",
    j5_p: "L'appareil de votre contact relève ses boîtes (ou est réveillé sur iOS), télécharge le paquet depuis n'importe quel relais et le déchiffre. Lui seul le peut.",
    j6_t: "L'accusé efface les copies",
    j6_p: "Le destinataire révèle un secret que lui seul connaissait. Chaque relais qui garde une copie peut le vérifier et supprimer le paquet, et les téléphones du mesh le pourront aussi.",
    r_eyebrow: "// accusés par secret révélé",
    r_h3: "Livré une fois, supprimé partout.",
    r_p: "L'identifiant d'un paquet est le hash d'un secret scellé à l'intérieur. Pour accuser réception, le destinataire publie ce secret. N'importe quel relais peut le vérifier, sans apprendre qui l'a envoyé, et supprime sa copie. Une fois le mesh en place, un message déjà livré par le mesh ne partira pas sur internet ensuite.",
    rc_reveals: "révèle",
    rc_secret: "secret",
    rc_h1: "nœud relais A",
    rc_h2: "nœud relais B",
    rc_h3: "borne sur le toit",
    rc_h4: "téléphone voisin",
    rc_del: "✓ copie supprimée",
    rc_check: "chacun vérifie : hash(secret) = identifiant du paquet",

    tr_eyebrow: "// vue transparence",
    tr_h2: "Voyez où est passé votre message, et qui a vu quoi.",
    tr_p: "La plupart des apps vous demandent de leur faire confiance. Barking vous montre. Touchez un message pour voir son trajet et exactement ce que chaque intermédiaire a pu observer. Ce journal est construit sur votre appareil et ne le quitte jamais.",
    tr_c1: "<strong>Le trajet :</strong> transport, nœuds relais et statut (En attente, Sur le réseau, Reçu, Non distribué).",
    tr_c2: "<strong>Qui a vu quoi :</strong> « ce voisin a vu passer un paquet chiffré de 1 024 octets, sans savoir qui vous êtes ».",
    tr_c3: "<strong>Vos contacts :</strong> leur clé, leurs appareils liés, l'état de vérification et où sont stockées les données chiffrées.",
    ui_details: "Détails du message",
    ui_details_sub: "« Tout va bien ! On va au… »",
    ui_path: "Trajet · 4 sauts · 42 min",
    ui_s1: "Votre téléphone",
    ui_s1s: "Chiffré et mis en file · 18:04:02",
    ui_s2: "Téléphone voisin",
    ui_s2w: "A vu <b>un paquet chiffré de 1 024 octets</b>. Pas qui vous êtes.",
    ui_s3: "Borne sur le toit",
    ui_s3w: "A vu <b>une boîte aux lettres</b> qui change chaque jour.",
    ui_s4: "3 nœuds relais",
    ui_s4s: "Internet · stocké 41 min",
    ui_s4w: "A vu <b>l'IP de la passerelle</b> pendant la connexion. Ni contenu, ni expéditeur.",
    ui_s5: "Livré à Maya",
    ui_s5s: "18:46 · 4 copies effacées",
    concept_note: "Les écrans de l'app sont des maquettes : les applications mobiles sont en développement.",

    sec_eyebrow: "// modèle de sécurité",
    sec_h2: "Ne faire confiance à aucun nœud. Pas même aux nôtres.",
    sec_p: "Dans un réseau ouvert, impossible de savoir quel code tourne sur le relais d'un inconnu. Barking est donc conçue pour qu'un nœud malveillant ne puisse ni lire, ni falsifier, ni faire disparaître discrètement vos messages.",
    on_1: "Lien entre voisins",
    on_1s: "prévu pour le mesh · BLE / Wi-Fi",
    on_2: "Paquet universel",
    on_2s: "ce que voient les relais",
    on_h1: "version",
    on_h2: "sauts restants",
    on_h3: "id du paquet",
    on_h4: "expiration",
    on_h5: "boîte du jour",
    on_h6: "remplissage par paliers",
    on_3: "Chiffrement de bout en bout",
    on_3s: "seuls les appareils du destinataire",
    on_c1: "identité de l'expéditeur",
    on_c2: "message",
    on_c3: "secret d'accusé",
    on_c4: "liste d'appareils",
    on_p: "Trois couches imbriquées. Le lien entre voisins arrivera avec le mesh ; les relais ne voient qu'une enveloppe scellée avec une adresse temporaire, et seul votre contact détient les clés de l'intérieur.",
    th1_q: "Lire un message",
    th1_a: "Impossible : chiffrement de bout en bout, les relais n'ont aucune clé.",
    th2_q: "Falsifier ou rejouer un message",
    th2_a: "Rejeté : chiffrement authentifié, listes d'appareils signées, identifiants déjà vus et expiration.",
    th3_q: "Simuler une livraison",
    th3_a: "Impossible : seul le vrai destinataire connaît le secret de l'accusé.",
    th4_q: "Supprimer ou retenir des messages",
    th4_a: "Copies sur plusieurs nœuds, accusés de bout en bout, renvoi ailleurs et score de fiabilité local par nœud.",
    th5_q: "Savoir qui parle à qui",
    th5_a: "Expéditeur caché, boîtes aux lettres renouvelées chaque jour et tailles par paliers. Un relais responsable voit tout de même les adresses IP qui déposent et qui relèvent, et peut les relier.",
    th6_q: "Vous isoler ou spammer le réseau",
    th6_a: "Défenses S/Kademlia, preuve de travail pour les identifiants de nœud et les dépôts, limites de débit.",
    libs_lbl: "Aucune crypto maison. Uniquement des bibliothèques open source reconnues :",

    id_root: "clé racine",
    id_phrase: "sauvegardée en 24 mots",
    id_signs: "signe",
    id_d1: "téléphone",
    id_d2: "ordinateur",
    id_d3: "téléphone volé",
    id_dk: "sa propre clé",
    id_dc: "+ certificat",
    id_rev: "révoqué en un geste",
    id_rev2: "rien d'autre de perdu",
    id_list: "liste d'appareils signée · envoyée de bout en bout à vos contacts",
    id_eyebrow: "// identité",
    id_h2: "Vous êtes une clé, pas un numéro de téléphone.",
    id_p: "Votre compte est une clé cryptographique créée sur votre appareil. Pas de numéro, pas d'e-mail, pas de serveur d'inscription qui pourrait faire fuiter votre carnet d'adresses.",
    if1_t: "Jusqu'à 8 appareils",
    if1_p: "Chaque appareil a sa propre clé, certifiée par votre clé racine. Votre historique suit, chiffré.",
    if2_t: "Codes de sécurité",
    if2_p: "Comparez un code en personne pour vérifier un contact. Vous êtes alerté si sa clé change.",
    if3_t: "Récupérable",
    if3_p: "Une phrase de 24 mots, gardée hors ligne, restaure votre identité sans dépendre d'aucun fournisseur.",
    if4_t: "Chiffré sur l'appareil",
    if4_p: "Contacts et historique sont dans une base SQLCipher chiffrée, sur votre appareil.",

    node_eyebrow: "// lancer un nœud",
    node_h2: "Le réseau, ce sont celles et ceux qui le font tourner.",
    node_p: "Un relais, c'est un binaire statique avec sa base de données intégrée. Lancez-le sur un VPS, un serveur maison ou un Raspberry Pi : sans inscription, sans autorisation. Chaque nouveau nœud rend le réseau plus difficile à couper.",
    nf1_t: "Aveugle par conception",
    nf1_p: "Votre nœud stocke des paquets chiffrés pour des boîtes aux lettres temporaires. Il ne peut pas les lire, et n'écrit jamais l'adresse IP d'un client sur disque ni dans ses journaux.",
    nf2_t: "Léger",
    nf2_p: "SQLite intégré, aucun service externe, plafonds de stockage, de connexions et de bande passante. Réglages Raspberry Pi fournis.",
    nf3_t: "Auto-organisé",
    nf3_p: "Les nœuds se trouvent par S/Kademlia et répliquent les paquets vers les autres nœuds responsables.",
    nf4_t: "Vérifiable",
    nf4_p: "Builds reproductibles et attestations de build GitHub, produites automatiquement par la CI : vérifiez que le binaire correspond au code.",

    rm_eyebrow: "// feuille de route",
    rm_h2: "Construit en public, une couche après l'autre.",
    rm_p: "Le cœur du protocole, le client en ligne de commande et le réseau de relais fonctionnent déjà. Les apps mobiles et le mesh radio arrivent ensuite.",
    ph1_tag: "✓ fonctionne aujourd'hui",
    ph1_t: "Cœur et relais",
    ph1_1: "Messagerie 1:1 chiffrée, accusés, historique",
    ph1_2: "Client en ligne de commande",
    ph1_3: "Relais QUIC auto-hébergés",
    ph1_4: "Découverte et réplication S/Kademlia",
    ph1_5: "Multi-appareils, jusqu'à 8",
    ph1_6: "Builds de release reproductibles et attestés",
    ph2_tag: "● ensuite",
    ph2_t: "Apps mobiles",
    ph2_1: "App Android avec vue transparence",
    ph2_2: "App iOS avec réveils en arrière-plan",
    ph2_3: "Relais d'amorçage publics",
    ph3_tag: "○ puis",
    ph3_t: "Le mesh",
    ph3_1: "Bluetooth LE et passerelles mesh",
    ph3_2: "Wi-Fi Aware / Multipeer",
    ph3_3: "Bornes LoRa sur Raspberry Pi, puis modules de poche",
    ph4_tag: "○ plus tard",
    ph4_t: "Groupes, médias, audit",
    ph4_1: "Groupes sans serveur jusqu'à 500",
    ph4_2: "Photos et vidéos, découpées et chiffrées",
    ph4_3: "Audit de sécurité externe",
    rm_warn: "<b>Barking est un prototype et n'a pas encore été audité.</b> Ne vous y fiez pas là où votre sécurité est en jeu. Essayez-le, cassez-le, et dites-nous ce que vous trouvez.",

    cta_eyebrow: "// rejoignez-nous",
    cta_h2: "Construisons une messagerie que personne ne peut éteindre.",
    cta_p: "Barking est un logiciel libre, créé par NakoCorp et ouvert à tous. Chaque star, relais, rapport de bug et pull request compte.",
    cc1_t: "Suivre le projet",
    cc1_p: "Suivez le dépôt pour voir chaque étape vers les apps et le mesh.",
    cc2_t: "Lancer un relais",
    cc2_p: "Un binaire, un petit VPS ou un Raspberry Pi. Rendez le réseau plus solide.",
    cc3_t: "Contribuer",
    cc3_p: "Rust, Swift, Kotlin, radio, relecture crypto, traductions : il y a de la place pour vous.",
    cta_btn: "Ouvrir le dépôt ↗",
    footer_copy: "© 2026 NakoCorp. Barking est un logiciel libre sous AGPL-3.0.",
    footer_privacy: "Confidentialité",
    footer_support: "Assistance"
  };

  var STORAGE_KEY = "nakocorp-lang";
  var nodes = document.querySelectorAll("[data-i18n]");
  nodes.forEach(function (el) { el._en = el.innerHTML; });

  function applyLang(lang) {
    document.documentElement.lang = lang;
    nodes.forEach(function (el) {
      var t = lang === "fr" ? fr[el.getAttribute("data-i18n")] : null;
      el.innerHTML = t || el._en;
    });
    document.querySelectorAll("[data-blog-link]").forEach(function (a) {
      a.setAttribute("href", "/" + lang + "/blog/");
    });
    // Pages whose French URL differs: the English one stays in href.
    document.querySelectorAll("[data-href-fr]").forEach(function (a) {
      if (!a._enHref) a._enHref = a.getAttribute("href");
      a.setAttribute("href", lang === "fr" ? a.getAttribute("data-href-fr") : a._enHref);
    });
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-lang-btn") === lang));
    });
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
    btn.addEventListener("click", function () { applyLang(btn.getAttribute("data-lang-btn")); });
  });

  var saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  if (!saved) saved = (navigator.language || "").toLowerCase().indexOf("fr") === 0 ? "fr" : "en";
  applyLang(saved === "fr" ? "fr" : "en");

  // Reveal on scroll.
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // The SMIL packet animation ignores CSS, so pause it explicitly.
  var mesh = document.getElementById("mesh");
  if (mesh && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches && mesh.pauseAnimations) {
    mesh.pauseAnimations();
  }
})();
