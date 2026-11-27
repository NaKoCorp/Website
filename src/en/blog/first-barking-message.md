---
title: Send your first Barking message in 5 minutes
description: Build the Barking CLI, create two identities, check a safety code, then exchange an encrypted message and its receipt as plain files.
date: 2026-11-20
updated: 2026-11-27
translationKey: first-message
tags: [barking, tutorial, rust]
barking: true
draft: false
---
In five minutes and two directories, you create two identities, check a safety code, exchange an end-to-end encrypted message inside a `.pkt` file and get its receipt back. No server, no network, no account. Then, if you have a relay at hand, `barking sync` does the same trip over the internet.

## What you will do

Alice and Bob both live on your machine, each in their own data directory. Alice writes a message to a file, Bob opens it and writes a receipt to another file, Alice reads the receipt and her message turns `delivered`. The file part was run for real on release [v0.2.0](https://github.com/NaKoCorp/Barking/releases/tag/v0.2.0) on macOS, and every output below is copied from that run.

Barking is a prototype that nobody has audited yet. [Why we're building Barking](/en/blog/why-barking/) explains what it is for and where it stands. Play with it, but do not trust it with anything sensitive.

## Build the client

You need Rust through [rustup](https://rustup.rs). The repository pins its toolchain in `rust-toolchain.toml`, so rustup fetches the right version on its own.

<div class="term">
<div class="term-bar"><i></i><i></i><i></i><span>build</span></div>

```sh
git clone --branch v0.2.0 https://github.com/NaKoCorp/Barking.git
cd Barking
cargo build --release -p barking-cli
alias barking="$PWD/target/release/barking"
```

</div>

On an Apple M4, with a fresh `target` directory, this build took 1 min 09 s (149 crates, with the crates.io registry and the toolchain already downloaded). Your first build will be longer if Cargo has to fetch them. The five minutes of this tutorial start after it.

Now move to an empty directory: everything below happens in it.

```sh
mkdir -p ~/barking-demo && cd ~/barking-demo
```

## Create two identities

The `--home` option picks the data directory (by default `~/.barking`). One directory per person:

```sh
# for this tutorial only: the passphrase ends up in your shell history
export BARKING_PASSPHRASE='demo-only-passphrase'
barking --home alice init --name laptop
barking --home bob init --name phone
```

The passphrase encrypts the local SQLCipher database. It goes through [Argon2id](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-cli/src/passphrase.rs) (64 MiB of memory, 3 passes) before it becomes a key. Without `BARKING_PASSPHRASE`, `init` asks for it twice and every other command asks once. The variable is a convenience for scripts and tutorials, not a good habit. Each `init` prints:

```text
Identity created.
Fingerprint: qkwr-rurz-yt2y-dfnk-laa7-kn66-kfh4-glil-pwgu-clug-5ww6-gdwu-lfhq

Recovery phrase (24 words):
# 24 words, hidden in this article

Write it down offline: it alone lets you recover your identity.
```

The fingerprint identifies you; yours will differ. The 24 words are your identity. Keep them offline. A recovery restores the identity, but neither your contacts nor your history.

## Swap contact cards

A contact card is how you meet someone on Barking. Store each card in a shell variable instead of copying 2,364 characters by hand:

```sh
ALICE_CARD=$(barking --home alice card --display-name Alice)
BOB_CARD=$(barking --home bob card --display-name Bob)
barking --home bob add "$ALICE_CARD" --alias alice
barking --home alice add "$BOB_CARD" --alias bob
```

Each `add` answers `Contact added:` followed by the other side's fingerprint. A card starts with `barking1:`. It carries a device list signed by the identity's root key, and the public keys a contact needs to open a session. It carries no phone number and no email. The format has room for up to three relay hints, signed with the rest, but the CLI leaves them empty. How identities and devices fit together is the subject of a later article.

## Compare the safety code

Anyone can hand you a card. The safety code tells you it is the right one:

```sh
barking --home alice safety bob
barking --home bob safety alice
```

```text
46702 95821 15050 31417 99645 54460 51939 22903 40051 42212 85143 59254
46702 95821 15050 31417 99645 54460 51939 22903 40051 42212 85143 59254
```

Twelve groups of five digits, the same on both sides. With a real contact, compare them in person or over a channel you already trust. If they match, mark the contact:

```sh
barking --home alice safety bob --verified
barking --home alice contacts
```

```text
46702 95821 15050 31417 99645 54460 51939 22903 40051 42212 85143 59254
Contact marked as verified.
bob  bz4c-vjp6-7mit-je4x-usq2-ph7v-27oa-rh7b-dnzy-24dh-ufsk-s2cs-pl3a  verified
```

## Send a message in a file

`send` encrypts the text, writes one `.pkt` file per packet into the `--out` directory and puts the message in the outgoing queue. Bob then processes the file, and Alice processes the receipt:

```sh
barking --home alice send bob 'Hello!' --out a2b
barking --home bob receive a2b/*.pkt --out b2a
barking --home alice receive b2a/*.pkt
```

```text
a2b/54461a58c157cab1093e29a6b4595ed8.pkt
[alice] Hello!
  receipt: b2a/0dad12d5081b8731204c62c8529ae047.pkt
b2a/0dad12d5081b8731204c62c8529ae047.pkt: delivered ✓
```

Bob decrypts the packet, learns who sent it and writes the receipt. Alice opens the receipt, and her message is delivered. Check both sides:

```sh
barking --home alice messages bob
barking --home bob messages alice
```

```text
2026-11-19 23:13:00  →  delivered  Hello!
2026-11-19 23:13:00  ←  received  Hello!
```

<figure>
{% diagram "file-trip" %}
<figcaption>The message and its receipt as two files. Any channel can carry them.</figcaption>
</figure>

That file can travel on a USB key, by email, by anything. It is encrypted, and it does not say who sent it: Bob learns that only by decrypting it. A text can be up to [4,000 bytes](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-core/src/envelope.rs#L29).

## What a relay would see

Barking keeps a transparency log of what it did and what it exposed:

```sh
barking --home alice log
```

The entry for the first packet, wrapped for reading:

```text
Encrypted packet of 16384 bytes (large tier), expires on 2026-11-20 23:10 UTC.
First message of a session: the introduction mailbox is computed from the public
keys (signing and key agreement) of the recipient device and the day. Relays see:
the size, the type (message or acknowledgement), the hop count, a packet
identifier, the mailbox, the expiry. They see neither who you are nor the content.
But anyone who has the recipient's contact card can tell that this is a first
message for that person.
```

Packets come in three [fixed sizes](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-packet/src/lib.rs#L49-L51): 245, 1,024 and 16,384 bytes. The first message of a session takes the largest, because it carries the key agreement; the receipt fits in 245 bytes. Every packet [expires 24 hours after it is sealed](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-core/src/envelope.rs#L282-L296), rounded down to 10 minutes so relays do not learn the second it was written: that is why the message sealed at 23:13 expires at 23:10 the next day. This is v0.2.0: since protocol 4, which came after it, a packet [lives 7 days](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-packet/src/lib.rs#L21-L22), so a build from the main branch shows an expiry a week later. The last sentence of the entry is a real limit: anyone holding Bob's card can recognise a first message addressed to him. The full threat model is in [Trust no node. Not even ours.](/en/blog/trust-no-node/)

## Now through relays

This part is optional, and it needs something the CLI does not give you yet: a relay reachable from the internet. Public beta relays have been up since 27 November 2026 (see the [network map](/en/network/)), but the [bootstrap list](https://github.com/NaKoCorp/Barking/blob/v0.2.0/crates/barking-dht/bootstrap.toml) built into the binary is still empty, so the CLI knows none of them. Without one, `sync` stops here:

```sh
barking --home alice sync
```

```text
introductions: partial poll, the rest at the next sync
Poll not recorded: some mailboxes were not fetched in full
polled 0 mailboxes, received 0 items, deposited 0 (first copies 0, extra 0), avoided 0 nodes, view 0 nodes
no known node: add a contact or a node
```

The relay has to take part in the network table: its operator sets `public_addr` in the `[dht]` section of its [configuration](https://github.com/NaKoCorp/Barking/blob/v0.2.0/docs/deploy/barking-node.toml), and gives you its address (`IP:port`) and its 52-character identifier. Add it on both sides, then synchronise by hand, in this order:

```sh
barking --home alice node add <IP:port> <node-id>
barking --home bob node add <IP:port> <node-id>
barking --home alice send bob 'Through a relay' --out a2b
# Alice deposits the message
barking --home alice sync
# Bob receives it and deposits the receipt
barking --home bob sync
# Alice receives the receipt
barking --home alice sync
```

`node add` checks that the relay answers and proves its identity, and it refuses a relay with no public address. A release build also refuses `127.0.0.1` and other private addresses. If the relay cannot be reached, `sync` prints `network unreachable, nothing is lost`, and the packets wait in the queue for the next attempt. Synchronisation is manual for now. Keep in mind that a relay sees your IP address while you are connected to it.

## What to try next

- `barking --home alice outbox --out resend` rewrites the packets still waiting for a receipt, so you can send them again by any channel.
- `barking link` adds a second device to an identity, through the same kind of file exchange.
- Run your own relay, so the previous section works for you and your contacts: the README's [Run a relay](https://github.com/NaKoCorp/Barking/blob/v0.2.0/README.md#-run-a-relay) takes one binary, with Docker or systemd.

When you are done, `rm -rf ~/barking-demo` and `unset BARKING_PASSPHRASE`. If a command in this tutorial does not behave as written, [open an issue](https://github.com/NaKoCorp/Barking/issues): it is a bug in the article or in Barking, and both are worth fixing.
