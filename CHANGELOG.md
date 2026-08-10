# Changelog

All notable changes to HELIOS are documented here.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/),
and the project follows a date-based versioning scheme (`YEAR.MONTH.PATCH`).

---

## 2026.9.0

The weather release, "Your real sky": the scene now reflects the weather over
your home, and the outdoor temperature and humidity join the card. Currently in
beta (`2026.9.0-b0`).

### Added: the terrain horizon

Helios now knows the shape of the land around your home. It works out the local
skyline from the surrounding terrain (worldwide, with no setup on your part) and
uses it two ways: the sun **dims realistically the moment it drops behind a hill
or a mountain**, not only at the flat horizon, and a discreet **horizon ridge** is
drawn around the house. The realistic dimming is always on, so the scene stays
true to where you live; the drawn line can be shown or hidden and recoloured in
the editor. A perfect match for anyone in a valley or the mountains.

### Added: state of charge on the battery chip

The battery chip now has a readout option: keep showing live **power** (the
default), or switch it to the battery's **state of charge (%)**, so a wall
dashboard can show how full the battery is at a glance. It falls back to whichever
value your battery actually provides.

### Added: a cost chip

When your Home Assistant Energy dashboard tracks a price, a new **cost chip**
joins the card: it reads out what your energy is costing you **right now**, in
your own currency per hour (net of any export revenue), and behaves like every
other chip. Tap it to bring its cost curve up on the timeline and around the
house, and scrub the day to read the cost at any moment. Like the weather chips
it sits along the bottom as secondary information, and you'll only see it if a
price is set in the Energy dashboard, Helios never invents one. It has a fixed,
configurable colour and icon, and a negative rate simply means you're earning
(selling your surplus). It reads Home Assistant's own cost statistics whenever
they exist, so **any tariff is handled** out of the box, a flat price, peak /
off-peak, Tempo, or a whole-home cost sensor from an integration, each already
priced correctly hour by hour by Home Assistant. A fixed price with no cost
statistic still works, computed as energy times price. **Multi-tariff grids
(peak / off-peak, Tempo)** are detected automatically, even when you only set a
price per tariff and never an explicit cost sensor: Helios finds Home Assistant's
own per-tariff cost statistics and sums them. And the chip is **fully in the
editor** now, show or hide it, and pick its colour and icon, like every other
chip. The chip **follows the timeline** as you scrub (the cost at the hovered
moment, like the other chips), and its **day curve around the house** now draws
for multi-tariff grids too, not just a fixed price. Open its detail panel for the
cumulative total over the selected period, what you spent, what you earned, and
the net.

### Added: the real weather, painted over the scene

The card now shows the weather at your home, resolved for the moment on the
timeline: clear-sky sunshine that dims as the cloud cover builds, an overcast
grey, then rain, snow or a thunderstorm on top. Each layer is driven by a real
measured value (cloud cover, precipitation, snowfall, the weather code), never a
guess, and the whole thing follows the scrub, so you can watch a front arrive
across the day. The sun glow now also fades as the sun nears the horizon, so
sunrise and sunset read honestly.

### Added: outdoor temperature and humidity

Two new chips show the outdoor temperature and humidity, grouped along the bottom
of the scene as secondary readings, and behave exactly like the other chips: tap
one to bring its day curve up around the house and its series onto the timeline,
tap again to toggle the curve, with the same detail panel (min / mean / max) and
hover readout.
Temperature scales to its own range so a two-degree swing is legible; humidity
sits on a fixed 0–100 % scale. Thanks to @tfriberg for the suggestion (#332).

### Added: local weather sensors override the forecast

If you run a weather station, you can point each weather reading at your own
sensor, temperature, humidity, cloud cover, precipitation, snowfall, or the
condition from a Home Assistant `weather` entity, and it takes over from
Open-Meteo for the live and past hours, while the forecast stays on the model.

### Added: a locked view that is the same on every device

The viewing angle of a locked card lived in the browser, so it differed from one
device to the next. Turning on **Lock rotation** now captures the current angle
into the card's configuration in one step: frame the scene in the preview, enable
the lock, and the exact same view is saved and frozen on every device and
browser. Thanks to @ferreto1978 (#310, #353) and @roumano (#363).

### Fixed: the grid import/export arrow, definitively

The 2026.8.3 fix for the swapped grid tower icons was itself the wrong way round,
because the MDI icon names are the opposite of what they draw. The arrow now
follows the real flow, points into the grid when exporting and away from it when
importing, everywhere it appears, with a code note so it can't be "corrected"
back. Thanks to @7oku (#356).

### Fixed: the battery detail chart now shows your battery names

On a multi-bank install, the battery detail chart labelled its banks "Battery 1,
2, 3…" instead of the names you gave each battery in the Energy dashboard. It now
uses your configured names throughout the per-bank charge, discharge and
state-of-charge rows. Thanks to @tfriberg (#365).

### Fixed: cloud shadows stayed round on a narrow card

The drifting cloud shadows were sized to the card's width and height, so on a
narrow or portrait card they stretched into tall ovals. They're now sized to the
card's width on both axes, staying round at any card shape. Thanks to @tfriberg
(#332).

### Fixed: the forecast curve could be shifted by the wrong time zone

When your device or Home Assistant server sat in a different time zone from your
home's coordinates (a "server time" setup, or simply browsing from elsewhere),
the weather forecast curve was displaced by the difference between the two zones,
so it no longer lined up with your live production. The forecast times are now
anchored to a fixed reference regardless of where you view the card from, so the
curve always aligns with the moment it belongs to. Thanks to @m1chaelmichael for
the precise report (#366).

---

## 2026.8.3

A small release on top of 2026.8.2: a new sun-chip readout, a fairer flow
animation, and a handful of fixes.

### Fixed: the grid import and export icons were the wrong way round

In the grid chip, its detail panel and the timeline tooltip, the import and export
tower icons were swapped, so the arrow pointed the wrong way for the direction it
labelled (#352). The icons now match their flow, and each one is defined in a single
place so the two can no longer drift apart. Thanks to @wasabi216 for the report.

### Changed: flow animation now paces every flow against one configurable reference

Every flow's animation speed is scaled so a bigger flow reads as faster, but the
flows didn't all share the same scale: grid export used a reference five times
smaller than the rest, so a small export could look quicker than a much larger
production (#351). Production, grid import and export, battery and device flows now
animate on one shared curve and one shared reference, so their relative pace is honest
across the whole card. That
reference is a new **Max expected power** setting (default 5000 W) in the editor's
data display section: the power at which a flow animates at full speed, so you can
raise it for a large installation or lower it for a small one. Thanks to @wasabi216.

### Added: the sun chip can read out the sun's position

A new **Sun chip readout** option (in the data display section) switches the sun chip
between solar irradiance (the default) and the sun's position as azimuth and elevation
(#310). The position comes from the card's own sun maths, so it needs no extra sensor.
Idea from @ferreto1978, and thanks to @thomluther for the push.

### Fixed: the grid flow bead now matches the other beads

The grid import and export bead was the only flow bead without the thin outline every
other bead carries, so it read slightly differently. It now has the same outline, and
the beads are consistent across the whole scene.

### Fixed: a sun-position card showed an empty home chip

On a card set to show the sun's position with the home hidden and no energy chips, an
empty home ring appeared: the sun chip was counted as holding the home anchor, even
though it has no leader to the home. Such a card now drops the ring, leaving just the
sun and the location. Thanks to @ferreto1978.

---

## 2026.8.2

A corrective release on top of 2026.8.1.

### Fixed: the card rendered only in half 3D on some older iPads

On older iPads, older WebKit could composite the flat basemap over the 3D scene
incorrectly, leaving the card looking cut in half (#304). Helios now detects those devices,
including inside the Home Assistant and Kiosk apps, not just Safari, and paints the
ground already projected into the scene, so the whole card renders. The perspective
on the map's vector elements is very slightly different on that path, but the scene
is whole again. Every other device is unchanged. Thanks to @Spaniard85 for testing
the fix on the affected hardware.

### Changed: the detail panel now names its period, and marks averages with Ø

The detail panel shows the selected period as its title, so every figure reads as a
total or average over that window, not a live value. Averages (including the battery
state of charge) now carry a Ø mean symbol instead of the old approximately-equal
sign, which wrongly suggested a rough value. Thanks to @stalakerob for the nudge on
the battery line (#331).

---

## 2026.8.1

A hotfix on top of 2026.8.0.

### Changed: assign devices to groups by drag-and-drop

Putting a device into a monitoring group is now a matter of dragging its chip into
a group zone in the editor, instead of the small cycle button whose "no group"
state showed an X that read as a delete button. Four group zones plus a "No group"
pool; it works with a mouse and on touch. Existing group settings are unchanged.

### Fixed: multi-meter grid and battery bands were impossible to tell apart

On a setup with several grid or battery meters, the timeline already split each
flow into one band per source, but every band carried the first source's name. The
timeline tooltip now names each band by its own source, so a multi-tariff grid or a
multi-bank battery reads clearly. Single-meter setups are unchanged.

### New: a Live button on the timeline

After scrubbing the lower graph, a small Live button jumps straight back to the
present, instead of nudging the slider back by hand.

### New: state of charge in the battery detail panel

The battery detail panel gains a state-of-charge line (its average over the shown
period). Thanks to @SBergers for the contribution.

---

## 2026.8.0

The biggest release yet. The devices you track in the Home Assistant energy
dashboard become first-class citizens of the card, the scene lives through the
day/night cycle, the map is now yours to theme, and the whole thing is lighter and
faster.

### New: monitoring groups replace the custom entity

You can now bundle the devices tracked in your energy dashboard into up to **four
monitoring groups**, each with its own name, colour and icon, set in the editor.
A group shows up as its own chip on the scene and its own curve in the timeline.
The old single "custom entity" is gone; groups do the same job for any number of
devices and need no YAML. Each group is shown by a coloured pill (its number by
default, its icon once you set one), consistent across the editor and the scene.

### New: your own map, fully themeable

The basemap is now drawn by Helios's own vector renderer, built on **OpenFreeMap**
(open data, still no API key). A new **Map configuration** editor section lets you
theme the ground itself: pick Auto (follows your Home Assistant theme), Dark, Light
or **Custom**, and in Custom set the colour and visibility of every layer, ground,
water, parks, roads, paths, railways, buildings and more. Make it match your
dashboard, or make it your own.

### New: the scene follows the sun

The whole scene is now graded through the day/night cycle. The ground and buildings
warm toward midday and cool through dusk into night, so a glance tells you roughly
where the day is, no flat overlay, just light.

### New: a sun-only card, and easier scrolling on mobile

Hide every chip (including home consumption) and the card collapses to just the sun
position and your location, a solar-position card you can drop on a non-energy
dashboard, for shutters or climate control keyed on the sun. And on a phone the card
no longer traps your scroll: swipe up or down and the page moves as it should, swipe
sideways and the scene turns. Your finger's direction decides, so neither gesture has
to wait for the other. Once a turn is under way, drifting up or down tilts the scene
as it always did on a mouse (#308).

### New: per-bank battery state of charge

The battery timeline now draws one **state-of-charge line per battery bank**, each
tinted by its live charge/discharge flow, so you can read each pack against the
charge and discharge beams above it.

### New: the day curve

Click any chip a second time, once it is the active one, and the day you are looking
at rises around your house as a curve.

It does not stand on a ring. It stands on the sun's own path, projected straight
down onto the ground: the track closes in on the house at midday, when the sun is
overhead, and reaches out to the exact spots where the arc meets the ground at
sunrise and sunset. So where a point sits on that track IS the hour it happened, and
a dashed line drops from the sun to the curve right beneath it. Scrub the timeline
and the whole thing follows: another day means that day's sun, that day's track and
that day's readings, never an average of the week around it.

Every metric draws itself its own way. **Production** splits into one curve per solar
source, each in its energy-dashboard colour, like the timeline; today's remaining
hours carry on from your forecast, dashed, so the shape of the day runs unbroken from
this morning to tonight and only its certainty gives way at the present moment.
**Grid** and **Battery** now split the same way: one stacked band per source, every
grid meter's import and export and every battery's charge and discharge, in the Home
Assistant energy colours, so a multi-meter grid or a multi-pack battery reads each
source instead of one lumped flow. The battery keeps its dashed state-of-charge curve
per pack. The curve on the house and the timeline below it draw the exact same split,
so there is never a second reading of the same day. A single grid meter or battery is
unchanged. A **monitoring group** draws one curve per device, in each device's colour.
**Irradiance** draws one too, on every period but Month, which reaches back further
than the weather model does.

Switch chips and the curve re-points and stays up, so you can walk one day through
each metric. The curve writes itself on as it is raised, from its own midnight, and
the chips that have nothing to say about the metric on show step aside while it is
up. Click the active chip again to put it away. It follows your **Graph detail**
setting like every other curve, so it smooths out at one point an hour and resolves
every cloud at six.

### Changed: a calmer scene

The home now simply takes the active chip's colour (keeping the squash-and-grow
animation when you switch chips). The camera lock is a scene-only setting. A single
tap on a chip now opens its detail panel (it used to want a double-tap), and a tap
anywhere on the scene background dismisses it, which finally makes it easy to close
on a phone. The sun arc uses the true -0.833 degree horizon so sunrise and sunset
land where Home Assistant puts them.

### Changed: solid buildings, shadows that follow their walls

The surroundings have been rebuilt. Buildings are no longer cut in half at the seams
between map tiles, and faces no longer flicker in and out while you turn the scene:
the order they are painted in is worked out from the buildings' real outlines. Rows
of houses that touch at the same height are drawn as one block, roof lines and all,
rather than a queue of overlapping boxes. Facades are lit by the sun's direction, so
a wall facing it reads brighter than one turned away, and a wall in shade is lit by
the sky alone.

Shadows follow each building's true outline, including concave blocks and inner
courtyards, and account for the roof rather than the walls alone. They no longer lie
underneath the building casting them, they stop at the ground their neighbours stand
on instead of running through them, and their fade no longer swings to the other
side when you nudge the camera by a fraction of a degree.

The display radius now tops out at **250 m**, which is as far as the ground beneath
the buildings actually reaches. A card set higher than that settles at 250 m; before,
the extra radius put buildings out past the edge of the map with nothing under them.

### Changed: a clearer default timeline

The default in-card period is now **Forecast** (today to two days ahead), a tighter
window that reads better on a phone. The timeline and period-selector top borders
take the active chip's colour, so the whole bar reads as one with the metric you are
looking at. The timeline itself now sizes from the card's own height rather than its
width, so it keeps its proportions whether the card is a squat tile on a dashboard
or a tall one on a wall tablet. On a phone it used to pin to its minimum and take no
notice of the vertical room it had, so a tall card and a squat one got the same bar.

### Changed: focused translations

Helios now ships **27 European languages**, curated for the communities that use
the card most. This cuts the download size substantially with no change to the
languages kept; any other language falls back to English.

### Fixed

- The scene now renders in full on older iPads. The buildings-and-shadows layer draws
  a whole neighbourhood, well past the card, and on those devices the browser capped
  that layer's size and painted only its top half. It is now bound to the card, so the
  whole scene draws, and as a bonus every device now paints far less off-card area on
  each frame (#304).
- Map and building colours repaint live as you change them in the editor, instead of
  waiting for the next data refresh.
- Scene: left-click drag-rotate now works on Firefox (#306).
- The basemap no longer vanishes after the card has sat in a background tab for a
  while, leaving the buildings floating over nothing. It is repainted from memory
  the moment the card comes back, which matters most on a wall tablet.
- The building colour and the home colour now take a plain colour (`#ff0000`,
  `rgb(...)`) as well as a Home Assistant colour name, like every other colour in
  the editor. They previously accepted the name only, and silently ignored anything
  else, leaving the buildings grey.
- The irradiance tooltip shows the forecast value and its beam again (#305).
- The dashed timeline lines (the solar forecast and the per-bank battery state of
  charge) now always draw their full length instead of stopping short until you
  scrubbed the timeline.
- The battery timeline no longer stacks a cluster of markers on its charge line.
- Assorted robustness: DST-safe day maths, a watchdog on slow map tiles, cleaner
  teardown of animations, and quieter, deduplicated data-layer warnings.

### Removed

- The **clock** and period-over-period **trend** dials. The scene, the timeline and
  its period selector now tell the same story more directly.
- The **Year** period. Month is now the longest view, and the last one the scene can
  still speak for: any day of it can be scrubbed to and read under that day's own
  sun. A year sat on a daily store that carried no shape of a day at all, so the arc,
  the shadows and the curve had nothing to say about it, and 365 bars two pixels wide
  had nothing to say to the eye. Your energy dashboard already tells that story
  better. Cards saved on Year fall back to the default period.

---

## 2026.7.4

A quick corrective release. Apologies: 2026.7.3 shipped a detail-panel bug, and I
wanted it fixed fast.

Moral of the story: never let a developer finish "just one more feature" at 2 a.m. :)

### Fixed: detail panel totals now match the energy clock on every period

The per-chip detail panel (double-tap a chip) computed its totals from the card's
rolling ~5-day data window, so on longer periods (month, year) its figures drifted
away from the energy clock and the Home Assistant dashboard, sometimes by a lot.
Every energy total is now computed with the **exact same method the clock uses**
for its period total, so the panel, the clock and the dashboard always agree, on
every period from a day to a year. (The consumption panel's earlier
watt-hours-labelled-as-kWh error is folded into this fix.)

### Fixed: a scene chip selection carries into the clock and trend dials again

Selecting a chip in the scene (including by double-tapping it) once more drives
which metric the clock and trend dials show when you switch to them, instead of
keeping the previously shown one.

### Fixed: the solar forecast is clearly visible on the irradiance view

The dashed solar forecast on the irradiance timeline was ghosted and hard to read
under the cloud-cover bands. It now uses the exact same styling as the production
timeline's forecast (theme-aware shade, full opacity, same dash).

---

## 2026.7.3

**This release changes how Helios reads your data: it now follows the Home
Assistant energy dashboard at 100%, and never estimates a value.** Everything the
card shows, live or historical, comes straight from your dashboard: there is
nothing extra to wire, and no per-card value that can drift from it. Please read
the first section below, it may change what you see on your card.

### Measured values only (energy dashboard alignment)

Helios used to derive some real-time values from your cumulative meters when no
live sensor was available. That created confusing differences with the energy
dashboard, so it is gone. The new rule is simple:

* **Live chips** (the real-time values in the scene) appear **only when a real
  live power sensor** is configured on the matching source of your energy
  dashboard (the optional "power" field). No sensor, no chip: nothing is
  derived from meters anymore.
* **Curves, scrub, energy clock and totals** come only from your **kWh
  meters**, through the same recorder data the energy dashboard reads. They
  match it by construction.
* **The home consumption readout** is the same live balance the energy
  dashboard defines (solar + import - export - battery) and appears once every
  configured family has its live sensor.
* If a live grid sensor is detected as **mis-wired** (for example an
  import-only sensor configured as a signed net sensor), Helios hides the
  affected chips and the editor explains exactly what to fix, instead of
  displaying values that cannot be trusted.
* The editor gains a **live-data status panel** telling you, family by family,
  which live chips can exist with your current configuration and what to add.
* The **home consumption override** option is removed: the dashboard's balance
  is the single source of truth (a diverging per-card sensor was exactly the
  kind of confusion this release ends). The old option is simply ignored.

### Added: detail panels, double-tap any chip

**Double-tap** (or double-click) any chip in the scene to open a compact panel
top-right, tinted in that chip's own colour. It aggregates the metric over the
period you are viewing, as icon-only figures in your chosen unit (W or kW):

* **Production / consumption**: total energy, peak power, average per day.
* **Grid**: total import, total export, net, average import per day.
* **Battery**: energy charged and energy discharged.
* **Battery charge (SoC)**: minimum, average and maximum.
* **Sun**: peak and average irradiance, plus sunrise, solar noon, sunset, highest
  altitude and day length.
* **Custom entity**: total, plus minimum, average and maximum.

Every figure is recomputed from the exact series the chart draws, so the panel and
the curve always agree. Double-tap again to close. Like everything else on the
card, there is nothing to configure: it reads only what your dashboard already
provides.

### Removed: the weather panel

The top-right weather + astronomy plate is gone, along with its temperature and
wind options. It had drifted away from what the card is about, the energy of your
home, and only ever showed values your dashboard displays better. The weather
Helios actually needs, cloud cover and irradiance, keeps driving the sun disc, the
irradiance view and the shadows exactly as before.

### Changed: the clock and trend dials lose their central column

The stacked column at the centre of the clock and trend dials is replaced by the
flat **Helios logo**, laid on the ground plane. It does the same job, hover or tap
it for the period total, without standing up into the view. With several filters
in clock mode, or a busy trend, the old column obstructed the bars, the arc and
the labels; the logo rests at half opacity and lifts to full when you point at it.

### Changed: custom entity now takes its two sensors

* The custom entity follows the same rule: a **power sensor** (live chip and
  curve) and an **energy sensor** (energy views), plus the optional colour and
  icon, in a redesigned editor block. It displays only when both sensors are
  set. An entity configured with the old single field is pre-moved to the
  matching new field in the editor; add the missing one and save.

### Changed: cloud coverage merged into the irradiance chip

* The floating cloud chip is gone (it collided with the home cluster on
  phones). Its weather glyph (clear / partly cloudy / overcast) now lives on
  the irradiance chip: one compact chip, the icon for the sky and the number
  for the W/m². Clicking it opens the irradiance view where the three cloud
  layers are drawn **over the curve** as translucent bands (100% total cover =
  top of the axis), so the clouds visibly eat the sun. The energy clock drops
  its cloud filter (an instantaneous coverage has no meaning in a cumulative
  view).

### Added: dashboard source names on the cards

* The grid and battery rows (tooltips, clock) now display the name you gave
  the source in the energy dashboard settings, when one is set, instead of the
  meter entities' names.

### Added: the solar forecast on the irradiance view

* The dashed forecast curve now also rides the irradiance view (next to the
  cloud layers), as a ghosted silhouette on its own scale: forecast, sun and
  clouds read together. The production view keeps its true shared-scale
  forecast.

### Fixed: the consumption detail panel read 1000x too high

The home (consumption) chip has no meter, so its detail panel integrates power
into energy; that integration returned watt-hours but labelled them kWh, inflating
the total and per-day average by 1000. It now matches the energy clock and the
dashboard. Grid, battery and custom panels were never affected (they sum the
recorder's kWh directly).

### Fixed: a stray battery leader with a hidden state-of-charge chip

When a battery reported power but no state of charge, a connector could still be
drawn to the empty SoC slot. A hidden SoC chip now drops both of the leaders tied
to it, whatever the power reads.

### Fixed: the custom entity stays visible at zero while scrubbing

A measured 0 is a real value, so the custom chip no longer vanishes when you scrub
onto a zero reading; it disappears only where the entity has no history at all.

### Fixed: a minus sign on zero values

* A sensor blipping a few negative milliwatts could render as "-0.00 kW" on a
  chip. Values that round to zero at the displayed precision now render as a
  true zero, everywhere.

### Fixed: production curve flattening into a plateau

* On days with a deep production bell and a long dawn/dusk tail, the
  spike-protection filter could reject the real midday peak and bridge it with
  a flat line. Its threshold now uses the 90th percentile instead of the
  median: genuine peaks always pass, meter-reset spikes are still rejected.

### Fixed: 2.5D buildings are back, from a more reliable source

* The buildings were fetched from the OpenStreetMap Overpass API, which had
  started refusing the card by waves. Helios now reads the same OpenStreetMap
  building data from **OpenFreeMap vector tiles** (a free, key-less map CDN):
  the surroundings load reliably again, with their real heights, and the card
  no longer depends on a service that can lock it out. Still cached locally, so
  it stays instant and works offline on the next load.

### Changed: the custom entity now reads measured energy

* If you use the optional custom entity, its clock ring, timeline curve and
  scrub now read the **energy meter** you configured (the measured kWh from the
  recorder), exactly like grid, solar and battery. The live chip still shows the
  power sensor's instant value. Both sensors stay required.

### Fixed: correctness and performance

* An off-screen card could keep polling the weather service forever; it now
  stops cleanly when hidden.
* A custom entity could re-query the recorder on every state update; it now
  refreshes at most once a minute.
* Recorder queries that never answered could freeze a value until the page was
  reloaded; they now time out and recover on their own.
* A locale that uses a comma as the decimal separator now reads correctly on
  every chip, not just the grid.
* A large batch of internal clean-up (dead code, memory and rendering), with no
  change to what the card does.


---

## 2026.7.2

A refinement release on top of 2026.7.1: a new ambient info panel, more display
and unit options, and a batch of accuracy fixes for specific setups.

### New: weather and astronomy panel

* A small **info panel** in the top-right corner showing the local weather right
  now: temperature and wind, with the sky condition shown as an icon, sourced
  from Open-Meteo, with optional Home Assistant entity overrides for outdoor
  temperature and wind speed. It can be **shown or hidden** from the editor.
* An optional **astronomical readout** (a toggle in the editor, shown only when
  the panel is on) that adds the sun's altitude and azimuth, sunrise, solar noon,
  sunset and day length, each labelled with an icon to keep the panel compact.
* The wind-direction arrow is **projected onto the tilted 2.5D ground**, so it
  keeps pointing at the true compass direction as you orbit the camera.
* The panel stays visible in **No UI mode**, so a wall display keeps its ambient
  weather even once the timeline and controls have faded away.

### New: No UI mode

* An opt-in mode that **fades the timeline and the on-card controls** after a few
  seconds of inactivity and brings them back on any tap or move. Built for
  kiosks and wall displays.

### Display and units

* A **power unit** selector (W or kW); energy follows it, so kW pairs with kWh
  and W with Wh.
* A separate **solar-constant (irradiance) unit** selector.
* A **battery-sign** option: default (minus charging, plus discharging),
  inverted, or hidden on the battery chip.
* An optional **home-consumption override** entity for the consumption chip
  readout, when an inverter exposes a direct sensor.

### Accuracy fixes

* Correct **southern-hemisphere** Clock and Trend, with hour binning now done in
  the server's timezone rather than the browser's.
* Fixed near-zero Clock and Trend totals on kWh-only solar sources.
* **Coarse-reporting meters** (those that report every 15 minutes or more) are
  smoothed so their curves no longer sawtooth.
* Fixed the **solar forecast** reading half power on sub-hourly buckets
  (contributed by @adamhf).
* **Non-solar 24/7 producers** (water turbines, micro-hydro) configured under
  solar production now keep their night-time hours on the Clock and Trend dials,
  and each per-source ring reads the exact recorder energy, matching the Energy
  dashboard instead of the slightly lagging calibration series.
* **Multi-string solar forecast** now sums every configured forecast provider
  instead of showing only the first string's prediction.
* **Multi-battery** installs with mixed wiring (one bank with a live power
  sensor, another with only energy meters) no longer drop a battery from the
  live power readout.
* The home now keeps the **colour of the selected chip** after you leave the
  dashboard and return, instead of resetting to the default metric.

---

## 2026.7.1

A new chapter for Helios. This release describes the card as it is **today**:
a single, self-contained Lovelace card that gives your solar setup a living,
real-time 2.5D presence on your dashboard. Everything below is what `2026.7.1`
does, here and now.

### The scene

* A 2.5D view of your home drawn entirely **without WebGL**: a
  tilted raster basemap from CARTO (free, no key, themed to match Home
  Assistant light / dark) with every overlay projected on top in SVG, so the
  card stays fluid on any device, phones included.
* Surrounding **buildings** are fetched once from OpenStreetMap (Overpass),
  extruded to their real heights (capped) or to a fixed prism, and cached
  locally so the scene reopens instantly and offline.
* **Cast ground shadows** projected from the building footprints along the live
  sun vector, fading as the sun nears the horizon.
* A **day / night ground** that darkens where the sun is below the horizon.
* Optional, opt-in **auto-rotation** that idly orbits the home and pauses the
  instant you touch the card, plus drag-to-rotate and a camera lock.

### The sun

* The sun's **full daily arc** projected with depth: discreet dots below the
  horizon, the bright daylight arc, the live sun disc and an irradiance halo
  that scales with the current W/m² on top.
* An animated **incidence ray** from the sun to the home, flowing faster the
  stronger the sun, and **sunrise / sunset markers** with local times.
* Solar position from a NOAA-validated declination + equation-of-time model;
  clear-sky irradiance via Haurwitz (1945) attenuated by cloud via
  Kasten-Czeplak (1980).

### The energy

* All solar / grid / battery numbers come from the **Home Assistant Energy
  dashboard**, the single source of truth, resolved automatically (no per-card
  entity wiring).
* Live **chips** orbit the home pill: PV production, battery state of charge +
  power, grid import / export and an optional custom entity, each with a leader
  and a flow bead encoding direction and magnitude.
* Live readings come from the configured rate sensors (cumulative meters are
  differentiated to watts on the fly); past curves read the recorder's
  pre-computed `change` metric, so the card and the official Energy dashboard
  agree to the watt-hour.
* **PV forecast** read natively from your configured solar-forecast provider,
  drawn as a dashed prediction the live observation tracks against.
* Optional physical **irradiance sensor** override and an optional **custom
  power / energy entity** surfaced as its own chip and dial metric.

### Three view modes

* **Scene**, the live 2.5D view with the timeline below.
* **Clock**, a 24-hour dial that bins each metric into hours of the day as
  concentric rings around a central column; tap an hour to read every metric,
  with a day / night ground wedge and an N / S compass.
* **Trend**, a period-over-period comparison: the current period as a ring of
  bars with a floating marker pinning the same hour in the previous comparable
  period, coloured good or bad per metric, a current-hour arrow, and a central
  column reading the global delta.

### The timeline

* A re-targetable chart below the scene: production (with dashed forecast and
  per-string breakdown), consumption, grid, battery, battery SoC, irradiance,
  cloud cover or your custom entity. Click or drag to scrub; the whole scene
  snaps to the selected instant.
* **Five periods**, chosen live and remembered per card: **Standard**
  (two days back, today, two days ahead), **Today**, **Week**, **Month** and
  **Year**. Today, Week, Month and Year all end on today; Month and Year match
  the real length of the previous calendar month / year.

### Built in

* **63 languages**, following your Home Assistant language.
* A visual **editor** for every visual and install option, with sensible
  defaults and graceful handling of malformed YAML.
* Per-card persistence of the view mode, camera pose, selected metrics and lock,
  so the dashboard reopens exactly as you left it.

---

## Legacy versions

Helios started its life as a different kind of card, and grew through many
iterations and a great deal of community feedback. To everyone who installed an
early build, opened an issue, suggested a feature or shared a screenshot:
**thank you.** That feedback is precisely what made the project rethink its
direction.

With `2026.7.1`, Helios takes a deliberate new course: a new rendering engine, a
new internal logic, a sharper vision and a real focus on performance and
fluidity on every device. Because so much changed at once, drawing a detailed
before-and-after comparison against the older releases would be more confusing
than useful, so this changelog starts fresh from `2026.7.1`.

The earlier releases remain available in the repository's
[release history](https://github.com/ReikanYsora/Helios/releases) and in the git
history for anyone who needs them, but they are no longer the recommended path.
The clearest, most current picture of where Helios is and where it is going
lives on the project site and its public roadmap at
**[helios-ha.org](https://helios-ha.org)**.
