---
title: Politique de confidentialité
description: Ce que l’app Barking conserve, ce qui quitte votre iPhone et qui peut voir quoi. En bref, NakoCorp n’a rien à lire.
lang: fr
altUrl: /en/privacy/
eyebrow: confidentialité
layout: layouts/page.njk
permalink: /fr/confidentialite/
updated: 2026-11-19
---

Cette politique couvre l’app Barking pour iPhone et les services réseau que NakoCorp exploite pour elle (nœuds relais et relais de notifications). Barking est un logiciel libre sous AGPL-3.0 : chaque affirmation ci-dessous peut être vérifiée dans [le code source](https://github.com/nakocorp/barking).

Barking est un prototype. Il n’a pas fait l’objet d’un audit externe. Ne vous y fiez pas encore pour des communications sensibles.

## En bref

- Pas de compte, pas de numéro de téléphone, pas d’adresse e-mail. Votre identité est une paire de clés créée sur votre iPhone.
- Les messages sont chiffrés de bout en bout. Les nœuds ne transportent que des paquets scellés et ne voient jamais qui les envoie ni ce qu’ils disent.
- Pas de publicité, pas de pistage, pas de statistiques d’usage, pas de rapports de plantage, aucun SDK tiers.
- NakoCorp ne garde aucune trace de vos contacts, de vos messages ni de votre appareil.

## Ce qui reste sur votre iPhone

Vos contacts, vos messages, vos clés et le journal de l’app sont stockés dans une base de données sur votre iPhone, chiffrée avec SQLCipher. Sa clé est protégée par la Secure Enclave de l’iPhone quand l’appareil en a une, sinon par le trousseau, et reste liée à cet appareil.

- La base est exclue des sauvegardes iCloud et sur ordinateur.
- Le journal affiché dans l’écran Transparence (ce que l’app a fait et les chemins pris par les messages) est conservé 30 jours sur l’iPhone et n’est jamais envoyé.
- Votre phrase de récupération (24 mots) est affichée une seule fois et l’app ne la conserve pas. Si vous l’exportez en PDF, le fichier est chiffré avec le mot de passe de votre choix.
- **Effacer Barking** (Réglages › Sécurité) supprime de l’iPhone la base, les clés et les fichiers de l’app. Vos contacts n’en sont pas avertis.

## Ce qui quitte votre iPhone

**Votre carte de contact.** Quand vous partagez votre code ou votre lien, la personne reçoit votre nom affiché, les clés publiques de vos appareils et leurs paquets de clés. Vous choisissez qui la reçoit. Elle ne contient ni numéro de téléphone ni adresse e-mail.

**Les messages.** Chaque message est chiffré pour chacun des appareils du destinataire (échange de clés PQXDH, puis Double Ratchet) avant de quitter votre iPhone. Il voyage dans un paquet scellé de taille fixe, déposé dans une boîte aux lettres dont l’identifiant change chaque jour. Un paquet ne contient pas l’identité de l’expéditeur.

**Les accusés de réception.** Quand un message arrive, l’app du destinataire publie un accusé qui prouve la remise sans révéler qui l’a reçu. Votre contact voit alors « Reçu ». Il n’y a ni accusé de lecture ni indicateur de saisie.

**Les jetons de notification.** Si les notifications instantanées sont activées, votre iPhone scelle son jeton de notification Apple pour que seul le relais de notifications puisse l’ouvrir, et confie ce jeton scellé à un nœud. Vous pouvez désactiver les notifications instantanées dans Réglages › Notifications. Les messages arrivent alors à l’ouverture de l’app ou lors d’une actualisation d’iOS.

## Qui voit quoi

**Les nœuds** (relais) stockent les paquets scellés 24 heures au plus, ainsi que l’accusé indiquant qu’un paquet est arrivé. Comme tout serveur sur internet, un nœud voit l’adresse IP depuis laquelle votre iPhone se connecte. Les nœuds n’utilisent les adresses qu’en mémoire, pour limiter les abus, le temps de la connexion : ils ne les écrivent ni sur disque ni dans leurs journaux. Leurs journaux ne contiennent ni adresse, ni boîte aux lettres, ni message.

**Le relais de notifications** (`barking-push`) n’ouvre un jeton scellé que pour demander à Apple de réveiller un iPhone. Il ne stocke rien : ni jeton, ni adresse, ni boîte aux lettres. Pour limiter les abus, il garde en mémoire, une heure au plus, une empreinte du jeton.

**Apple** achemine la notification. Apple voit qu’un iPhone reçoit une notification Barking, jamais son contenu : la notification indique seulement « Nouveau message ». L’app déchiffre ensuite le message sur l’iPhone pour afficher le nom de l’expéditeur ou le texte, selon votre réglage d’aperçu. Avec le verrouillage de l’app, les notifications indiquent toujours « Nouveau message ».

**Aucun d’eux ne voit l’expéditeur ni le contenu.** Une limite demeure : un nœud qui coopère avec le relais de notifications ou avec Apple pourrait relier une boîte aux lettres à un iPhone. Désactiver les notifications instantanées l’empêche.

## Ce que NakoCorp collecte

Rien sur votre usage de Barking. NakoCorp n’a ni base de comptes, ni copie de vos contacts ou de vos messages, ni statistiques d’usage. L’étiquette de confidentialité de l’App Store indique « Aucune donnée collectée ».

Si vous écrivez à [support@nakocorp.com](mailto:support@nakocorp.com), nous utilisons votre adresse e-mail et votre message uniquement pour vous répondre, et les supprimons une fois votre demande réglée.

## Ce site

www.nakocorp.com n’utilise ni cookies, ni statistiques, ni publicité. Il retient votre langue et votre thème dans le stockage local de votre navigateur. Le site est hébergé par GitHub Pages, qui reçoit votre adresse IP pour servir les pages. La page d’accueil charge ses polices depuis Google Fonts, qui reçoit aussi votre adresse IP ; les pages du blog hébergent leurs polices elles-mêmes.

## Vos droits

Le RGPD vous permet de demander l’accès à vos données personnelles, leur rectification ou leur effacement, ou de vous opposer à leur traitement. Comme NakoCorp ne détient aucune donnée sur votre usage de l’app, il n’y a en général rien à vous transmettre : vos données sont sur votre iPhone, et **Effacer Barking** les supprime. Pour toute question, écrivez à [support@nakocorp.com](mailto:support@nakocorp.com). Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).

## Enfants

Barking ne s’adresse pas aux enfants.

## Modifications

Nous mettrons cette page à jour quand l’app ou les services changeront ce qu’ils traitent. La date en haut indique la dernière modification. L’historique de cette page est public dans [le dépôt du site](https://github.com/nakocorp/website).

## Contact

NakoCorp, France. [support@nakocorp.com](mailto:support@nakocorp.com)
