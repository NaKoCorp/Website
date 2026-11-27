---
title: Réseau de relais
description: Carte en direct des relais de la bêta publique de Barking, par pays et par opérateur réseau, issue d’un recensement toutes les heures. Aucune adresse n’est affichée.
lang: fr
altUrl: /en/network/
layout: layouts/network.njk
permalink: /fr/reseau/
---

Toutes les heures, une tâche GitHub Actions lance `barking census`, une commande du client Barking en ligne de commande. Elle part de quelques relais d’entrée, parcourt la table S/Kademlia avec des requêtes `FindNode`, puis demande à chaque relais trouvé son rapport public (`Info`, protocole 5) : sa version, depuis combien de temps il tourne, le remplissage de son stockage et le réseau et le pays où il dit se trouver.

Chaque relais est placé dans le pays qu’il déclare : la recherche faite par son opérateur sur sa propre adresse. Le recensement confronte cette déclaration à l’adresse sur laquelle le relais a répondu, cherchée dans la même base IP hors ligne que celle de l’app. L’adresse elle-même n’est jamais gardée : ni sur cette page, ni dans les données brutes, ni dans les journaux de la tâche. Seuls le pays et l’opérateur réseau restent. Quand la base indique un autre pays ou un autre opérateur, la liste l’indique dans **Vérification du lieu** : la base peut se tromper, un relais aussi.

Un relais apparaît ici une fois entré dans la table, ce qui demande `[dht] public_addr` dans sa configuration. [Faire tourner un relais Barking](/fr/blog/faire-tourner-un-relais-barking/) détaille l’installation.

Base IP : [DB-IP Lite](https://db-ip.com), sous licence CC BY 4.0. Carte : [Natural Earth](https://www.naturalearthdata.com), domaine public.
