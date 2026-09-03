document.addEventListener('DOMContentLoaded', () => {
    const analysisContent = document.getElementById('analysisContent');
    const datasetState = getDatasetState();
    let currentModelsMetadata = [];
    let currentExperimentId = null;
    let baselineMetrics = null;
    let chartInstance = null;
    
    if (datasetState && datasetState.analysis) {
        renderAnalysis(datasetState.filename, datasetState.analysis);
    }
    
    function renderAnalysis(filename, analysis) {
        let html = `
            <h3>Loaded Dataset: ${escapeHtml(filename)}</h3>
            <div class="analysis-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem;">
                <div class="stat-box">
                    <div class="value">${analysis.row_count}</div>
                    <div class="label">Rows</div>
                </div>
                <div class="stat-box">
                    <div class="value">${analysis.column_count}</div>
                    <div class="label">Columns</div>
                </div>
                <div class="stat-box">
                    <div class="value">${analysis.numerical_columns_count}</div>
                    <div class="label">Numerical Features</div>
                </div>
                <div class="stat-box">
                    <div class="value">${analysis.categorical_columns_count}</div>
                    <div class="label">Categorical Features</div>
                </div>
            </div>
        `;
        
        let tableHtml = `
            <div class="analysis-section-header">
                <h4><span class="icon">📊</span> Column Details</h4>
                <p class="subtitle">Detailed breakdown of dataset features</p>
            </div>
            <div class="table-container-static">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th><span class="icon">📝</span> Column Name</th>
                            <th><span class="icon">🔠</span> Type</th>
                            <th><span class="icon">❌</span> Missing Data</th>
                            <th><span class="icon">📉</span> Missing %</th>
                            <th><span class="icon">🔢</span> Summary</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysis.columns.map(col => {
                            const typeBadgeClass = col.type === 'numerical' ? 'badge-blue' : 'badge-purple';
                            const missingDataText = col.missing_count;
                            const missingPctText = col.missing_percentage + '%';
                                
                            return `
                            <tr>
                                <td>
                                    <div class="col-name">${escapeHtml(col.name)}</div>
                                </td>
                                <td>
                                    <span class="badge ${typeBadgeClass}">${col.type}</span>
                                    <span class="text-xs text-muted" style="display:block; margin-top:4px;">${col.dtype}</span>
                                </td>
                                <td style="font-weight: 500; color: ${col.missing_count > 0 ? 'var(--error-color)' : 'inherit'}">
                                    ${missingDataText}
                                </td>
                                <td style="font-weight: 500; color: ${col.missing_percentage > 0 ? 'var(--error-color)' : 'inherit'}">
                                    ${missingPctText}
                                </td>
                                <td>
                                    ${col.type === 'numerical' ? 
                                        `<div class="stat-summary">
                                            <span><strong>Min:</strong> ${col.min}</span>
                                            <span><strong>Max:</strong> ${col.max}</span>
                                            <span><strong>Mean:</strong> ${col.mean !== null ? col.mean.toFixed(2) : 'N/A'}</span>
                                         </div>` : 
                                        `<div class="stat-summary">
                                            <span><strong>Unique Values:</strong> ${col.unique_values || 'N/A'}</span>
                                         </div>`}
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        html += tableHtml;
        analysisContent.innerHTML = html;
        analysisContent.className = '';
        
        document.getElementById('configSection').style.display = 'block';
        setupTargetSelection(datasetState);
    }
    
    function setupTargetSelection(state) {
        const targetSelect = document.getElementById('targetSelect');
        targetSelect.innerHTML = '<option value="">-- Select Target --</option>';
        
        state.analysis.columns.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col.name;
            opt.textContent = col.name;
            targetSelect.appendChild(opt);
        });
        
        if (state.target) {
            targetSelect.value = state.target;
            triggerTargetChange(state.target, state);
        }
        
        targetSelect.addEventListener('change', async (e) => {
            const target = e.target.value;
            if (!target) return;
            await triggerTargetChange(target, state);
        });
    }

    const modelInfoMap = {
        "Random Forest Classifier": { desc: "An ensemble of decision trees that uses majority voting to make predictions.", strength: "Highly accurate and robust against overfitting.", weakness: "Can be slow to train and less interpretable than single trees." },
        "Logistic Regression": { desc: "A linear model used for predicting probabilities of classes.", strength: "Fast, interpretable, and provides probability estimates.", weakness: "Assumes linear relationships and struggles with complex patterns." },
        "Decision Tree Classifier": { desc: "A tree-like model that splits data based on feature thresholds.", strength: "Highly interpretable and handles non-linear relationships well.", weakness: "Prone to overfitting if not properly tuned." },
        "Gradient Boosting Classifier": { desc: "Builds trees sequentially, with each tree correcting the errors of the previous one.", strength: "Often achieves state-of-the-art accuracy on tabular data.", weakness: "Prone to overfitting and sensitive to hyperparameters." },
        "Support Vector Machine": { desc: "Finds the optimal hyperplane that maximizes the margin between classes.", strength: "Effective in high-dimensional spaces.", weakness: "Scales poorly to very large datasets." },
        "K-Nearest Neighbors": { desc: "Predicts the class based on the majority class of its K nearest data points.", strength: "Simple to understand and makes no assumptions about data distribution.", weakness: "Slow at inference time and sensitive to irrelevant features." },
        "Random Forest Regressor": { desc: "An ensemble of decision trees that averages their predictions for continuous values.", strength: "Robust, handles non-linear data well, and reduces variance.", weakness: "Can be computationally expensive and less interpretable." },
        "Linear Regression": { desc: "A simple linear model that predicts a continuous value based on feature combinations.", strength: "Extremely fast and highly interpretable.", weakness: "Assumes a strict linear relationship between features and target." },
        "Decision Tree Regressor": { desc: "Splits data into branches to predict a continuous numeric value at the leaves.", strength: "Captures non-linear relationships without feature scaling.", weakness: "Easily overfits and can be highly sensitive to small data changes." },
        "Gradient Boosting Regressor": { desc: "Builds trees sequentially to minimize regression errors.", strength: "Highly accurate and flexible for complex datasets.", weakness: "Can overfit and requires careful hyperparameter tuning." }
    };

    async function triggerTargetChange(target, state) {
        try {
            const response = await fetch('/ml/api/target', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ filepath: state.filepath, target: target })
            });
            const data = await response.json();
            
            if (response.ok) {
                state.target = target;
                state.problem_type = data.problem_type;
                currentModelsMetadata = data.models_metadata || [];
                
                // Show target description
                document.getElementById('targetProblemType').textContent = data.problem_type;
                document.getElementById('targetDescription').style.display = 'block';
                
                // Show warnings
                const warnBox = document.getElementById('dataLeakageWarnings');
                const warnList = document.getElementById('warningList');
                if (data.warnings && data.warnings.length > 0) {
                    warnList.innerHTML = data.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('');
                    warnBox.style.display = 'block';
                } else {
                    warnBox.style.display = 'none';
                }
                
                setupModelSelection(data.models_metadata || data.available_models);
            }
        } catch (err) {
            console.error('Error fetching target details:', err);
        }
    }
    
    function setupModelSelection(modelsData) {
        const modelSelect = document.getElementById('modelSelect');
        modelSelect.innerHTML = '';
        const models = Array.isArray(modelsData) ? modelsData : [];
        models.forEach(item => {
            const opt = document.createElement('option');
            opt.value = typeof item === 'string' ? item : item.name;
            opt.textContent = typeof item === 'string' ? item : item.name;
            modelSelect.appendChild(opt);
        });
        
        function updateModelDesc() {
            const selected = modelSelect.value;
            const infoBox = document.getElementById('modelDescription');
            const info = modelInfoMap[selected];
            if (info) {
                document.getElementById('modelDescText').textContent = info.desc;
                document.getElementById('modelStrength').textContent = info.strength;
                document.getElementById('modelWeakness').textContent = info.weakness;
                infoBox.style.display = 'block';
            } else {
                infoBox.style.display = 'none';
            }
        }
        
        modelSelect.addEventListener('change', updateModelDesc);
        if (models.length > 0) updateModelDesc();
    }
    
    // Baseline Training
    document.getElementById('trainBaselineBtn')?.addEventListener('click', async () => {
        const state = datasetState;
        if (!state || !state.target) {
            alert("Please select a target.");
            return;
        }
        
        const btn = document.getElementById('trainBaselineBtn');
        const progContainer = document.getElementById('trainProgressContainer');
        const progBar = document.getElementById('trainProgressBar');
        
        btn.disabled = true;
        progContainer.style.display = 'block';
        progBar.style.width = '50%';
        
        // Auto select all features except target for baseline
        const features = state.analysis.columns.map(c => c.name).filter(c => c !== state.target);
        
        try {
            const response = await fetch('/ml/api/experiments/baseline', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    filepath: state.filepath,
                    target: state.target,
                    features: features,
                    model: document.getElementById('modelSelect').value,
                    problem_type: state.problem_type
                })
            });
            const data = await response.json();
            btn.disabled = false;
            
            if (response.ok) {
                progBar.style.width = '100%';
                setTimeout(() => {
                    progContainer.style.display = 'none';
                    baselineMetrics = data.metrics;
                    currentExperimentId = data.experiment_id;
                    initializeLaboratory(state, data.metrics, features);
                }, 500);
            } else {
                progContainer.style.display = 'none';
                alert(data.error || 'Training failed.');
            }
        } catch (err) {
            btn.disabled = false;
            progContainer.style.display = 'none';
            alert('Network error.');
        }
    });
    
    function initializeLaboratory(state, metrics, features) {
        document.getElementById('laboratoryState').style.display = 'block';
        
        // Setup Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.tab).classList.add('active');
                if (e.target.dataset.tab === 'history-lab') {
                    loadHistory();
                }
            });
        });
        
        renderDashboard(metrics);
        renderCV(metrics);
        setupAblationLab(features);
        setupEngineeringLab(features, state.analysis.columns);
        setupNoiseLab(features);
        setupSimulatorLab(metrics);
        
        document.getElementById('laboratoryState').scrollIntoView({behavior: 'smooth'});
    }
    
    function renderDashboard(metrics) {
        const cards = document.getElementById('metricCards');
        cards.innerHTML = '';
        
        const skipKeys = new Set(['confusion_matrix', 'actual_vs_predicted', 'feature_importances', 'insights', 'classes', 'classification_report', 'model_name', 'problem_type', 'cv_scores']);
        
        for (const [key, value] of Object.entries(metrics)) {
            if (skipKeys.has(key)) continue;
            let displayVal = value;
            if (typeof value === 'number') {
                displayVal = Number.isInteger(value) ? value : value.toFixed(4);
            }
            cards.innerHTML += `
                <div class="stat-box">
                    <div class="value">${displayVal}</div>
                    <div class="label">${escapeHtml(key.replace(/_/g, ' '))}</div>
                </div>
            `;
        }
        
        if (metrics.insights) {
            document.getElementById('modelExplanation').innerHTML = `
                <div class="alert alert-info">
                    <strong>Model Insight:</strong> ${escapeHtml(metrics.insights)}
                </div>
            `;
        }
        
        const featList = document.getElementById('featureImportanceList');
        featList.innerHTML = '';
        if (metrics.feature_importances) {
            metrics.feature_importances.forEach(item => {
                const pct = Math.max(0, Math.min(100, item.percentage || (item.importance * 100)));
                featList.innerHTML += `
                    <div class="feature-importance-item">
                        <div class="feature-label-col">${escapeHtml(item.feature)}</div>
                        <div class="feature-bar-col">
                            <div class="feature-bar-fill" style="width: ${pct}%;"></div>
                        </div>
                        <div class="feature-pct-col">${pct.toFixed(1)}%</div>
                    </div>
                `;
            });
        }
    }
    
    function renderCV(metrics) {
        const cvStats = document.getElementById('cvStats');
        if (!metrics.cv_scores || metrics.cv_scores.length === 0) {
            cvStats.innerHTML = '<p>Cross-validation data not available.</p>';
            return;
        }
        
        const mean = metrics.cv_scores.reduce((a,b)=>a+b,0) / metrics.cv_scores.length;
        const variance = metrics.cv_scores.reduce((a,b)=>a + Math.pow(b-mean, 2), 0) / metrics.cv_scores.length;
        const std = Math.sqrt(variance);
        
        cvStats.innerHTML = `
            <div class="grid-2">
                <div class="stat-box"><div class="value">${mean.toFixed(4)}</div><div class="label">Mean CV Score</div></div>
                <div class="stat-box"><div class="value">±${std.toFixed(4)}</div><div class="label">Standard Deviation</div></div>
            </div>
        `;
        
        const ctx = document.getElementById('cvChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: metrics.cv_scores.map((_, i) => `Fold ${i+1}`),
                datasets: [{
                    label: 'Score',
                    data: metrics.cv_scores,
                    backgroundColor: '#3b82f6'
                }]
            },
            options: {
                scales: { y: { beginAtZero: false, suggestedMin: Math.min(...metrics.cv_scores) * 0.95 } }
            }
        });
    }
    
    function setupAblationLab(features) {
        const list = document.getElementById('ablationFeatureList');
        list.innerHTML = '';
        features.forEach(f => {
            const a = document.createElement('a');
            a.className = 'list-group-item';
            a.style.cursor = 'pointer';
            a.style.display = 'block';
            a.style.padding = '10px';
            a.style.border = '1px solid #ccc';
            a.style.marginBottom = '5px';
            a.style.borderRadius = '5px';
            a.textContent = f;
            a.onclick = () => runAblation(f, features);
            list.appendChild(a);
        });
    }
    
    async function runAblation(featureToDrop, allFeatures) {
        const resBox = document.getElementById('ablationResultBox');
        resBox.innerHTML = '<p>Running ablation experiment...</p>';
        resBox.className = 'result-box';
        
        try {
            const response = await fetch('/ml/api/experiments/ablate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    filepath: datasetState.filepath,
                    target: datasetState.target,
                    features: allFeatures,
                    dropped_feature: featureToDrop,
                    model: document.getElementById('modelSelect').value,
                    problem_type: datasetState.problem_type,
                    parent_experiment_id: currentExperimentId
                })
            });
            const data = await response.json();
            if (response.ok) {
                const metricKey = datasetState.problem_type.includes('Classification') ? 'Accuracy' : 'R2';
                const baseScore = baselineMetrics[metricKey];
                const newScore = data.result.metrics[metricKey];
                const diff = newScore - baseScore;
                const diffStr = diff > 0 ? `+${diff.toFixed(4)} (Improved)` : `${diff.toFixed(4)} (Decreased)`;
                const diffColor = diff > 0 ? 'green' : 'red';
                
                resBox.innerHTML = `
                    <h4>Results after removing: <strong>${escapeHtml(featureToDrop)}</strong></h4>
                    <p>Baseline ${metricKey}: <strong>${baseScore.toFixed(4)}</strong></p>
                    <p>New ${metricKey}: <strong>${newScore.toFixed(4)}</strong></p>
                    <p>Impact: <strong style="color: ${diffColor};">${diffStr}</strong></p>
                    <p class="mt-2 small text-muted">If the score improved, the feature was likely adding noise. If it decreased, the feature was highly useful.</p>
                `;
            } else {
                resBox.innerHTML = `<p class="text-danger">Error: ${data.error}</p>`;
            }
        } catch (e) {
            resBox.innerHTML = '<p class="text-danger">Network error.</p>';
        }
    }
    
    function setupEngineeringLab(features, columnsInfo) {
        const sel = document.getElementById('engFeatureSelect');
        sel.innerHTML = '';
        
        const numCols = columnsInfo.filter(c => c.type === 'numerical' && features.includes(c.name));
        numCols.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
        
        document.getElementById('runEngineeringBtn').onclick = async () => {
            const resBox = document.getElementById('engineeringResultBox');
            resBox.style.display = 'block';
            resBox.innerHTML = '<p>Running engineering experiment...</p>';
            
            try {
                const response = await fetch('/ml/api/experiments/engineer', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        filepath: datasetState.filepath,
                        target: datasetState.target,
                        features: features,
                        original_feature: sel.value,
                        transformation_type: document.getElementById('engTransformSelect').value,
                        model: document.getElementById('modelSelect').value,
                        problem_type: datasetState.problem_type,
                        parent_experiment_id: currentExperimentId
                    })
                });
                const data = await response.json();
                if (response.ok) {
                    const metricKey = datasetState.problem_type.includes('Classification') ? 'Accuracy' : 'R2';
                    const diff = data.result.metrics[metricKey] - baselineMetrics[metricKey];
                    resBox.innerHTML = `
                        <h4>Created new feature: <strong>${data.result.new_feature}</strong></h4>
                        <p>New ${metricKey}: <strong>${data.result.metrics[metricKey].toFixed(4)}</strong></p>
                        <p>Impact vs Baseline: <strong style="color: ${diff > 0 ? 'green' : 'red'};">${diff > 0 ? '+' : ''}${diff.toFixed(4)}</strong></p>
                    `;
                } else {
                    resBox.innerHTML = `<p class="text-danger">Error: ${data.error}</p>`;
                }
            } catch (e) {
                resBox.innerHTML = '<p class="text-danger">Network error.</p>';
            }
        };
    }
    
    function setupNoiseLab(features) {
        const sel = document.getElementById('noiseFeatureSelect');
        sel.innerHTML = '';
        features.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            sel.appendChild(opt);
        });
        
        const slider = document.getElementById('noiseLevelSlider');
        const disp = document.getElementById('noiseLevelDisp');
        slider.oninput = () => disp.textContent = slider.value;
        
        document.getElementById('runNoiseBtn').onclick = async () => {
            const resBox = document.getElementById('noiseResultBox');
            resBox.style.display = 'block';
            resBox.innerHTML = '<p>Running noise experiment...</p>';
            
            try {
                const response = await fetch('/ml/api/experiments/noise', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        filepath: datasetState.filepath,
                        target: datasetState.target,
                        features: features,
                        noise_feature: sel.value,
                        noise_level: slider.value,
                        model: document.getElementById('modelSelect').value,
                        problem_type: datasetState.problem_type,
                        parent_experiment_id: currentExperimentId
                    })
                });
                const data = await response.json();
                if (response.ok) {
                    const metricKey = datasetState.problem_type.includes('Classification') ? 'Accuracy' : 'R2';
                    const diff = data.result.metrics[metricKey] - baselineMetrics[metricKey];
                    resBox.innerHTML = `
                        <h4>Result of ${slider.value}% noise on <strong>${sel.value}</strong></h4>
                        <p>New ${metricKey}: <strong>${data.result.metrics[metricKey].toFixed(4)}</strong></p>
                        <p>Impact vs Baseline: <strong style="color: red;">${diff.toFixed(4)}</strong></p>
                        <p class="small text-muted mt-2">A large drop indicates the model was heavily reliant on exact values of this feature.</p>
                    `;
                } else {
                    resBox.innerHTML = `<p class="text-danger">Error: ${data.error}</p>`;
                }
            } catch (e) {
                resBox.innerHTML = '<p class="text-danger">Network error.</p>';
            }
        };
    }
    
    function setupSimulatorLab(metrics) {
        const container = document.getElementById('simulatorSliders');
        container.innerHTML = '';
        if (!metrics.feature_importances) return;
        
        const realPred = document.getElementById('realSimPred');
        const simPred = document.getElementById('hypoSimPred');
        
        // Setup initial dummy prediction values for visualization
        const isClass = datasetState.problem_type.includes('Classification');
        let basePredValue = isClass ? "Class A" : 100.0;
        
        realPred.textContent = basePredValue;
        simPred.textContent = basePredValue;
        
        metrics.feature_importances.forEach((item, idx) => {
            const pct = Math.round(Math.max(0, Math.min(100, item.percentage || (item.importance * 100))));
            container.innerHTML += `
                <div class="simulator-slider">
                    <div class="label">${escapeHtml(item.feature)}</div>
                    <input type="range" class="sim-input" data-idx="${idx}" data-orig="${pct}" min="0" max="100" value="${pct}">
                    <div class="val" id="simVal_${idx}">${pct}%</div>
                </div>
            `;
        });
        
        const inputs = document.querySelectorAll('.sim-input');
        const normalizeToggle = document.getElementById('normalizeInfluenceToggle');
        
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = e.target.dataset.idx;
                document.getElementById(`simVal_${idx}`).textContent = e.target.value + '%';
                
                if (normalizeToggle.checked) {
                    normalizeSliders(e.target);
                }
                
                // Very basic dummy update to prediction to show interaction
                if (isClass) {
                    simPred.textContent = Math.random() > 0.5 ? "Class A" : "Class B";
                } else {
                    simPred.textContent = (100.0 + (Math.random() * 20 - 10)).toFixed(2);
                }
            });
        });
        
        function normalizeSliders(changedInput) {
            let total = 0;
            inputs.forEach(inp => total += parseInt(inp.value));
            if (total === 100) return;
            
            const diff = total - 100;
            const others = Array.from(inputs).filter(inp => inp !== changedInput);
            if (others.length === 0) return;
            
            let otherTotal = 0;
            others.forEach(inp => otherTotal += parseInt(inp.value));
            
            others.forEach(inp => {
                if (otherTotal === 0) return;
                let share = parseInt(inp.value) / otherTotal;
                let newVal = parseInt(inp.value) - (diff * share);
                newVal = Math.max(0, Math.min(100, Math.round(newVal)));
                inp.value = newVal;
                document.getElementById(`simVal_${inp.dataset.idx}`).textContent = newVal + '%';
            });
        }
    }
    
    async function loadHistory() {
        const timeline = document.getElementById('historyTimeline');
        timeline.innerHTML = '<p>Loading history...</p>';
        try {
            const response = await fetch('/ml/api/experiments');
            const data = await response.json();
            if (data.experiments.length === 0) {
                timeline.innerHTML = '<p>No experiments found.</p>';
                return;
            }
            
            timeline.innerHTML = data.experiments.map(exp => `
                <div class="timeline-item">
                    <div class="timeline-date">${exp.created_at} | ${exp.experiment_type.toUpperCase()}</div>
                    <div class="timeline-content">
                        <h4>${escapeHtml(exp.description || exp.model_name)}</h4>
                        <p class="small text-muted" style="margin:0;">Target: ${escapeHtml(exp.target)}</p>
                        ${exp.metrics.Accuracy ? `<p style="margin-bottom:0;">Accuracy: <strong>${exp.metrics.Accuracy.toFixed(4)}</strong></p>` : ''}
                        ${exp.metrics.R2 ? `<p style="margin-bottom:0;">R² Score: <strong>${exp.metrics.R2.toFixed(4)}</strong></p>` : ''}
                    </div>
                </div>
            `).join('');
            
        } catch (e) {
            timeline.innerHTML = '<p class="text-danger">Failed to load history.</p>';
        }
    }
    
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }
    
    function getDatasetState() {
        try {
            const stored = sessionStorage.getItem('currentDataset');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    }
});
