
// Global utilities
function storeDatasetState(analysis, filepath, filename) {
    sessionStorage.setItem('currentDataset', JSON.stringify({
        analysis: analysis,
        filepath: filepath,
        filename: filename
    }));
}

function getDatasetState() {
    const state = sessionStorage.getItem('currentDataset');
    return state ? JSON.parse(state) : null;
}
