# Tomb Raver: YouTube reference notes

Research pass of 2026-10-08/09. Purpose: make the gear layout, Pebble's hand/body movement, the mixing logic and the PS1 Tomb Raider look believable.

## How to read this file

Every observation carries a source tag and the video id(s) it came from.

| Tag | Meaning |
|---|---|
| **[F]** | I looked at storyboard frames from that video myself (sprite sheets in `assets-src/ref/youtube/<id>/sb0_M###.jpg`, kept locally and not in the repository). |
| **[T]** | I looked at the video's 1280x720 thumbnail (`thumb.jpg`), which is a single sharp still. |
| **[S]** | Taken from the video's auto-generated English subtitles (`<id>.en.vtt`), paraphrased. |
| **[GK]** | General knowledge. Not checked against any video or manual in this session. Verify before relying on exact figures. |

Limits of the frame evidence, stated once so it does not have to be repeated:

- Storyboards are one frame every ~10 s (4.9 s on videos under ~15 min), 320x180 px at best and 160x90 px on older uploads. They show **where** hands and bodies are and how often. They do **not** show motion, so nothing here about how fast a knob is turned, how deep a head nod is, or what a gesture lines up with musically comes from frames. Those points are from subtitles or marked [GK].
- There is no audio in a storyboard. Any link between a gesture and "the drop" is an inference and is labelled as one.
- Fine finger detail (which finger is on which knob) is only trustworthy from the [T] thumbnails and the handful of close-up camera angles.

"Used" column in the tables: `F` frames viewed and usable, `f` frames viewed but only 160x90, `f-` frames viewed and too small/dark to use, `T` thumbnail viewed, `S` subtitles read, `S*` subtitles read but garbled, `-` vetted only.

For rows marked `-` or `f-`, the "why it is useful" text is what I expect from the title, channel and artist. I did not check it against the video.

## Vetted videos

81 videos. Each one was confirmed with a full `yt-dlp` metadata extraction (not just a search hit): id, exact title, channel, duration, public availability. Raw list: `assets-src/ref/youtube/vetted.tsv` (local only). Titles below are exact. In the id the URL ends with, case matters.

### A. Club / stream DJ sets with hands and gear visible (13)

| Used | Title | Channel | Dur. | URL | Why it is useful |
|---|---|---|---|---|---|
| F | Len Faki Boiler Room Berlin DJ Set | Boiler Room | 1:32:53 | https://youtu.be/jQRI3b2SX8c | Classic Boiler Room layout (crowd behind DJ). Long techno blends: hunched two-hand mixer stance, long sideways reaches, fist pump, towel. |
| F | DJ EZ classic UK Garage set in The Lab LDN | Mixmag | 1:27:12 | https://youtu.be/NFJIbNIAABo | Has a dedicated mixer close-up cam (Pioneer DJM): two hands pinching EQ knobs side by side; fast-cut UKG on CDJs. |
| F | Four Tet @TheLotRadio 12-01-2025 | The Lot Radio | 2:00:28 | https://youtu.be/x8uIOM6iFCs | Fixed front camera for 2 h; CDJs + mixer; headphones round the neck, index-finger "conducting", turning away to the bag. |
| f- | DJ RANDALL history of jungle set in The Lab LDN | Mixmag | 1:43:32 | https://youtu.be/UgK8h9xRFls | Jungle history set in the same Lab LDN booth. Storyboard is only 159x90 per frame: downloaded, too small to read hands. |
| f- | DJ Storm \| HÖR London Takeover - Apr 27 / 2023 | HÖR BERLIN | 55:13 | https://youtu.be/o1Hrpk_PzVk | Jungle/DnB in the same HOR booth. Storyboard only 160x90: downloaded, not analysed. |
| F,T | Interplanetary Criminal \| HÖR - Jun 27 / 2022 | HÖR BERLIN | 55:22 | https://youtu.be/96qhgQMtX2c | BEST SINGLE REFERENCE. Fixed front cam, bright light, two Technics + Pioneer DJM, UKG on vinyl, record crate behind. 108 frames tallied. |
| f- | SHERELLE \| Boiler Room London: Bass & Percs Special | Boiler Room | 50:21 | https://youtu.be/Z4_KD9UhdCE | 160 bpm footwork/jungle, very physical DJ. Storyboard only 160x90: downloaded, not analysed. |
| - | Jamie Jones for Cercle at Pliva Waterfalls in Jajce, Bosnia-Herzegovina | Cercle | 1:53:49 | https://youtu.be/RWVBoK4idas | House, outdoor multi-cam with booth close-ups. Storyboards downloaded (320x180), not analysed. |
| F | Sammy Virji's Energetic UKG & Bassline Set From DJ Mag HQ | DJ Mag | 1:08:24 | https://youtu.be/sLcvUGn_4VM | Crowd-facing gestures: arm up, clap, both hands to headphones; one overhead shot of 4 CDJs + mixer in a row. |
| - | FUNK TRIBU \| HÖR - Feb 1 / 2023 | HÖR BERLIN | 52:56 | https://youtu.be/vBQFcUTm8dA | Fast trance-techno HOR set, high-energy body movement. Vetted only. |
| F | Nia Archives \| Boiler Room: London | Boiler Room | 57:14 | https://youtu.be/jO5JhZNSjUA | Jungle, crowd behind, fisheye top-front cam; light flips red -> white in the frames where crowd arms are up; mic in hand. |
| - | Calibre \| Boiler Room Festival Amsterdam: SYSTEM | Boiler Room | 59:21 | https://youtu.be/LuB29bL2kyI | Liquid DnB, long smooth blends. Vetted only. |
| - | Ben UFO Boiler Room London DJ Set | Boiler Room | 49:00 | https://youtu.be/bcuc9FgCquU | Calm, technical vinyl/CDJ hybrid mixing. Vetted only. |

### B. Vinyl sets on Technics with a club or rotary mixer (13)

| Used | Title | Channel | Dur. | URL | Why it is useful |
|---|---|---|---|---|---|
| - | Theo Parrish Boiler Room London DJ Set | Boiler Room | 46:20 | https://youtu.be/7wZ5-lb7bQ4 | Famous for aggressive EQ/isolator riding on vinyl. Vetted only. |
| F,T | 100% Vinyl Deep House & Techno Mix \| Groovefocus 1 \| Technics SL-1200 & Xone 96 | Groovefocus | 1:08:55 | https://youtu.be/FaDIpCgYkGk | Technics SL-1200 + Xone:96 in daylight, front cam: hand rest positions on the mixer, headphones on neck, turning to records behind. |
| f- | Motor City Drum Ensemble Boiler Room London DJ Set | Boiler Room | 56:51 | https://youtu.be/zIBBEggIXBw | Canonical vinyl house/disco Boiler Room. Storyboard 160x90 and very dark: no usable hand detail. |
| f- | Helena Hauff Boiler Room DJ Set | Boiler Room | 38:24 | https://youtu.be/vBIVet7QPAE | Vinyl electro/techno, crowd pressed round the booth. 160x90: only gross posture readable (long reaches, arms spread). |
| - | Kerri Chandler Boiler Room London DJ Set | Boiler Room | 1:09:31 | https://youtu.be/iwew9TzWY3M | House on vinyl plus live keys. Vetted only. |
| - | Hunee Boiler Room Berlin DJ Set | Boiler Room | 59:01 | https://youtu.be/mDX_eYOKe4s | Vinyl house/disco, DJ dances a lot between moves. Vetted only. |
| F,T | Deep House Vinyl Mix on Union Audio Rotary Mixer \| Vinyl Grooves #001 | Vinyl Grooves | 1:01:46 | https://youtu.be/BD2tCXSWbQI | Union Audio rotary mixer, side close-up cam: how a big rotary knob is gripped; headphones on head. |
| F,T | MiX ROOM #24 - Vinyl Dj Set (Technics SL 1200/1210 mk2 & NEW Allen & Heath Xone 92 Mk2/Limited) | MiX ROOM | 1:11:51 | https://youtu.be/KSYfck7DRWE | Overhead-from-behind cam on Technics + Xone:92 MK2: two hands on EQ, idle hand flat on the deck corner, DJ walks out of frame between mixes. |
| f- | DJ Storm Vinyl-Only D&B Set Live From DJ Mag At Work | DJ Mag | 1:03:43 | https://youtu.be/nmcMjEoDL4o | Vinyl-only DnB with a crowd. 160x90: side cam, arm outstretched on deck while looking at crowd, phones/hands up. |
| - | Deep House Vinyl Mix / Rotary Mixer / Soulful / Chilled Vibe | Rust-E | 52:19 | https://youtu.be/qK-s9QjUpHI | Rotary deep-house vinyl mix. Storyboards downloaded (320x180), not analysed. |
| F | Yoyaku Instore session Helena Hauff | Yoyaku Record Store | 59:38 | https://youtu.be/F8Nh7sJl4gU | BEST-LIT VINYL REFERENCE. Multi-cam, 3 Technics + Xone:92: hand-on-record close-ups, headphone poses, digging in crates behind. |
| - | Omen Classics Vol. 2 – Frankfurt Techno 1996–1998 \| All Vinyl Set on Technics 1210 | All Vinyl – Christian Jäger | 1:07:35 | https://youtu.be/tcNIL9kmyhU | All-vinyl 90s techno on 1210s. Storyboards downloaded (320x180), not analysed. |
| - | Atmospheric Jungle Vinyl DJ Mix | Pesky | 1:06:15 | https://youtu.be/3V3YbUJoFUI | Atmospheric jungle on vinyl. Storyboards downloaded (320x180), not analysed. |

### C. Overhead / hands-cam footage (11)

| Used | Title | Channel | Dur. | URL | Why it is useful |
|---|---|---|---|---|---|
| F | Jeff Mills - "Exhibitionist Mix" ( Full version) | TOP DJ ROOM [ex Top DJ Mag] | 45:07 | https://youtu.be/cCpHiWwA2Rg | Three locked-off angles (front, side hands, overhead) on a black void; 3 Technics + mixer. The layout diagram for the toy. |
| - | Axis Mix (Complete) - Jeff Mills / Exhibitionist DVD | ghostdancer1972 | 47:07 | https://youtu.be/THgeFErZI_4 | Same DVD, different mix. Storyboards downloaded (240x180), not analysed. |
| f,T | The Art Of DJing: Jeff Mills - Mixing with three turntables (from The Exhibitionist DVD) | Resident Advisor | 14:00 | https://youtu.be/g5Jd31qDSjo | 14-min excerpt of the same DVD; storyboard every 4.9 s. Thumbnail is a clean wide-armed pose. |
| - | Purpose Maker Mix (Complete) - Jeff Mills(Feat Random Noise Generator LIVE)  / Exhibitionist DVD | ghostdancer1972 | 45:21 | https://youtu.be/vUgwa5sJRKs | Same DVD, with live TR-909. Vetted only. |
| f,T | House & Techno  \| +1h Vinyl DJ Mix by Jake Noble \| BN3018 Basement Mix \| YouTube DJ | Jake Noble | 1:20:18 | https://youtu.be/801ejEC_yq4 | True overhead; mixer sits behind the two decks; one hand on record edge + other on pitch fader. |
| f | Back to Basics Ep3 - Vinyl Only Mix | Crossfader | 12:35 | https://youtu.be/SocOQlmFAiw | True top-down of deck-mixer-deck, storyboard every 4.9 s: "home" positions of both hands. |
| f,T | All vinyl DJ set \| House music \| Technics \| Rotary mixer | tmuckle | 1:09:10 | https://youtu.be/BNMpdylnIXU | Side cam on Technics + small rotary: two-hand rotary grip, record swap, DJ steps away for long stretches. |
| - | Nu-Skool Breaks Vinyl DJ Mix (Live) - Visually Effected Beats & Bass Lines | Chew's Sessions | 1:01:46 | https://youtu.be/Ei3THnJaFs8 | Breaks on vinyl with a visual overlay. Storyboards downloaded (320x180), not analysed. |
| f- | Mastersounds Radius 4 \| Deep, Melodic Techno DJ Set | Opa Music | 1:08:44 | https://youtu.be/hS_Uoo7lIIc | Rotary (Radius 4) close cam. Storyboard 160x90: downloaded, not analysed. |
| - | Minimal Tech House DJ Mix - Pioneer CDJ 3000 Performance | Crossfader | 27:42 | https://youtu.be/IUaL7-xEepo | Top-down performance cam on CDJ-3000s + DJM. Vetted only. |
| - | Beatport Essential House Mix - CDJ-3000 & DJM-900NXS2 | Crossfader | 22:08 | https://youtu.be/2lBMA7Onqas | Top-down on CDJ-3000 + DJM-900NXS2 (the mixer described under "Mixer facts"). Vetted only. |

### D. Technique tutorials (20)

| Used | Title | Channel | Dur. | URL | Why it is useful |
|---|---|---|---|---|---|
| S | How to Beatmatch Vinyl by Ear \| Learn Vinyl DJing for Beginners | Alex Eneas | 15:09 | https://youtu.be/Kqz7_cvg2iM | Tour of the Technics 1210 controls left to right, then beatmatching by ear. |
| S | Beatmatching on Vinyl: Complete Turntable Mixing Guide | DJ Blakey | 40:59 | https://youtu.be/mpa_xy_yg4k | 41-min vinyl guide: platter-rim drag, spindle twist, slipmat, drift, 32-beat phrasing. |
| S | 2 DJ Transition Styles and When to Swap Your Basses | Club Ready DJ School | 16:37 | https://youtu.be/C-5qFyU9QNU | "Swap on the one" vs "out by the one"; cue 16 bars before the transition point. |
| S | How DJs Know EXACTLY When To Mix (Phrasing Explained) | DJ Blakey | 24:22 | https://youtu.be/1dLfSkKLhuk | Phrasing: 32 beats = 8 bars, press play on the phrase boundary. |
| S | 5 DJ EQ Techniques That Instantly Improve Your Mixes | Club Ready DJ School | 14:17 | https://youtu.be/z0mFNt1ZTBw | EQ technique: bass about half out (not killed) before the fader comes up; work up vs work down. |
| - | 3 PRO DJ FILTER TECHNIQUES to enhance your transitions | Club Ready DJ School | 16:56 | https://youtu.be/UY3uiQ3cmPs | Filter techniques. No English subtitles available: vetted only. |
| S | How to Improve Your Echo Out Transitions | DJcityTV | 8:26 | https://youtu.be/tkwM9vCmIbg | Echo-out: high-pass the echo, 1/1 beat, depth ~50%, feedback ~70%. |
| S | DJ Sound Levels Every DJ Must Know! | Club Ready DJ School | 16:57 | https://youtu.be/OxEJnKtSPcI | Gain staging: trims at 12 o'clock, faders up, stay out of the red. |
| S* | How to Mix Techno | Club Ready DJ School | 31:07 | https://youtu.be/BMYZiz4FdjQ | Techno: long blends, loops, isolator vs EQ. Auto-captions are badly garbled; used sparingly. |
| S | Pitch Riding: Throwback Thursday DJ Tutorial | DJ TechTools | 4:30 | https://youtu.be/F54nVlEorM0 | Pitch riding: quick throw, or ~20% offset held 5-6 s. |
| - | How To Use DJ Headphones (Beginner's Guide) | Off The Rack Jack | 9:30 | https://youtu.be/Ce2EapnAQUI | Headphone habits. Subtitle download blocked (HTTP 429): vetted only. |
| - | Bass Swap EQ Mixing Technique \| Mix & Tricks #4 with XDJ-RX3 | AlphaTheta / Pioneer DJ USA | 5:12 | https://youtu.be/Dmb5GmLkbrY | Official bass-swap demo. Vetted only. |
| S | How To Beatmatch & Mix On Vinyl Turntables \| Bop DJ | Bop DJ | 8:40 | https://youtu.be/IPMaEb_CBLU | Five-step vinyl beatmatch; exactly where the fingers go to cue, slow and speed a record. |
| - | How To Set Your Volumes Like A Pro When DJing | Digital DJ Tips | 5:11 | https://youtu.be/m7mumr0p-Qk | Level setting. Vetted only. |
| - | 3 Ways To Mix Techno (DJ Tutorial) | Crossfader | 11:25 | https://youtu.be/22XjZKJS69E | Three techno transition styles. Vetted only. |
| S | 5 Ways to Use Filter FX in your DJ Sets | Club Ready DJ School | 17:48 | https://youtu.be/fpnO6-y4VlI | Filter FX: knob directions, resonance settings, punch-in on both channels. |
| S | How To Use The Filter When DJing | Heavy Hits | 5:46 | https://youtu.be/NwgjT6MbRoI | Filter: HPF through a build then release on the drop; LPF fade-in. |
| S | How to DJ: Headphone Cueing & Split Cue Tutorial | The DJ Podcast | 4:12 | https://youtu.be/xZanGnb1XeA | Cue buttons, cue/master mix knob, split cue. |
| - | TRANSITION BETWEEN ANY GENRE/BPM! \| DJ ECHO OUT TUTORIAL | DJ Phil Harris | 10:17 | https://youtu.be/R5xVG7cL4eA | Echo-out between tempos. No English subtitles: vetted only. |
| - | DJ Transitions Masterclass – Master Phrasing, EQ & Filters | Club Ready DJ School | 18:24 | https://youtu.be/Fd9jEpFG6II | Phrasing + EQ + filter combined. Vetted only. |

### E. Mixer and turntable walkthroughs (12)

| Used | Title | Channel | Dur. | URL | Why it is useful |
|---|---|---|---|---|---|
| S | Pioneer DJM-900NXS2 Talkthrough Video | Digital DJ Tips | 13:25 | https://youtu.be/FEz_hUwwmj4 | DJM-900NXS2: section-by-section talkthrough (Sound Color FX, Beat FX, clip light, X-Pad). |
| S | Ultimate Pioneer DJM 900 NXS 2 walkthrough guide  - DJ Nexus 2 mixer tips manual tutorial | Dexxter Clark Music | 46:19 | https://youtu.be/h9WLrz_hmLE | 46-min DJM-900NXS2 walkthrough: headphone section, EQ/isolator switch, fader curves, FX list. |
| - | DJM-A9 Walkthrough | AlphaTheta / Pioneer DJ Global | 4:25 | https://youtu.be/05AgTCmWDt8 | Official DJM-A9 walkthrough (music only; captions were empty). |
| - | The NEW club standard mixer 🎚 Full Pioneer DJ DJM-A9 review + guide | Digital DJ Tips | 26:45 | https://youtu.be/CS08_0TANVg | DJM-A9 guide. Vetted only. |
| - | Pioneer DJ DJM-V10 Review & Demo - The 6 Channel BEAST! | Crossfader | 28:23 | https://youtu.be/bZgkY3hp9oY | DJM-V10 (6 ch, 4-band EQ, compressor). Vetted only. |
| S | Xone 92 MK2 –  Deep Dive Review | Opa Music | 21:46 | https://youtu.be/ya9GaqWdjnE | Xone:92 MK2: ergonomics, EQ behaviour, filters. |
| S | Allen & Heath Xone:96 Mixer Talkthrough | Digital DJ Tips | 7:51 | https://youtu.be/xap__ybVM5A | Xone:96 talkthrough with the product specialist: what changed from the 92. |
| S | Allen & Heath Xone 96 Review & Tutorial - Best club mixer ever? | Dave Mech | 17:40 | https://youtu.be/aJW4JsO-130 | Xone:96: 4-band EQ centre frequencies, filter modes, resonance, crunch. |
| - | Mastersounds Radius 4 Rotary DJ Mixer \| Is a 3-band EQ necessary? | Opa Music | 41:27 | https://youtu.be/QmbNQZPob_U | Radius 4 rotary. No English subtitles: vetted only. |
| - | Review: MasterSounds Radius 4 Rotary Mixer | DJcityTV | 8:59 | https://youtu.be/AbQ2bRbPMn8 | Radius 4 rotary review. Vetted only. |
| S | Allen & Heath Xone 96 vs 92 - Is the 96 an improvement? | Dave Mech | 15:38 | https://youtu.be/whjuOJDmPQI | Xone:96 vs 92 side by side: EQ differences, LFO, fader curves. |
| - | How to set up a Technics SL-1200 | The Vinyl Factory | 5:47 | https://youtu.be/EVaKAgcrAXw | Physical tour of an SL-1200 (tonearm, weight, anti-skate). Vetted only. |

### F. Tomb Raider (1996) and Tomb Raider II on PlayStation (12)

| Used | Title | Channel | Dur. | URL | Why it is useful |
|---|---|---|---|---|---|
| F | PSX Longplay [019] Tomb Raider (Part 1 of 3) | World-of-Longplays | 2:03:27 | https://youtu.be/LCO8R_qZ-cA | TR1 on PlayStation, Peru + start of Greece. 27 sheets (~240 frames) viewed: title ring, passport, LOADING, stats screen, bars, crystals. |
| - | Tomb Raider (1996) Longplay (PS1) | VG Navigator | 6:34:21 | https://youtu.be/pR0kUN_lJ3g | Complete TR1 PS1 longplay. Vetted only. |
| - | Tomb Raider 1996 - PS1 - Longplay - 100% Complete - No Commentary | Doggett TV | 5:59:16 | https://youtu.be/g6I0N2O2i1M | Complete TR1 PS1 100% longplay. Vetted only. |
| F | PSX Longplay [072] Tomb Raider 2 (Part 1 of 8) | World-of-Longplays | 1:08:19 | https://youtu.be/1T7ueLPuq94 | TR2 on PlayStation: title, LOADING bar, Great Wall, Venice, inventory backdrop, health bar. |
| F,S | DF Retro: Tomb Raider Analysed on PS1/Saturn/DOS/Win95 | Digital Foundry | 15:03 | https://youtu.be/VutzIK3DqZE | Technical analysis: 30 fps, affine warping, dithering, Gouraud shading, blue underwater tint. |
| - | Tomb Raider 2 (PSX) Longplay (All 48 Secrets) | Darius320 | 7:42:11 | https://youtu.be/wf6aCZ8itzo | Complete TR2 PSX longplay. Vetted only. |
| F | St. Francis' Folly (PS1) \| All Secrets Walkthrough \| Tomb Raider (1996) | Sun and Eos Gaming | 19:07 | https://youtu.be/brF2vzR_XIw | TR1 PS1 St. Francis' Folly: level-select menu, LOADING + progress bar, pushable block, dark brick palette. |
| - | [TAS] PSX Tomb Raider by Troye in 51:45.55 | TASVideosChannel | 53:38 | https://youtu.be/EAI9zuPqCbY | TAS of TR1 PSX. Vetted only. |
| f | Tomb Raider (PS1) 100% Walkthrough- Level 10: City of Khamoon | Eldincy | 22:03 | https://youtu.be/Hbl1584vzAo | TR1 PS1 Egypt: sandstone/hieroglyph palette, carved pushable blocks, green underwater (160x90 frames). |
| f | Tomb Raider (1996) PS1 Walkthrough Gameplay \| Level 1 - Caves | Daniel | 7:38 | https://youtu.be/AM3r5GycTOY | TR1 PS1 Caves: title ring and opened passport (160x90 frames). |
| f | Tomb Raider 2 - Intro & Level 1 - The Great Wall (PlayStation 1) | MikeyTheMachineGaming | 17:00 | https://youtu.be/LG7gjNWi1MY | TR2 PS1 Great Wall: health bar, dark interiors (160x90 frames). |
| - | Tomb Raider II (PS1) Gameplay | teh2Dgamer | 16:37 | https://youtu.be/bG7IswBBncU | TR2 PS1 gameplay sample. Vetted only. |


### What was actually examined

- **Frames viewed and usable (22 videos: 15 across A-C, 7 in F).** A: NFJIbNIAABo, jQRI3b2SX8c, x8uIOM6iFCs, 96qhgQMtX2c, sLcvUGn_4VM, jO5JhZNSjUA. B: FaDIpCgYkGk, KSYfck7DRWE, BD2tCXSWbQI, F8Nh7sJl4gU. C: cCpHiWwA2Rg, g5Jd31qDSjo, SocOQlmFAiw, 801ejEC_yq4, BNMpdylnIXU. F: LCO8R_qZ-cA, 1T7ueLPuq94, brF2vzR_XIw, VutzIK3DqZE, plus Hbl1584vzAo, AM3r5GycTOY and LG7gjNWi1MY at 160x90.
- **Frames viewed, too small or dark to say anything about hands (3):** zIBBEggIXBw, vBIVet7QPAE, nmcMjEoDL4o. Only gross posture is quoted from these.
- **Subtitles read (20).** In full: C-5qFyU9QNU, z0mFNt1ZTBw, tkwM9vCmIbg, Kqz7_cvg2iM, F54nVlEorM0, IPMaEb_CBLU, fpnO6-y4VlI, NwgjT6MbRoI, xZanGnb1XeA, FEz_hUwwmj4, ya9GaqWdjnE, VutzIK3DqZE. Keyword-filtered only, so I may have missed points: mpa_xy_yg4k, 1dLfSkKLhuk, OxEJnKtSPcI, BMYZiz4FdjQ (garbled captions), h9WLrz_hmLE, xap__ybVM5A, aJW4JsO-130, whjuOJDmPQI.
- **Failed:** subtitles for Ce2EapnAQUI and g5Jd31qDSjo (HTTP 429, tried twice); no English subtitles exist for UY3uiQ3cmPs, QmbNQZPob_U, R5xVG7cL4eA; 05AgTCmWDt8 has captions but they are empty (music only). Three searches containing the word "Exhibitionist" returned nothing; the Jeff Mills videos were found with a different query.
- Storyboards were downloaded but not examined for RWVBoK4idas, qK-s9QjUpHI, tcNIL9kmyhU, 3V3YbUJoFUI, Ei3THnJaFs8, THgeFErZI_4 (all 240-320 px wide and worth a look) and UgK8h9xRFls, o1Hrpk_PzVk, Z4_KD9UhdCE, hS_Uoo7lIIc (160x90).

Sheet timing: sheets are 3x3 (9 frames) for the larger storyboards and 5x5 (25 frames) for the 160x90 ones. Frame *n*, reading left to right and top to bottom, is at `start + (n-1) x interval`. Start times and the interval are in each folder's `frames.txt`.

---

## What the hands do

### Where hands spend their time

Rough tally of all 108 frames sampled across the 55-minute HOR vinyl set (96qhgQMtX2c) **[F]**. Counted by eye, so treat as +/- 5 points:

| Where the hands are | Share of frames |
|---|---|
| On the mixer (one or both hands) | ~33% |
| On a deck: record, platter, tonearm or pitch | ~33% |
| Away from the gear: at the crate, or holding a record or sleeve | ~22% |
| Idle, standing back, looking around | ~6% |
| Handling the headphones (putting on, holding) | ~5% |

Two other home videos agree on the surprising part, which is how often **nobody is touching anything**: in the Xone:92 overhead (KSYfck7DRWE **[F]**) and the rotary side-cam (BNMpdylnIXU **[F]**) there are runs of consecutive frames, so 20 s or more, where the DJ is out of frame entirely or only legs pass through. On CDJs there is no crate trip, and the time goes to the mixer instead (x8uIOM6iFCs **[F]**).

### Rest ("home") positions between moves

The pattern across all of these: **one hand parked on a deck at a control corner, the other on the mixer.** Hands rest on what they will need next. (Left/right below is the DJ's own left/right; most cameras face the DJ, so the picture is mirrored.)

- **Deck corner plus low on the mixer.** In the true top-down view (SocOQlmFAiw **[F]**, sheet M002, 04:06 onward) the commonest frame is: left hand at the near-left corner of the left deck (the start/stop corner) or on the edge of its record, right hand on the bottom third of the mixer where the faders are.
- **Jeff Mills, side-hands angle** (cCpHiWwA2Rg **[F]**, M005 frames 4-5 at ~07:57, M011 frames 1-2 at ~16:25): one hand lies flat, fingers extended and together, at the front-left corner of his outer right-hand deck, right beside the red strobe lamp where start/stop is. The other hand is arched over the mixer with fingertips down on the knobs.
- **Jeff Mills, front** (g5Jd31qDSjo **[T]**): right hand flat at the front-right corner of the outer deck, which is where the pitch fader is; left hand on the lower part of the mixer.
- **Pitch corner plus arm hanging.** KSYfck7DRWE **[T]**: one hand resting flat at the pitch-fader corner of a deck, the other arm loose at the side, body about a forearm's length back from the table.
- **Both hands parked on the mixer.** FaDIpCgYkGk **[T]**: one hand rests on the near edge of the mixer by the faders, the other reaches further up with fingertips down among the EQ knobs and the wrist floating clear of the panel. 96qhgQMtX2c **[T]**: one hand pinching a small knob between thumb and index with the other fingers curled, the other arm down at the side.
- **One arm folded across the stomach, the other hand's fingers on the mixer edge.** 96qhgQMtX2c **[F]** M007 frame 2 (~10:36), and again in M016 frames 4 and 9 (~24:22, ~25:12). Reads as "listening, waiting".
- **Fingertips resting on the front lip of the mixer**, not on any control (F8Nh7sJl4gU **[F]** M016 frame 8, ~25:05).

### Knobs

- **Grip from above, three fingers.** In every close-up, an EQ knob is held with thumb plus index and middle finger coming down from above, wrist raised, the other two fingers curled or lifted clear. Seen in the DJ EZ mixer cam (NFJIbNIAABo **[F]** M005 frames 3 and 7 at ~07:48 and ~08:28; M010 frames 5-6 at ~15:36), the HOR thumbnail (96qhgQMtX2c **[T]**) and Jeff Mills's side angle (cCpHiWwA2Rg **[F]** M011 frame 1).
- **Two hands on two channels at once.** NFJIbNIAABo **[F]** M010 frame 5: both hands over the mixer about one channel strip apart, each pinching a knob in the same row. This is the visible half of a bass swap. KSYfck7DRWE **[F]** M020 frames 4-8 (~30:22-31:02) and F8Nh7sJl4gU **[F]** M016 frames 1, 4, 5 show the same two-hands-side-by-side shape on a Xone:92.
- **Rotary knobs are held differently.** BD2tCXSWbQI **[T]**: the big channel knob is gripped from the *side*, thumb underneath and index plus middle on top, palm open and hovering, wrist straight, forearm level with the mixer top. BNMpdylnIXU **[T]**: both hands on the small rotary together, fingers splayed, forearms horizontal.
- **How far and how fast** cannot be read from stills. From subtitles: the incoming bass is taken "about halfway" out rather than fully, with mids and highs dialled back "a little" (z0mFNt1ZTBw **[S]**); the outgoing track is "slowly rolled out" on the EQ over the bars before the phrase change rather than cut (C-5qFyU9QNU **[S]**); full, dramatic swaps are described as optional and sometimes making the other track "sound like it just disappeared" (z0mFNt1ZTBw **[S]**). Xone buttons need a firm press; a soft press does not engage the filter (ya9GaqWdjnE **[S]**).

### Records, platter, tonearm, pitch

Technique as taught (subtitles), with the frames that show it:

| Move | What the hand does | Source |
|---|---|---|
| Find the first beat | Needle down at the start, play, stop on the first kick. | mpa_xy_yg4k, IPMaEb_CBLU **[S]** |
| Back-cue (hold the record ready) | A finger on the **side/outer part of the vinyl**, rocking the first beat back and forth. The platter keeps spinning underneath because of the slipmat. | IPMaEb_CBLU, mpa_xy_yg4k **[S]** |
| Release | **Push** the record forward on the beat. Do not just let go, or the start lags. On a high-torque SL-1210 a released record is at speed almost at once. | IPMaEb_CBLU, mpa_xy_yg4k **[S]** |
| Slow it a touch | Fingertip dragged lightly against the **side of the platter** (the dotted rim). Light pressure. | IPMaEb_CBLU, mpa_xy_yg4k **[S]** |
| Speed it a touch | Finger on the **label**, pushed clockwise. Or pinch and twist the **spindle**; the tutor says most vinyl DJs he sees use the spindle. | IPMaEb_CBLU, mpa_xy_yg4k **[S]** |
| Make it stick | After every nudge, move the **pitch fader the same way** (nudged forward, so fader toward you = faster). Then listen again. Repeat for the whole blend. | IPMaEb_CBLU **[S]** |
| Pitch ride (no touching the record) | Either a quick big throw of the pitch fader and straight back, or a small offset (about 20% of the travel) held for 5-6 s and then back to exactly where it was. | F54nVlEorM0 **[S]** |

What the frames add:

- **Cueing pose.** Arm extended to the deck, two or three fingertips on the vinyl between label and outer edge, other hand staying on the mixer. Torso rotated 20-30 degrees toward that deck, head tilted down at the record. 96qhgQMtX2c **[F]** M007 frames 5, 8, 9 (~11:06-11:46); F8Nh7sJl4gU **[F]** M011 frames 2-3 (~16:36) and close-up M011 frame 6 (~17:16), where three fingertips lie flat on the vinyl. In the two top-down videos the left hand lands on the left record at about the 7-9 o'clock edge as the DJ sees it (SocOQlmFAiw **[F]** M002; 801ejEC_yq4 **[F]** M005).
- **Just released.** Open hand hovering a few centimetres above the platter edge, fingers spread. F8Nh7sJl4gU **[F]** M016 frame 8.
- **Record edge plus pitch fader, same deck.** Left hand at the 9 o'clock edge of the record, right hand on that deck's pitch fader. 801ejEC_yq4 **[F]** M005 frames 7-9 (~21:46).
- **Needle drop.** Bent forward from the hips over the deck, one hand pinching the headshell finger-lift, the other tucked against the stomach or flat on the table. 96qhgQMtX2c **[F]** M007 frames 4 and 7 (~10:56, ~11:26).
- **Changing the record.** Turn fully away to the crate (back to camera), flick through, walk back holding the sleeve flat against the chest with both hands, slide the disc out at hip height off to one side, old record lifted off with one hand. 96qhgQMtX2c **[F]** M000 frames 6-7 (~00:50-01:00), M007 frame 1, and many frames in M013, M020 and M023. BNMpdylnIXU **[F]** M005 (~20:46-24:50) shows the same plus a crouch to a shelf under the decks (frame 8, ~21:56).
- **Start/stop.** I did not catch a frame of a finger actually on the start/stop button. Its position is known (front-left, under the power dial; Kqz7_cvg2iM **[S]**), and the left hand habitually rests there.

### Faders

- Hands on the **bottom third** of the mixer with head bowed is the fader stance (F8Nh7sJl4gU **[F]** M016 frames 1, 4, 5).
- Four Tet works the mixer with one **extended index finger** per hand pointing down at the fader row rather than a pinch (x8uIOM6iFCs **[F]** M007 frames 1-4, ~10:28-10:58). On these small frames I cannot tell fader from button.
- One tutor mixes with channel faders **fully up** and uses the EQ as the "volume", only touching faders to finish (OxEJnKtSPcI, C-5qFyU9QNU **[S]**).

---

## What the body does

- **Default stance.** Feet under the table edge, torso tipped forward 10-20 degrees, head bowed 30-40 degrees to look at the mixer, elbows bent about 90 degrees and held near the ribs, shoulders slightly rounded. 96qhgQMtX2c **[F][T]**, FaDIpCgYkGk **[T]**, cCpHiWwA2Rg **[F]**, g5Jd31qDSjo **[T]**.
- **Wide-armed stance.** One hand on an outer deck and one on the mixer puts the hands well over a metre apart; the chest stays square to the mixer and only the head turns. g5Jd31qDSjo **[T]**, F8Nh7sJl4gU **[F]** M011 frame 3.
- **Reach.** For a far deck the whole torso leans sideways and the opposite hand plants on the table or mixer edge for support. jQRI3b2SX8c **[F]** M000 frames 4 and 6 (~00:30, ~00:50), M006 frames 4-5 (~09:28), and repeatedly in M044-M061; vBIVet7QPAE **[F]** (low-res) shows the same from the side.
- **Club energy is a deeper version of the same pose**, not a different one: Len Faki stays bent over with both hands on the mixer for most frames and looks up only briefly (jQRI3b2SX8c **[F]**); DJ EZ is folded almost double over the gear (NFJIbNIAABo **[F]**).
- **Stepping back.** Between mixes the body straightens, takes a half step back, arms drop or fold, eyes go to the room. 96qhgQMtX2c **[F]** M007 frame 6 (~11:16); KSYfck7DRWE **[T]**.
- **Head nod, bounce, sway:** not measurable from stills. **[GK]** A nod on every beat with a deeper dip on beat 1 of the bar, knees soft, is the usual read; treat it as an animation default, not a finding.

### Headphones

| Habit | Where seen |
|---|---|
| **Round the neck**, cable hanging down the chest, while working the mixer | 96qhgQMtX2c **[F]**, FaDIpCgYkGk **[T]**, x8uIOM6iFCs **[F]** (nearly every frame), jQRI3b2SX8c **[F]**, sLcvUGn_4VM **[F]** |
| **Put on or adjusted with both hands**, elbows flared, head tipped | 96qhgQMtX2c **[F]** M000 frame 9 (~01:20) and M016 frame 3 (~24:12); x8uIOM6iFCs **[F]** M014 frame 3 (~21:17); F8Nh7sJl4gU **[F]** M011 frame 7 (~17:26) |
| **One hand lifting or pressing one cup, other hand on the record or player** | F8Nh7sJl4gU **[F]** M000 frame 2 (~00:10): one hand at a cup, the other arm down on the deck, head tilted toward the raised hand. NFJIbNIAABo **[F]** M010 frame 7 (~15:56): one hand pressing a cup, the other on the player |
| **Both hands pressing both cups**, elbows high ("listening hard") | F8Nh7sJl4gU **[F]** M005 frame 8 (~08:38), a close-up; sLcvUGn_4VM **[F]** M013 frame 3 (~19:45) |
| **Worn fully on the head throughout** | Jeff Mills (cCpHiWwA2Rg **[F]**, g5Jd31qDSjo **[T]**); the rotary home set (BD2tCXSWbQI **[F][T]**) |
| **Held in the hand** at hip or chest while standing back | 96qhgQMtX2c **[F]** M000 frame 3 (~00:20), M029 frame 2 (~43:25) |
| Cup wedged between ear and raised shoulder | **Not seen** in any frame I viewed. **[GK]** It is a real and common habit; include it if you like, but it is not evidenced here. |

How cueing works on the mixer **[S]**: each channel has a CUE button just above its fader; pressing it sends that channel to the headphones even with the fader down. A CUE/MASTER mix knob blends cued channel against the main output. Split cue (mono split) puts the cue in one ear and the master in the other (xZanGnb1XeA, h9WLrz_hmLE). A vinyl tutor calls headphones "non-negotiable" for vinyl because the beatmatching mess must stay out of the speakers (mpa_xy_yg4k).

### Crowd-facing gestures

All **[F]**; timing against the music is inferred, not observed.

- **One arm straight up, open hand or pointing**, the other hand still on the mixer: sLcvUGn_4VM M000 frame 5 (~00:40) and M006 frame 6 (~09:47); jQRI3b2SX8c M044 frame 1 (~1:05:47).
- **Fist pump at chest height**, elbow bent, short and tight: jQRI3b2SX8c M050 frame 1 (~1:14:46).
- **Clap at chest height, smiling, looking out**: sLcvUGn_4VM M013 frame 8 (~20:35).
- **Loose raised hand "conducting" at shoulder height**, index finger extended: x8uIOM6iFCs M022 frames 1 and 6 (~32:56, ~33:46).
- **Towel to the face or head with one hand**: jQRI3b2SX8c M011 frame 5 (~17:06) and M044 frame 5 (~1:06:27).
- **Looking out at the crowd with a hand left resting on the deck**: nmcMjEoDL4o M005 (low-res).
- **Inference on timing:** in the Nia Archives set (jO5JhZNSjUA) the light is red in most frames and white in a few, and the white frames are the ones with the most crowd arms in the air (e.g. M005 frame 4 ~07:57, M016 frame 6 ~24:43). That suggests white light marks drops. In those frames the DJ is still head-down over the gear, which fits the common pattern of the DJ's own gesture coming a beat or two *after* the drop lands, once the hands are free. **[GK]** for that last clause.
- Crowd hands up and clapping at the very end of a set while the DJ is still looking at the decks: jQRI3b2SX8c M061 frames 7-8 (~1:32:13).

---

## Booth layout

- **Order is deck, mixer, deck in one straight line**, touching or within a couple of centimetres. 96qhgQMtX2c **[T]**, FaDIpCgYkGk **[T]**, KSYfck7DRWE **[T]**, SocOQlmFAiw **[F]**, BNMpdylnIXU **[T]**.
- **With three decks the mixer is off-centre.** Jeff Mills, from the audience: deck, deck, mixer, deck. From his own side that is one deck on his left, the mixer, then two decks on his right (cCpHiWwA2Rg **[F]** overhead angle, enlarged to check; g5Jd31qDSjo **[T]**). The Yoyaku instore also has three Technics around a Xone:92 (F8Nh7sJl4gU **[F]**).
- **Orientation is "normal", not "battle".** In every vinyl booth where I could tell, the tonearm is on the DJ's right of each platter with its pivot at the back, the pitch fader is at the front right and start/stop at the front left: 96qhgQMtX2c **[T]**, FaDIpCgYkGk **[T]**, KSYfck7DRWE **[T]**, cCpHiWwA2Rg **[F]** (overhead angle), SocOQlmFAiw **[F]**, 801ejEC_yq4 **[T]**, BNMpdylnIXU **[T]**. I could not determine it for F8Nh7sJl4gU. **[GK]** Battle orientation (deck turned 90 degrees anticlockwise, tonearm at the back) is a hip-hop/scratch convention and would look wrong for a house/techno tomb rave.
- **A variant:** mixer *behind* the decks, two turntables side by side in front (801ejEC_yq4 **[T]**). Home setup, not a club layout.
- **Proportions.** The club mixer looks about three quarters the width of a turntable and slightly deeper (96qhgQMtX2c **[T]**, KSYfck7DRWE **[T]**). A boutique rotary is much smaller, about half a deck wide and half as deep, with wooden side cheeks (BNMpdylnIXU **[T]**). **[GK]** catalogue sizes: SL-1200MK2 453 x 360 x 162 mm; DJM-900NXS2 about 333 x 414 x 108 mm; Xone:92 about 320 x 358 x 88 mm. So two decks plus a club mixer is about 1.24 m wide.
- **Height.** The top of the gear sits at about hip height, so forearms slope down to it (96qhgQMtX2c **[F]**, FaDIpCgYkGk **[T]**). Decks and mixer tops are roughly level with each other in the booths seen; the Jeff Mills mixer appears to sit slightly higher than the decks (g5Jd31qDSjo **[T]**).
- **Record storage is behind or below, never in front.** A crate or shelf about a metre behind, needing a full turn (96qhgQMtX2c **[F][T]**: white shelf behind, slightly to the DJ's left); crates across the room behind (F8Nh7sJl4gU **[F]**); records fanned out on a sofa behind (FaDIpCgYkGk **[T]**); an open flight case behind the DJ on his left (cCpHiWwA2Rg **[F]**); a shelf under the decks (BNMpdylnIXU **[F]**).
- **Monitors.** Small speakers on stands at head height either side and slightly behind the DJ, plus the room PA (NFJIbNIAABo **[F]**); small monitors at table level left and right at home (BD2tCXSWbQI **[F]**); horn speakers on shelves in the record shop (F8Nh7sJl4gU **[F]**).
- **Cables** leave from the back of the mixer in a fan (SocOQlmFAiw **[F]**) and hang off the back edge of the table (g5Jd31qDSjo **[T]**). The headphone cable hangs down the DJ's chest to the mixer (96qhgQMtX2c **[F]**, FaDIpCgYkGk **[T]**); **[GK]** on a DJM the socket is at the near-left corner.
- **Lighting.** Flat bright fluorescent with one bare tube on the side wall (HOR, 96qhgQMtX2c). Dark room, blue/red wash, projection behind (Boiler Room, jQRI3b2SX8c, jO5JhZNSjUA). Purple LED wash on a sticker-covered wall (The Lot Radio, x8uIOM6iFCs). Dark with one coloured neon sign behind and gear LEDs glowing (Mixmag Lab, NFJIbNIAABo). Black void with a hard key light on hands and decks only (Jeff Mills, cCpHiWwA2Rg). The last one is the closest to "torch-lit": gear and hands readable, everything else falling off to black.
- **Camera positions that read well**, for the toy's own camera: front and slightly above, wide enough for both decks (HOR); straight down (Crossfader, Jake Noble); a low side angle along the line of decks with hands crossing the frame (Jeff Mills side angle, Union rotary close-up).

---

## How a transition goes (with numbers)

### Units

- 4 beats = 1 bar. **32 beats = 8 bars = 1 phrase.** Something in the track changes at every phrase boundary: drums added or removed, a breakdown starts, a drop lands (1dLfSkKLhuk, mpa_xy_yg4k **[S]**). Another tutor lists phrase lengths of 8, 16, 32 and up to 64 without saying beats or bars (IPMaEb_CBLU **[S]**).
- **Start the incoming track on beat 1 of a phrase** in the playing track (1dLfSkKLhuk **[S]**). Getting this wrong is described as the quickest giveaway of an amateur (mpa_xy_yg4k **[S]**).
- Tempo ranges quoted: house 120-130 BPM, drum and bass 170-180 (IPMaEb_CBLU **[S]**).
- Arithmetic (mine): 8 bars lasts 15.0 s at 128 BPM, 14.2 s at 135, 13.7 s at 140, 11.0 s at 174. 16 bars is double.

### Timeline of a standard blend

`T` is the transition point: beat 1 of the phrase where the new track takes over. From C-5qFyU9QNU **[S]** unless noted.

| When | What happens | Hands |
|---|---|---|
| Before T-16 bars | Incoming record cued on its first beat, held. Channel fader down, CUE on. Incoming **LOW about half out, MID and HI trimmed a little** (z0mFNt1ZTBw). Trim at 12 o'clock (OxEJnKtSPcI). | One hand on the record, other on headphone cup or mixer |
| **T-16 bars** | Release the incoming on the phrase boundary. | Push-off on the record |
| T-16 to T-8 (**8 bars**) | **Beatmatch in the headphones**: listen, nudge, correct pitch, repeat (IPMaEb_CBLU). 2 BPM of difference was about 1.5% on the pitch fader in the demo (Kqz7_cvg2iM). | Record edge / platter rim / spindle, then pitch fader |
| T-8 to T (**8 bars**) | **Bring the incoming in** under the end of the outgoing phrase, by fader or by easing the EQ up. | One hand per channel on the mixer |
| **T ("the one")** | **Bass swap**: incoming LOW back to 12 o'clock, outgoing LOW down, on the first beat of the new phrase. The incoming is now dominant. | Two hands, one on each LOW knob, turning in opposite directions |
| After T | Either style A or style B below. | |

**Style A, "swap on the one" (long blend).** After the swap both tracks keep playing together. End it when either track is about to change section: take the outgoing out before it "kicks back in" or before the new one "goes to a big bit". The tutor gives no number; one more phrase or two (8 or 16 bars) is my reading of the demos. Suits house, melodic and groove-led music. Options during the overlap: low-pass the old track, or leave its hats over the new track.

**Style B, "out by the one" (quick mix).** Same 16-bar setup, but start **rolling the outgoing track's EQ out early**, during the last bars before T, so that it is **gone on beat 1**. Not a slam: the audience should still hear the end of the phrase. The incoming must have something landing at T (a verse, build or drop), not a bare intro. Suits vocal tracks and anything with clashing melodies.

Other rules from the same tutors **[S]**:

- With only one track playing, the EQ sits at 12 o'clock. The EQ is touched only while two tracks overlap (z0mFNt1ZTBw).
- **Working up** (start with the incoming EQ low and ease it in) is the safe default. **Working down** is for when the new track should come in hard right as a section ends; the captions give the purpose but not the exact knob moves (z0mFNt1ZTBw).
- Taking the highs off the *outgoing* track makes room for the new one (z0mFNt1ZTBw).
- Do not exit with a fast fader pull; dissolve the outgoing track with the EQ (BMYZiz4FdjQ, garbled captions).
- For techno, give yourself 16-24 bars and use a short loop on the incoming track's intro to buy time; an isolator-type EQ lets you keep only one band of a track playing (BMYZiz4FdjQ, garbled captions, low confidence).
- **Vinyl never stays locked.** A very good match holds for one to three minutes, then drifts; expect a corrective nudge every few bars for the whole overlap (mpa_xy_yg4k).

### Filter

- One knob per channel, **centre = off, left = low-pass, right = high-pass** (fpnO6-y4VlI, NwgjT6MbRoI, FEz_hUwwmj4 **[S]**).
- Resonance (the PARAMETER knob on a DJM): **about 10 o'clock for a smooth sweep**, past 12 for a gritty, peaky one (fpnO6-y4VlI **[S]**).
- Filter as a bass swap: high-pass the incoming before it comes up, then return it to centre at T while sweeping the outgoing away (fpnO6-y4VlI **[S]**).
- Preset and punch: park the knobs at about 10 o'clock or 2 o'clock, then switch the filter on for both channels at once just before T and off again after the swap, hiding the swap inside the filter (fpnO6-y4VlI **[S]**).
- Tension: bring the high-pass in slowly through a build-up until almost no low end is left, then snap back to centre on the drop (NwgjT6MbRoI **[S]**).
- Low-pass can replace the fader for a gentle entrance (NwgjT6MbRoI **[S]**).
- **Sweep length in bars was not stated in any subtitle I read.** **[GK]** 4 or 8 bars up, released on beat 1, is the usual shape; treat as a default to tune.

### Echo-out

From tkwM9vCmIbg **[S]**:

- The key is a **high-passed echo**: only mids and highs feed the echo, so the tail does not fight the next track's kick and bass. If the unit cannot do that, **cut the channel's LOW first**, then engage the echo.
- Echo time **1/1 (one beat)**.
- Suggested settings on a software echo: **depth about 50%, feedback about 70%, high-pass cutoff at about 10-11 o'clock**.
- Trigger: echo on, then drop the fader (or throw the crossfader). Without post-fader effects, the old-school way is to **stop the deck** and let the echo ring.
- It can be timed to catch a single hit, e.g. one snare.
- Not for every transition.
- A high-pass before any echo, loop roll or spinback keeps it clean; a climactic loop without it is described as sounding like a machine gun (fpnO6-y4VlI **[S]**).

### Gain staging

From OxEJnKtSPcI **[S]**:

- Three stages: trim (input gain, above the EQ), channel fader, master.
- **Trims at 12 o'clock** by default; turn one up only for a quiet record. The alternative school sets the trim so the meter sits at **0 dB, where green ends**.
- Channel faders fully up; balance with EQ.
- Peaks may touch red briefly; the meter must never sit in red. On a DJM-900NXS2 a CLIP light flashes if you push further (FEz_hUwwmj4 **[S]**).
- Master just under red. Set the room first, then turn the booth monitor down to nothing and bring it up until it balances.
- A quieter incoming track that is not corrected with trim is called out as a common audible mistake.

---

## Mixer facts

### Pioneer DJM-900NXS2 (the club default)

Layout and behaviour from FEz_hUwwmj4 and h9WLrz_hmLE **[S]**; the HOR and DJ EZ frames (96qhgQMtX2c **[T]**, NFJIbNIAABo **[F]**) show a DJM of this family from the front.

- What each control does is from the subtitles. **Where it sits on the panel is [GK]**, since the subtitles rarely say and the frames are too small to read labels.
- Four channel strips. Each, top to bottom: input selector, **TRIM**, **HI / MID / LOW**, **COLOR** knob, **CUE** button, channel fader, crossfader assign switch (**A / THRU / B**). Level meter beside each strip, with a CLIP light.
- **EQ CURVE switch: EQ or ISOLATOR.** In ISOLATOR, a band turned fully down is silent, and all three down means no sound. In EQ, a band turned down is reduced but never fully silent. **[GK]** figures from the manual: EQ mode -26 dB to +6 dB, ISOLATOR mode -infinity to +6 dB, TRIM -infinity to +9 dB. I do not have confirmed crossover frequencies; do not quote any.
- **Channel fader curve** and **crossfader curve**, three positions each: from a sharp cut (sound appears as soon as the crossfader leaves one side) to a gradual blend.
- **Sound Color FX** (left side, six buttons): Space, Dub Echo, Sweep, Noise, Crush, Filter. One COLOR knob per channel, plus one shared **PARAMETER** knob: resonance for Filter, feedback for Dub Echo, tail length for Space.
- **Beat FX** (right side): Delay, Echo, Ping Pong, Spiral, Reverb, Trans, Filter, Flanger, Phaser, Pitch, Slip Roll, Roll, Vinyl Brake, Helix. Channel-select knob, beat buttons from 1/16 up, X-Pad strip, LEVEL/DEPTH knob, big ON/OFF button at bottom right. **FX FREQUENCY** buttons choose whether the effect hits lows, mids, highs or all. A light on the strip shows which channel the Beat FX is on.
- **Headphones** (lower left): MONO SPLIT / STEREO switch, MIXING knob (CUE to MASTER), LEVEL knob, two sockets (6.3 mm and 3.5 mm).
- **Master** (upper right): MASTER LEVEL, master meter, BALANCE, BOOTH MONITOR. Mic section upper left with its own EQ and talk-over.
- Two USB ports so two DJs can hand over.

### Allen & Heath Xone:92 / Xone:96

From xap__ybVM5A, aJW4JsO-130, whjuOJDmPQI, ya9GaqWdjnE **[S]**; F8Nh7sJl4gU **[F]** and KSYfck7DRWE **[T]** show a 92 in use.

- **Four-band EQ per channel: HI, HI-MID, LO-MID, LOW.** The extra band is the point of the mixer.
- Centre frequencies as stated by one reviewer: on the **96, HI-MID about 1.1 kHz and LO-MID about 300 Hz**; on the **92 the HI-MID sits higher, about 2 kHz**. He measures the mid boost as +10 dB on one and +6 dB on the other and says the 96 boosts further; the 92's LOW cut sounded deeper to him. Single source, by ear.
- **[GK]** from the 92 manual: HI and LOW go from full kill to +6 dB, the two mids from -30 dB to +6 dB.
- **Two analogue filters (Filter 1, Filter 2)**. Each has three mode buttons, **HPF / BPF / LPF**, which can be combined; a large frequency knob; and a resonance knob labelled **mild to wild**. Each channel has buttons to route it to Filter 1 or Filter 2. High-pass at "wild" gives a big bass bump at the cutoff. The filter does not self-oscillate.
- The **92 has an LFO** wired to filter cutoff; the 96 drops it and adds **CRUNCH** (overdrive) and click-free switching.
- Two aux sends per channel, two return channels with their own EQ, booth EQ and two independent headphone cue sections on the 96, selectable fader curves on the 96.
- The 96 was designed so that "with your eyes closed and your hands on it, it is a 92": same knob positions.
- Standard Xone fader law is described as doing nothing for the first part of the travel and then arriving quickly, which is why the 96 adds curve options.
- Feel: firm knobs with resistance, buttons that want a decisive press.

### Rotary mixer

- No rotary walkthrough had usable subtitles, so this is frames plus **[GK]**.
- Frames: a row of **large round volume knobs** along the bottom where faders would be, smaller EQ/aux knobs above, a short LED meter, wooden side cheeks, no crossfader (BD2tCXSWbQI **[T]**, BNMpdylnIXU **[T]**). The unit is far smaller than a club mixer.
- **[GK]** Typically 2 or 4 channels, 2- or 3-band EQ per channel or none, a 3-band master isolator, a per-channel high-pass filter on some (MasterSounds Radius). Blends are slow, two-handed turns of two volume knobs in opposite directions.

### Technics SL-1200 / 1210

- Controls left to right along the front, from Kqz7_cvg2iM **[S]**: **power dial** (its red lamp shines on the platter rim), **start/stop** directly below it, **33 / 45** buttons beside that, pop-up **target light** that lights the needle, then the **tonearm** with cartridge and stylus, then the **pitch fader** at the far right.
- **Pitch range +/-8%**, with a light at the centre (0%) position (Kqz7_cvg2iM, mpa_xy_yg4k **[S]**).
- **Fader toward you = faster, away = slower** (IPMaEb_CBLU **[S]**).
- High torque: a held platter is back at speed almost immediately when released (mpa_xy_yg4k **[S]**).
- Seen in frames: silver or black body, S-shaped tonearm with a round counterweight at the back right, 45 adaptor puck in the back-left corner, platter with a dotted strobe rim, slipmat with the Technics logo, red glow at the front-left (96qhgQMtX2c **[T]**, BNMpdylnIXU **[T]**, 801ejEC_yq4 **[T]**).
- **[GK]** Platter 332 mm across, start-up 0.7 s, quartz lock at 0% on the MK2.

---

## Tomb Raider look

Sources: TR1 PlayStation longplay LCO8R_qZ-cA (27 sheets, about 240 frames), St. Francis' Folly brF2vzR_XIw, Khamoon Hbl1584vzAo, Caves AM3r5GycTOY, TR2 longplay 1T7ueLPuq94, TR2 Great Wall LG7gjNWi1MY, and Digital Foundry's analysis VutzIK3DqZE. All **[F]** unless tagged otherwise.

### Camera

- Behind and a little above the character, looking slightly down. Measured on six frames of one sheet (LCO8R_qZ-cA M005, 07:29-08:59): the character is **about a third of the frame height while moving in open space (26-37%)** and about 45% when standing still in a room. Centred left-right, head about 40% of the way down the frame, feet at 75-83%. So she sits in the lower middle with the top 40% of the screen free for architecture.
- **Walls push the camera in.** In corridors and against rock it closes to a three-quarter rear close-up with the character filling half the frame or more (LCO8R_qZ-cA M005 frame 6, ~08:19; M070 frame 9).
- **It lifts and tilts down** when she hangs from a ledge, climbs, or works a block (LCO8R_qZ-cA M005 frame 3; Hbl1584vzAo M002 rows 3-5).
- Fixed 4:3 frame. FMV cutscenes are letterboxed inside it.

### HUD

- **There is no permanent HUD.** Most gameplay frames have nothing on screen at all.
- **TR1 health bar: top right.** A thin horizontal bar about 28% of the screen wide and about 2% tall, inset about 5% from the top and right edges, near-black track, **orange-to-yellow fill**. It is absent from most frames and present in a few (LCO8R_qZ-cA M005 frame 4 ~07:59; M038 frames 3-4; brF2vzR_XIw M001 frame 5). **[GK]** It shows while weapons are drawn or health is changing, then disappears.
- **TR1 air bar: same place, light blue/cyan fill**, shown only underwater (LCO8R_qZ-cA M010-M011, M038 frames 1-2). I never saw both bars in one frame, so I cannot say where each sits when both are up.
- **TR2 health bar: top right, thin pale outline, fill is a red-to-yellow-to-green gradient** (1T7ueLPuq94 M003 frame 1 ~04:29; LG7gjNWi1MY M001).
- **Pickup text, ammo counter:** not caught in any frame I viewed. **[GK]** In TR1 an item pickup shows the small item sprite briefly in a screen corner with no text; ammo count appears top right under the health bar when a weapon with limited ammo is drawn.

### Menus and type

- **TR1 title screen** (LCO8R_qZ-cA M001 frames 4-5, ~02:00-02:10; AM3r5GycTOY M000): black-to-deep-red background with a low-poly render of Lara's face at right, lit hot orange from one side. "**TOMB**" in fat slab capitals textured like rust or lava; "**RAIDER**" under it in wide, letter-spaced, engraved gold capitals. Centre-left, a **thin yellow ring** with clusters of tick marks and **three glowing orange hexagons** at roughly 12, 4 and 8 o'clock. Bottom line: "TM & (c) Core Design Ltd 1996" in dim red-brown.
- **Passport.** Selecting it floats a passport in the centre, which opens like a book to a pale page with a red-backed photo. Caption under the item ("Game"), button hints bottom left ("X Select") and bottom right ("O Go Back").
- **Level select** (brF2vzR_XIw M000 frame 1): a list centred over the title art, header "Select Level", level names in title case, a thin gold frame, a darker band behind the highlighted row.
- **Menu font:** chunky slab-serif bitmap capitals and lower case with a slightly uneven, hand-cut feel. Each glyph has a vertical **gradient from pale yellow at the top to orange-brown at the bottom** and a dark outline or drop shadow. Text is always centred.
- **End-of-level stats** (LCO8R_qZ-cA M008 frame 7, ~12:58; enlarged while researching): plain **black screen**, six centred lines evenly spaced at about 12% of screen height apart:

  ```
  Caves
  KILLS 13
  PICKUPS 6
  SECRETS 2 of 3
  TIME TAKEN 7:21
  (X) Continue
  ```

  Level name in title case and slightly smaller; stat labels in capitals; "of" in lower case; a small grey round button glyph before "Continue".
- **LOADING screen.** TR1: the word LOADING in grey embossed serif capitals, top centre, over a still of the level entrance, with a **dark red progress bar** along the bottom edge (LCO8R_qZ-cA M008 frame 8; brF2vzR_XIw M001 frame 4). TR2: same idea with a **purple bar on a black track** across about 70% of the width near the bottom (1T7ueLPuq94 M002 frame 6, ~03:49).
- **TR2 title:** painterly jungle-green background, "TOMB RAIDER II" in gold-beige Roman capitals top left, Lara at right, a red passport floating centre (1T7ueLPuq94 M002 frame 3).
- **Inventory.** TR2's is a carousel of small 3D items on a **dark red damask wallpaper** that vignettes to near black: selected item front and lower, neighbours higher and smaller (1T7ueLPuq94 M006 frame 5, ~09:38). The TR1 in-game ring was not caught in my frames; the title-screen ring above is the same device.

### World, palette, texture

- **Built from square blocks.** Floors, walls and ledges are a visible grid; a pushable block is one grid cube, about a head taller than Lara (brF2vzR_XIw M001 frames 7-8; Hbl1584vzAo M002). Digital Foundry's wireframe shots show the grid directly (VutzIK3DqZE **[F]**).
- **Textures** are small square tiles repeated per face, blocky and unfiltered up close, with seams at tile edges and visible swimming and warping on large near surfaces (LCO8R_qZ-cA M070 frame 4; 1T7ueLPuq94 M003 frames 4-5).
- **Lighting is baked and uneven.** Faces step from lit to dark between neighbouring blocks, corridors fall to pure black a few blocks away, and open rooms can have a black void where the far wall should be (LCO8R_qZ-cA M005 frame 2; M070 frames 5 and 8; brF2vzR_XIw). No cast shadows; a simple dark blob under the character.
- **Palettes by area:**

  | Area | Look | Frames |
  |---|---|---|
  | Peru, Caves | Cold grey rock, blue-white ice and snow, dull moss green, olive rope bridges; later grey stone-brick ruins with bright ivy | LCO8R_qZ-cA M001-M008 |
  | Peru, Vilcabamba | Mid-grey stone brick with carved geometric bands, yellow-brown plank ceilings and wooden platforms, turquoise pools with white flecks, a wall of skulls | LCO8R_qZ-cA M009-M013 |
  | Peru, Inca temple interiors | **Ochre/orange carved relief panels, salmon-red floors and ceilings, pale grey stone trim with a dark red step-fret border** | LCO8R_qZ-cA M016, M032 |
  | Peru, Lost Valley | Lush green ground, grey cliffs, white waterfalls, black sky | LCO8R_qZ-cA M022, M027 |
  | Greece (St. Francis' Folly) | Very dark sienna brick, sand-coloured columns and blocks, patterned mosaic floors | brF2vzR_XIw; LCO8R_qZ-cA M076-M081 |
  | Egypt (Khamoon) | Sandstone yellow, hieroglyph panels, cream walls with a lotus frieze in brown and green | Hbl1584vzAo |
  | TR2 Great Wall | Grey-green mottled rock, dark stone interiors | 1T7ueLPuq94 M003; LG7gjNWi1MY |
  | TR2 Venice | Off-white plaster, red awnings, terracotta roofs, dark wood interiors, chequered floors | 1T7ueLPuq94 M023-M032 |

- **Underwater** the whole screen is tinted: teal/turquoise in Peru, green in Egypt (LCO8R_qZ-cA M010; Hbl1584vzAo M002). Digital Foundry notes the blue underwater tint is specific to the PlayStation version (VutzIK3DqZE **[S]**).

### Objects

- **Save crystal (TR1 PlayStation):** a floating, faceted, elongated diamond in saturated **blue-violet**, flat-shaded in three or four tones, roughly waist-to-shoulder tall, hovering at about hip height. It is the most saturated thing on screen (LCO8R_qZ-cA M070 frame 9, ~1:46:08; M027 frame 8, ~41:35; M013 frame 3, ~19:47).
- **Pushable block:** a plain pale concrete cube with dark scuffs in Greece; a dark brown cube carved with hieroglyphs in Egypt (brF2vzR_XIw M001; Hbl1584vzAo M002).
- **Wall switch:** what appears to be a small dark lever on a blue-grey plate set into the wall at about chest height, the character standing square to it for three consecutive frames (LCO8R_qZ-cA M012 frames 4-6, ~18:28-18:48). Too small to describe the lever itself.
- **Pickups:** tiny flat sprites on the floor, a few pixels across at normal camera distance, tan or gold (LCO8R_qZ-cA M005 frame 6). A row of small orange-gold objects along a ledge appears in M012 frames 7-9 and M013 frames 1-2; at this size I cannot tell whether they are pickups or decoration. I could not identify a medipack in any frame. **[GK]** Small medipack: small white-and-red pouch. Large medipack: larger pack with a red cross.
- **Other set dressing seen:** carved stone face doors, stone cogs on a wall, rope bridges, a wall of skulls, floor spikes (white with red tips), and in TR2 spiked walls, white cobwebs and a skeleton.
- **Torches and flames:** I did **not** catch an in-game wall torch or flame in any gameplay frame. The only torches seen are in TR2's pre-rendered intro (1T7ueLPuq94 M001: a handheld torch and wall torches with orange teardrop flames in a dark red room). **[GK]** TR1 has almost no torches; TR2 uses flame emitters as animated 2D sprites with no real light cast in the PlayStation version. Since the tomb is torch-lit, this is the item most worth a targeted follow-up.

### Rendering traits

From VutzIK3DqZE **[S]**:

- PlayStation release dated 14 November 1996; runs at a "surprisingly stable" **30 fps**.
- **Affine texture warping** (textures bend and swim; no perspective correction).
- **Gouraud shading** on characters, smoother than the Saturn and DOS versions.
- Higher colour depth than the 8-bit DOS version, but with **heavy dithering**.
- The Saturn version is darker, with whole areas lost to black; the PlayStation one is more vibrant.
- Ambient sound beds with short music cues for key moments, rather than continuous music.

**[GK]**, not from these videos: 320x240 output, no texture filtering, no z-buffer (polygon sorting errors and popping), vertex positions snapped to whole pixels (the wobble), no mip-mapping (distant textures shimmer).

### What says "TR1 on PlayStation" at a glance

1. An empty screen with one thin bar at the top right that appears and disappears.
2. Gold-to-orange gradient slab-serif text, centred, on black.
3. A world visibly made of cubes, with one warm colour family per level.
4. Darkness that starts a few blocks away.
5. A saturated blue-violet crystal floating in an otherwise muted room.
6. LOADING in grey capitals with a thin coloured bar along the bottom.
7. A passport as the menu.

---

## Gaps worth a second pass

- **Motion.** Nothing here measures speed of hand moves, nod depth or gesture timing. Short clips or dense frame grabs of two or three videos (96qhgQMtX2c, F8Nh7sJl4gU, cCpHiWwA2Rg) would settle it; I kept to storyboards and thumbnails as instructed.
- **In-game torches, medipacks, pickup feedback, the TR1 in-game inventory ring** were not caught at 10 s sampling.
- **Exact EQ crossover frequencies** for the DJM-900NXS2 and Xone:92 need the manuals.
- **Filter sweep lengths** were not given in bars by any tutor.
- **Rotary mixers** have no subtitle-backed facts here.
- Category A/B videos marked `-` or `f-` in the tables are vetted to exist but unexamined.
