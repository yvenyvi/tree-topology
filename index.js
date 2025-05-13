// Initialize the tree topology network application
document.addEventListener('DOMContentLoaded', function() {
    // ========================
    // Global Variables
    // ========================
    let treeData = null;
    let currentNode = null;
    let root = null;
    let selectedSource = null;
    let selectedTarget = null;
    let isSimulating = false;
    let isDarkMode = false;
    let simulationInterval = null;
    let simulationSpeed = 500; // ms per hop
    let simulationCycleCount = 0;
    let maxSimulationCycles = 3; // Default number of cycles to run
    let currentPacket = null;
    let stopSimulation = false;
    
    // DOM Elements
    const svgEl = document.getElementById('tree-svg');
    const zoomLayer = document.getElementById('zoom-layer');
    const tooltip = document.getElementById('tooltip');
    const centerMessage = document.getElementById('center-message');
    const contextMenu = document.getElementById('context-menu');
    const nodeDialog = document.getElementById('node-dialog');
    const statsPanel = document.getElementById('stats-panel');
    const pathInfo = document.getElementById('path-info');
    const importFileInput = document.getElementById('import-file');
    const simulationLegend = document.getElementById('simulation-legend');
    const simulationNotification = document.getElementById('simulation-notification');
    const infoModal = document.getElementById('info-modal');
    const closeModalBtn = document.querySelector('.close-modal');

    // Control Buttons
    const addRootBtn = document.getElementById('add-root-btn');
    const expandAllBtn = document.getElementById('expand-all-btn');
    const collapseAllBtn = document.getElementById('collapse-all-btn');
    const resetTreeBtn = document.getElementById('reset-tree-btn');
    const toggleStatsBtn = document.getElementById('toggle-stats-btn');
    const toggleDarkModeBtn = document.getElementById('toggle-dark-mode-btn');
    const simulateBtn = document.getElementById('simulate-btn');
    const stopSimulationBtn = document.getElementById('stop-simulation-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const sourceNodeSelect = document.getElementById('source-node-select');
    const targetNodeSelect = document.getElementById('target-node-select');
    const infoBtn = document.getElementById('info-btn');

    // Dialog Elements
    const dialogTitle = document.getElementById('dialog-title');
    const nodeNameInput = document.getElementById('node-name');
    const nodeStateInput = document.getElementById('node-state');
    const stateLabel = document.getElementById('state-label');
    const dialogCancelBtn = document.getElementById('dialog-cancel');
    const dialogConfirmBtn = document.getElementById('dialog-confirm');

    // Context Menu Items
    const addChildMenuItem = document.getElementById('add-child-menu');
    const renameNodeMenuItem = document.getElementById('rename-node-menu');
    const toggleNodeMenuItem = document.getElementById('toggle-node-menu');
    const toggleCollapseMenuItem = document.getElementById('toggle-collapse-menu');
    const deleteNodeMenuItem = document.getElementById('delete-node-menu');

    // ========================
    // D3 Setup
    // ========================
    // Set initial SVG dimensions
    const margin = {top: 50, right: 50, bottom: 50, left: 50};
    let width = svgEl.clientWidth;
    let height = svgEl.clientHeight;
    
    // Create the tree layout
    const treeLayout = d3.tree()
        .nodeSize([70, 90])
        .separation((a, b) => a.parent === b.parent ? 1.2 : 1.4);
        
    // Initialize zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
            zoomLayer.setAttribute('transform', event.transform);
        });
        
    d3.select(svgEl).call(zoom);

    // Initial center position for the tree
    function centerTree() {
        const initialTransform = d3.zoomIdentity
            .translate(width / 2, margin.top)
            .scale(0.8);
        d3.select(svgEl).call(zoom.transform, initialTransform);
    }

    // ========================
    // Tree Data Management
    // ========================
    // Initialize or reset tree data
    function initTreeData() {
        return {
            id: generateId(),
            name: "Root",
            children: [],
            isOn: true,
            _expanded: true
        };
    }

    // Generate a unique ID for nodes
    function generateId() {
        return 'node_' + Math.random().toString(36).substr(2, 9);
    }

    // Add a child node to the selected node
    function addChildNode(parentNode, nodeName, isOn = true) {
        // A child node can't be ON if its parent is OFF
        if (!parentNode.isOn) {
            isOn = false;
        }
        
        const newNode = {
            id: generateId(),
            name: nodeName || `Node ${parentNode.children.length + 1}`,
            children: [],
            isOn: isOn,
            _expanded: true
        };
        
        if (!parentNode.children) {
            parentNode.children = [];
        }
        
        parentNode.children.push(newNode);
        updateTree();
        updateNodeSelects();
        return newNode;
    }

    // Delete a node and its subtree
    function deleteNode(nodeToDelete) {
        // Cannot delete the root
        if (!nodeToDelete.parent) {
            showNotification("Cannot delete the root node", "error");
            return;
        }
        
        const parent = nodeToDelete.parent;
        parent.data.children = parent.data.children.filter(child => 
            child.id !== nodeToDelete.data.id
        );
        
        updateTree();
        updateNodeSelects();
        updateTreeStats();
    }

    // Toggle a node's ON/OFF state
    function toggleNodeState(node) {
        node.data.isOn = !node.data.isOn;
        
        // If a node is turned OFF, turn off all its children recursively
        if (!node.data.isOn) {
            setSubtreeState(node, false);
        }
        
        updateTree();
        updateNodeSelects();
    }
    
    // Set the state of a node and all its descendants
    function setSubtreeState(node, isOn) {
        // Set the state of the current node
        node.data.isOn = isOn;
        
        // Recursively set the state of all children
        if (node.children) {
            node.children.forEach(child => {
                setSubtreeState(child, isOn);
            });
        }
        
        // Also handle collapsed children (_children)
        if (node._children) {
            node._children.forEach(child => {
                setSubtreeState(child, isOn);
            });
        }
    }

    // Toggle a node's expanded/collapsed state
    function toggleNodeExpansion(node) {
        node.data._expanded = !node.data._expanded;
        updateTree();
    }

    // Expand all nodes in the tree
    function expandAll(node) {
        node.data._expanded = true;
        if (node.children) {
            node.children.forEach(expandAll);
        }
    }

    // Collapse all nodes in the tree except root
    function collapseAll(node) {
        if (node.depth > 0) {
            node.data._expanded = false;
        }
        if (node.children) {
            node.children.forEach(collapseAll);
        }
    }

    // Rename a node
    function renameNode(node, newName) {
        node.data.name = newName;
        updateTree();
        updateNodeSelects();
    }

    // Find a node by its ID in the tree
    function findNodeById(nodeId, currentNode = root) {
        if (currentNode.data.id === nodeId) {
            return currentNode;
        }
        
        if (currentNode.children) {
            for (const child of currentNode.children) {
                const found = findNodeById(nodeId, child);
                if (found) return found;
            }
        }
        
        return null;
    }

    // Export tree data to JSON
    function exportTreeData() {
        if (!treeData) return;
        
        const dataStr = JSON.stringify(treeData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'tree-topology-network.json';
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // Import tree data from JSON file
    function importTreeData(jsonData) {
        try {
            treeData = JSON.parse(jsonData);
            updateTree();
            updateNodeSelects();
            enableButtons();
            showNotification("Tree data imported successfully", "success", 2000);
        } catch (error) {
            showNotification("Error importing data: " + error.message, "error", 5000);
        }
    }

    // ========================
    // Tree Visualization
    // ========================
    // Update the tree visualization
    function updateTree() {
        if (!treeData) return;
        
        // Create hierarchy and apply the tree layout
        root = d3.hierarchy(treeData);
        
        // Process the tree data for visualization
        root.each(node => {
            // Generate unique ID if not present
            if (!node.data.id) {
                node.data.id = generateId();
            }
            
            // Ensure isOn property exists
            if (typeof node.data.isOn !== 'boolean') {
                node.data.isOn = true;
            }
            
            // Ensure _expanded property exists
            if (typeof node.data._expanded !== 'boolean') {
                node.data._expanded = true;
            }
            
            // Handle collapsed nodes for visualization
            if (node.children && !node.data._expanded) {
                node._children = node.children;
                node.children = null;
            } else if (node._children && node.data._expanded) {
                node.children = node._children;
                node._children = null;
            }
        });
        
        // Apply the tree layout to the root
        treeLayout(root);
        
        // Clear previous contents
        d3.select(zoomLayer).selectAll('*').remove();
        
        // Draw links first (to ensure they're below nodes)
        const links = d3.select(zoomLayer)
            .append('g')
            .attr('class', 'links')
            .selectAll('path')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', d => {
                const sourceOn = d.source.data.isOn;
                const targetOn = d.target.data.isOn;
                return `link ${(!sourceOn || !targetOn) ? 'off' : ''}`;
            })
            .attr('d', d => {
                // Create curved links (horizontal tree layout)
                return `M${d.source.y},${d.source.x}
                        C${(d.source.y + d.target.y) / 2},${d.source.x}
                         ${(d.source.y + d.target.y) / 2},${d.target.x}
                         ${d.target.y},${d.target.x}`;
            })
            .attr('id', d => `link-${d.source.data.id}-${d.target.data.id}`);
        
        // Create node groups
        const nodes = d3.select(zoomLayer)
            .append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('class', d => `node ${d.data.isOn ? '' : 'off'}`)
            .attr('id', d => `node-${d.data.id}`)
            .attr('transform', d => `translate(${d.y},${d.x})`)
            .attr('data-id', d => d.data.id);
        
        // Add circles to nodes
        nodes.append('circle')
            .attr('r', 10)
            .attr('fill', d => d.data.isOn ? 'var(--node-color)' : 'var(--node-off-color)')
            .on('click', handleNodeClick)
            .on('dblclick', handleNodeDblClick)
            .on('contextmenu', handleContextMenu)
            .on('mouseover', showTooltip)
            .on('mouseout', hideTooltip);
        
        // Add expand/collapse indicator for non-leaf nodes
        nodes.each(function(d) {
            const node = d3.select(this);
            
            // Add expand/collapse button for nodes with children
            if (d.children || d._children) {
                node.append('circle')
                    .attr('class', 'expander')
                    .attr('r', 6)
                    .attr('cx', 0)
                    .attr('cy', -20)
                    .attr('fill', 'var(--bg-color)')
                    .attr('stroke', 'var(--node-stroke)')
                    .attr('stroke-width', 1.5)
                    .attr('cursor', 'pointer')
                    .on('click', (event, d) => {
                        event.stopPropagation();
                        toggleNodeExpansion(d);
                    });
                    
                node.append('text')
                    .attr('class', 'expander-symbol')
                    .attr('x', 0)
                    .attr('y', -16)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '12px')
                    .attr('pointer-events', 'none')
                    .text(d.data._expanded ? '-' : '+');
            }
        });
        
        // Add node labels
        nodes.append('text')
            .attr('dy', '0.35em')
            .attr('x', 0)
            .attr('y', 25)
            .attr('text-anchor', 'middle')
            .text(d => d.data.name || 'Unnamed')
            .each(function(d) {
                // If the text is too long, truncate it
                const text = d3.select(this);
                const maxWidth = 70;
                
                if (this.getComputedTextLength() > maxWidth) {
                    let textContent = text.text();
                    while (this.getComputedTextLength() > maxWidth && textContent.length > 0) {
                        textContent = textContent.slice(0, -1);
                        text.text(textContent + '...');
                    }
                }
            });
        
        // Add state indicator
        nodes.append('circle')
            .attr('class', 'state-indicator')
            .attr('r', 5)
            .attr('cx', 15)
            .attr('cy', -12)
            .attr('fill', d => d.data.isOn ? '#44cc44' : '#cc4444')
            .attr('stroke', 'var(--bg-color)')
            .attr('stroke-width', 1)
            .attr('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                toggleNodeState(d);
            });
        
        // Update tree statistics
        updateTreeStats();
    }

    // ========================
    // Visualization Helpers
    // ========================
    // Handle window resize
    function handleResize() {
        width = svgEl.clientWidth;
        height = svgEl.clientHeight;
        
        // Update the center position
        centerTree();
    }

    // Toggle dark mode
    function toggleDarkMode() {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode', isDarkMode);
    }

    // Show tooltip for node
    function showTooltip(event, d) {
        const nodeEl = event.currentTarget;
        const rect = nodeEl.getBoundingClientRect();
        const svgRect = svgEl.getBoundingClientRect();
        
        // Calculate position
        const x = rect.left + rect.width / 2 - svgRect.left;
        const y = rect.top - svgRect.top;
        
        // Prepare tooltip content
        const content = `
            <div><strong>Name:</strong> ${d.data.name}</div>
            <div><strong>ID:</strong> ${d.data.id}</div>
            <div><strong>Depth:</strong> ${d.depth}</div>
            <div><strong>Parent:</strong> ${d.parent ? d.parent.data.name : 'None'}</div>
            <div><strong>Children:</strong> ${d.children ? d.children.length : 0}</div>
            <div><strong>State:</strong> ${d.data.isOn ? 'ON' : 'OFF'}</div>
            <div><em>Right-click for options</em></div>
        `;
        
        tooltip.innerHTML = content;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y - 10}px`;
        tooltip.style.opacity = 1;
    }

    // Hide tooltip
    function hideTooltip() {
        tooltip.style.opacity = 0;
    }

    // Show an alert or notification message
    function showNotification(message, type = 'info', duration = 2000) {
        // Configure SweetAlert2 based on message type
        const Toast = Swal.mixin({
            toast: true,
            position: 'top',
            showConfirmButton: false,
            timer: duration,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer)
                toast.addEventListener('mouseleave', Swal.resumeTimer)
            }
        });

        let icon = 'info';
        let background = '#3498db';
        
        switch (type) {
            case 'success':
                icon = 'success';
                background = '#2ecc71';
                break;
            case 'error':
                icon = 'error';
                background = '#e74c3c';
                break;
            case 'warning':
                icon = 'warning';
                background = '#f39c12';
                break;
            case 'info':
            default:
                icon = 'info';
                background = '#3498db';
                break;
        }
        
        // For short duration simple messages, use toast style
        if (duration <= 3000 && message.length < 50) {
            Toast.fire({
                icon: icon,
                title: message,
                background: background,
                color: '#fff'
            });
        } else {
            // For longer or more important messages, use modal style but position at top
            Swal.fire({
                icon: icon,
                title: type.charAt(0).toUpperCase() + type.slice(1),
                text: message,
                timer: duration,
                timerProgressBar: true,
                showConfirmButton: duration > 5000,
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
                position: 'top',
                width: 'auto',
                padding: '1em'
            });
        }
    }

    // Update tree statistics
    function updateTreeStats() {
        if (!root) {
            document.getElementById('tree-stats').innerHTML = '<div class="stats-summary">No tree data available. Create a root node to begin.</div>';
            return;
        }
        
        // Calculate various tree statistics
        let totalNodes = 0;
        let maxDepth = 0;
        let nodesOn = 0;
        let nodesOff = 0;
        let reachableLeafNodes = 0;
        let leafNodes = 0;
        
        root.eachBefore(node => {
            totalNodes++;
            maxDepth = Math.max(maxDepth, node.depth);
            
            if (node.data.isOn) {
                nodesOn++;
            } else {
                nodesOff++;
            }
            
            // Count leaf nodes (nodes with no children)
            if (!node.children && !node._children) {
                leafNodes++;
            // Check if it's a reachable leaf node
                if (isNodeReachable(node)) {
                reachableLeafNodes++;
                }
            }
        });
        
        // Find the longest path
        let longestPath = 0;
        let longestPathPair = null;
        
        // Check all possible paths between nodes
        const leaves = [];
        root.leaves().forEach(leaf => {
            leaves.push(leaf);
        });
        
        for (let i = 0; i < leaves.length; i++) {
            for (let j = i + 1; j < leaves.length; j++) {
                const path = findPath(leaves[i], leaves[j]);
                if (path && path.length > longestPath) {
                    longestPath = path.length;
                    longestPathPair = [leaves[i].data.name, leaves[j].data.name];
                }
            }
        }
        
        // Calculate percentages for progress bars
        const nodesOnPercent = Math.round((nodesOn / totalNodes) * 100);
        const nodesOffPercent = Math.round((nodesOff / totalNodes) * 100);
        const reachableLeafPercent = leafNodes > 0 ? Math.round((reachableLeafNodes / leafNodes) * 100) : 0;
        
        // Update the stats panel with enhanced styling
        const statsHTML = `
            <div class="stat-card">
                <div class="stat-label"><i class="fas fa-network-wired"></i> Total Nodes</div>
                <div class="stat-value">${totalNodes}</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label"><i class="fas fa-sitemap"></i> Maximum Depth</div>
                <div class="stat-value">${maxDepth}</div>
                <div class="stats-summary">Tree height from root to deepest node</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">
                    <i class="fas fa-power-off"></i> Node Status
                    <span class="stat-badge badge-on">${nodesOn} ON</span>
                    <span class="stat-badge badge-off">${nodesOff} OFF</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar progress-on" style="width: ${nodesOnPercent}%"></div>
                </div>
                <div class="progress-container" style="margin-top: 2px;">
                    <div class="progress-bar progress-off" style="width: ${nodesOffPercent}%"></div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label"><i class="fas fa-leaf"></i> Leaf Nodes</div>
                <div class="stat-value">${leafNodes} 
                    <span style="font-size: 16px; color: var(--success-color);">(${reachableLeafNodes} reachable)</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar progress-on" style="width: ${reachableLeafPercent}%"></div>
                </div>
                <div class="stats-summary">${reachableLeafPercent}% of leaf nodes are reachable</div>
            </div>
            
            ${longestPathPair ? `
            <div class="stat-card">
                <div class="stat-label"><i class="fas fa-route"></i> Longest Path</div>
                <div class="stat-value">${longestPath - 1} <span style="font-size: 16px;">hops</span></div>
                <div class="longest-path">
                    <i class="fas fa-arrow-right"></i>
                    <span class="longest-path-endpoints">${longestPathPair[0]} ↔ ${longestPathPair[1]}</span>
                </div>
            </div>
            ` : `
            <div class="stat-card">
                <div class="stat-label"><i class="fas fa-route"></i> Longest Path</div>
                <div class="stat-value">N/A</div>
                <div class="stats-summary">Add more nodes to see path information</div>
            </div>
            `}
            
            <div class="stats-summary">
                <i class="fas fa-info-circle"></i> ${getTreeHealth(nodesOnPercent, reachableLeafPercent)}
            </div>
        `;
        
        document.getElementById('tree-stats').innerHTML = statsHTML;
    }
    
    // Get tree health status message based on statistics
    function getTreeHealth(nodesOnPercent, reachableLeafPercent) {
        if (nodesOnPercent === 100) {
            return "Network is fully operational with all nodes connected.";
        } else if (nodesOnPercent >= 75) {
            return "Network is operating well with most nodes online.";
        } else if (nodesOnPercent >= 50) {
            return "Network is partially operational with some nodes offline.";
        } else if (reachableLeafPercent <= 25) {
            return "Network has significant outages affecting most endpoints.";
        } else {
            return "Network has major outages with limited connectivity.";
        }
    }

    // Check if a node is reachable from root
    function isNodeReachable(node) {
        if (!root.data.isOn) return false;
        
        let current = node;
        let isReachable = true;
        
        // Check if all nodes in the path to the root are ON
        while (current && current !== root) {
            if (!current.data.isOn) {
                isReachable = false;
                break;
            }
            current = current.parent;
        }
        
        return isReachable;
    }

    // Find path between two nodes
    function findPath(sourceNode, targetNode) {
        // If source and target are the same, return just the node
        if (sourceNode === targetNode) {
            return [sourceNode];
        }
        
        // Find lowest common ancestor (LCA)
        let sourcePath = [];
        let targetPath = [];
        
        // Create path from source to root
        let current = sourceNode;
        while (current) {
            sourcePath.push(current);
            current = current.parent;
        }
        
        // Create path from target to root
        current = targetNode;
        while (current) {
            targetPath.push(current);
            current = current.parent;
        }
        
        // Reverse the source path so both paths go from root to node
        sourcePath.reverse();
        targetPath.reverse();
        
        // Find the lowest common ancestor
        let commonIndex = 0;
        while (commonIndex < sourcePath.length && 
               commonIndex < targetPath.length && 
               sourcePath[commonIndex] === targetPath[commonIndex]) {
            commonIndex++;
        }
        
        // The common ancestor is the last matching node
        const commonAncestorIndex = commonIndex - 1;
        if (commonAncestorIndex < 0) return null; // No common ancestor
        
        // Build the complete path:
        // 1. From source to common ancestor (backwards)
        // 2. From common ancestor to target (forwards)
        const path = [];
        
        // Add nodes from source to the node before common ancestor (in reverse)
        for (let i = 0; i < sourcePath.length - commonIndex; i++) {
            path.push(sourcePath[sourcePath.length - 1 - i]);
        }
        
        // Add common ancestor if not already in path
        if (path.length === 0 || path[path.length - 1] !== sourcePath[commonAncestorIndex]) {
            path.push(sourcePath[commonAncestorIndex]);
        }
        
        // Add nodes from after common ancestor to target
        for (let i = commonAncestorIndex + 1; i < targetPath.length; i++) {
            path.push(targetPath[i]);
        }
        
        return path;
    }

    // Update node select dropdowns
    function updateNodeSelects() {
        if (!root) return;
        
        // Clear existing options
        sourceNodeSelect.innerHTML = '<option value="">Select source node</option>';
        targetNodeSelect.innerHTML = '<option value="">Select target node</option>';
        
        // Add options for all nodes
        const addOptions = (node) => {
            // Create option element
            const sourceOption = document.createElement('option');
            sourceOption.value = node.data.id;
            sourceOption.textContent = node.data.name;
            sourceOption.disabled = !node.data.isOn;
            sourceNodeSelect.appendChild(sourceOption);
            
            const targetOption = document.createElement('option');
            targetOption.value = node.data.id;
            targetOption.textContent = node.data.name;
            targetOption.disabled = !node.data.isOn;
            targetNodeSelect.appendChild(targetOption);
            
            // Process children
            if (node.children) {
                node.children.forEach(addOptions);
            }
        };
        
        // Start with the root
        addOptions(root);
        
        // Update selected values
        if (selectedSource) {
            sourceNodeSelect.value = selectedSource;
        }
        if (selectedTarget) {
            targetNodeSelect.value = selectedTarget;
        }
        
        // Enable/disable simulation button
        simulateBtn.disabled = !(sourceNodeSelect.value && targetNodeSelect.value && 
                                 sourceNodeSelect.value !== targetNodeSelect.value);
    }

    // ========================
    // User Interactions
    // ========================
    // Handle node click
    function handleNodeClick(event, d) {
        // Don't propagate the event to avoid unwanted behaviors
        event.stopPropagation();
        
        // If we're simulating, don't allow interactions
        if (isSimulating) return;
        
        // Store the current node for potential operations
        currentNode = d;
        
        // Toggle selection for simulation (first click = source, second = target)
        if (!selectedSource) {
            selectedSource = d.data.id;
            sourceNodeSelect.value = selectedSource;
            d3.select(`#node-${d.data.id} circle`).attr('stroke', 'var(--highlight-color)').attr('stroke-width', 3);
        } else if (!selectedTarget) {
            // Don't select the same node for source and target
            if (d.data.id !== selectedSource) {
                selectedTarget = d.data.id;
                targetNodeSelect.value = selectedTarget;
                d3.select(`#node-${d.data.id} circle`).attr('stroke', 'var(--highlight-color)').attr('stroke-width', 3);
                
                // Enable the simulate button
                simulateBtn.disabled = false;
            }
        } else {
            // If both are already selected, reset and select this one as source
            d3.selectAll('.node circle').attr('stroke', function() {
                return d3.select(this.parentNode).classed('off') ? 
                    'var(--node-off-stroke)' : 'var(--node-stroke)';
            }).attr('stroke-width', 2);
            
            selectedSource = d.data.id;
            selectedTarget = null;
            
            sourceNodeSelect.value = selectedSource;
            targetNodeSelect.value = '';
            
            d3.select(`#node-${d.data.id} circle`).attr('stroke', 'var(--highlight-color)').attr('stroke-width', 3);
            
            // Disable the simulate button
            simulateBtn.disabled = true;
        }
    }

    // Handle node double click for renaming
    function handleNodeDblClick(event, d) {
        event.stopPropagation();
        
        // If we're simulating, don't allow interactions
        if (isSimulating) return;
        
        currentNode = d;
        showRenameDialog(d);
    }

    // Handle right-click for context menu
    function handleContextMenu(event, d) {
        event.preventDefault();
        event.stopPropagation();
        
        // If we're simulating, don't allow interactions
        if (isSimulating) return;
        
        currentNode = d;
        
        // Position context menu
        const rect = svgEl.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.style.display = 'block';
        
        // Update toggle text based on current states
        toggleNodeMenuItem.textContent = d.data.isOn ? 'Turn OFF' : 'Turn ON';
        toggleCollapseMenuItem.textContent = d.data._expanded ? 'Collapse Subtree' : 'Expand Subtree';
        
        // Disable delete option for root
        deleteNodeMenuItem.style.opacity = d.parent ? 1 : 0.5;
    }

    // ========================
    // Dialog Functions
    // ========================
    // Show dialog for adding a child node
    function showAddChildDialog(parentNode) {
        dialogTitle.textContent = 'Add Child Node';
        nodeNameInput.value = `Child ${parentNode.children ? parentNode.children.length + 1 : 1}`;
        
        // If parent is OFF, child must be OFF too
        if (!parentNode.data.isOn) {
            nodeStateInput.checked = false;
            nodeStateInput.disabled = true;
            stateLabel.textContent = 'OFF (Parent is OFF)';
        } else {
        nodeStateInput.checked = true;
            nodeStateInput.disabled = false;
        stateLabel.textContent = 'ON';
        }
        
        nodeDialog.dataset.mode = 'add';
        nodeDialog.style.display = 'block';
        nodeNameInput.focus();
        nodeNameInput.select();
    }

    // Show dialog for renaming a node
    function showRenameDialog(node) {
        dialogTitle.textContent = 'Rename Node';
        nodeNameInput.value = node.data.name;
        
        // Check if parent is OFF - if so, this node must remain OFF
        const parentIsOff = node.parent && !node.parent.data.isOn;
        if (parentIsOff) {
            nodeStateInput.checked = false;
            nodeStateInput.disabled = true;
            stateLabel.textContent = 'OFF (Parent is OFF)';
        } else {
        nodeStateInput.checked = node.data.isOn;
            nodeStateInput.disabled = false;
        stateLabel.textContent = node.data.isOn ? 'ON' : 'OFF';
        }
        
        nodeDialog.dataset.mode = 'rename';
        nodeDialog.style.display = 'block';
        nodeNameInput.focus();
        nodeNameInput.select();
    }

    // ========================
    // Simulation Functions
    // ========================
    // Simulate message routing between two nodes
    function simulateMessage() {
        if (!selectedSource || !selectedTarget || isSimulating) return;
        
        // Reset the stop flag
        stopSimulation = false;
        
        // Find the source and target nodes
        const sourceNode = findNodeById(selectedSource);
        const targetNode = findNodeById(selectedTarget);
        
        if (!sourceNode || !targetNode) {
            showNotification("Invalid source or target node", "error");
            return;
        }
        
        // Find the path between the nodes
        const path = findPath(sourceNode, targetNode);
        
        if (!path) {
            showNotification("Could not find a path between the selected nodes", "error");
            return;
        }
        
        // For debugging - log the path
        console.log("Path:", path.map(node => node.data.name));
        
        // Check if all nodes in the path are ON
        let allNodesOn = true;
        let offNodeIndex = -1;
        
        for (let i = 0; i < path.length; i++) {
            if (!path[i].data.isOn) {
                allNodesOn = false;
                offNodeIndex = i;
                break;
            }
        }
        
        // Reset any previous highlights
        d3.selectAll('.link').classed('highlight', false);
        
        // Highlight the path in the correct direction from source to target
        for (let i = 0; i < path.length - 1; i++) {
            const source = path[i];
            const target = path[i + 1];
            
            // Create a unique ID for the link
            const linkId1 = `link-${source.data.id}-${target.data.id}`;
            const linkId2 = `link-${target.data.id}-${source.data.id}`;
            
            // Try to select the link with either ID
            const link1 = d3.select(`#${linkId1}`);
            const link2 = d3.select(`#${linkId2}`);
            
            // Highlight whichever link exists
            if (!link1.empty()) {
                link1.classed('highlight', true);
            } else if (!link2.empty()) {
                link2.classed('highlight', true);
            }
        }
        
        // Display path information
        const hops = path.length - 1;
        const latencyPerHop = 50; // ms
        const totalLatency = hops * latencyPerHop;
        
        const pathStatsHTML = `
            <div class="stat-card">
                <div class="stat-label"><i class="fas fa-map-marker-alt"></i> Source & Destination</div>
                <div class="path-item">
                    <div class="path-icon"><i class="fas fa-play"></i></div>
                    <div><strong>${sourceNode.data.name}</strong> (Source)</div>
            </div>
                <div class="path-item">
                    <div class="path-icon"><i class="fas fa-flag"></i></div>
                    <div><strong>${targetNode.data.name}</strong> (Destination)</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label"><i class="fas fa-exchange-alt"></i> Path Details</div>
                <div class="stat-value">${hops} <span style="font-size: 16px;">hops</span></div>
                <div class="progress-container" style="margin-top: 8px; height: 12px;">
                    ${Array(hops).fill().map((_, i) => 
                        `<div class="progress-bar progress-on" style="width: ${100/hops}%; margin-right: 2px; 
                         ${!allNodesOn && i >= offNodeIndex-1 ? 'background-color: var(--error-color);' : ''}"></div>`
                    ).join('')}
                </div>
                <div class="stats-summary" style="margin-top: 10px;">
                    <strong>Total Latency:</strong> ${totalLatency}ms
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">
                    <i class="fas fa-${allNodesOn ? 'check-circle' : 'exclamation-circle'}"></i> 
                    Status
                </div>
                <div style="color: ${allNodesOn ? 'var(--success-color)' : 'var(--error-color)'}; font-weight: 600; margin: 5px 0;">
                    ${allNodesOn ? 
                        '✓ Path available' : 
                        `✗ Path interrupted at ${path[offNodeIndex].data.name} (OFF)`}
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label"><i class="fas fa-route"></i> Complete Path</div>
                <div style="font-size: 14px; margin-top: 8px; overflow-wrap: break-word;">
                    ${path.map((n, i) => 
                        `<span style="color: ${!allNodesOn && i >= offNodeIndex ? 'var(--error-color)' : 'inherit'}; 
                        ${i === 0 || i === path.length-1 ? 'font-weight: 600;' : ''}">
                        ${n.data.name}</span>${i < path.length-1 ? ' → ' : ''}`
                    ).join('')}
                </div>
            </div>
        `;
        
        document.getElementById('path-stats').innerHTML = pathStatsHTML;
        pathInfo.style.display = 'block';
        
        // If the path is interrupted, stop the simulation
        if (!allNodesOn) {
            stopSimulation = true;
            // Instead of calling stopSimulationBtn.onclick() which shows "Simulation stopped"
            // Show a more appropriate message
            showSimulationNotification(`Cannot simulate: Path blocked at ${path[offNodeIndex].data.name} (OFF)`, "error", 2000);
            
            // Clean up any animation elements
            d3.select(zoomLayer).selectAll('.message-packet-group, .message-packet-trail').interrupt().remove();
            d3.selectAll('.node circle').classed('receiving-message', false);
            d3.selectAll('.node circle').classed('message-delivered', false);
            d3.selectAll('.link').classed('active-segment', false);
            isSimulating = false;
            simulateBtn.disabled = false;
            stopSimulationBtn.disabled = true;
            return;
        }

        // Set simulation mode
        isSimulating = true;
        simulateBtn.disabled = true;
        stopSimulationBtn.disabled = false;

        // Show simulation notification
        showSimulationNotification(`Starting simulation: ${sourceNode.data.name} → ${targetNode.data.name}`, "info", 2000);
        simulationLegend.style.opacity = '1';

        // Reset stop button handler
        stopSimulationBtn.onclick = () => {
            // Set the stop flag for the animation
            stopSimulation = true;

            // Stop any ongoing animations
            d3.select(zoomLayer).selectAll('.message-packet-group, .message-packet-trail').interrupt().remove();
            d3.selectAll('.node circle').classed('receiving-message', false);
            d3.selectAll('.node circle').classed('message-delivered', false);
            d3.selectAll('.link').classed('active-segment', false);
            isSimulating = false;
            simulateBtn.disabled = false;
            stopSimulationBtn.disabled = true;
            showSimulationNotification("Simulation stopped", "error", 2000);
        };
        
        // Animate the message packet along the path
        animateMessagePacket(path, allNodesOn, offNodeIndex);
    }

    // Animate a message packet along a path
    function animateMessagePacket(path, allNodesOn, offNodeIndex) {
        // Create a message packet (circle) and its glow effect
        const packetGroup = d3.select(zoomLayer).append('g')
            .attr('class', 'message-packet-group');
            
        packetGroup.append('circle')
            .attr('class', 'message-packet-glow')
            .attr('r', 16);
            
        packetGroup.append('circle')
            .attr('class', 'message-packet')
            .attr('r', 8);
        
        // Add a pulse circle for extra effect
        packetGroup.append('circle')
            .attr('class', 'message-packet-pulse')
            .attr('r', 0)
            .attr('fill', 'rgba(255,255,255,0.7)')
            .attr('opacity', 0.7)
            .attr('stroke', 'var(--message-color)')
            .attr('stroke-width', 2);
        
        // Set initial position at the source node
        const startNode = path[0];
        packetGroup.attr('transform', `translate(${startNode.y},${startNode.x})`);
        
        // Show pulse effect at start node
        d3.select(`#node-${startNode.data.id} circle`).classed('receiving-message', true);
        
        // Animation duration between each node (slower for better visualization)
        const stepDuration = 1200; // ms
        
        // Create ripple effect at source
        createRippleEffect(startNode.y, startNode.x);
        
        // Determine the last valid node index
        let lastValidIndex = path.length - 1;
        
        // If there's an OFF node in the path, stop at that node
        if (!allNodesOn && offNodeIndex > -1) {
            lastValidIndex = offNodeIndex;
        }
        
        // Create path segments for animation
        const pathSegments = [];
        
        // Build segments from node to node following the curved links
        for (let i = 0; i < lastValidIndex; i++) {
            const source = path[i];
            const target = path[i + 1];
            
            // Debug info
            console.log(`Segment ${i}: ${source.data.name} -> ${target.data.name}`);
            
            // Try both possible link IDs since the link might be in either direction
            const linkId1 = `link-${source.data.id}-${target.data.id}`;
            const linkId2 = `link-${target.data.id}-${source.data.id}`;
            
            // Find the actual path element
            let linkElement = document.getElementById(linkId1);
            let isReversed = false;
            
            if (!linkElement) {
                linkElement = document.getElementById(linkId2);
                isReversed = true;
            }
            
            if (linkElement) {
                pathSegments.push({
                    source: source,
                    target: target,
                    path: linkElement,
                    length: linkElement.getTotalLength(),
                    isReversed: isReversed
                });
            } else {
                // Fallback if link element not found - direct line
                pathSegments.push({
                    source: source,
                    target: target,
                    path: null,
                    length: Math.sqrt(
                        Math.pow(target.y - source.y, 2) + 
                        Math.pow(target.x - source.x, 2)
                    ),
                    isReversed: false
                });
            }
        }
        
        // Active node highlighting during animation
        function highlightCurrentNode(index) {
            // Reset all nodes to normal
            d3.selectAll('.node circle').classed('receiving-message', false);
            
            // Highlight the current node
            if (index >= 0 && index < path.length) {
                d3.select(`#node-${path[index].data.id} circle`).classed('receiving-message', true);
            }
        }
        
        // Function to animate along the path
        function animateAlongPath(segmentIndex) {
            // If stop flag is set, end animation
            if (stopSimulation) {
                // Clean up
                packetGroup.remove();
                d3.selectAll('.node circle').classed('receiving-message', false);
                return;
            }
            
            // Check if all nodes in path are still ON before proceeding
            let allNodesStillOn = true;
            let interruptedNodeName = "";
            
            for (let i = 0; i < path.length; i++) {
                if (!path[i].data.isOn) {
                    allNodesStillOn = false;
                    interruptedNodeName = path[i].data.name;
                    break;
                }
            }
            
            // If a node has been turned off during simulation, stop
            if (!allNodesStillOn) {
                // Clean up
                packetGroup.remove();
                d3.selectAll('.node circle').classed('receiving-message', false);
                d3.selectAll('.link').classed('active-segment', false);
                
                // Show failure notification
                showSimulationNotification(`Path interrupted: ${interruptedNodeName} is now OFF`, "error", 2000);
                
                // End the simulation
                isSimulating = false;
                simulateBtn.disabled = false;
                stopSimulationBtn.disabled = true;
                stopSimulation = true;
                
                return;
            }
            
            // If we've reached the end of the path segments
            if (segmentIndex >= pathSegments.length) {
                // For an OFF node, we stop there
                if (!allNodesOn) {
                    // Remove the packet and node highlighting
                    packetGroup.remove();
                    d3.selectAll('.node circle').classed('receiving-message', false);
                    
                    // Show failure notification
                    showSimulationNotification(`Message failed at ${path[offNodeIndex].data.name} (OFF)`, "error", 2000);
                    
                    // End the simulation
                    isSimulating = false;
                    simulateBtn.disabled = false;
                    stopSimulationBtn.disabled = true;
                    
                    // Remove path highlights after a delay
                    setTimeout(() => {
                        d3.selectAll('.link').classed('highlight', false);
                    }, 2000);
                    
                    return;
                }
                
                // For functioning paths, loop back to start for continuous animation
                // Small pause before starting again
                setTimeout(() => {
                    // Reset to source node position
                    packetGroup.attr('transform', `translate(${startNode.y},${startNode.x})`);
                    
                    // Briefly show success notification and then restart animation
                    showSimulationNotification(`Message delivered from ${path[0].data.name} to ${path[path.length-1].data.name}`, "success", 2000);
                    
                    // Add success effect to the target node
                    const targetNode = path[path.length-1];
                    d3.select(`#node-${targetNode.data.id} circle`).classed('receiving-message', false);
                    d3.select(`#node-${targetNode.data.id} circle`).classed('message-delivered', true);
                    
                    // Create ripple effect at target
                    createRippleEffect(targetNode.y, targetNode.x);
                    
                    // Remove success effect after a delay
                    setTimeout(() => {
                        d3.select(`#node-${targetNode.data.id} circle`).classed('message-delivered', false);
                    }, 1000);
                    
                    // Start over from the first segment
                    setTimeout(() => {
                        if (isSimulating) { // Only restart if still simulating
                            animateAlongPath(0);
                        }
                    }, 500);
                }, 500);
                
                return;
            }
            
            const segment = pathSegments[segmentIndex];
            const segmentDuration = stepDuration * (segment.length / 100); // Adjust timing based on length
            
            // Highlight the source node
            highlightCurrentNode(segmentIndex);
            
            if (segment.path) {
                // Animate along the SVG path
                const pathLength = segment.path.getTotalLength();
                
                // Add extra highlight to current link segment
                const segmentId = segment.path.id;
                d3.select(`#${segmentId}`).classed('active-segment', true);
                
                // Create interpolator for points along the path, respecting direction
                const pointInterpolator = function(t) {
                    // If the path is reversed, we need to animate from end to start
                    const point = segment.isReversed 
                        ? segment.path.getPointAtLength((1 - t) * pathLength)
                        : segment.path.getPointAtLength(t * pathLength);
                    return `translate(${point.x}, ${point.y})`;
                };
                
                // Create evenly spaced points along the path for trail effect
                const trailPoints = [];
                const numTrailPoints = 10;
                
                for (let i = 0; i <= numTrailPoints; i++) {
                    // If the path is reversed, we need points from end to start
                    const pathPosition = segment.isReversed 
                        ? (1 - i / numTrailPoints) * pathLength
                        : (i / numTrailPoints) * pathLength;
                    trailPoints.push(segment.path.getPointAtLength(pathPosition));
                }
                
                // Animate packet along the curved path
                packetGroup.transition()
                    .duration(segmentDuration)
                    .attrTween("transform", () => t => pointInterpolator(t))
                    .on("end", () => {
                        // Remove active segment highlight
                        d3.select(`#${segmentId}`).classed('active-segment', false);
                        
                        // Create effect at the end of this segment
                        createRippleEffect(segment.target.y, segment.target.x);
                        
                        // Move to next segment
                        animateAlongPath(segmentIndex + 1);
                    });
                
                // Add trail effect at intervals
                for (let i = 1; i < trailPoints.length; i++) {
                    setTimeout(() => {
                        if (!isSimulating) return; // Skip if simulation stopped
                        
                        d3.select(zoomLayer).append('circle')
                            .attr('class', 'message-packet-trail')
                            .attr('r', 3)
                            .attr('cx', trailPoints[i].x)
                            .attr('cy', trailPoints[i].y)
                            .transition()
                            .duration(1500)
                            .style('opacity', 0)
                            .remove();
                    }, segmentDuration * (i / trailPoints.length));
                }
            } else {
                // Fallback for direct line if path element not found
                packetGroup.transition()
                    .duration(segmentDuration)
                    .attr('transform', `translate(${segment.target.y},${segment.target.x})`)
                    .on("end", () => {
                        // Move to next segment
                        animateAlongPath(segmentIndex + 1);
                    });
                
                // Add trail effect
                const sourcePoint = { x: segment.source.x, y: segment.source.y };
                const targetPoint = { x: segment.target.x, y: segment.target.y };
                
                for (let i = 1; i <= 5; i++) {
                    setTimeout(() => {
                        if (!isSimulating) return; // Skip if simulation stopped
                        
                        const t = i / 5;
                        const x = sourcePoint.x + (targetPoint.x - sourcePoint.x) * t;
                        const y = sourcePoint.y + (targetPoint.y - sourcePoint.y) * t;
                        
                        d3.select(zoomLayer).append('circle')
                            .attr('class', 'message-packet-trail')
                            .attr('r', 3)
                            .attr('cx', y) // x and y are swapped in d3.tree layout
                            .attr('cy', x)
                            .transition()
                            .duration(1500)
                            .style('opacity', 0)
                            .remove();
                    }, segmentDuration * (i / 5));
                }
            }
        }
        
        // Start the animation with the first segment
        animateAlongPath(0);
        
        // Make stop button active
        stopSimulationBtn.disabled = false;
        stopSimulationBtn.onclick = () => {
            // Set the stop flag for the animation
            stopSimulation = true;
            
            // Stop any ongoing animations
            d3.select(zoomLayer).selectAll('.message-packet-group, .message-packet-trail').interrupt().remove();
            d3.selectAll('.node circle').classed('receiving-message', false);
            d3.selectAll('.node circle').classed('message-delivered', false);
            d3.selectAll('.link').classed('active-segment', false);
            isSimulating = false;
            simulateBtn.disabled = false;
            stopSimulationBtn.disabled = true;
            showSimulationNotification("Simulation stopped", "error", 2000);
        };
    }

    // Add this function for creating ripple effects at nodes
    function createRippleEffect(x, y) {
        const ripple = d3.select(zoomLayer).append('circle')
            .attr('class', 'ripple-effect')
            .attr('cx', x)
            .attr('cy', y)
            .attr('r', 5)
            .attr('fill', 'none')
            .attr('stroke', 'var(--highlight-color)')
            .attr('stroke-width', 2)
            .attr('opacity', 0.8);
        
        ripple.transition()
            .duration(1500)
            .attr('r', 40)
            .attr('opacity', 0)
            .on('end', function() {
                ripple.remove();
            });
    }

    // ========================
    // Information & Help Functions
    // ========================
    // Show the information modal
    function showInfoModal() {
        infoModal.style.display = 'block';
    }

    // Hide the information modal
    function hideInfoModal() {
        infoModal.style.display = 'none';
    }

    // ========================
    // Event Listeners
    // ========================
    // Handle window resize
    window.addEventListener('resize', handleResize);
    
    // Close context menu on click elsewhere
    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });
    
    // Prevent default context menu
    svgEl.addEventListener('contextmenu', e => {
        e.preventDefault();
    });
    
    // Information button listener
    infoBtn.addEventListener('click', showInfoModal);
    
    // Modal close button
    closeModalBtn.addEventListener('click', hideInfoModal);
    
    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === infoModal) {
            hideInfoModal();
        }
    });
    
    // Button click handlers
    addRootBtn.addEventListener('click', () => {
        if (!treeData) {
            // Initialize tree data
            treeData = initTreeData();
            updateTree();
            centerTree();
            enableButtons();
        } else {
            showNotification("Root node already exists");
        }
    });
    
    expandAllBtn.addEventListener('click', () => {
        if (root) {
            expandAll(root);
            updateTree();
        }
    });
    
    collapseAllBtn.addEventListener('click', () => {
        if (root) {
            collapseAll(root);
            updateTree();
        }
    });
    
    resetTreeBtn.addEventListener('click', () => {
        // Confirm before resetting
        if (confirm("Are you sure you want to reset the tree? This will delete all nodes.")) {
            treeData = null;
            root = null;
            selectedSource = null;
            selectedTarget = null;
            
            // Clear the SVG
            d3.select(zoomLayer).selectAll('*').remove();
            
            // Hide path info
            pathInfo.style.display = 'none';
            
            // Update the statistics
            updateTreeStats();
            
            // Clear dropdowns
            sourceNodeSelect.innerHTML = '<option value="">Select source node</option>';
            targetNodeSelect.innerHTML = '<option value="">Select target node</option>';
            
            // Disable buttons
            disableButtons();
        }
    });
    
    toggleStatsBtn.addEventListener('click', () => {
        statsPanel.classList.toggle('hidden');
    });
    
    toggleDarkModeBtn.addEventListener('click', toggleDarkMode);
    
    simulateBtn.addEventListener('click', simulateMessage);
    
    exportBtn.addEventListener('click', exportTreeData);
    
    importBtn.addEventListener('click', () => {
        importFileInput.click();
    });
    
    // Context menu items
    addChildMenuItem.addEventListener('click', () => {
        if (currentNode) {
            showAddChildDialog(currentNode);
        }
        contextMenu.style.display = 'none';
    });
    
    renameNodeMenuItem.addEventListener('click', () => {
        if (currentNode) {
            showRenameDialog(currentNode);
        }
        contextMenu.style.display = 'none';
    });
    
    toggleNodeMenuItem.addEventListener('click', () => {
        if (currentNode) {
            toggleNodeState(currentNode);
        }
        contextMenu.style.display = 'none';
    });
    
    toggleCollapseMenuItem.addEventListener('click', () => {
        if (currentNode) {
            toggleNodeExpansion(currentNode);
        }
        contextMenu.style.display = 'none';
    });
    
    deleteNodeMenuItem.addEventListener('click', () => {
        if (currentNode && currentNode.parent) {
            deleteNode(currentNode);
        } else if (currentNode) {
            showNotification("Cannot delete the root node");
        }
        contextMenu.style.display = 'none';
    });
    
    // Dialog event listeners
    nodeStateInput.addEventListener('change', () => {
        stateLabel.textContent = nodeStateInput.checked ? 'ON' : 'OFF';
    });
    
    dialogCancelBtn.addEventListener('click', () => {
        nodeDialog.style.display = 'none';
    });
    
    dialogConfirmBtn.addEventListener('click', () => {
        const mode = nodeDialog.dataset.mode;
        const nodeName = nodeNameInput.value.trim() || 'Unnamed';
        const isOn = nodeStateInput.checked;
        
        if (mode === 'add' && currentNode) {
            addChildNode(currentNode.data, nodeName, isOn);
        } else if (mode === 'rename' && currentNode) {
            renameNode(currentNode, nodeName);
            
            // Update node state and propagate to children if turning off
            const wasOn = currentNode.data.isOn;
            currentNode.data.isOn = isOn;
            
            // If turning off, make sure children are also turned off
            if (wasOn && !isOn) {
                setSubtreeState(currentNode, false);
            }
            
            updateTree();
        }
        
        nodeDialog.style.display = 'none';
    });
    
    // Select change handlers
    sourceNodeSelect.addEventListener('change', () => {
        // Reset highlights
        d3.selectAll('.node circle').attr('stroke', function() {
            return d3.select(this.parentNode).classed('off') ? 
                'var(--node-off-stroke)' : 'var(--node-stroke)';
        }).attr('stroke-width', 2);
        
        selectedSource = sourceNodeSelect.value || null;
        
        if (selectedSource) {
            d3.select(`#node-${selectedSource} circle`).attr('stroke', 'var(--highlight-color)').attr('stroke-width', 3);
        }
        
        // Enable/disable simulate button
        simulateBtn.disabled = !(sourceNodeSelect.value && targetNodeSelect.value && 
                               sourceNodeSelect.value !== targetNodeSelect.value);
    });
    
    targetNodeSelect.addEventListener('change', () => {
        // Reset highlights
        d3.selectAll('.node circle').attr('stroke', function() {
            return d3.select(this.parentNode).classed('off') ? 
                'var(--node-off-stroke)' : 'var(--node-stroke)';
        }).attr('stroke-width', 2);
        
        selectedTarget = targetNodeSelect.value || null;
        
        if (selectedSource) {
            d3.select(`#node-${selectedSource} circle`).attr('stroke', 'var(--highlight-color)').attr('stroke-width', 3);
        }
        
        if (selectedTarget) {
            d3.select(`#node-${selectedTarget} circle`).attr('stroke', 'var(--highlight-color)').attr('stroke-width', 3);
        }
        
        // Enable/disable simulate button
        simulateBtn.disabled = !(sourceNodeSelect.value && targetNodeSelect.value && 
                               sourceNodeSelect.value !== targetNodeSelect.value);
    });
    
    // File input change handler
    importFileInput.addEventListener('change', () => {
        const file = importFileInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                importTreeData(e.target.result);
            };
            reader.readAsText(file);
        }
    });
    
    // ========================
    // Helper Functions
    // ========================
    // Enable all buttons when tree is initialized
    function enableButtons() {
        expandAllBtn.disabled = false;
        collapseAllBtn.disabled = false;
        resetTreeBtn.disabled = false;
        exportBtn.disabled = false;
    }
    
    // Disable buttons when no tree exists
    function disableButtons() {
        // Disable all tree-related buttons when no tree exists
        const buttonsToDisable = [
            { element: expandAllBtn, label: 'Expand All' },
            { element: collapseAllBtn, label: 'Collapse All' },
            { element: resetTreeBtn, label: 'Reset Tree' },
            { element: simulateBtn, label: 'Simulate Message' },
            { element: exportBtn, label: 'Export Tree' }
        ];
        
        // Disable all buttons with visual feedback
        buttonsToDisable.forEach(btn => {
            btn.element.disabled = true;
            btn.element.title = `${btn.label} (Unavailable - No tree exists)`;
            btn.element.classList.add('disabled-button');
        });
        
        // Disable node selection dropdowns
        sourceNodeSelect.disabled = true;
        sourceNodeSelect.title = "Source node selection unavailable - No tree exists";
        targetNodeSelect.disabled = true;
        targetNodeSelect.title = "Target node selection unavailable - No tree exists";
        
        // Show a helpful message in the center of the screen
        showNotification("Create or import a tree to begin", "info", 3000);
    }
    
    // ========================
    // Example Tree Generation
    // ========================
    // Generate a sample tree for demo purposes
    function generateSampleTree() {
        treeData = {
            id: generateId(),
            name: "Root",
            isOn: true,
            _expanded: true,
            children: [
                {
                    id: generateId(),
                    name: "Switch A",
                    isOn: true,
                    _expanded: true,
                    children: [
                        {
                            id: generateId(),
                            name: "Node A1",
                            isOn: true,
                            _expanded: true,
                            children: []
                        },
                        {
                            id: generateId(),
                            name: "Node A2",
                            isOn: false,
                            _expanded: true,
                            children: []
                        }
                    ]
                },
                {
                    id: generateId(),
                    name: "Switch B",
                    isOn: true,
                    _expanded: true,
                    children: [
                        {
                            id: generateId(),
                            name: "Node B1",
                            isOn: true,
                            _expanded: true,
                            children: []
                        },
                        {
                            id: generateId(),
                            name: "Switch B2",
                            isOn: true,
                            _expanded: true,
                            children: [
                                {
                                    id: generateId(),
                                    name: "Node B2.1",
                                    isOn: true,
                                    _expanded: true,
                                    children: []
                                },
                                {
                                    id: generateId(),
                                    name: "Node B2.2",
                                    isOn: true,
                                    _expanded: true,
                                    children: []
                                }
                            ]
                        }
                    ]
                }
            ]
        };
        
        updateTree();
        centerTree();
        enableButtons();
        sourceNodeSelect.disabled = false;
        targetNodeSelect.disabled = false;
    }
    
    // Initialize with a sample tree
    generateSampleTree();

    // Update the simulation buttons to ensure text renders correctly with icons
    simulateBtn.innerHTML = '<i class="fas fa-play"></i>&nbsp; Simulate Message';
    stopSimulationBtn.innerHTML = '<i class="fas fa-stop"></i>&nbsp; Stop Simulation';

    // Show simulation notification
    function showSimulationNotification(message, type = 'success', duration = 2000) {
        // Clear any existing notification timeouts
        if (window.notificationTimeout) {
            clearTimeout(window.notificationTimeout);
        }
        
        // Set notification type and message
        simulationNotification.className = 'simulation-notification';
        simulationNotification.classList.add(type);
        
        // Update content based on type
        const notificationIcon = simulationNotification.querySelector('.notification-icon');
        const notificationText = simulationNotification.querySelector('.notification-text');
        const timerProgress = simulationNotification.querySelector('.notification-timer-progress');
        
        // Reset timer animation
        timerProgress.classList.remove('animate');
        
        // Set icon and text based on type
        if (type === 'success') {
            notificationIcon.className = 'notification-icon fas fa-check-circle';
        } else if (type === 'error') {
            notificationIcon.className = 'notification-icon fas fa-exclamation-triangle';
        } else {
            notificationIcon.className = 'notification-icon fas fa-info-circle';
        }
        
        notificationText.textContent = message;
        
        // Show the notification with timer animation
        simulationNotification.classList.add('show');
        
        // Force a reflow to restart the animation
        void timerProgress.offsetWidth;
        
        // Set animation duration to match the notification duration
        timerProgress.style.animationDuration = `${duration}ms`;
        
        // Start the timer animation
        timerProgress.classList.add('animate');
        
        // Auto-hide after duration
        window.notificationTimeout = setTimeout(() => {
            simulationNotification.classList.remove('show');
        }, duration);
    }
});

