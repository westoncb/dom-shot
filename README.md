This is a Chrome extension that let's you turn any webpage in to a 3d asteroids-like game, except it's very unfinished and works best on simple pages like news.ycombinator.com and craigslist.com

### Installation
Works the same as any in-development Chrome extension: open 'manage extensions', enable developer mode, click 'load unpacked' and point it to this project's root folder. Enable the extension.

### Running
As long as the extension is enabled you'll see a big circular, teal play button in the upper right corner of every page. Click it to launch the 'game'.

### Controls
- A,S,D,W: fly around
- K: enter asteroids mode

### Project state Vs. Original vision

The plan I had in mind was to do a fun joke game where you can launch this on any page and fly a ship around blowing up a 3D representation of the DOM. The latest design included two modes, each with different weapon styles: the initial mode where you cruise the ship around above the page's surface and use a mortar-like cannon to blow up a chunk of the page; and the second mode—entered automatically after using the weapon in the first mode—that resembles a game of asteroids, where you blow up page fragments that were dislodged during the first mode.

In it's current state the game starts in the first mode, and you can press 'K' to enter the second mode. However, weapons have not been programmed for either mode, you can just fly around in both. So the game is not really playable at this point.
