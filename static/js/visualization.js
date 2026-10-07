// ==========================================================================
// PatternLab 3D Visualization Controller
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    let datasetState = getDatasetState();
    const datasetSelect = document.getElementById('datasetSelectVis');
    const graphContainer = document.getElementById('3d-graph');
    let Graph = null;
    let currentFeatures = new Set();
    let target = null;
    let selectedNode = null;

    // Initialize 3D Graph Instance
    function initGraph() {
        if (!Graph && graphContainer) {
            Graph = ForceGraph3D()(graphContainer)
                .width(graphContainer.clientWidth)
                .height(graphContainer.clientHeight || 600)
                .backgroundColor('#090d16')
                .nodeLabel('name')
                .nodeColor(node => {
                    if (node.type === 'target') return '#ec4899';
                    const corr = node.correlation || 0.1;
                    if (corr > 0.6) return '#6366f1';
                    if (corr > 0.3) return '#38bdf8';
                    return '#94a3b8';
                })
                .onNodeClick(node => handleNodeClick(node));
        }
    }

    // Auto-load dataset if missing
    async function ensureDatasetLoaded() {
        if (!datasetState) {
            // Load Iris by default so page is immediately active
            const res = await fetch('/ml/api/load-demo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: 'iris.csv' })
            });
            const data = await res.json();
            if (res.ok) {
                datasetState = {
                    filepath: data.filepath,
                    filename: data.filename,
                    analysis: data.analysis,
                    target: data.suggested_target || 'species'
                };
                storeDatasetState(data.analysis, data.filepath, data.filename, data.suggested_target);
            }
        }
        
        if (datasetSelect && datasetState) {
            for (let opt of datasetSelect.options) {
                if (opt.value === datasetState.filename || opt.value === datasetState.filepath) {
                    opt.selected = true;
                    break;
                }
            }
        }
        
        setupDatasetContext();
    }

    function setupDatasetContext() {
        if (!datasetState || !datasetState.analysis) return;
        
        const cols = datasetState.analysis.columns.map(c => c.name);
        target = datasetState.target || cols[cols.length - 1];
        currentFeatures = new Set(cols.filter(c => c !== target));
        
        initGraph();
        loadGraphData();
    }

    // Handle switching dataset from dropdown
    if (datasetSelect) {
        datasetSelect.addEventListener('change', async (e) => {
            const selectedOpt = datasetSelect.options[datasetSelect.selectedIndex];
            const isUser = selectedOpt.dataset.user === 'true';
            const val = selectedOpt.value;
            
            showToast(`Loading ${selectedOpt.text}...`, 'info');
            
            try {
                let res, data;
                if (isUser) {
                    res = await fetch('/ml/api/load-existing', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filepath: val, filename: selectedOpt.text })
                    });
                } else {
                    res = await fetch('/ml/api/load-demo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename: val })
                    });
                }
                data = await res.json();
                if (res.ok) {
                    datasetState = {
                        filepath: data.filepath,
                        filename: data.filename,
                        analysis: data.analysis,
                        target: data.suggested_target || null
                    };
                    storeDatasetState(data.analysis, data.filepath, data.filename, data.suggested_target);
                    setupDatasetContext();
                    showToast(`Loaded ${data.filename}`, 'success');
                } else {
                    showToast(data.error || 'Failed to switch dataset.', 'danger');
                }
            } catch {
                showToast('Error switching dataset.', 'danger');
            }
        });
    }

    // Switch visualization modes
    document.getElementById('visMode')?.addEventListener('change', (e) => {
        const mode = e.target.value;
        const graphControls = document.getElementById('graphControls');
        const dimControls = document.getElementById('dimControls');
        const statusBadge = document.getElementById('canvasStatusBadge');
        
        if (mode === 'graph') {
            graphControls.style.display = 'block';
            dimControls.style.display = 'none';
            statusBadge.textContent = 'Feature Correlation Network';
            loadGraphData();
        } else {
            graphControls.style.display = 'none';
            dimControls.style.display = 'block';
            statusBadge.textContent = mode === 'pca' ? 'PCA Manifold Projection' : 't-SNE Manifold Projection';
            // Clear graph until project is clicked
            if (Graph) Graph.graphData({ nodes: [], links: [] });
        }
    });

    // Run Dimensionality Reduction Projection
    document.getElementById('projectBtn')?.addEventListener('click', async () => {
        const mode = document.getElementById('visMode').value;
        const dims = parseInt(document.getElementById('dimSelect').value);
        const btn = document.getElementById('projectBtn');
        const varianceBanner = document.getElementById('varianceBanner');
        const varianceText = document.getElementById('varianceExplainedText');
        
        btn.disabled = true;
        btn.textContent = 'Projecting points...';
        
        try {
            const response = await fetch('/api/visualization/reduce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filepath: datasetState.filepath,
                    features: Array.from(currentFeatures),
                    method: mode,
                    dimensions: dims
                })
            });
            const data = await response.json();
            btn.disabled = false;
            btn.textContent = 'Run Projection';
            
            if (response.ok && data.points) {
                renderProjection(data.points, dims);
                
                if (data.meta && data.meta.total_variance_explained) {
                    varianceBanner.style.display = 'block';
                    varianceText.textContent = `${data.meta.total_variance_explained}%`;
                } else {
                    varianceBanner.style.display = 'none';
                }
                showToast(`Rendered ${data.points.length} sample points`, 'success');
            } else {
                showToast(data.error || 'Projection failed.', 'danger');
            }
        } catch {
            btn.disabled = false;
            btn.textContent = 'Run Projection';
            showToast('Network error during projection.', 'danger');
        }
    });

    // Launch in ML Studio button
    document.getElementById('buildModelBtn')?.addEventListener('click', () => {
        if (!datasetState) return;
        datasetState.target = target;
        datasetState.selectedFeatures = Array.from(currentFeatures);
        sessionStorage.setItem('currentDataset', JSON.stringify(datasetState));
        window.location.href = '/ml/builder';
    });

    async function loadGraphData() {
        if (!datasetState) return;
        
        try {
            const response = await fetch('/api/visualization/graph', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filepath: datasetState.filepath,
                    target: target,
                    features: Array.from(currentFeatures)
                })
            });
            const data = await response.json();
            if (response.ok && Graph) {
                Graph.graphData(data)
                     .nodeRelSize(5)
                     .nodeVal(node => node.val)
                     .linkWidth(link => Math.max(1, (link.weight || 0.1) * 6))
                     .linkColor(() => 'rgba(99, 102, 241, 0.35)');
            }
        } catch (err) {
            console.error('Graph fetch error:', err);
        }
    }

    function renderProjection(points, dims) {
        if (!Graph) return;
        
        const nodes = points.map((p, i) => ({
            id: i,
            x: p.x * 25,
            y: p.y * 25,
            z: dims === 3 ? (p.z || 0) * 25 : 0,
            name: `Sample Record #${i + 1}`
        }));
        
        Graph.graphData({ nodes: nodes, links: [] })
             .nodeRelSize(3)
             .nodeVal(3.5)
             .nodeColor(() => '#38bdf8')
             .d3Force('charge', null)
             .d3Force('link', null);
    }

    function handleNodeClick(node) {
        if (document.getElementById('visMode').value !== 'graph') return;
        
        selectedNode = node;
        const inspector = document.getElementById('nodeInspector');
        inspector.style.display = 'block';
        document.getElementById('nodeName').textContent = node.name;
        document.getElementById('nodeType').textContent = node.type.toUpperCase();
        document.getElementById('nodeCorr').textContent = node.correlation !== undefined ? node.correlation.toFixed(4) : 'Target Variable';
        
        const toggleBtn = document.getElementById('toggleFeatureBtn');
        if (node.type === 'target') {
            toggleBtn.style.display = 'none';
        } else {
            toggleBtn.style.display = 'block';
            toggleBtn.textContent = currentFeatures.has(node.name) ? 'Remove from Analysis' : 'Include in Analysis';
        }
    }

    document.getElementById('toggleFeatureBtn')?.addEventListener('click', () => {
        if (!selectedNode || selectedNode.type === 'target') return;
        
        if (currentFeatures.has(selectedNode.name)) {
            currentFeatures.delete(selectedNode.name);
            showToast(`Excluded ${selectedNode.name}`, 'info');
        } else {
            currentFeatures.add(selectedNode.name);
            showToast(`Included ${selectedNode.name}`, 'success');
        }
        loadGraphData();
        document.getElementById('nodeInspector').style.display = 'none';
    });

    ensureDatasetLoaded();
});
