// ==========================================================================
// PatternLab Dashboard Interactions
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Drag-and-Drop & File Upload
    const uploadForm = document.getElementById('uploadForm');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('csvFile');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    const selectedFileName = document.getElementById('selectedFileName');
    const clearFileBtn = document.getElementById('clearFileBtn');
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
    const uploadStatus = document.getElementById('uploadStatus');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                handleFileSelection(files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFileSelection(fileInput.files[0]);
            }
        });

        if (clearFileBtn) {
            clearFileBtn.addEventListener('click', () => {
                fileInput.value = '';
                dropZone.style.display = 'block';
                selectedFileInfo.style.display = 'none';
                uploadSubmitBtn.disabled = true;
                uploadStatus.textContent = '';
            });
        }
    }

    function handleFileSelection(file) {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            showToast('Please select a valid CSV file (.csv)', 'danger');
            return;
        }

        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        selectedFileName.textContent = `${file.name} (${sizeMb} MB)`;
        dropZone.style.display = 'none';
        selectedFileInfo.style.display = 'flex';
        uploadSubmitBtn.disabled = false;
        uploadStatus.textContent = '';
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!fileInput.files || fileInput.files.length === 0) return;

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            uploadSubmitBtn.disabled = true;
            uploadSubmitBtn.innerHTML = '<span>Analyzing dataset...</span>';
            uploadStatus.textContent = 'Uploading and generating exploratory data analysis...';
            uploadStatus.className = 'status-msg';

            try {
                const response = await fetch('/ml/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (response.ok) {
                    uploadStatus.textContent = 'Upload successful! Launching ML Studio...';
                    uploadStatus.className = 'status-msg success';
                    showToast('Dataset analyzed successfully!', 'success');
                    storeDatasetState(data.analysis, data.filepath, data.filename);

                    setTimeout(() => {
                        window.location.href = '/ml/builder';
                    }, 600);
                } else {
                    uploadSubmitBtn.disabled = false;
                    uploadSubmitBtn.innerHTML = '<span>Upload &amp; Analyze</span>';
                    uploadStatus.textContent = data.error || 'Upload failed.';
                    uploadStatus.className = 'status-msg error';
                    showToast(data.error || 'Upload error.', 'danger');
                }
            } catch (err) {
                uploadSubmitBtn.disabled = false;
                uploadSubmitBtn.innerHTML = '<span>Upload &amp; Analyze</span>';
                uploadStatus.textContent = 'Network error during file upload.';
                uploadStatus.className = 'status-msg error';
                showToast('Network error during upload.', 'danger');
            }
        });
    }

    // 2. Demo Datasets Loading
    document.querySelectorAll('.demo-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const filename = btn.getAttribute('data-filename');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Loading...';

            try {
                const response = await fetch('/ml/api/load-demo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: filename })
                });
                const data = await response.json();

                if (response.ok) {
                    storeDatasetState(data.analysis, data.filepath, data.filename, data.suggested_target);
                    showToast(`Loaded ${data.filename}! Opening studio...`, 'success');
                    setTimeout(() => {
                        window.location.href = '/ml/builder';
                    }, 400);
                } else {
                    btn.disabled = false;
                    btn.textContent = originalText;
                    showToast(data.error || 'Failed to load demo dataset.', 'danger');
                }
            } catch (err) {
                btn.disabled = false;
                btn.textContent = originalText;
                showToast('Network error while loading demo dataset.', 'danger');
            }
        });
    });

    // 3. User Dataset Actions
    document.querySelectorAll('.load-db-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const filepath = e.target.getAttribute('data-filepath');
            const filename = e.target.getAttribute('data-filename');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Loading...';

            try {
                const response = await fetch('/ml/api/load-existing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filepath: filepath, filename: filename })
                });
                const data = await response.json();

                if (response.ok) {
                    storeDatasetState(data.analysis, data.filepath, data.filename);
                    window.location.href = '/ml/builder';
                } else {
                    btn.disabled = false;
                    btn.textContent = originalText;
                    showToast(data.error || 'Failed to load dataset.', 'danger');
                }
            } catch (err) {
                btn.disabled = false;
                btn.textContent = originalText;
                showToast('Network error while loading dataset.', 'danger');
            }
        });
    });

    document.querySelectorAll('.delete-db-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const datasetId = e.target.getAttribute('data-id');
            if (!confirm('Are you sure you want to delete this dataset? Associated experiments will also be removed.')) {
                return;
            }

            try {
                const response = await fetch(`/ml/api/dataset/${datasetId}`, {
                    method: 'DELETE'
                });
                const data = await response.json();

                if (response.ok) {
                    const card = document.getElementById(`dataset-card-${datasetId}`);
                    if (card) {
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.95)';
                        card.style.transition = 'all 0.3s ease';
                        setTimeout(() => card.remove(), 300);
                    }
                    showToast('Dataset deleted.', 'info');
                } else {
                    showToast(data.error || 'Failed to delete dataset.', 'danger');
                }
            } catch (err) {
                showToast('Network error while deleting dataset.', 'danger');
            }
        });
    });

    // 4. Dataset Preview Modal
    const previewModal = document.getElementById('previewModal');
    const modalTitle = document.getElementById('modalDatasetTitle');
    const modalMeta = document.getElementById('modalDatasetMeta');
    const modalLoading = document.getElementById('modalLoading');
    const modalTableWrapper = document.getElementById('modalTableWrapper');
    const modalThead = document.getElementById('modalThead');
    const modalTbody = document.getElementById('modalTbody');
    const modalLoadBtn = document.getElementById('modalLoadInStudioBtn');
    let currentPreviewData = null;

    function openModal() {
        previewModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        previewModal.classList.remove('active');
        document.body.style.overflow = '';
        currentPreviewData = null;
    }

    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('modalCloseActionBtn')?.addEventListener('click', closeModal);
    previewModal?.addEventListener('click', (e) => {
        if (e.target === previewModal) closeModal();
    });

    // Preview for Demo Datasets
    document.querySelectorAll('.preview-demo-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const filename = btn.getAttribute('data-filename');
            openModal();
            modalTitle.textContent = `Preview: ${filename}`;
            modalMeta.textContent = 'Fetching rows from demo dataset...';
            modalLoading.style.display = 'block';
            modalTableWrapper.style.display = 'none';

            try {
                // First get demo dataset analysis/path
                const loadRes = await fetch('/ml/api/load-demo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: filename })
                });
                const loadData = await loadRes.json();
                if (!loadRes.ok) throw new Error(loadData.error || 'Failed to resolve demo dataset.');

                currentPreviewData = loadData;
                await fetchAndRenderPreviewTable(loadData.filepath, loadData.filename, loadData.analysis);
            } catch (err) {
                modalLoading.innerHTML = `<p class="status-msg error">${err.message || 'Error loading preview.'}</p>`;
            }
        });
    });

    // Preview for User Datasets
    document.querySelectorAll('.preview-dataset-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const filepath = btn.getAttribute('data-filepath');
            const filename = btn.getAttribute('data-filename');
            openModal();
            modalTitle.textContent = `Preview: ${filename}`;
            modalMeta.textContent = 'Fetching sample records...';
            modalLoading.style.display = 'block';
            modalTableWrapper.style.display = 'none';

            try {
                const loadRes = await fetch('/ml/api/load-existing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filepath: filepath, filename: filename })
                });
                const loadData = await loadRes.json();
                if (!loadRes.ok) throw new Error(loadData.error || 'Failed to resolve dataset.');

                currentPreviewData = loadData;
                await fetchAndRenderPreviewTable(filepath, filename, loadData.analysis);
            } catch (err) {
                modalLoading.innerHTML = `<p class="status-msg error">${err.message || 'Error loading preview.'}</p>`;
            }
        });
    });

    async function fetchAndRenderPreviewTable(filepath, filename, analysis) {
        const res = await fetch('/ml/api/dataset/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath: filepath, n_rows: 15 })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Preview extraction failed.');

        modalMeta.textContent = `Showing first ${data.rows.length} of ${data.total_rows.toLocaleString()} rows &bull; ${data.total_columns} columns`;

        // Render Head
        modalThead.innerHTML = `<tr>${data.columns.map(c => `<th>${escapeHtml(c.name)} <span class="badge ${c.type === 'numerical' ? 'badge-blue' : 'badge-orange'}" style="font-size: 0.65rem; padding: 1px 4px;">${c.type}</span></th>`).join('')}</tr>`;

        // Render Body
        modalTbody.innerHTML = data.rows.map(row => {
            return `<tr>${data.columns.map(c => {
                const val = row[c.name];
                const display = val === null || val === undefined ? '<span class="text-muted">null</span>' : escapeHtml(String(val));
                return `<td>${display}</td>`;
            }).join('')}</tr>`;
        }).join('');

        modalLoading.style.display = 'none';
        modalTableWrapper.style.display = 'block';
    }

    if (modalLoadBtn) {
        modalLoadBtn.addEventListener('click', () => {
            if (currentPreviewData) {
                storeDatasetState(currentPreviewData.analysis, currentPreviewData.filepath, currentPreviewData.filename, currentPreviewData.suggested_target);
                window.location.href = '/ml/builder';
            }
        });
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }
});
