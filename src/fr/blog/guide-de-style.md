---
title: Guide de style des articles
description: Tous les éléments qu’un article peut utiliser, sur une seule page, pour vérifier la lecture en Paper et en Ink avant publication.
date: 2026-11-18
translationKey: style-guide
tags: [meta]
barking: true
draft: true
---
Ce brouillon n’est jamais publié. Il montre chaque élément qu’un article peut utiliser, pour vérifier les styles de lecture dans les deux thèmes. Le texte courant est en police système de 17 px, sur une colonne de 70 caractères. Les noms de produits et de binaires sont en style code : `barking`, `barking-node`, `barking-push`.

## Titres et paragraphes

Une section commence par un h2 en Fira Code. Les paragraphes restent courts : dire ce que fait Barking, puis ce qu’il ne fait pas encore. Les liens ressemblent [à celui-ci](https://github.com/nakocorp/barking), dans la couleur d’accent.

### Un titre de troisième niveau

Un h3 découpe une longue section. À utiliser avec mesure ; deux niveaux suffisent en général.

## Listes

Ce dont Barking n’a pas besoin :

- d’un numéro de téléphone ;
- d’un serveur central ;
- de faire confiance à un relais en particulier.

Comment un message quitte votre téléphone :

1. L’application le chiffre pour chacun des appareils du destinataire.
2. Elle confie l’enveloppe scellée à un relais.
3. Le relais la garde jusqu’à ce que le destinataire la récupère, puis l’efface.

## Citation

> « Des messages qui arrivent. Même quand Internet ne suit pas. »

## Code

Un bloc Rust, avec mots-clés, chaînes et commentaires colorés :

```rust
use std::time::Duration;

/// Durée de conservation d'une enveloppe que personne n'a récupérée.
const RETENTION: Duration = Duration::from_secs(14 * 24 * 3600);

fn describe(hops: u8) -> String {
    // Le relais ne voit jamais le texte en clair.
    match hops {
        0 => "direct".to_string(),
        n => format!("{n} sauts"),
    }
}
```

Une session shell :

```sh
# Lancer un relais avec l'image publiée
docker compose -f deploy/compose.yaml up -d
barking-node --version
echo "le relais tourne"
```

Le code en ligne, comme `RETENTION` ou `cargo test --workspace`, s’affiche dans une petite pastille qui suit le thème.

## Tableau

| Chemin | Glyphe | Portée |
| --- | --- | --- |
| Bluetooth LE | ᛒ | une pièce |
| Wi-Fi | ◎ | un bâtiment |
| Relais Internet | ≋ | partout |

## Schéma

Les schémas sont du SVG en ligne. Ils utilisent `currentColor` et les tokens du thème, ils suivent donc Paper et Ink, et leur texte est dans la langue de la page.

<figure>
{% diagram "flow" %}
<figcaption>Un message via un relais.</figcaption>
</figure>
