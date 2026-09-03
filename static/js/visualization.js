document.addEventListener('DOMContentLoaded', () => {
    const datasetState = getDatasetState();
    if (!datasetState) return;

    document.getElementById('visHeader').innerHTML = `<h3>Dataset: ${datasetState.filename}</h3>`;
    document.getElementById('visHeader').className = '';
    document.getElementById('visWorkspace').style.display = 'flex';

    let Graph = ForceGraph3D()(document.getElementById('3d-graph'))
        .width(document.getElementById('3d-graph').clientWidth)
        .height(600)
        .backgroundColor('#111')
        .nodeLabel('name')
        .nodeAutoColorBy('type')
        .onNodeClick(node => handleNodeClick(node));

    let currentFeatures = new Set(datasetState.analysis.columns.map(c => c.name));
    let target = datasetState.target || datasetState.analysis.columns[datasetState.analysis.columns.length - 1].name;
    currentFeatures.delete(target);

    loadGraphData();

    document.getElementById('visMode').addEventListener('change', (e) => {
        const mode = e.target.value;
        if (mode === 'graph') {
            document.getElementById('graphControls').style.display = 'block';
            document.getElementById('dimControls').style.display = 'none';
            loadGraphData();
        } else {
            document.getElementById('graphControls').style.display = 'none';
            document.getElementById('dimControls').style.display = 'block';
            // Wait for user to click project button for projection
            Graph.graphData({nodes: [], links: []});
        }
    });

    document.getElementById('projectBtn').addEventListener('click', async () => {
        const mode = document.getElementById('visMode').value;
        const dims = parseInt(document.getElementById('dimSelect').value);
        
        try {
            const response = await fetch('/api/visualization/reduce', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    filepath: datasetState.filepath,
                    features: Array.from(currentFeatures),
                    method: mode,
                    dimensions: dims
                })
            });
            const data = await response.json();
            if (response.ok) {
                renderProjection(data.points, dims);
            }
        } catch (err) {
            console.error(err);
        }
    });
    
    document.getElementById('buildModelBtn').addEventListener('click', () => {
        datasetState.target = target;
        datasetState.selectedFeatures = Array.from(currentFeatures);
        sessionStorage.setItem('currentDataset', JSON.stringify(datasetState));
        window.location.href = '/ml/builder';
    });

    async function loadGraphData() {
        try {
            const response = await fetch('/api/visualization/graph', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    filepath: datasetState.filepath,
                    target: target,
                    features: Array.from(currentFeatures)
                })
            });
            const data = await response.json();
            if (response.ok) {
                Graph.graphData(data)
                     .nodeRelSize(5)
                     .nodeVal(node => node.val)
                     .linkWidth(link => link.weight * 5);
            }
        } catch (err) {
            console.error(err);
        }
    }

    function renderProjection(points, dims) {
        const nodes = points.map((p, i) => ({
            id: i,
            x: p.x,
            y: p.y,
            z: dims === 3 ? p.z : 0,
            name: `Point ${i}`
        }));
        
        Graph.graphData({nodes: nodes, links: []})
             .nodeRelSize(3)
             .nodeVal(3)
             .d3Force('charge', null)
             .d3Force('link', null);
    }

    let selectedNode = null;
    function handleNodeClick(node) {
        if (document.getElementById('visMode').value !== 'graph') return;
        
        selectedNode = node;
        document.getElementById('nodeInspector').style.display = 'block';
        document.getElementById('nodeName').textContent = node.name;
        document.getElementById('nodeType').textContent = node.type;
        document.getElementById('nodeCorr').textContent = node.correlation || 'N/A';
        
        const toggleBtn = document.getElementById('toggleFeatureBtn');
        if (node.type === 'target') {
            toggleBtn.style.display = 'none';
        } else {
            toggleBtn.style.display = 'inline-block';
            toggleBtn.textContent = currentFeatures.has(node.name) ? 'Remove Feature' : 'Include Feature';
        }
    }

    document.getElementById('toggleFeatureBtn').addEventListener('click', () => {
        if (!selectedNode || selectedNode.type === 'target') return;
        
        if (currentFeatures.has(selectedNode.name)) {
            currentFeatures.delete(selectedNode.name);
        } else {
            currentFeatures.add(selectedNode.name);
        }
        loadGraphData();
        document.getElementById('nodeInspector').style.display = 'none';
    });
    
    document.getElementById('weightSlider').addEventListener('input', (e) => {
        document.getElementById('weightValue').textContent = e.target.value + 'x';
        // Experimental weighting visualization logic would go here
    });
});
