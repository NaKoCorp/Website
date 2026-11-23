---
title: Post-quantique dès le premier jour
description: "Chaque session Barking commence par une poignée de main hybride X25519 + ML-KEM-768. Son fonctionnement, et la liste complète de ce qui reste classique."
date: 2026-11-24
translationKey: post-quantum
tags: [barking, cryptography, post-quantum]
barking: true
draft: false
---
Quelqu’un qui enregistre aujourd’hui votre trafic chiffré n’a pas besoin de le casser aujourd’hui. Il peut le stocker et attendre un ordinateur quantique assez grand pour faire tourner l’algorithme de Shor contre X25519. La menace a un nom : *harvest now, decrypt later* (« enregistrer maintenant, déchiffrer plus tard »).

Pour une messagerie, ce qui est exposé, c’est l’échange de clés. Tout ce qu’une session chiffre dérive du secret convenu à son ouverture. Si une machine future retrouve ce secret à partir d’une poignée de main enregistrée, elle lit toute la conversation. Les signatures sont un autre cas : en forger une plus tard ne change rien à ce qui a déjà été envoyé.

Barking n’avait pas d’utilisateurs à migrer, donc son tout premier format de session s’ouvre par une poignée de main hybride : X25519 et ML-KEM-768, combinés sur le modèle de [PQXDH](https://signal.org/docs/specifications/pqxdh/) de Signal. Cet article montre comment le secret est construit, pourquoi les deux primitives sont gardées, et la liste complète de ce qui reste classique. Cette liste compte plus que le reste.

Chaque valeur ci-dessous vient du dépôt Barking au commit [`07fe55a`](https://github.com/NaKoCorp/Barking/commit/07fe55a99f90981c0d11bee18f75aa2ffb530336), après la version v0.2.0.

## Enregistrer maintenant, déchiffrer plus tard

En une phrase : chaque session Barking part d’un secret qui mélange trois ou quatre échanges X25519 avec un secret partagé ML-KEM-768, si bien qu’un enregistrement fait aujourd’hui reste fermé tant que l’une des deux primitives tient.

Les signatures, le scellement du premier message et la guérison du ratchet restent classiques. La suite de l’article, c’est le détail.

## Pourquoi hybride, et pas ML-KEM seul

ML-KEM, normalisé par le NIST en 2024 sous le nom FIPS 203, est conçu pour résister à un ordinateur quantique. Il est aussi jeune. X25519 a vingt ans d’analyse derrière lui et aucune faiblesse classique connue, mais un grand ordinateur quantique le casserait.

Barking ne choisit pas. Il concatène les sorties X25519 et le secret ML-KEM en une seule entrée pour une seule dérivation HKDF. Pour retrouver la clé de session, un attaquant doit retrouver chaque morceau de cette entrée : casser X25519 *et* ML-KEM. Une faille trouvée dans ML-KEM l’an prochain laisse la protection classique en place, et un ordinateur quantique laisse la protection post-quantique.

Le prix, c’est la taille. La clé d’encapsulation ML-KEM-768 d’un appareil fait [1 184 octets](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/handshake/prekeys.rs#L18-L20), et elle voyage dans la carte de contact. Le chiffré que l’initiateur renvoie fait 1 088 octets. Au total, ouvrir une session ajoute [au plus 1 340 octets](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/envelope.rs#L202-L207) au premier paquet, une borne qu’un test vérifie sur de vrais paquets.

Les paquets Barking existent en trois tailles : S (245 octets), M (1 024) et L (16 384). Le chiffré ML-KEM seul dépasse un paquet M, donc le premier message d’une session part toujours dans un paquet L. Le code refuse aussi de mettre une ouverture de session dans un paquet S, la taille prévue pour LoRa : sur le mesh prévu, il faudra ouvrir les sessions par un autre lien.

## La poignée de main, pas à pas

**Ce que publie le destinataire.** Chaque appareil de Bob détient un *paquet de préclés* : une préclé signée X25519, une clé d’encapsulation ML-KEM-768, et la signature Ed25519 de l’appareil sur les deux. Barking ne dépose pas ce paquet sur les relais. Il voyage dans la carte de contact de Bob, que signe la clé racine et que vous recevez hors du réseau, comme le décrit [Vous êtes une clé, pas un numéro de téléphone](/fr/blog/une-cle-pas-un-numero/). La carte contient un paquet par appareil.

**Ce que calcule l’initiateur.** L’appareil d’Alice vérifie la signature du paquet, tire une clé X25519 éphémère, puis calcule :

- DH1 = clé d’identité d’Alice × préclé signée de Bob
- DH2 = clé éphémère d’Alice × clé d’identité de Bob
- DH3 = clé éphémère d’Alice × préclé signée de Bob
- DH4 = clé éphémère d’Alice × une clé à usage unique, seulement si le paquet en propose une
- une encapsulation ML-KEM-768 vers la clé de Bob, qui donne un secret partagé et un chiffré

Le matériel de clé, c’est 32 octets `0xFF`, puis chaque sortie DH dans cet ordre, puis le secret ML-KEM : 192 octets au plus. HKDF-SHA256, avec un sel de 32 octets nuls, en dérive deux valeurs distinctes de 32 octets : la clé de session et le secret des boîtes aux lettres. Les deux clés d’identité, concaténées, deviennent les données associées de la session.

<figure>
{% diagram "pqxdh-key-material" %}
<figcaption>Trois échanges classiques et un secret post-quantique entrent dans une seule dérivation. Casser une seule famille ne suffit pas.</figcaption>
</figure>

L’appareil de Bob refait le même calcul à partir du message initial (la clé d’identité d’Alice, sa clé éphémère, le chiffré) et arrive aux deux mêmes valeurs. Voici les deux fonctions qui assemblent et dérivent le matériel, telles qu’elles sont dans [`pqxdh.rs`](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/handshake/pqxdh.rs#L145-L175) :

```rust
/// Appends an X25519 output to the key material, rejecting the all-zero output
/// (weak-order point: the exchange would not be contributory).
fn push_dh(km: &mut Zeroizing<Vec<u8>>, mut dh: [u8; 32]) -> Result<()> {
    let acc = dh.iter().fold(0u8, |acc, b| acc | b);
    if acc == 0 {
        return Err(CoreError::Crypto);
    }
    km.extend_from_slice(&dh);
    dh.zeroize();
    Ok(())
}

fn derive(km: &[u8], ik_a: &[u8; 32], ik_b: &[u8; 32]) -> Result<SessionSecrets> {
    let salt = [0u8; 32];
    let mut ad = Vec::with_capacity(64);
    ad.extend_from_slice(ik_a);
    ad.extend_from_slice(ik_b);
    let mut s = SessionSecrets {
        sk: [0u8; 32],
        mailbox_secret: [0u8; 32],
        ad,
    };
    hkdf_sha256(Some(&salt), km, labels::PQXDH_SK, &mut s.sk)?;
    hkdf_sha256(
        Some(&salt),
        km,
        labels::PQXDH_MAILBOX,
        &mut s.mailbox_secret,
    )?;
    Ok(s)
}
```

Deux détails. `push_dh` refuse une sortie X25519 toute nulle : un pair qui envoie un point d’ordre faible forcerait sinon une valeur connue dans le matériel. Et le tampon qui contient le matériel est un vecteur `Zeroizing` dont la capacité est fixée à 192 octets avant la première écriture, si bien qu’aucune réallocation ne laisse de copie non effacée en mémoire.

## Puis le Double Ratchet

La clé de session initialise un Double Ratchet dans sa [variante à en-têtes chiffrés](https://signal.org/docs/specifications/doubleratchet/#double-ratchet-with-header-encryption) (section 4 de la spécification de Signal), avec ChaCha20-Poly1305 comme AEAD. Les deux côtés s’en servent comme [première clé racine](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/ratchet/state.rs#L64-L93) ; la préclé signée du destinataire sert de première clé de ratchet.

C’est ainsi que la protection post-quantique se propage. Chaque pas du ratchet mélange une nouvelle sortie X25519 à la clé racine, sans jamais la remplacer. Un attaquant qui n’a que le trafic enregistré, même avec un ordinateur quantique, doit d’abord retrouver la clé racine initiale, donc casser aussi ML-KEM.

Le ratchet garde les clés des messages arrivés dans le désordre [8 jours au plus](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/ratchet/mod.rs#L26-L29) : les 7 jours de vie d’un message sur les relais, plus un jour de décalage d’horloge. Pendant ce temps, ces clés restent sur l’appareil. C’est un compromis : sans elles, un message en retard ne pourrait pas être lu.

## Ce qui n’est pas (encore) post-quantique

Si vous ne lisez qu’une section, lisez cette liste.

<div class="status-list is-limit">

- **Les signatures.** La clé racine, les certificats d’appareil, la liste d’appareils, les paquets de préclés, la carte de contact et l’identité des relais utilisent Ed25519. Un attaquant quantique futur ne peut pas réécrire ce qui a déjà été signé, mais le jour où une telle machine existe, il pourrait forger des signatures en direct : une fausse carte, un faux paquet de préclés.
- **Les pas du ratchet.** Ils utilisent X25519 seul. Le trafic enregistré reste protégé par la clé racine, comme expliqué plus haut. Mais la *guérison* est classique : si quelqu’un vole l’état d’une session, les pas suivants du ratchet ne l’en excluent à nouveau que face à un attaquant classique. Signal a publié des travaux sur un ratchet post-quantique ; Barking n’a rien de comparable pour l’instant.
- **Le scellement du premier message.** Le message initial est scellé par un échange X25519 éphémère vers la clé d’identité du destinataire, pour que les relais ne voient pas qui ouvre la conversation. Un attaquant quantique futur qui a gardé ce paquet pourrait ouvrir le scellé et apprendre la clé d’identité de l’expéditeur. Pas le contenu : il reste derrière ML-KEM.
- **Le transport QUIC.** Entre le client et le relais, QUIC tourne sur rustls 0.23.46 avec le fournisseur `ring`, dont les [groupes d’échange de clés](https://docs.rs/rustls/0.23.46/rustls/crypto/ring/static.DEFAULT_KX_GROUPS.html) sont X25519, P-256 et P-384. Aucun groupe hybride ML-KEM : Barking a choisi `ring` pour un build plus simple et reproductible. Le transport ne cache que des métadonnées au réseau, puisque le contenu est déjà chiffré de bout en bout.
- **Ni clé à usage unique, ni rotation.** Le code sait gérer les clés à usage unique, mais les cartes que Barking produit aujourd’hui n’en portent aucune. Chaque appareil génère ses préclés une fois, à sa création, et les garde : la même clé ML-KEM sert à toutes les sessions ouvertes vers cet appareil. Qui volerait plus tard les secrets de préclés d’un appareil et sa clé d’identité pourrait reconstruire le secret d’ouverture de chaque session enregistrée vers lui, et en lire les premiers messages, jusqu’à ce que le premier aller-retour du ratchet remplace les clés.

</div>

{% diagram "pq-coverage" %}

## Bibliothèques et tests

Barking n’implémente aucune primitive lui-même. La poignée de main utilise [`ml-kem`](https://crates.io/crates/ml-kem) 0.3 de RustCrypto, `x25519-dalek` et `ed25519-dalek` 3.0, `hkdf` 0.13 et `chacha20poly1305` 0.11 ; les empreintes utilisent BLAKE3. Le code propre à Barking, c’est l’assemblage : ce qui entre dans le matériel, dans quel ordre, avec quelles étiquettes.

Cet assemblage a 16 tests dans `pqxdh.rs`. Parmi eux : les deux côtés arrivent aux mêmes secrets ; une clé à usage unique est consommée une fois, et seulement si la poignée de main réussit ; un identifiant de préclé inconnu donne « pas de session » plutôt qu’un plantage ; chaque échange tout nul est refusé, des deux côtés ; un chiffré de mauvaise taille est refusé. Un test vérifie une propriété de ML-KEM lui-même : un chiffré modifié n’échoue pas, il donne un autre secret, si bien que la session ne déchiffre simplement jamais. Un test à part, `wire_overhead_bound_holds`, vérifie la borne de 1 340 octets sur de vrais paquets.

## Lisez le code, cassez-le

Barking est un prototype et n’a pas été audité. Un audit externe est prévu avant que quiconque doive s’y fier. D’ici là, la meilleure relecture qu’il puisse recevoir, c’est la vôtre.

Si vous connaissez PQXDH, ces 450 lignes sont pour vous : [`handshake/pqxdh.rs`](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/handshake/pqxdh.rs), puis [`envelope.rs`](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/envelope.rs) pour le scellement du premier message. Si vous trouvez une faille, signalez-la en privé comme l’explique [`SECURITY.md`](https://github.com/NaKoCorp/Barking/blob/main/SECURITY.md).
