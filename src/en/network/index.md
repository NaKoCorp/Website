---
title: Relay network
description: Live map of the Barking public beta relays, by country and network operator, from an hourly census. No address is ever shown.
lang: en
altUrl: /fr/reseau/
layout: layouts/network.njk
permalink: /en/network/
---

Every hour, a GitHub Actions job runs `barking census`, a command of the Barking CLI. It starts from a few seed relays, walks the S/Kademlia table with `FindNode` requests, then asks every relay it found for its public report (`Info`, protocol 5): its version, how long it has been up, how full its storage is, and the network and country it says it sits in.

Each relay is placed in the country it declares: its operator's own lookup of its address. The census checks that claim against the address the relay answered on, looked up in the same offline IP base the app uses. The address itself is never kept: not on this page, not in the raw data, not in the job's logs. Only the country and the network operator remain. When the base names another country or operator, the list says so under **Location check**: the base can be wrong, and so can a relay.

A relay shows up here once it has joined the table, which takes `[dht] public_addr` in its configuration. [Run a Barking relay](/en/blog/run-a-barking-relay/) walks through the setup.

IP base: [DB-IP Lite](https://db-ip.com), under CC BY 4.0. Map: [Natural Earth](https://www.naturalearthdata.com), public domain.
