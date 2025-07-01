# 🎮 PLYNK-IO — Player Link Input Output

[![Buy Me a Beer](https://github.com/ctrl-alt-paul/plynk-io-v025fresh/blob/main/buymeabeer.png)](https://buymeacoffee.com/ctrl_alt_paul)  
[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor%20on-GitHub-%23EA4AAA?logo=github)](https://github.com/sponsors/CtrlAltPaul)

**PLYNK-IO** is a gloriously overengineered I/O control system for emulated arcade games. It hijacks game data in real time — from memory addresses to emulator broadcasts — and lets you fire it off to real-world devices like LEDs, serial devices, WLED devices, motors, solenoids, and anything else you can bolt to a cabinet.

It happily listens to **MAME**, **TeknoParrot** (via Boomslangnz’s legendary OutputBlaster), and any other emulator shouting out `WM_COPYDATA`.  Or, if you’re the kind of person who enjoys living dangerously, you can skip the messages and rip data straight from memory using the magic you pulled from your favourite CheatEngine voodoo.

Whether you’re just lighting up a few buttons or building a feedback system that could scare small pets, PLYNK-IO turns software into hardware chaos — in all the best ways.


## 🚀 Features at a Glance

- 🧠 **Memory Reader** — poll live game data from RAM using process injection  
- 💬 **Message Listener** — intercept `WM_COPYDATA` broadcasts from MAME and other emulators  
- 🧩 **Game Profiles** — bundle memory + message mappings and assign them to running processes  
- ⚙️ **Device Support** — output to:
  - 🎛️ **PacDrive** (USB LED controllers)  
  - 🔌 **Serial Devices** (COM-port microcontrollers)  
  - 🌈 **WLED** (Wi‑Fi LED strips and effects)  
- 🧪 **Value Transforms** — manipulate any input with inline JavaScript (math, conditions, logic)  
- 🎨 **LED Effects** — fully map game values to segment colours, brightness, and animation profiles  
- 📈 **Live Dashboard** — monitor game data, output activity, device health and logging in real time  
- 📦 **JSON Config Profiles** — portable, shareable, editable outside the app

---

## 🛠️ Built With

| Layer             | Stack                                              |
|-------------------|----------------------------------------------------|
| Frontend          | React 18 + TypeScript + Vite                       |
| UI Styling        | Tailwind CSS + Shadcn UI                           |
| Desktop Platform  | Electron (Node.js + Chromium)                      |
| Native Layer      | C++ modules for WM_COPYDATA interception           |
| Devices Supported | Serial (COM), USB HID (PacDrive), HTTP (WLED)      |
| IPC Layer         | Electron IPC bridges between UI and device logic   |

---

## 📷 Core Modules

### 🖥️ Dashboard
Your real-time control panel:
- Displays live connection status for all devices and active processes
- Monitors outputs: current value, raw value, mapped device, and channel
- Offers toggles for memory polling and message listening
- Category-based logging with colour-coded channels

---

### 🎮 Game Manager
The heart of the app:
- Bind a process name (e.g. `mame64.exe`, `d1a.exe`) to a game profile
- Link memory + message profiles and assign their outputs to specific hardware
- Supports JavaScript transformations (`value > 50 ? 255 : 0`, etc.)
- Supports active/inactive toggles, duplication, and profile inheritance

---

### 🔍 Memory Manager
Fine-tuned memory extraction:
- Attach to a running process and scan absolute, module-relative, or pointer-chain addresses
- Supports multiple data types: Int, Float, Double, Byte, etc.
- Apply bitmasks, formatting, and inversion
- Uses polling intervals (1ms–5s) and value caching
- Visual inspection of raw vs transformed vs output value

---

### 💬 Message Manager
WM_COPYDATA handler built for MAME-style output:
- Listens for Windows messages on a hidden native window
- Maps key-value pairs to output labels (`id_2`, `id_34`, etc.)
- Triggers hardware dispatch in real-time
- Supports `__MAME_START__` and `__GAME_NAME__` reserved keys
- Reusable profiles for message-based output

---

### ⚙️ Device Manager
Bridge to the physical world:
- **PacDrive**: USB discovery, test outputs, assign channels
- **Serial**: COM port selection, baud rate, handshaking, test signal dispatch
- **WLED**: IP-addressed, rules-based light control, segment mapping, full effect library access
- Device detection, connection status, diagnostics, and inline configuration

---

### 🌈 WLED Profiles
Advanced lighting logic:
- Rule-based profiles triggered by memory or message values
- Supports `exact`, `range`, and `threshold` rule types
- Define segments, effect IDs, brightness, and RGB colour
- Can control multiple segments from a single game variable
- WLED config import support

---

## 🧠 Data Flow

```
Game (Emulated) 
  └── Memory Read ➜ Transform ➜ Output Mapping ➜ Hardware
  └── Message Event ➜ Parse ➜ Transform ➜ Output Mapping ➜ Hardware
```

---

## 💡 Ideas for Future Versions

- WebSocket or UDP device output (for ultra low-latency)  
- Input signal mapping (buttons, encoders → game actions)  
- Game auto-profile generation via message parsing  
- GUI-based LED segment preview and effect testing  
- Screen monitoring  
- Profile sync to cloud or GitHub Gist  
- Replay & visualise logged output sessions

---

## 💡 Inspiration

PLYNK‑IO draws from legends in the emulator‑to‑hardware space:

- **Boomslangnz (OutputBlaster)** – the real‑time output wizard whose work influenced PLYNK‑IO architecture  
- **Howard_Casto (MameHooker)** – pioneer of message‑driven hardware mapping in emulators

---

## 🙏 Special Thanks

A huge shout-out to:

- **Boomslangnz** – creator of OutputBlaster  
- **Howard_Casto** – mastermind behind MameHooker  
- **Aaron Giles** – whose emulator output code laid much of the groundwork

Your work lit the fuse for PLYNK‑IO — thank you!

---

## 📜 License

MIT License  
© 2025 [**CtrlAltPaul**](https://github.com/CtrlAltPaul)

Use it, mod it, share it. Just don’t blame me if you blow up a LED strip while racing.

---

## 🦾 Built By

Created by **CtrlAltPaul**, for people who love arcade rigs, cables everywhere, and watching their desk light up like Tokyo in the rain.

> _“Reads memory like a psychic. Slaps LEDs like a DJ. Powers feedback like Zeus with a USB cable.”_

---

## 📫 Get Involved

If this made your rig cooler, raise an Issue, submit a PR, or just star the repo.  
Have an idea? Hit me up on GitHub or Reddit: **@CtrlAltPaul**

---
