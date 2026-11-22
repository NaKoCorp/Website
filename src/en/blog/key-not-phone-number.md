---
title: You are a key, not a phone number
description: "In Barking your identity is an Ed25519 root key saved as 24 words. It signs your list of up to 8 devices: no phone number, no account server."
date: 2026-11-23
translationKey: key-not-phone-number
tags: [barking, identity, security, multi-device]
barking: true
draft: false
---
Most messengers know you by your phone number. That number belongs to a carrier, which can reassign it after you leave, or hand it to whoever talks a shop assistant into a new SIM. It also turns your address book into a map: upload it, and the service learns who knows whom.

Barking has no phone number, no email address and no sign-up server. `barking init` creates your identity on your own device, and nothing leaves it. This article follows that identity through its life, in the order you would live it: you create it, you show it to someone, you add a laptop, you hand the main role to another device, you lose a phone, you lose everything. At each step: what gets signed, by which key, and what you lose.

Every number below comes from the Barking repository at commit [`4fe359d`](https://github.com/NaKoCorp/Barking/commit/4fe359d07fe5caa05594766477e6d7e5291dc403).

## No phone number, no account server

In one sentence: your identity is an Ed25519 root key created on your device and saved as 24 words; it signs the list of your devices (8 at most, each with its own key), and that signed list, not an account server, tells your contacts which devices to encrypt for.

There is no directory to look you up in. People add you because you gave them your contact card, and they know it is you because they compared a code with you. The rest of this article is the detail.

## One root key, 24 words

At creation, Barking draws [32 bytes of entropy](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/root.rs#L49-L68), writes them as a BIP39 phrase of 24 English words, and derives the Ed25519 root key from them with HKDF. The words are the key in another form: whoever has them has your identity.

What you share is the fingerprint, a BLAKE3 hash of the root public key, [shown in base32](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/root.rs#L130-L152) as 13 groups of 4 characters.

The root key itself lives in the encrypted database (SQLCipher) of your first device. In the command-line client, the key of that database comes from your passphrase through [Argon2id](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-cli/src/passphrase.rs#L7-L9) (64 MiB, 3 passes). In the iOS app, still in development, a key held in the Secure Enclave [wraps the database key](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/apple/BarkingKit/EnclaveKey.swift#L5). To be exact: the Ed25519 root is not in the Secure Enclave. It sits in the database that the enclave helps lock.

The [first-message tutorial](/en/blog/first-barking-message/) shows `barking init` and its output.

## One key per device, one signed list

The root key is not used to chat. Each device generates its own pair, Ed25519 for signing and X25519 for key agreement, which never leaves it. The root signs a certificate for it (public key, a name of [64 bytes at most](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/device.rs#L13), a date), after the device has proved it holds the private half.

The certificates go into one list, signed by the root and versioned. The code puts the rule in [two lines](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/device_list.rs#L1-L2): a more recent list without a device revokes that device. `init` signs the first list with the current time as its version; every link or removal adds one.

The list holds [8 devices at most](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/device_list.rs#L12-L18). The reason is size, not policy: with 8 devices and the longest names, the heaviest message that carries your card still fits in one 16 KiB packet, and a test measures it.

<figure>
{% diagram "key-tree" %}
<figcaption>The list goes into the cards your contacts hold. It never goes to the relays.</figcaption>
</figure>

When someone writes to you, their client encrypts the message once for each device on your list. When you send from your phone, Barking also copies the message to your other devices, so your laptop shows the whole conversation.

As [Trust no node](/en/blog/trust-no-node/) explains, relays never see this list. It travels end to end, inside cards and sync messages.

## Showing your key to someone

Your contact card is a line of text that starts with [`barking1:`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/contact.rs#L14-L30). It contains your display name, your signed device list, the public keys each device needs to open a session, and up to 3 relay hints. The root signs the whole card, which stays under 16 KiB. It holds no number and no address.

A card proves that its keys belong together. It does not prove that it came from you. For that, `barking safety alice` prints a safety code: 12 groups of 5 digits, [computed from both fingerprints](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/identity/safety.rs#L1-L26) and identical on both sides. Compare it in person or on a call you trust, then mark the contact with `--verified`.

If an alias you know later comes back with another key, Barking does not switch silently. It writes a [warning to the log](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/transparency.rs#L365): "the key of alice has changed", with the old and new fingerprints, and asks you to check the code again.

## Adding a laptop

Linking takes four steps, and the command-line client has a command for each. Here is a real run with two `--home` folders, one for the phone (which holds the root) and one for the new laptop. It ran on release v0.2.0; the linking code is the same at `4fe359d`.

```text
$ barking --home phone link offer --out offer.txt
Link offer written: offer.txt
It is valid for 10 minutes and can be used only once.
Hand this file to the new device over a channel you control.

$ barking --home laptop link request --offer offer.txt --name laptop --out request.txt
Link request written: request.txt
Hand it to the admin device (`barking link accept`).
Delete the offer file now: offer.txt

$ barking --home phone link accept --request request.txt --out bundle.barkinglink --history history.bin --packets out
Device linked: laptop
Link bundle written: bundle.barkinglink
History written: history.bin
out/bac633eb….pkt

$ barking --home laptop link finish --bundle bundle.barkinglink --history history.bin
Link completed.
Fingerprint: <same fingerprint as the phone>
Delete the link files now: the offer, the link bundle and the history. They are no longer needed, and the bundle and the history contain your contacts and your messages.
```

What happens underneath:

1. **Offer.** The admin device draws a random secret, valid for [10 minutes](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/link.rs#L74) and usable once. A second `accept` with the same offer fails with "offer missing or already used".
2. **Request.** The new device creates its own keys and sends its public key, protected by an HMAC-SHA256 tag derived from that secret.
3. **Bundle.** The admin device signs a new list at version + 1 and writes a link bundle encrypted with XChaCha20-Poly1305 and signed by the root. It carries a snapshot of your contacts. With `--history`, your message history follows in [64 KiB encrypted chunks](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/history.rs#L59), signed too.
4. **Finish.** The laptop checks the signatures and joins the identity. It shows the same fingerprint as the phone.

<figure>
{% diagram "device-linking" %}
<figcaption>Four messages, all carried by hand. The secret in the offer is what ties the request to you.</figcaption>
</figure>

None of this goes through a relay. In the command-line client the steps are files. In the iOS app, offer and request are [QR codes or files](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-ffi/src/link.rs#L1-L2), and the bundle is one `.barkinglink` file.

The `.pkt` file that `accept` writes is where the network comes back in. It holds `CardUpdate` messages for your contacts, so their clients start encrypting for the laptop too. In the run above, Bob's log then read: "alice updated their device list (+1, −0)". Your other devices receive the new list as `SyncDevices`.

The laptop does not get the root. Ask it for a card and it answers "This device does not hold the root key". It can read and send, but it cannot link another device or sign a new list.

## Handing over the admin role

The device that holds the root is the admin device. You can move that role, for example to the new phone that replaces the old one. The iOS app calls it "Make admin".

The transfer sends the root, encrypted through the existing session, to one of your devices only. The old admin [keeps its copy](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/admin.rs#L1-L13) until the target acknowledges the packet, then erases it. Until then, no linking and no second transfer. If no acknowledgement comes back before the packet expires, 7 days after sealing, the transfer is cancelled and the old admin keeps the root. If the packet arrived and only its acknowledgement was lost, both devices hold the root.

There is deliberately no second admin keeping a spare copy. Each copy of the root is one more device whose theft gives away the whole identity.

The transfer exists in the Rust core and in the iOS app, which is not published. The command-line client has no command for it.

## Losing a phone

To remove a device, the admin signs a new list at version + 1 [without it](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/remove.rs#L1-L15). Your other devices get it as `SyncDevices`, and your contacts get it as `CardUpdate`: they stop encrypting for that device and drop their sessions with it.

The removed device is told too, if it is still online. It then [erases its root](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/removed.rs#L1-L11) if it had one, and can no longer send. It can still read, including the history it already stored: removal protects the future, not the past.

A linked device can also leave on its own, by asking the admin to remove it.

Like the transfer, removal is in the core and the unpublished iOS app, not in the command-line client.

The hard case is losing the admin device itself. The root is on it, protected only by the key of its database. Nobody else can sign a list to remove it. The answer is the 24 words.

## Losing everything: the 24 words

`barking recover --name <device>` reads the phrase on standard input and rebuilds the root. Barking then signs a new list that holds only the new device. Its version is the current time, so it is newer than any list a link ever produced, and it replaces the old one wherever it arrives.

The old devices learn it in two ways: a contact who accepts your new card relays it to them, or one old device that hears of it passes it to the others. Each then records its removal and erases its root. The 24 words take the identity back.

Recovery gives back the identity, not the rest. The command says it plainly:

```text
Identity recovered.
Contacts are not restored: add them again.
```

Your contacts and your message history are not restored. You add your contacts again, and they see your new card. Keep the phrase offline: it is worth the whole identity, and it is the only copy of it that does not sit on a device.

## What is not there yet

Barking is a prototype and has not been audited. On identity specifically:

- **No passkey backup.** It is planned. The 24 words are the only way back today.
- **No encrypted backup of contacts.** Recovery starts with an empty address book.
- **The admin device carries the whole identity.** Steal it and break the key of its database, and you have the root.
- **A gap during linking.** A contact who writes before receiving your new card encrypts for your old list, so that message does not reach the new device.
- **Removal and transfer are not in the command-line client.** They exist in the core and in an iOS app that is not published.

If you want to see linking for yourself, set up two folders as in the [first-message tutorial](/en/blog/first-barking-message/), then run `barking link offer`, `request`, `accept` and `finish` between them. If anything surprises you, [open an issue](https://github.com/NaKoCorp/Barking/issues).

The code for the admin role and for removal is short and commented: [`admin.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/admin.rs) and [`remove.rs`](https://github.com/NaKoCorp/Barking/blob/4fe359d07fe5caa05594766477e6d7e5291dc403/crates/barking-core/src/core/remove.rs).
