---
title: Style guide for blog articles
description: Every element an article can use, in one page, to check the reading styles in Paper and Ink before publishing.
date: 2026-11-18
translationKey: style-guide
tags: [meta]
barking: true
draft: true
---
This draft is never published. It shows every element an article can use, so the reading styles can be checked in both themes. Body text is the system sans at 17 px, with a 70 character column. Product and binary names are set in code style: `barking`, `barking-node`, `barking-push`.

## Headings and paragraphs

A section opens with an h2 in Fira Code. Keep paragraphs short: say what Barking does, then what it does not do yet. Links look [like this one](https://github.com/nakocorp/barking), in the accent colour.

### A third-level heading

An h3 splits a long section. Use it sparingly; two levels are usually enough.

## Lists

What Barking does not need:

- a phone number;
- a central server;
- trust in any single relay.

How a message leaves your phone:

1. The app encrypts it for each of the recipient's devices.
2. It hands the sealed envelope to a relay.
3. The relay keeps it until the recipient fetches it, then deletes it.

## Quotation

> Messages that get through. Even when the internet doesn't.

## Code

A Rust block, with keywords, strings and comments highlighted:

```rust
use std::time::Duration;

/// How long a relay keeps an envelope nobody fetched.
const RETENTION: Duration = Duration::from_secs(14 * 24 * 3600);

fn describe(hops: u8) -> String {
    // The relay never sees the plaintext.
    match hops {
        0 => "direct".to_string(),
        n => format!("{n} hops"),
    }
}
```

A shell session:

```sh
# Run a relay with the published image
docker compose -f deploy/compose.yaml up -d
barking-node --version
echo "relay is up"
```

Inline code such as `RETENTION` or `cargo test --workspace` sits in a small chip that follows the theme.

## Table

| Path | Glyph | Range |
| --- | --- | --- |
| Bluetooth LE | ᛒ | a room |
| Wi-Fi | ◎ | a building |
| Internet relays | ≋ | anywhere |

## Diagram

Diagrams are inline SVG. They use `currentColor` and the theme tokens, so they follow Paper and Ink, and their text is in the page's language.

<figure>
{% diagram "flow" %}
<figcaption>A message through one relay.</figcaption>
</figure>
