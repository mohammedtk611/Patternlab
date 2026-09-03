document.addEventListener('DOMContentLoaded', () => {
    
    // File Upload Form
    const uploadForm = document.getElementById('uploadForm');
    const uploadStatus = document.getElementById('uploadStatus');
    
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fileInput = document.getElementById('csvFile');
            if (fileInput.files.length === 0) {
                uploadStatus.textContent = 'Please select a CSV file to upload.';
                uploadStatus.className = 'status-msg error';
                return;
            }
            
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            
            uploadStatus.textContent = 'Uploading and analyzing dataset...';
            uploadStatus.className = 'status-msg';
            
            try {
                const response = await fetch('/ml/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    uploadStatus.textContent = 'Upload successful! Redirecting to ML Builder...';
                    uploadStatus.className = 'status-msg success';
                    storeDatasetState(data.analysis, data.filepath, data.filename);
                    
                    setTimeout(() => {
                        window.location.href = '/ml/builder';
                    }, 800);
                } else {
                    uploadStatus.textContent = data.error || 'Upload failed.';
                    uploadStatus.className = 'status-msg error';
                }
            } catch (err) {
                uploadStatus.textContent = 'Network error occurred during upload.';
                uploadStatus.className = 'status-msg error';
            }
        });
    }

    // Demo Datasets
    const demoButtons = document.querySelectorAll('.demo-btn');
    const demoStatus = document.getElementById('demoStatus');
    
    demoButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const filename = btn.getAttribute('data-filename');
            
            demoStatus.textContent = `Loading ${filename}...`;
            demoStatus.className = 'status-msg';
            
            try {
                const response = await fetch('/ml/api/load-demo', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ filename: filename })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    demoStatus.textContent = 'Dataset loaded! Redirecting to ML Builder...';
                    demoStatus.className = 'status-msg success';
                    storeDatasetState(data.analysis, data.filepath, data.filename);
                    
                    setTimeout(() => {
                        window.location.href = '/ml/builder';
                    }, 800);
                } else {
                    demoStatus.textContent = data.error || 'Failed to load demo dataset.';
                    demoStatus.className = 'status-msg error';
                }
            } catch (err) {
                demoStatus.textContent = 'Network error occurred.';
                demoStatus.className = 'status-msg error';
            }
        });
    });

    // Load Existing User Dataset
    document.querySelectorAll('.load-db-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const filepath = e.target.getAttribute('data-filepath');
            const filename = e.target.getAttribute('data-filename');
            
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
                    alert(data.error || 'Failed to load dataset.');
                }
            } catch (err) {
                alert('Network error occurred.');
            }
        });
    });

    // Delete User Dataset
    document.querySelectorAll('.delete-db-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const datasetId = e.target.getAttribute('data-id');
            if (!confirm('Are you sure you want to delete this dataset? This action cannot be undone.')) {
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
                        setTimeout(() => card.remove(), 300);
                    }
                } else {
                    alert(data.error || 'Failed to delete dataset.');
                }
            } catch (err) {
                alert('Network error occurred while deleting dataset.');
            }
        });
    });
});
