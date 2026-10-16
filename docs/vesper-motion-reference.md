# Reference teardown: "Vesper" particle site (textura.us TikTok, 2026-10-16)

Frame-by-frame read of a 14 s phone recording of a laptop screen. Colors were
sampled from the cropped screen region, so they are approximate (phone camera,
screen glow, compression). Timestamps are seconds into the clip at 30 fps.

## Palette

| Role | Hex | Where it appears |
|---|---|---|
| Page background | `#02040a` | Everything behind the particles; near black with a blue cast |
| Deep haze | `#0f295e`, `#112054` | Soft blurred fog in the top corners of every dark section |
| Indigo (particle low end) | `#193297`, `#2b5dcf` | Bottom of each shape |
| Blue (particle mid) | `#1a83d0`, `#38a0fc` | Middle of each shape, most of the galaxy arms |
| Cyan (particle high end) | `#2a9e9a`, `#58dbe8` | Top of each shape, bright arm edges |
| Mint tip | `#4fd9b0` | Only the topmost particles of the blob and brain |
| Hotspot | `#dfeaf5` | Cursor attractor glow, brain highlight, star bokeh |
| Heading text | `#ceecfa` | Light weight grotesk on dark sections |
| Small caps text | `#678db2` | Captions and stat labels |
| Light section background | `#ceecfa` to `#abcff7` | "A living interface" and the FAQ, a pale ice-blue, not white |
| Light section accent | `#5e8dc4` | Blue backdrop behind the portrait |

The particle color is a vertical gradient mapped to each particle's height:
indigo at the bottom, blue through the middle, cyan to mint at the top. It
never changes between shapes, which is why the blob, galaxy and brain read as
one object changing form.

## Typography and chrome

- One typeface, a geometric grotesk at light weight (about 300) for headings,
  regular for body. Inter Tight or Outfit would match.
- Nav: small star logo, "Home Services Works About", and an outlined pill
  **Contact Us** on the right. Nothing else.
- Each hero has a two-line heading on the left, a one-sentence small caps
  caption, and in the galaxy section a stat strip along the bottom edge.

## The opening cloud, frame by frame (1.0 s to 3.8 s)

This is the hero piece. Read at 15 fps from full-resolution crops
(`scratchpad/vid/cloudA.png`, `cloudB.png`, `cloudC.png` in the session
scratchpad; regenerate with the ffmpeg lines at the end of this doc).

| Frames | Phase | What the particles do |
|---|---|---|
| 0.0 to 1.0 | Pre-roll | Black, with faint white streaks falling at about 60 degrees. A few dozen particles only. |
| 1.0 to 1.9 (27 frames) | Condense | A soft dust cloud with no edge, about 40 percent of the final size, indigo at the bottom and cyan on top. Each frame it tightens: the centre hollows out first, then the outline firms up from the bottom up. The fuzz lasts because particles arrive at different times, not because the whole cloud is blurred: each particle has its own random delay and eases toward its slot on the shell. |
| 1.9 to 2.6 (21 frames) | Form | The shell is now crisp: a sphere with a hole through it, seen slightly off axis so it reads as a torus. The surface is ridged by low-frequency noise into 3 or 4 broad lobes, and fine moire lines show the particles sit on a parametric grid (rows of latitude and longitude), not a random scatter. It rotates slowly about a tilted axis, roughly one turn per 20 s. |
| 2.3 to 2.6 | Cursor pull | The cursor sits to the right of the shell. A lobe stretches toward it over about 5 frames and relaxes back over about 10 once the cursor stops, like a spring with damping. Only particles within a radius of the cursor move; the far side is unaffected. |
| 2.6 to 3.3 | Idle | Continuous wobble: the lobes drift around the surface (noise animated over time), and the whole shell breathes by a few percent. Behind it, 6 to 10 large soft dots drift upward slowly, out of focus, for depth. |
| 3.3 to 3.8 (15 frames) | Dissolve | Scroll begins. The top (cyan) particles let go first and scatter upward, then the whole shell expands outward from its centre, loses structure, drifts down a little, and fades. The heading loses opacity in the same window. |

Colors of the cloud itself, sampled at 1.2 s, 1.6 s, 2.0 s and 2.8 s:

| Position on shell | Hex |
|---|---|
| Bottom | `#2c3fc5` to `#4150d7` (indigo) |
| Lower middle | `#1f6dc9`, `#2557da` |
| Upper middle | `#1f81d2`, `#2671e5` (blue) |
| Top | `#38e6e0`, `#4bf2ec` (cyan) |
| Highest tips | `#4fd9b0` (mint) |
| Halo around the shell | `#0b2859` at low opacity (the additive blend of many faint particles) |

Visual recipe, in order of how much each contributes to the look:

1. Additive blending with a soft round sprite, so overlapping particles brighten toward white at dense spots and the whole shell carries a halo.
2. Height-mapped color ramp (indigo, blue, cyan, mint) in the vertex shader. The ramp is in world space, so it does not rotate with the shell.
3. Grid-sampled sphere (about 300 by 300 points, 90k particles) displaced along its normal by 3D simplex noise at a low frequency (2 to 3 lobes across the surface) and animated over time. The grid is what produces the moire.
4. Hole through the centre: the sampler skips a cap on both poles, or the shape is a fat torus with a small hole. The off-axis view makes it look like a sphere with a window.
5. Cursor attractor: raycast the pointer to the shell's plane, pull particles within a radius toward it with a spring, damp back.
6. Assemble and dissolve driven by a single progress value: at 0 every particle is at a random position in a wide sphere, at 1 it is on the shell. Each particle gets a random delay and an ease-out so the edge stays fuzzy while it forms. Dissolve runs the same curve backward with an outward velocity and a fade.
7. Slow rotation, a few blurred background dots, and a bloom pass at low strength.

The current site hero already has a canvas, a blob, and `three.js` loaded, so this drops in as a replacement for the wireframe blob in `assets/js/site.js`.

## Animation timeline

| Time | What happens |
|---|---|
| 0.0 to 1.0 | Black screen, sparse white particle streaks falling diagonally (loading state). |
| 1.0 to 1.6 | Heading "Motion instead of chrome" appears word by word, each word going from blurred and transparent to sharp. At the same time scattered dust converges into a hollow sphere (a torus seen face on). |
| 1.6 to 3.3 | The shell wobbles with low-frequency noise and rotates slowly. When the cursor moves near it, particles bulge out toward the cursor and settle back over about 10 frames. |
| 3.4 to 3.9 | Scroll begins. The shell blows apart outward and fades to dust in about 15 frames (0.5 s). |
| 3.9 to 4.3 | Nearly empty frame with a few large bokeh dots. "Reads presence, in motion" fades in word by word with the same blur-in. |
| 4.3 to 4.7 | Dust condenses into a diffuse cloud, then into a spiral galaxy with two bright cyan arms, tilted about 70 degrees from face on. |
| 4.7 to 7.0 | Galaxy rotates slowly. Cursor movement drags the nearest arm sideways (frames around 5.2 to 5.8 show an arm bending toward the pointer). |
| 7.0 to 7.4 | Camera pitches until the galaxy is edge on, a flat glowing line with a bright core. |
| 7.4 to 7.8 | The line disperses into a cloud and drifts off (next scroll). |
| 7.8 to 8.4 | Empty with bokeh. "Motion instead of chrome" heading returns for the third section. |
| 8.4 to 8.6 | Particles rush in from the cursor position, which glows white, and form a brain in about 6 frames (0.2 s). The cursor is the attractor the shape grows from. |
| 8.6 to 10.1 | Brain rotates slowly, slight breathing scale. A white hotspot follows the cursor across the surface. Caption: point counts, tessellation and pixel ratio scale by device, never by frame rate. |
| 10.2 to 10.5 | Scroll: the brain dissolves upward into dust while a light section slides up from the bottom. |
| 10.5 to 11.5 | Light section "A living interface": heading blurs in, portrait on a blue backdrop on the right, short paragraphs below. |
| 11.5 to 12.3 | "Frequently asked" accordion on the same light background. |
| 12.3 to 13.0 | Back to dark: "Let's talk." with Name, Email, and a **Contact Us** button, then a footer. |

Patterns that repeat:

- Every section change is dissolve to dust, empty beat of 10 to 15 frames,
  then re-form into the next shape. Scroll progress drives it; it is not time
  based.
- Headings always enter with a blur and opacity ramp per word, about 8 frames
  per word, staggered.
- Dark and light sections alternate, and the light one is ice blue rather
  than white so the palette holds.
- The cursor is treated as a physical thing: shapes bulge or bend toward it,
  and new shapes grow out of it.

## How it is built, most likely

- One `three.js` `Points` object with roughly 50k to 100k particles, additive
  blending, a soft circular sprite, and a bloom pass. Each particle carries a
  target position for every shape (hollow sphere, spiral, brain mesh surface)
  and lerps between them on a scroll-driven progress value.
- Noise displacement in the vertex shader for the wobble, plus a cursor
  attractor: raycast the pointer onto the scene plane and push particles
  within a radius toward it, with spring damping.
- The brain is a sampled surface from a low-poly brain model; the galaxy is a
  logarithmic spiral with jitter; the sphere is a shell with noise.

## Applying it to jonathanpoeder.com

- The site already loads `three.js` r128 and runs a wireframe blob in the hero
  (`assets/js/site.js`, `data-blob` canvases). A particle system can replace
  it on the same canvases without touching the layout.
- The current site is light with orange `#f37021`. The reference is dark navy
  with cyan. Two ways to go: keep the light site and use the particle blob
  with the orange ramp, or switch the hero and footer to dark navy and use the
  cyan ramp. The second is closer to the reference; the first keeps the brand.
- The per-word blur-in heading and the scroll-driven dissolve are small
  additions that work with either palette.

## Regenerating the frame sheets

```sh
V=<the mp4>
ffmpeg -ss 0.9 -t 0.8 -i "$V" -vf "fps=15,crop=430:270:70:355,tile=4x3" cloudA.png
ffmpeg -ss 1.7 -t 0.8 -i "$V" -vf "fps=15,crop=430:270:70:355,tile=4x3" cloudB.png
ffmpeg -ss 2.5 -t 0.8 -i "$V" -vf "fps=15,crop=430:270:70:355,tile=4x3" cloudC.png
```
