// ==========================================================================
// PatternLab Interactive ML Studio Controller
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const analysisContent = document.getElementById('analysisContent');
    const datasetState = getDatasetState();
    
    let currentModelsMetadata = [];
    let currentExperimentId = null;
    let baselineMetrics = null;
    let cvChartInstance = null;
    let regressionChartInstance = null;
    let sessionExperiments = []; // Tracks runs within this session for instant comparison
    let currentHyperparameters = {};
    
    if (datasetState && datasetState.analysis) {
        renderAnalysis(datasetState.filename, datasetState.analysis);
        document.getElementById('datasetQuickActions').style.display = 'flex';
    }

    // Dataset Quick View Modal in Studio
    document.getElementById('viewDatasetBtn')?.addEventListener('click', () => {
        if (!datasetState) return;
        openStudioPreviewModal(datasetState.filepath, datasetState.filename);
    });

    // Exploratory Data Analysis & Setup
    function renderAnalysis(filename, analysis) {
        let html = `
            <div class="dataset-summary-bar">
                <div class="dataset-summary-title">
                    <span>📄</span>
                    <span>${escapeHtml(filename)}</span>
                </div>
                <div class="dataset-summary-stats">
                    <span><strong>${analysis.row_count.toLocaleString()}</strong> Rows</span>
                    <span><strong>${analysis.column_count}</strong> Columns</span>
                    <span><strong style="color: var(--info);">${analysis.numerical_columns_count}</strong> Numerical</span>
                    <span><strong style="color: #a855f7;">${analysis.categorical_columns_count}</strong> Categorical</span>
                </div>
            </div>
            
            <div class="analysis-section-header" style="margin-top: 1.5rem; margin-bottom: 0.75rem;">
                <h4 style="font-size: 1.15rem; margin-bottom: 0.25rem;">Column Architecture &amp; Data Health</h4>
                <p class="text-muted" style="font-size: 0.85rem;">Feature types, missing value percentages, and baseline summary statistics</p>
            </div>
            
            <div class="table-container-static" style="overflow-x: auto; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); box-shadow: var(--shadow-sm);">
                <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="padding: 1.25rem 1rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px;">Column Name</th>
                            <th style="padding: 1.25rem 1rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px;">Data Type</th>
                            <th style="padding: 1.25rem 1rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px;">Missing Cells</th>
                            <th style="padding: 1.25rem 1rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px;">Missing %</th>
                            <th style="padding: 1.25rem 1rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px;">Distribution Summary</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysis.columns.map(col => {
                            const typeBadgeClass = col.type === 'numerical' ? 'badge-blue' : 'badge-orange';
                            const hasMissing = col.missing_count > 0;
                            return `
                            <tr style="transition: all 0.2s ease; cursor: pointer; border-bottom: 1px solid var(--border-subtle);" onmouseover="this.style.backgroundColor='var(--bg-surface-hover)'" onmouseout="this.style.backgroundColor='transparent'">
                                <td style="padding: 1.25rem 1rem;">
                                    <div style="font-weight: 600; color: var(--accent-primary); font-family: var(--font-mono); font-size: 1rem;">${escapeHtml(col.name)}</div>
                                </td>
                                <td style="padding: 1.25rem 1rem;">
                                    <span class="badge ${typeBadgeClass}" style="box-shadow: var(--shadow-sm);">${col.type}</span>
                                    <span class="text-muted" style="display: block; font-size: 0.8rem; margin-top: 6px; font-family: var(--font-mono); font-weight: 500;">${col.dtype}</span>
                                </td>
                                <td style="padding: 1.25rem 1rem;">
                                    <span style="display: inline-block; padding: 0.35rem 0.75rem; border-radius: 6px; background: ${hasMissing ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}; color: ${hasMissing ? 'var(--danger)' : 'var(--success)'}; font-weight: 700; font-size: 0.95rem;">
                                        ${col.missing_count}
                                    </span>
                                </td>
                                <td style="padding: 1.25rem 1rem;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span style="font-weight: 700; font-size: 0.95rem; color: ${hasMissing ? 'var(--danger)' : 'var(--text-muted)'}; min-width: 40px;">${col.missing_percentage}%</span>
                                        <div style="flex-grow: 1; max-width: 100px; height: 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-subtle); overflow: hidden;">
                                            <div style="width: ${col.missing_percentage > 0 ? col.missing_percentage : 100}%; height: 100%; background: ${hasMissing ? 'var(--danger)' : 'var(--success)'}; opacity: ${hasMissing ? '1' : '0.5'};"></div>
                                        </div>
                                    </div>
                                </td>
                                <td style="padding: 1.25rem 1rem;">
                                    ${col.type === 'numerical' ? `
                                        <div style="display: inline-flex; align-items: center; gap: 0.75rem; background: var(--bg-surface); padding: 0.5rem 1rem; border-radius: 99px; border: 1px solid var(--border-subtle); font-family: var(--font-mono); font-size: 0.85rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                                            <span style="color: var(--text-muted); font-weight: 600;">MIN</span> <strong style="color: var(--text-primary); font-size: 0.95rem;">${col.min !== null ? col.min : 'N/A'}</strong> 
                                            <span style="color: var(--text-muted); font-weight: 600; padding-left: 0.75rem; border-left: 1px solid var(--border-subtle);">MEAN</span> <strong style="color: var(--text-primary); font-size: 0.95rem;">${col.mean !== null ? col.mean.toFixed(2) : 'N/A'}</strong>
                                            <span style="color: var(--text-muted); font-weight: 600; padding-left: 0.75rem; border-left: 1px solid var(--border-subtle);">MAX</span> <strong style="color: var(--text-primary); font-size: 0.95rem;">${col.max !== null ? col.max : 'N/A'}</strong>
                                        </div>
                                    ` : `
                                        <div style="display: inline-flex; align-items: center; gap: 0.75rem; background: var(--bg-surface); padding: 0.5rem 1rem; border-radius: 99px; border: 1px solid var(--border-subtle); font-family: var(--font-mono); font-size: 0.85rem;">
                                            <span style="color: var(--text-muted); font-weight: 600;">UNIQUE CATEGORIES</span> <strong style="color: var(--text-primary); font-size: 0.95rem;">${col.unique_values || 'N/A'}</strong>
                                        </div>
                                    `}
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        analysisContent.innerHTML = html;
        analysisContent.className = '';
        document.getElementById('configSection').style.display = 'block';
        setupTargetSelection(datasetState);
    }

    // Target Variable Selection
    function setupTargetSelection(state) {
        const targetSelect = document.getElementById('targetSelect');
        targetSelect.innerHTML = '<option value="">-- Choose Target Column --</option>';
        
        state.analysis.columns.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col.name;
            opt.textContent = col.name;
            targetSelect.appendChild(opt);
        });
        
        // Auto-select pre-suggested or stored target
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

    async function triggerTargetChange(target, state) {
        try {
            const response = await fetch('/ml/api/target', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filepath: state.filepath, target: target })
            });
            const data = await response.json();
            
            if (response.ok) {
                state.target = target;
                state.problem_type = data.problem_type;
                currentModelsMetadata = data.models_metadata || [];
                
                // Show problem type
                document.getElementById('targetProblemType').textContent = data.problem_type;
                document.getElementById('targetDescription').style.display = 'flex';
                
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
            console.error('Error fetching target metadata:', err);
            showToast('Failed to analyze target column.', 'danger');
        }
    }

    // Algorithm Selection & Hyperparameters
    function setupModelSelection(modelsData) {
        const modelSelect = document.getElementById('modelSelect');
        modelSelect.innerHTML = '';
        const models = Array.isArray(modelsData) ? modelsData : [];
        
        models.forEach(item => {
            const opt = document.createElement('option');
            const name = typeof item === 'string' ? item : item.name;
            opt.value = name;
            opt.textContent = name;
            modelSelect.appendChild(opt);
        });
        
        function updateModelView() {
            const selected = modelSelect.value;
            const meta = currentModelsMetadata.find(m => m.name === selected) || {};
            
            // Update badge & category
            const catBadge = document.getElementById('modelCategoryBadge');
            if (meta.category) {
                catBadge.textContent = `${meta.badge || 'Algorithm'} • ${meta.category}`;
                catBadge.style.display = 'inline-flex';
            } else {
                catBadge.style.display = 'none';
            }
            
            // Description & Strengths
            const infoBox = document.getElementById('modelDescription');
            if (meta.description) {
                document.getElementById('modelDescText').textContent = meta.description;
                document.getElementById('modelStrength').textContent = meta.strengths || 'Robust performance across standard tabular benchmarks.';
                document.getElementById('modelWeakness').textContent = meta.weaknesses || 'Sensitive to extreme outlier samples.';
                infoBox.style.display = 'block';
            } else {
                infoBox.style.display = 'none';
            }
            
            // Build dynamic hyperparameter controls
            renderHyperparameterControls(meta.hyperparameters || []);
        }
        
        modelSelect.addEventListener('change', updateModelView);
        if (models.length > 0) updateModelView();
    }

    // Hyperparameter Accordion Toggle
    const hpToggle = document.getElementById('hyperparamsToggle');
    const hpBody = document.getElementById('hyperparamsBody');
    const hpChevron = document.getElementById('hyperparamsChevron');
    if (hpToggle) {
        hpToggle.addEventListener('click', () => {
            const isOpen = hpBody.style.display === 'block';
            hpBody.style.display = isOpen ? 'none' : 'block';
            hpChevron.textContent = isOpen ? '▼' : '▲';
        });
    }

    function renderHyperparameterControls(params) {
        const container = document.getElementById('hyperparamsContainer');
        container.innerHTML = '';
        currentHyperparameters = {};
        
        if (!params || params.length === 0) {
            container.innerHTML = '<p class="text-muted" style="font-size: 0.85rem;">This algorithm operates effectively with standard statistical defaults.</p>';
            return;
        }
        
        params.forEach(p => {
            currentHyperparameters[p.name] = p.default;
            
            const item = document.createElement('div');
            item.className = 'hyperparam-item';
            
            if (p.type === 'number') {
                item.innerHTML = `
                    <div class="hyperparam-header">
                        <span>${escapeHtml(p.label)}: <span class="hyperparam-val-badge" id="hp_val_${p.name}">${p.default}</span></span>
                        <span class="text-muted" style="font-size: 0.75rem;">${escapeHtml(p.description || '')}</span>
                    </div>
                    <input type="range" class="hp-range" data-param="${p.name}" 
                           min="${p.min || 1}" max="${p.max || 100}" step="${p.step || 1}" value="${p.default}" 
                           style="width: 100%; accent-color: var(--accent-primary);">
                `;
            } else if (p.type === 'boolean') {
                item.innerHTML = `
                    <div class="hyperparam-header" style="display: flex; align-items: center; justify-content: space-between;">
                        <span>${escapeHtml(p.label)}</span>
                        <label class="switch">
                            <input type="checkbox" class="hp-check" data-param="${p.name}" ${p.default ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                    <p class="text-muted" style="font-size: 0.75rem; margin: 0;">${escapeHtml(p.description || '')}</p>
                `;
            }
            container.appendChild(item);
        });
        
        // Listen to range slider inputs
        container.querySelectorAll('.hp-range').forEach(input => {
            input.addEventListener('input', (e) => {
                const param = e.target.dataset.param;
                const val = parseFloat(e.target.value);
                currentHyperparameters[param] = val;
                const disp = document.getElementById(`hp_val_${param}`);
                if (disp) disp.textContent = val;
            });
        });
        
        // Listen to checkbox inputs
        container.querySelectorAll('.hp-check').forEach(input => {
            input.addEventListener('change', (e) => {
                const param = e.target.dataset.param;
                currentHyperparameters[param] = e.target.checked;
            });
        });
    }

    // 4. Baseline Pipeline Training
    document.getElementById('trainBaselineBtn')?.addEventListener('click', async () => {
        const state = datasetState;
        if (!state || !state.target) {
            showToast('Please select a target variable first.', 'warning');
            return;
        }
        
        const btn = document.getElementById('trainBaselineBtn');
        const progContainer = document.getElementById('trainProgressContainer');
        const progBar = document.getElementById('trainProgressBar');
        const progPct = document.getElementById('trainPctText');
        const statusText = document.getElementById('trainStatusText');
        
        btn.disabled = true;
        progContainer.style.display = 'block';
        progBar.style.width = '30%';
        progPct.textContent = '30%';
        statusText.textContent = 'Applying preprocessing & imputer pipelines...';
        
        const features = state.analysis.columns.map(c => c.name).filter(c => c !== state.target);
        const selectedModel = document.getElementById('modelSelect').value;
        
        setTimeout(() => {
            progBar.style.width = '65%';
            progPct.textContent = '65%';
            statusText.textContent = `Optimizing ${selectedModel} estimators...`;
        }, 400);
        
        try {
            const response = await fetch('/ml/api/experiments/baseline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filepath: state.filepath,
                    target: state.target,
                    features: features,
                    model: selectedModel,
                    problem_type: state.problem_type,
                    hyperparameters: currentHyperparameters
                })
            });
            const data = await response.json();
            btn.disabled = false;
            
            if (response.ok) {
                progBar.style.width = '100%';
                progPct.textContent = '100%';
                statusText.textContent = 'Training complete! Generating visualizations...';
                
                setTimeout(() => {
                    progContainer.style.display = 'none';
                    baselineMetrics = data.metrics;
                    currentExperimentId = data.experiment_id;
                    
                    // Add to session comparisons to keep memory of earlier algorithms
                    sessionExperiments.push({
                        name: `Baseline (${selectedModel}) - Run ${sessionExperiments.length + 1}`,
                        type: 'baseline',
                        algorithm: selectedModel,
                        metrics: data.metrics,
                        isBaseline: true
                    });
                    
                    showToast('Baseline model trained successfully!', 'success');
                    initializeLaboratory(state, data.metrics, features);
                }, 450);
            } else {
                progContainer.style.display = 'none';
                showToast(data.error || 'Training failed.', 'danger');
            }
        } catch (err) {
            btn.disabled = false;
            progContainer.style.display = 'none';
            showToast('Network error occurred during training.', 'danger');
        }
    });

    // 5. Initialize Laboratory State & Tabs
    function initializeLaboratory(state, metrics, features) {
        document.getElementById('laboratoryState').style.display = 'block';
        
        // Hide the dataset table and the main header to simulate a "new page"
        document.getElementById('analysisContent').style.display = 'none';
        const builderHeader = document.querySelector('.builder-header');
        if (builderHeader) builderHeader.style.display = 'none';
        
        // Make the main container full width for the dashboard layout
        const mainContainer = document.querySelector('main.container');
        if (mainContainer) {
            mainContainer.style.maxWidth = '100%';
            mainContainer.style.padding = '0';
        }
        
        const builderContainer = document.querySelector('.ml-builder-container');
        if (builderContainer) {
            builderContainer.style.maxWidth = '100%';
            builderContainer.style.padding = '0';
        }
        
        // Move the setup config section into the laboratory state as a top header
        const setupState = document.getElementById('setupState');
        const tabContent = document.querySelector('.tab-content');
        if (setupState && tabContent) {
            setupState.style.border = 'none';
            setupState.style.background = 'transparent';
            setupState.style.padding = '0 0 1.5rem 0';
            
            // Hide the setup header and other parts we don't need in the dashboard view
            const setupHeader = setupState.querySelector('.panel-header');
            if (setupHeader) setupHeader.style.display = 'none';
            
            document.getElementById('hyperparamsAccordion').style.display = 'none';
            const dataLeakageWarnings = document.getElementById('dataLeakageWarnings');
            if (dataLeakageWarnings) dataLeakageWarnings.style.display = 'none';
            
            // Hide the train button container
            const trainBtn = document.getElementById('trainBaselineBtn');
            if (trainBtn && trainBtn.parentNode) {
                trainBtn.parentNode.style.display = 'none';
            }
            
            tabContent.prepend(setupState);
        }
        
        // Tab click listeners
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = (e) => {
                const targetBtn = e.currentTarget;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                
                targetBtn.classList.add('active');
                const pane = document.getElementById(targetBtn.dataset.tab);
                if (pane) pane.classList.add('active');
                
                if (targetBtn.dataset.tab === 'history-lab') loadHistory();
                if (targetBtn.dataset.tab === 'comparison-lab') renderComparisonTable();
            };
        });
        
        renderDashboard(metrics, state.problem_type);
        renderCV(metrics);
        setupAblationLab(features);
        setupEngineeringLab(features, state.analysis.columns);
        setupNoiseLab(features);
        setupSimulatorLab(metrics);
        renderComparisonTable();
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 6. Render Dashboard (Metrics, Confusion Matrix, Actual vs Pred, Feature Importance)
    function renderDashboard(metrics, problemType) {
        const cards = document.getElementById('metricCards');
        cards.innerHTML = '';
        
        const skipKeys = new Set([
            'confusion_matrix', 'actual_vs_predicted', 'feature_importances', 
            'insights', 'classes', 'classification_report', 'model_name', 
            'problem_type', 'cv_scores', 'best_params', 'cv_metric'
        ]);
        
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
        
        // Natural Language Insights
        if (metrics.insights) {
            document.getElementById('modelExplanation').innerHTML = `
                <div class="alert alert-info">
                    <div>
                        <strong>🤖 Automated Explainer Insight:</strong>
                        <p style="margin-top: 0.25rem; font-size: 0.95rem;">${escapeHtml(metrics.insights)}</p>
                    </div>
                </div>
            `;
        }
        
        // Render Confusion Matrix (Classification)
        const cmContainer = document.getElementById('confusionMatrixContainer');
        if (metrics.confusion_matrix && metrics.confusion_matrix.matrix) {
            cmContainer.style.display = 'block';
            renderConfusionMatrixHeatmap(metrics.confusion_matrix);
        } else {
            cmContainer.style.display = 'none';
        }
        
        // Render Regression Scatter Plot (Regression)
        const regContainer = document.getElementById('regressionPlotContainer');
        if (metrics.actual_vs_predicted && metrics.actual_vs_predicted.length > 0) {
            regContainer.style.display = 'block';
            renderRegressionScatterChart(metrics.actual_vs_predicted);
        } else {
            regContainer.style.display = 'none';
        }
        
        // Render Feature Importance
        const featList = document.getElementById('featureImportanceList');
        featList.innerHTML = '';
        if (metrics.feature_importances && metrics.feature_importances.length > 0) {
            metrics.feature_importances.forEach(item => {
                const pct = Math.max(0, Math.min(100, item.percentage || (item.importance * 100)));
                featList.innerHTML += `
                    <div class="feature-importance-item">
                        <div class="feature-label-col" title="${escapeHtml(item.feature)}">${escapeHtml(item.feature)}</div>
                        <div class="feature-bar-col">
                            <div class="feature-bar-fill" style="width: ${pct}%;"></div>
                        </div>
                        <div class="feature-pct-col">${pct.toFixed(1)}%</div>
                    </div>
                `;
            });
        } else {
            featList.innerHTML = '<p class="text-muted">Feature importance weights not available for this model configuration.</p>';
        }
    }

    // Confusion Matrix Heatmap Builder
    function renderConfusionMatrixHeatmap(cmData) {
        const wrapper = document.getElementById('cmGridWrapper');
        const matrix = cmData.matrix;
        const labels = cmData.labels || [];
        
        // Calculate max value for color intensity scaling
        let maxVal = 1;
        let totalVal = 0;
        matrix.forEach(row => row.forEach(val => {
            if (val > maxVal) maxVal = val;
            totalVal += val;
        }));
        
        let tableHtml = `<table class="cm-table"><thead><tr><th>Actual \\ Pred</th>`;
        labels.forEach(lbl => {
            tableHtml += `<th>Pred: ${escapeHtml(lbl)}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;
        
        matrix.forEach((row, i) => {
            tableHtml += `<tr><th>Actual: ${escapeHtml(labels[i] || `Class ${i}`)}</th>`;
            row.forEach((cellVal, j) => {
                const ratio = cellVal / maxVal;
                let lvl = 'cm-lvl-0';
                if (ratio > 0.75) lvl = 'cm-lvl-4';
                else if (ratio > 0.45) lvl = 'cm-lvl-3';
                else if (ratio > 0.2) lvl = 'cm-lvl-2';
                else if (cellVal > 0) lvl = 'cm-lvl-1';
                
                const pct = totalVal > 0 ? ((cellVal / totalVal) * 100).toFixed(1) : 0;
                tableHtml += `
                    <td>
                        <div class="cm-cell ${lvl}" title="Actual: ${escapeHtml(labels[i])}, Predicted: ${escapeHtml(labels[j])}">
                            <span>${cellVal}</span>
                            <span class="cell-pct">${pct}%</span>
                        </div>
                    </td>
                `;
            });
            tableHtml += `</tr>`;
        });
        
        tableHtml += `</tbody></table>`;
        wrapper.innerHTML = tableHtml;
    }

    // Regression Scatter Chart Builder
    function renderRegressionScatterChart(dataPoints) {
        const ctx = document.getElementById('regressionChart').getContext('2d');
        if (regressionChartInstance) regressionChartInstance.destroy();
        
        const scatterData = dataPoints.map(p => ({ x: p.actual, y: p.predicted }));
        const minVal = Math.min(...dataPoints.map(p => Math.min(p.actual, p.predicted)));
        const maxVal = Math.max(...dataPoints.map(p => Math.max(p.actual, p.predicted)));
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        
        regressionChartInstance = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Predictions',
                        data: scatterData,
                        backgroundColor: 'rgba(99, 102, 241, 0.75)',
                        borderColor: '#6366f1',
                        borderWidth: 1,
                        pointRadius: 4.5,
                        pointHoverRadius: 7
                    },
                    {
                        label: 'Ideal 45° Fit (Actual = Predicted)',
                        data: [{ x: minVal, y: minVal }, { x: maxVal, y: maxVal }],
                        type: 'line',
                        borderColor: '#10b981',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textColor, font: { family: 'Inter', size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `Actual: ${ctx.parsed.x.toFixed(2)}, Predicted: ${ctx.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Actual Ground Truth', color: textColor },
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    },
                    y: {
                        title: { display: true, text: 'Model Prediction', color: textColor },
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    }
                }
            }
        });
    }

    // 7. Cross-Validation Lab
    function renderCV(metrics) {
        const cvStats = document.getElementById('cvStats');
        const metricName = metrics.cv_metric || (datasetState.problem_type.includes('Classification') ? 'Accuracy' : 'R² Score');
        
        if (!metrics.cv_scores || metrics.cv_scores.length === 0) {
            cvStats.innerHTML = '<p class="text-muted">Cross-validation data is being populated.</p>';
            return;
        }
        
        const mean = metrics.cv_mean || (metrics.cv_scores.reduce((a, b) => a + b, 0) / metrics.cv_scores.length);
        const std = metrics.cv_std !== undefined ? metrics.cv_std : 0;
        
        cvStats.innerHTML = `
            <div class="grid-2">
                <div class="stat-box">
                    <div class="value">${mean.toFixed(4)}</div>
                    <div class="label">Mean CV ${metricName}</div>
                </div>
                <div class="stat-box">
                    <div class="value">±${std.toFixed(4)}</div>
                    <div class="label">Fold Stability (Std Dev)</div>
                </div>
            </div>
        `;
        
        const ctx = document.getElementById('cvChart').getContext('2d');
        if (cvChartInstance) cvChartInstance.destroy();
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        
        cvChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: metrics.cv_scores.map((_, i) => `Fold ${i + 1}`),
                datasets: [{
                    label: `${metricName} per Fold`,
                    data: metrics.cv_scores.map(s => Number(s.toFixed(4))),
                    backgroundColor: 'rgba(99, 102, 241, 0.85)',
                    borderColor: '#6366f1',
                    borderRadius: 6,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textColor } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: textColor } },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor },
                        suggestedMin: Math.max(0, Math.min(...metrics.cv_scores) * 0.9)
                    }
                }
            }
        });
    }

    // 8. Feature Ablation Lab
    function setupAblationLab(features) {
        const list = document.getElementById('ablationFeatureList');
        list.innerHTML = '';
        
        features.forEach(f => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline';
            btn.style.width = '100%';
            btn.style.justifyContent = 'space-between';
            btn.style.padding = '0.75rem 1rem';
            btn.innerHTML = `<span>✂️ ${escapeHtml(f)}</span> <span class="badge badge-orange" style="font-size:0.7rem;">Click to Drop</span>`;
            btn.onclick = () => runAblation(f, features, btn);
            list.appendChild(btn);
        });
    }

    async function runAblation(featureToDrop, allFeatures, triggerBtn) {
        const resBox = document.getElementById('ablationResultBox');
        resBox.innerHTML = `<div style="text-align:center; padding: 1.5rem;"><p>Ablating <strong>${escapeHtml(featureToDrop)}</strong> and retraining...</p></div>`;
        resBox.className = 'result-box';
        
        triggerBtn.disabled = true;
        
        try {
            const response = await fetch('/ml/api/experiments/ablate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            triggerBtn.disabled = false;
            
            if (response.ok) {
                const isClass = datasetState.problem_type.includes('Classification');
                const metricKey = isClass ? 'Accuracy' : 'R2';
                const baseScore = baselineMetrics[metricKey] || 0;
                const newScore = data.result.metrics[metricKey] || 0;
                const diff = newScore - baseScore;
                
                const isImproved = diff > 0.0005;
                const isHarmful = diff < -0.0005;
                const diffColor = isImproved ? 'var(--success)' : isHarmful ? 'var(--danger)' : 'var(--text-muted)';
                const diffLabel = isImproved ? `+${diff.toFixed(4)} (Accuracy Improved Without Feature!)` : isHarmful ? `${diff.toFixed(4)} (Performance Dropped)` : `0.0000 (No Material Change)`;
                
                resBox.innerHTML = `
                    <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                        <h4 style="margin: 0; font-size: 1.15rem;">Ablation Results: Dropped <strong style="color: var(--accent-primary);">${escapeHtml(featureToDrop)}</strong></h4>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="stat-box">
                            <div class="value">${baseScore.toFixed(4)}</div>
                            <div class="label">Baseline ${metricKey}</div>
                        </div>
                        <div class="stat-box">
                            <div class="value" style="color: ${diffColor};">${newScore.toFixed(4)}</div>
                            <div class="label">Ablated ${metricKey}</div>
                        </div>
                    </div>
                    <p style="font-size: 0.95rem; margin-bottom: 0.5rem;">Net Impact: <strong style="color: ${diffColor};">${diffLabel}</strong></p>
                    <div class="alert ${isImproved ? 'alert-warning' : isHarmful ? 'alert-info' : 'alert-info'}" style="margin-top: 0.75rem;">
                        ${isImproved ? 
                            `<strong>Conclusion:</strong> Removing '${escapeHtml(featureToDrop)}' actually improved performance! This indicates the feature was causing overfitting or introducing noise.` :
                          isHarmful ? 
                            `<strong>Conclusion:</strong> Removing '${escapeHtml(featureToDrop)}' hurt model accuracy. This proves the feature is genuinely useful and contributes real signal.` :
                            `<strong>Conclusion:</strong> Removing '${escapeHtml(featureToDrop)}' caused no noticeable change. The feature is likely redundant.`
                        }
                    </div>
                `;
                
                // Track in session comparison
                sessionExperiments.push({
                    name: `Ablated: ${featureToDrop}`,
                    type: 'ablation',
                    algorithm: document.getElementById('modelSelect').value,
                    metrics: data.result.metrics,
                    isBaseline: false
                });
                showToast(`Ablation test completed for ${featureToDrop}`, 'success');
            } else {
                resBox.innerHTML = `<p class="status-msg error">${data.error || 'Ablation failed.'}</p>`;
            }
        } catch (e) {
            triggerBtn.disabled = false;
            resBox.innerHTML = `<p class="status-msg error">Network error during ablation.</p>`;
        }
    }

    // 9. Feature Engineering Lab
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
            resBox.innerHTML = '<p>Synthesizing transformed feature and re-training pipeline...</p>';
            
            try {
                const response = await fetch('/ml/api/experiments/engineer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                    const isClass = datasetState.problem_type.includes('Classification');
                    const metricKey = isClass ? 'Accuracy' : 'R2';
                    const diff = (data.result.metrics[metricKey] || 0) - (baselineMetrics[metricKey] || 0);
                    const isPos = diff > 0.0005;
                    const color = isPos ? 'var(--success)' : 'var(--danger)';
                    
                    resBox.innerHTML = `
                        <h4>Created Feature: <span class="badge badge-orange">${escapeHtml(data.result.new_feature)}</span></h4>
                        <p style="margin-top: 0.5rem;">New ${metricKey}: <strong>${data.result.metrics[metricKey].toFixed(4)}</strong></p>
                        <p>Delta vs Baseline: <strong style="color: ${color};">${diff > 0 ? '+' : ''}${diff.toFixed(4)}</strong></p>
                    `;
                    
                    sessionExperiments.push({
                        name: `Engineered: ${data.result.new_feature}`,
                        type: 'engineering',
                        algorithm: document.getElementById('modelSelect').value,
                        metrics: data.result.metrics,
                        isBaseline: false
                    });
                    showToast('Feature engineering completed!', 'success');
                } else {
                    resBox.innerHTML = `<p class="status-msg error">${data.error}</p>`;
                }
            } catch (e) {
                resBox.innerHTML = '<p class="status-msg error">Network error.</p>';
            }
        };
    }

    // 10. Noise Lab
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
            resBox.innerHTML = '<p>Injecting synthetic perturbation and evaluating degradation...</p>';
            
            try {
                const response = await fetch('/ml/api/experiments/noise', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                    const isClass = datasetState.problem_type.includes('Classification');
                    const metricKey = isClass ? 'Accuracy' : 'R2';
                    const diff = (data.result.metrics[metricKey] || 0) - (baselineMetrics[metricKey] || 0);
                    
                    resBox.innerHTML = `
                        <h4>Noise Stress Test on <strong>${escapeHtml(sel.value)}</strong> (${slider.value}% Noise)</h4>
                        <p style="margin-top: 0.5rem;">New ${metricKey}: <strong>${data.result.metrics[metricKey].toFixed(4)}</strong></p>
                        <p>Performance Drop: <strong style="color: var(--danger);">${diff.toFixed(4)}</strong></p>
                        <p class="small text-muted mt-2">A steep decline in performance reveals that the model heavily hinges on exact values of this feature, making it sensitive to sensor noise.</p>
                    `;
                    
                    sessionExperiments.push({
                        name: `Noise: ${sel.value} (${slider.value}%)`,
                        type: 'noise',
                        algorithm: document.getElementById('modelSelect').value,
                        metrics: data.result.metrics,
                        isBaseline: false
                    });
                    showToast('Noise injection test complete!', 'info');
                } else {
                    resBox.innerHTML = `<p class="status-msg error">${data.error}</p>`;
                }
            } catch (e) {
                resBox.innerHTML = '<p class="status-msg error">Network error.</p>';
            }
        };
    }

    // 11. Realistic Feature Influence Simulator
    function setupSimulatorLab(metrics) {
        const container = document.getElementById('simulatorSliders');
        container.innerHTML = '';
        if (!metrics.feature_importances) return;
        
        const realPred = document.getElementById('realSimPred');
        const simPred = document.getElementById('hypoSimPred');
        
        const isClass = datasetState.problem_type.includes('Classification');
        
        // Base value: For classification, display top class or base percentage; for regression, median/mean value
        let baseValue = 0;
        if (isClass) {
            baseValue = 75.0; // Base probability %
            realPred.textContent = metrics.classes ? `${metrics.classes[0]} (75%)` : 'Class 1 (75%)';
            simPred.textContent = realPred.textContent;
        } else {
            baseValue = 150.0;
            if (metrics.actual_vs_predicted && metrics.actual_vs_predicted.length > 0) {
                const vals = metrics.actual_vs_predicted.map(p => p.actual);
                baseValue = vals.reduce((a,b)=>a+b,0) / vals.length;
            }
            realPred.textContent = baseValue.toFixed(2);
            simPred.textContent = baseValue.toFixed(2);
        }
        
        metrics.feature_importances.forEach((item, idx) => {
            const pct = Math.round(Math.max(0, Math.min(100, item.percentage || (item.importance * 100))));
            container.innerHTML += `
                <div class="simulator-slider">
                    <div class="label" title="${escapeHtml(item.feature)}">${escapeHtml(item.feature)}</div>
                    <input type="range" class="sim-input" data-idx="${idx}" data-weight="${pct}" min="0" max="200" value="100">
                    <div class="val" id="simVal_${idx}">1.0x</div>
                </div>
            `;
        });
        
        const inputs = document.querySelectorAll('.sim-input');
        const normalizeToggle = document.getElementById('normalizeInfluenceToggle');
        
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = e.target.dataset.idx;
                const multiplier = (parseInt(e.target.value) / 100).toFixed(1);
                document.getElementById(`simVal_${idx}`).textContent = `${multiplier}x`;
                
                // Compute mathematical weighted prediction shift
                let totalShiftFactor = 0;
                let totalWeight = 0;
                
                inputs.forEach(inp => {
                    const weight = parseFloat(inp.dataset.weight);
                    const factor = parseFloat(inp.value) / 100;
                    totalShiftFactor += weight * factor;
                    totalWeight += weight;
                });
                
                const relativeFactor = totalWeight > 0 ? (totalShiftFactor / totalWeight) : 1.0;
                
                if (isClass) {
                    const shiftedProb = Math.max(5, Math.min(99, baseValue * relativeFactor));
                    const predictedClass = metrics.classes ? (shiftedProb >= 50 ? metrics.classes[0] : (metrics.classes[1] || 'Class 2')) : 'Class 1';
                    simPred.textContent = `${predictedClass} (${shiftedProb.toFixed(0)}%)`;
                } else {
                    const shiftedVal = baseValue * relativeFactor;
                    simPred.textContent = shiftedVal.toFixed(2);
                }
            });
        });
    }

    // 12. Model Comparison Lab
    document.getElementById('refreshComparisonBtn')?.addEventListener('click', renderComparisonTable);
    
    function renderComparisonTable() {
        const tbody = document.getElementById('comparisonTableBody');
        if (!tbody) return;
        
        const isClass = datasetState.problem_type.includes('Classification');
        const m1 = isClass ? 'Accuracy' : 'R2';
        const m2 = isClass ? 'F1 Score' : 'RMSE';
        
        document.getElementById('compMetricHeader1').textContent = isClass ? 'Accuracy' : 'R² Score';
        document.getElementById('compMetricHeader2').textContent = isClass ? 'F1 Score' : 'RMSE';
        
        if (sessionExperiments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center; padding: 2rem;">No experiments conducted in this session yet. Train baseline or run ablations.</td></tr>';
            return;
        }
        
        const baseScore = baselineMetrics ? (baselineMetrics[m1] || 0) : 0;
        
        tbody.innerHTML = sessionExperiments.map(exp => {
            const val1 = exp.metrics[m1] !== undefined ? exp.metrics[m1].toFixed(4) : 'N/A';
            const val2 = exp.metrics[m2] !== undefined ? exp.metrics[m2].toFixed(4) : 'N/A';
            
            let deltaHtml = '<span class="text-muted">Baseline</span>';
            if (!exp.isBaseline && exp.metrics[m1] !== undefined) {
                const diff = exp.metrics[m1] - baseScore;
                const isPos = diff > 0;
                const colorClass = isPos ? 'delta-pos' : 'delta-neg';
                deltaHtml = `<span class="${colorClass}">${isPos ? '+' : ''}${diff.toFixed(4)}</span>`;
            }
            
            return `
                <tr>
                    <td><strong>${escapeHtml(exp.name)}</strong></td>
                    <td><span class="badge ${exp.type === 'baseline' ? 'badge-blue' : exp.type === 'ablation' ? 'badge-orange' : 'badge-warning'}">${exp.type}</span></td>
                    <td>${escapeHtml(exp.algorithm)}</td>
                    <td style="font-family: var(--font-mono); font-weight: 700;">${val1}</td>
                    <td style="font-family: var(--font-mono);">${val2}</td>
                    <td>${deltaHtml}</td>
                </tr>
            `;
        }).join('');
    }

    // 13. Experiment History Timeline
    async function loadHistory() {
        const timeline = document.getElementById('historyTimeline');
        timeline.innerHTML = '<p class="text-muted">Loading experiment log...</p>';
        
        try {
            const response = await fetch('/ml/api/experiments');
            const data = await response.json();
            
            if (!data.experiments || data.experiments.length === 0) {
                timeline.innerHTML = '<p class="text-muted">No saved experiments found in your account.</p>';
                return;
            }
            
            timeline.innerHTML = data.experiments.map(exp => `
                <div class="timeline-item" id="exp-item-${exp.id}">
                    <div class="timeline-date">${exp.created_at} &bull; <span class="badge badge-orange" style="font-size:0.65rem;">${exp.experiment_type}</span></div>
                    <div class="timeline-content">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <h4>${escapeHtml(exp.description || exp.model_name)}</h4>
                                <p class="text-muted" style="margin: 0; font-size: 0.85rem;">Target: <strong>${escapeHtml(exp.target)}</strong> (${escapeHtml(exp.problem_type)})</p>
                            </div>
                            <button class="btn btn-sm btn-danger delete-exp-btn" data-id="${exp.id}" title="Delete Run">🗑️</button>
                        </div>
                        <div style="display:flex; gap: 1.25rem; margin-top: 0.75rem; font-size: 0.9rem; font-family: var(--font-mono);">
                            ${exp.metrics.Accuracy ? `<span>Accuracy: <strong style="color:var(--accent-primary);">${exp.metrics.Accuracy.toFixed(4)}</strong></span>` : ''}
                            ${exp.metrics.R2 ? `<span>R²: <strong style="color:var(--accent-primary);">${exp.metrics.R2.toFixed(4)}</strong></span>` : ''}
                            ${exp.metrics.RMSE ? `<span>RMSE: <strong>${exp.metrics.RMSE.toFixed(4)}</strong></span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
            
            // Wire delete buttons
            timeline.querySelectorAll('.delete-exp-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    const id = e.currentTarget.dataset.id;
                    if (!confirm('Delete this saved experiment?')) return;
                    try {
                        const res = await fetch(`/ml/api/experiments/${id}`, { method: 'DELETE' });
                        if (res.ok) {
                            document.getElementById(`exp-item-${id}`)?.remove();
                            showToast('Experiment deleted.', 'info');
                        }
                    } catch {
                        showToast('Failed to delete experiment.', 'danger');
                    }
                };
            });
            
        } catch (e) {
            timeline.innerHTML = '<p class="status-msg error">Failed to load history.</p>';
        }
    }

    // 14. Studio Dataset Record Explorer Modal
    const studioModal = document.getElementById('studioPreviewModal');
    const studioThead = document.getElementById('studioModalThead');
    const studioTbody = document.getElementById('studioModalTbody');
    const studioMeta = document.getElementById('studioModalMeta');
    
    function openStudioPreviewModal(filepath, filename) {
        studioModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.getElementById('studioModalTitle').textContent = `Records: ${filename}`;
        studioMeta.textContent = 'Extracting dataset records...';
        
        fetch('/ml/api/dataset/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath: filepath, n_rows: 20 })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            studioMeta.textContent = `Showing first ${data.rows.length} of ${data.total_rows.toLocaleString()} rows &bull; ${data.total_columns} columns`;
            
            studioThead.innerHTML = `<tr>${data.columns.map(c => `<th>${escapeHtml(c.name)} <span class="badge ${c.type === 'numerical' ? 'badge-blue' : 'badge-orange'}" style="font-size:0.65rem; padding: 1px 4px;">${c.type}</span></th>`).join('')}</tr>`;
            
            studioTbody.innerHTML = data.rows.map(row => {
                return `<tr>${data.columns.map(c => {
                    const val = row[c.name];
                    return `<td>${val === null || val === undefined ? '<span class="text-muted">null</span>' : escapeHtml(String(val))}</td>`;
                }).join('')}</tr>`;
            }).join('');
        })
        .catch(err => {
            studioTbody.innerHTML = `<tr><td colspan="5" class="status-msg error">${err.message || 'Error loading records.'}</td></tr>`;
        });
    }
    
    function closeStudioModal() {
        studioModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    document.getElementById('closeStudioModalBtn')?.addEventListener('click', closeStudioModal);
    document.getElementById('closeStudioModalActionBtn')?.addEventListener('click', closeStudioModal);
    studioModal?.addEventListener('click', (e) => {
        if (e.target === studioModal) closeStudioModal();
    });

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }
});
