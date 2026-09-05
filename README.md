<div align="center">

<img src="https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/helios-logo.svg" alt="" width="84">

# HELIOS

**Make your energy visible, in 2.5D.**

A Home Assistant card that turns your Energy dashboard into a living scene:
what your home produces, stores and consumes, as the sun and the real weather
cross your sky.

<img src="https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/helios-preview.gif" alt="The Helios card: the sun crossing its arc over a home, the day's production curve rising around the house, and the live production and consumption chips following along." width="880">

[**Live demo**](https://helios-ha.org/helios/) &nbsp;&nbsp; [**Documentation**](https://helios-ha.org/help/) &nbsp;&nbsp; [**Roadmap**](https://helios-ha.org/roadmap/)

[![Release](https://img.shields.io/github/v/release/ReikanYsora/Helios?display_name=tag&style=for-the-badge&color=e0a106)](https://github.com/ReikanYsora/Helios/releases)
[![HACS Default](https://img.shields.io/badge/HACS-Default-e0a106.svg?style=for-the-badge)](https://github.com/hacs/default)
[![License](https://img.shields.io/github/license/ReikanYsora/Helios?style=for-the-badge&color=blue)](https://www.gnu.org/licenses/gpl-3.0)
[![Stars](https://img.shields.io/github/stars/ReikanYsora/Helios?style=for-the-badge&color=e0a106)](https://github.com/ReikanYsora/Helios/stargazers)
[![Downloads](https://img.shields.io/github/downloads/ReikanYsora/Helios/total?style=for-the-badge&color=e0a106&label=downloads)](https://github.com/ReikanYsora/Helios/releases)
[![Community: Discussions](https://img.shields.io/badge/community-discussions-e0a106?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ReikanYsora/Helios/discussions)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=000000)](https://www.buymeacoffee.com/reikanysora)

<br>

<a href="https://www.youtube.com/watch?v=KrGNsCsGLGg"><img src="https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/trailer-thumb.jpg" alt="Watch the Helios 2026.9.0 trailer, 'Your real sky', on YouTube." width="820"></a>

**[▶ Watch the 2026.9.0 trailer](https://www.youtube.com/watch?v=KrGNsCsGLGg)**

</div>

---

## Install

1. Open **HACS**, search for **Helios**, install it.
2. Reload your browser.
3. On your dashboard: **Edit**, then **+ Add card**, then search **Helios**.

That is the whole setup. Helios reads the **Energy dashboard you already
configured** and wires itself from it: solar, grid, battery and the devices you
track. No API key, no account, no per-card entity list to fill in.

It works **with or without solar panels**. Without them you get the sun, your
home and your consumption; the production layers simply do not appear.

<details>
<summary>Manual install, without HACS</summary>

1. Download `helios.js` from the [latest release](https://github.com/ReikanYsora/Helios/releases).
2. Copy it to `<config>/www/community/helios/`.
3. In `Settings` > `Dashboards` > three-dot menu > `Resources`, add:
   ```yaml
   url: /local/community/helios/helios.js
   type: module
   ```
4. Hard-refresh your browser.

</details>

---

## What you get

* **The sun's real arc** over your own address, with the live sun disc, the
  incidence ray and the irradiance reading (or the sun's azimuth and elevation,
  if you prefer), sunrise and sunset placed where the arc meets your horizon.
* **Your real horizon**, worked out from the terrain around your home, so the sun
  dims the moment it drops behind a hill and not only at the flat horizon, with
  the skyline drawn as a discreet ridge around the scene.
* **The moon**, on its own arc across the same sky, with the actual crescent for
  tonight's phase lit toward the sun. At night by default, always or never if
  you prefer; purely for the eye, it carries no reading.
* **Live flows**, production, grid and battery, each with a bead that travels to
  the home at the speed of the power it carries.
* **A timeline you can scrub**, from yesterday to two days ahead, or back across
  the week and the month. The whole scene follows: sun, shadows, weather, every value.
* **Your real sky**, the local weather painted over the scene: clear-sky
  sunshine that dims as the clouds build, then rain, snow or a thunderstorm,
  each following the timeline as you scrub.
* **Outdoor temperature and humidity**, as two chips with their own day curve,
  and either can be pinned to your own weather-station sensor instead of the
  forecast.
* **What it costs**, a cost chip that reads out your energy spend right now in
  your own currency (a negative rate means you're earning), with its own curve
  to scrub across the day. Shown only when your Energy dashboard tracks a price.
* **The day's curve**, your production or consumption standing on the sun's own
  path around the house, so where a point sits on it *is* the hour.
* **Your devices, grouped**, up to four groups with their own name, colour and
  icon, each with a chip and a curve of its own.
* **Cast shadows** from the buildings around you, projected from real
  footprints, fading as the sun nears the horizon.
* **Built for a wall**, an optional mode that fades the controls away after a
  few seconds and leaves only the scene, with a locked viewing angle you can
  set once and get identically on every device.

Every option is in the visual editor, and the full reference is in the
[documentation](https://helios-ha.org/help/).

---

## Where the numbers come from

Helios follows your Energy dashboard and **never estimates a value**.

A **chip** is always a real-time measurement, read from the live power sensor of
that source. If a source has no live sensor, its chip is not shown and the
editor tells you which one is missing. Nothing is ever derived from a cumulative
meter to fake a "now".

A **curve or a total** is always your own meter data, read through the recorder
statistics: the exact numbers the official Energy dashboard's bars are made of.
Where the dashboard has a figure, Helios shows the same figure.

**Home consumption** is the dashboard's own balance, solar plus import minus
export minus battery, and it appears only once every configured family has a
live sensor to compute it honestly.

If a sensor is detected as mis-wired, Helios hides the affected chips and the
editor explains what to fix, rather than showing a number you cannot trust.

---

## Local by design

Your solar, battery and grid figures never leave your browser. There is no
Helios server, no account and no telemetry.

Two open services are used, neither needs a key: [Open-Meteo](https://open-meteo.com/)
for the weather, and [OpenFreeMap](https://openfreemap.org/) for the map tiles
the ground is drawn from. If you run a local weather station, you can point each
weather reading (temperature, humidity, cloud cover, precipitation, snow, or the
condition) at your own sensor, and it takes over from the forecast for the live
and past hours.

The scene is painted by a self-contained **2.5D engine with no WebGL**: a tilted
vector basemap on a canvas with every overlay projected on top in SVG. Light
enough to stay fluid on a phone, a tablet or an old wall panel, and where a
classic 3D render will not run, this one does.

---

## Also in the Helios family

**[Helios Forecast](https://github.com/ReikanYsora/Helios-Forecast)** is a
solar production forecast that learns from your own panels and runs entirely on
your Home Assistant. It feeds the official Energy dashboard, corrects itself
against what your installation really produces, and exposes a clean set of
sensors. Helios draws its prediction as the dashed curve your production tracks
against, and marks each array you configured there in the scene: a small tile at
its position, turned and tilted the way the panels look, with its own ray to the
sun.

---

<details>
<summary><b>Screenshots</b>, updated every release</summary>

<br>

<img src="https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_01.jpg" alt="Helios at golden hour: the sun's arc and irradiance, the live production, home, grid and device chips, and the cost, temperature and humidity chips along the bottom.">

<img src="https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_02.jpg" alt="Helios: rain falling over an overcast scene, the sun dimmed behind the cloud, with the live chips and the timeline below.">

<img src="https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_03.jpg" alt="Helios: the week's consumption curve standing on the sun's own path around the house, over a golden-hour scene.">

<img src="https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_04.jpg" alt="Helios at dusk: the day curve in blue with sunrise and sunset marked on the sun's path, and the buildings under a low sky.">

An interactive live demo is at [helios-ha.org](https://helios-ha.org/helios/).

</details>

---

## Documentation

| | |
| :-- | :-- |
| [Configuration reference](docs/CONFIGURATION.md) | Every option, in the editor and in YAML |
| [Architecture](ARCHITECTURE.md) | How the engine, the solar maths and the data layer work |
| [Development](docs/DEVELOPMENT.md) | Building from source, and where everything lives |
| [Changelog](CHANGELOG.md) | What changed, release by release |
| [helios-ha.org](https://helios-ha.org) | Live demo, guides and the public roadmap |

---

## Support the project

Helios is built and maintained by one person, in the open, and given away. If it
earns a place on your dashboard, a **star** costs nothing and helps more people
find it. A coffee keeps the next cycle going.

<div align="center">
<a href="https://www.buymeacoffee.com/reikanysora"><img src="https://img.buymeacoffee.com/button-api/?text=Support this project&emoji=☀️&slug=reikanysora&button_colour=5F7FFF&font_colour=ffffff&font_family=Arial&outline_colour=000000&coffee_colour=FFDD00" alt="Buy me a coffee"></a>
</div>

Found a bug or missing something? [Open an issue](https://github.com/ReikanYsora/Helios/issues).
Every idea on the roadmap came from a user.

---

## Special thanks

- [antoineguilbert.fr](https://www.antoineguilbert.fr/helios-home-assistant-carte-3d-avec-lidar/) ([Helios Forecast](https://www.antoineguilbert.fr/prevision-solaire-home-assistant-avec-helios-forecast/))
- [Glooob Domo](https://www.youtube.com/watch?v=bTg4mzb9jwA)
- [Smart-Live](https://youtu.be/zFbppiAmCr0)

---

## Credits

Helios stands on open data, none of which requires an account or a key:
[OpenFreeMap](https://openfreemap.org/) for the vector basemap,
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors for the map
and the building footprints, [Open-Meteo](https://open-meteo.com/) for the
weather, and the Home Assistant Energy dashboard for every energy figure.
Bundled alongside [Lit](https://lit.dev/):
[polygon-clipping](https://github.com/mfogel/polygon-clipping) by Mike Fogel (MIT).

And thank you to everyone who tried Helios, filed an issue, suggested an idea or
just shared a screenshot. That feedback is what shaped the card.

---

## License

HELIOS, an energy visualisation card for Home Assistant.
Copyright (C) 2026 Jérôme CREMOUX (ReikanYsora).

Licensed under the GNU General Public License v3.0, see [LICENSE](LICENSE).
