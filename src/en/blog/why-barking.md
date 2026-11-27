---
title: Why we're building Barking
description: An end-to-end encrypted messenger with relays anyone can run, no central server, no phone number. What works today, and what does not exist yet.
date: 2026-11-19
updated: 2026-11-27
translationKey: why-barking
tags: [barking, manifesto]
barking: true
draft: false
---
Barking is an open-source, end-to-end encrypted messenger whose relays anyone can run. It has no central server and asks for no phone number. It is also a prototype that nobody has audited yet. This article says what it is for, how it is built, and exactly which parts work today. Every fact below was checked in the code of release [v0.2.0](https://github.com/NaKoCorp/Barking/releases/tag/v0.2.0), the latest at the time of writing.

## Messaging that depends on nobody's infrastructure

The messengers most people use stop working when a cell tower goes down, when a government cuts the internet, or when the company behind them shuts a server. Your conversations live on somebody else's machines, and that somebody can be switched off.

Barking aims at two situations with the same software: the ordinary days, when you just want to talk to people, and the day one of those things happens. The design goal is that no single operator, NakoCorp included, can stop your messages or read them.

<p class="pull">No single operator, NakoCorp included, should be able to stop your messages or read them.</p>

The code is not there yet: the rest of this article draws the line between the two.

## Who it is for

The first audience is anyone who wants a real alternative to Signal or Telegram: no phone number, no account on a company's server, and source code you can read.

The second audience is people in a crisis: an internet shutdown, a natural disaster, a protest under surveillance. For them, staying reachable and staying anonymous matter more than anything else. Barking is designed with them in mind, and that is exactly why they should **not** rely on it today. Software meant for that situation has to be externally audited first, and Barking has not been.

## What Barking does differently

**No central server.** Messages travel through relays. A relay is one binary, `barking-node`, that anyone can run on a small server. Relays find each other through an S/Kademlia routing table and copy each packet onto the several nodes responsible for its mailbox, so one relay going away does not lose your messages.

**No relay is trusted, not even NakoCorp's.** Messages are encrypted end to end. The sender's identity is not written on the packet: it is only inside the encrypted content, and the recipient learns it when decrypting. The mailbox a packet is addressed to is a 16-byte identifier that only the two correspondents can compute, and it [changes every day](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-core/src/mailbox.rs#L1-L2). A relay stores sealed packets for mailboxes it cannot link to a name.

<figure>
{% diagram "message-path" %}
<figcaption>Sealed on one device, copied onto the relays responsible for a daily mailbox, opened on the other.</figcaption>
</figure>

**An identity is a key, not a phone number.** Your identity is an Ed25519 root key derived from a 24-word recovery phrase. It can sign for up to [eight devices](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-core/src/identity/device_list.rs#L18).

**A custom protocol, no custom cryptography.** Barking does not build on Nostr, libp2p or MLS: none of them is in its dependency tree. It does use well-known libraries for every primitive (RustCrypto crates such as `ml-kem` and `chacha20poly1305`, and the dalek crates for X25519 and Ed25519). A conversation starts with PQXDH, a key agreement that combines X25519 with the post-quantum ML-KEM-768, then continues with a Double Ratchet whose headers are encrypted too.

## What works today

The current prototype ships a command-line client, `barking`, and the relay nodes. Concretely, at v0.2.0:

<div class="status-list is-done">

- encrypted one-to-one messaging from the CLI, with contact cards, safety codes and delivery receipts;
- text messages up to [4,000 UTF-8 bytes](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-core/src/envelope.rs#L29);
- a persistent outgoing queue;
- a local SQLCipher database, keyed from your passphrase with Argon2id;
- up to eight devices on one identity, linked through a file exchange, with optional transfer of the encrypted history;
- two transports: `.pkt` files you move by hand (a USB key, an email, anything), or `barking sync`, which sends and receives through relays;
- self-hosted relays that store encrypted packets over QUIC until the recipient fetches them;
- distributed routing: S/Kademlia discovery and replication between the nodes responsible for a mailbox;
- synchronization built for bad connections, with resumable fetches and saved progress;
- the server side of iOS wake-ups: relays notify `barking-push`, a stateless relay that forwards sealed tokens to Apple's push service.

</div>

A first conversation, with the commands of the README's Quick start at v0.2.0 (synchronization is manual for now):

<div class="term">
<div class="term-bar"><i></i><i></i><i></i><span>barking · v0.2.0</span></div>

```sh
# create an identity and export your contact card
barking init --name laptop
barking card --display-name Alice

# add a contact and a relay, then talk
barking add '<contact-card>' --alias bob
barking node add <IP:port> <node-id>
barking send bob 'Hello!' --out ./packets
barking sync
barking messages bob
```

</div>

An iOS app is in progress in the same repository, under `apple/`. It is not published, and its test builds are not public.

## What does not exist yet

These items are planned, not built:

<div class="status-list is-planned">

- published Android and iOS apps;
- mesh transports: Bluetooth LE, Wi-Fi and LoRa (the packet format already has fragmentation for small radio frames, but no radio transport exists);
- groups and media attachments;
- Tor or a mixnet, to hide your IP address from relays;
- an external security audit.

</div>

Releases do exist: v0.0.1 and v0.1.0 came out on 13 November 2026, and [v0.2.0](https://github.com/NaKoCorp/Barking/releases/tag/v0.2.0) on 16 November. A release only means the binaries were built by GitHub's CI and attested there. It does not mean the software is ready.

The public relay network is only starting: its first relays went up in beta on 27 November 2026, and the [network map](/en/network/) shows where they run. The [bootstrap list](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-dht/bootstrap.toml) built into the binary is still empty, so to send anything you first add a relay by hand, yours or a friend's.

## Honest limits

The warning in the README comes down to three points:

<div class="status-list is-limit">

- **Not audited.** No external firm has reviewed the cryptography or the code.
- **Relays see your IP address.** A relay knows which address deposits or fetches a packet. Hiding it needs Tor or a mixnet, which is planned, not done.
- **A public relay network in beta only.** The first relays are up, but the binary does not know them yet: you add a relay by hand, yours or someone else's.

</div>

Do not use Barking for sensitive communications yet. Use it to try the design, break it and report what you find.

## Who builds it

Barking is built by one person, Paul ([HoaMi on GitHub](https://github.com/HoaMi)), a tech lead in SRE and DevSecOps, under the NakoCorp name. With a single author, every extra reader counts: the code is public under the AGPL-3.0-only license, so read it rather than take this article's word for it.

There is one dependency on NakoCorp for now. Apple only accepts wake-ups signed with the app publisher's key, so NakoCorp is the only operator of the push relay for its iOS app.

## Where it is going

<figure>
{% diagram "roadmap" %}
<figcaption>Built today, next, and later. No dates.</figcaption>
</figure>

The order is set, the dates are not. First the mobile apps: iOS, then Android. Then the mesh, so that phones can pass messages to each other without the internet: Bluetooth LE with gateways, Wi-Fi Aware, and LoRa through small Raspberry Pi stations. Then groups, media, and the external audit that has to come before anyone in a crisis relies on Barking.

## How you can help

- **Try the CLI.** Build it and send your first messages with the README's [Quick start](https://github.com/NaKoCorp/Barking/blob/v0.2.0/README.md#-quick-start).
- **Run a relay.** One binary, with Docker or systemd: see [Run a relay](https://github.com/NaKoCorp/Barking/blob/v0.2.0/README.md#-run-a-relay).
- **Review the cryptography.** If you find a flaw, report it privately as [SECURITY.md](https://github.com/NaKoCorp/Barking/blob/v0.2.0/SECURITY.md) explains.
- **Sponsor NakoCorp** on [GitHub Sponsors](https://github.com/sponsors/NaKoCorp).

Start by starring and watching [the repository](https://github.com/NaKoCorp/Barking): that is where each release shows up first.
