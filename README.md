# 🌳 Interactive Tree Topology Simulation (Web-Based)

An educational and interactive web application that simulates a **Tree Topology Network** using **HTML**, **CSS**, **JavaScript**, and **D3.js**. This tool is designed for learning, visualizing, and experimenting with hierarchical network structures, including node management and message transmission simulation.

---

## 📌 Features

### 🧱 Core Functionality
- **Dynamic Tree Visualization** using `d3.tree()` and `d3.hierarchy()`.
- **Interactive Nodes**: Add, rename, or delete any node via intuitive click/keyboard actions.
- **Real-Time Updates**: All changes reflect instantly with animated transitions.

### 🧩 Simulation & Messaging
- Simulate message delivery between any two nodes.
- Visually trace the packet route with animation and latency display.
- Accounts for hop count and total delay (e.g., 50ms per hop).

### 🧠 Network Behavior
- **ON/OFF toggle** per node to simulate availability.
- Root node is critical: turning it OFF disables the entire tree network.
- Nodes with no route to the root are marked unreachable.

### 📊 Advanced UI
- Sidebar or top menu with:
  - Add Node
  - Collapse / Expand All
  - Simulate Message
  - Reset Tree
  - Export / Import Tree (JSON)
  - Dark Mode toggle
- **Tooltips** show node metadata: name, depth, parent, number of children.
- **Statistics Panel** (optional): total nodes, max depth, leaf count, etc.
