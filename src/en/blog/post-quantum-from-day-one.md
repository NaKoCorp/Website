---
title: Post-quantum from day one
description: "Every Barking session starts with a hybrid X25519 + ML-KEM-768 handshake. How it works, and the full list of what is still classical."
date: 2026-11-24
translationKey: post-quantum
tags: [barking, cryptography, post-quantum]
barking: true
draft: false
---
Someone who records your encrypted traffic today does not need to break it today. They can store it and wait for a quantum computer large enough to run Shor's algorithm against X25519. The threat has a name: *harvest now, decrypt later*.

For a messenger, the part at risk is the key exchange. Everything a session encrypts derives from the secret agreed at its start. If a future machine recovers that secret from a recorded handshake, it reads the whole conversation. Signatures are a different case: forging one later does not change what was already sent.

Barking had no users to migrate, so its very first session format opens with a hybrid handshake: X25519 and ML-KEM-768, combined on the model of Signal's [PQXDH](https://signal.org/docs/specifications/pqxdh/). This article shows how the secret is built, why both primitives are kept, and the full list of what is still classical. That list matters more than the rest.

Every value below comes from the Barking repository at commit [`07fe55a`](https://github.com/NaKoCorp/Barking/commit/07fe55a99f90981c0d11bee18f75aa2ffb530336), after release v0.2.0.

## Record now, decrypt later

In one sentence: each Barking session starts from a secret that mixes three or four X25519 exchanges with one ML-KEM-768 shared secret, so a recording made today stays closed as long as either primitive holds.

The signatures, the sealing of the first message and the healing of the ratchet stay classical. The rest of this article is the detail.

## Why hybrid, not ML-KEM alone

ML-KEM, standardised by NIST as FIPS 203 in 2024, is designed to resist a quantum computer. It is also young. X25519 has twenty years of analysis behind it and no known classical weakness, but a large quantum computer would break it.

Barking does not choose. It concatenates the X25519 outputs and the ML-KEM secret into one input for a single HKDF derivation. To recover the session key, an attacker must recover every part of that input: break X25519 *and* ML-KEM. A flaw found in ML-KEM next year leaves the classical protection in place, and a quantum computer leaves the post-quantum one.

The cost is size. A device's ML-KEM-768 encapsulation key is [1,184 bytes](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/handshake/prekeys.rs#L18-L20), and it travels in the contact card. The ciphertext the initiator sends back is 1,088 bytes. In total, opening a session adds [at most 1,340 bytes](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/envelope.rs#L202-L207) to the first packet, a bound a test checks on real packets.

Barking packets come in three sizes: S (245 bytes), M (1,024) and L (16,384). The ML-KEM ciphertext alone is larger than an M packet, so the first message of a session always travels as an L packet. The code also refuses to ever put a session opening in an S packet, the size meant for LoRa: on the planned mesh, sessions will have to be opened over another link.

## The handshake, step by step

**What the recipient publishes.** Each device of Bob's holds a *prekey bundle*: a signed X25519 prekey, an ML-KEM-768 encapsulation key, and the Ed25519 signature of the device over both. Barking does not put this bundle on the relays. It travels inside Bob's contact card, which the root key signs and which you receive outside the network, as described in [You are a key, not a phone number](/en/blog/key-not-phone-number/). The card holds one bundle per device.

**What the initiator computes.** Alice's device checks the bundle's signature, draws an ephemeral X25519 key, then computes:

- DH1 = Alice's identity key × Bob's signed prekey
- DH2 = Alice's ephemeral key × Bob's identity key
- DH3 = Alice's ephemeral key × Bob's signed prekey
- DH4 = Alice's ephemeral key × a one-time prekey, only if the bundle offers one
- an ML-KEM-768 encapsulation to Bob's key, which gives a shared secret and a ciphertext

The key material is 32 bytes of `0xFF`, then each DH output in that order, then the ML-KEM secret: 192 bytes at most. HKDF-SHA256, with a salt of 32 zero bytes, derives two separate 32-byte values from it: the session key and the mailbox secret. Both identity keys, concatenated, become the associated data of the session.

<figure>
{% diagram "pqxdh-key-material" %}
<figcaption>Three classical exchanges and one post-quantum secret go into one derivation. Breaking one family is not enough.</figcaption>
</figure>

Bob's device repeats the same computation from the initial message (Alice's identity key, her ephemeral key, the ciphertext) and reaches the same two values. Here are the two functions that assemble and derive the material, as they are in [`pqxdh.rs`](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/handshake/pqxdh.rs#L145-L175):

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

Two details. `push_dh` rejects an all-zero X25519 output: a peer who sends a weak-order point would otherwise force a known value into the material. And the buffer that holds the material is a `Zeroizing` vector whose capacity is fixed at 192 bytes before the first write, so no reallocation leaves an unerased copy in memory.

## Then the Double Ratchet

The session key seeds a Double Ratchet in its [header encryption variant](https://signal.org/docs/specifications/doubleratchet/#double-ratchet-with-header-encryption) (section 4 of Signal's specification), with ChaCha20-Poly1305 as the AEAD. Both sides use it as the [first root key](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/ratchet/state.rs#L64-L93); the responder's signed prekey serves as its first ratchet key.

This is how the post-quantum protection carries over. Each ratchet step mixes a new X25519 output into the root key, but never replaces it. An attacker who only has the recorded traffic, even with a quantum computer, must first recover the initial root key, which means breaking ML-KEM too.

The ratchet keeps the keys of messages that arrive out of order for [8 days at most](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/ratchet/mod.rs#L26-L29): the 7-day lifetime of a message on the relays, plus one day of clock skew. During that window, those keys sit on the device. It is a trade-off: without them, a late message could not be read.

## What is not post-quantum (yet)

This is the list to read if you only read one section.

<div class="status-list is-limit">

- **Signatures.** The root key, device certificates, the device list, prekey bundles, the contact card and the identity of relays all use Ed25519. A future quantum attacker cannot rewrite what was already signed, but once such a machine exists, it could forge signatures live: a fake card, a fake bundle.
- **The ratchet steps.** They use X25519 alone. Recorded traffic stays protected by the root key, as explained above. But *healing* is classical: if someone steals a session state, the next ratchet steps lock them out again only against a classical attacker. Signal has published work on a post-quantum ratchet; Barking has nothing comparable yet.
- **The sealing of the first message.** The initial message is sealed with an ephemeral X25519 exchange towards the recipient's identity key, so relays do not see who opens the conversation. A future quantum attacker who kept that packet could open the seal and learn the sender's identity key. Not the content: that stays behind ML-KEM.
- **The QUIC transport.** Between client and relay, QUIC runs on rustls 0.23.46 with the `ring` provider, whose [key exchange groups](https://docs.rs/rustls/0.23.46/rustls/crypto/ring/static.DEFAULT_KX_GROUPS.html) are X25519, P-256 and P-384. No hybrid ML-KEM group: Barking chose `ring` for a simpler, reproducible build. The transport only hides metadata from the network, since the content is already encrypted end to end.
- **No one-time prekeys, no rotation.** The code supports one-time prekeys, but the cards Barking produces today carry none. Each device generates its prekeys once, at creation, and keeps them: the same ML-KEM key serves every session opened towards that device. Whoever later steals a device's prekey secrets and its identity key can rebuild the opening secret of every session recorded towards it, and read its first messages, until the ratchet's first round trip replaces the keys.

</div>

{% diagram "pq-coverage" %}

## Libraries and tests

Barking implements no primitive itself. The handshake uses RustCrypto's [`ml-kem`](https://crates.io/crates/ml-kem) 0.3, `x25519-dalek` and `ed25519-dalek` 3.0, `hkdf` 0.13 and `chacha20poly1305` 0.11; fingerprints use BLAKE3. Barking's own code is the assembly: what goes into the material, in which order, with which labels.

That assembly has 16 tests in `pqxdh.rs`. Among them: both sides reach the same secrets; a one-time key is consumed once, and only if the handshake succeeds; an unknown prekey identifier gives "no session" rather than a crash; every all-zero exchange is refused, on both sides; a ciphertext of the wrong size is refused. One test checks a property of ML-KEM itself: a modified ciphertext does not fail, it yields a different secret, so the session simply never decrypts. A separate test, `wire_overhead_bound_holds`, checks the 1,340-byte bound on real packets.

## Read the code, break it

Barking is a prototype and has not been audited. An external audit is planned before anyone should rely on it. Until then, the strongest review it can get is yours.

If you know PQXDH, these 450 lines are for you: [`handshake/pqxdh.rs`](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/handshake/pqxdh.rs), then [`envelope.rs`](https://github.com/NaKoCorp/Barking/blob/07fe55a99f90981c0d11bee18f75aa2ffb530336/crates/barking-core/src/envelope.rs) for the sealing of the first message. If you find a flaw, report it privately as described in [`SECURITY.md`](https://github.com/NaKoCorp/Barking/blob/main/SECURITY.md).
