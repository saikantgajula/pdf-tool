const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const dropZone = document.getElementById("drop-zone");
const fileCount = document.getElementById("file-count");
const loading = document.getElementById("loading");
const loadingText = document.getElementById("loadingText");
const status = document.getElementById("status");

const mergeBtn = document.getElementById("mergeBtn");
const splitBtn = document.getElementById("splitBtn");
const rotateBtn = document.getElementById("rotateBtn");
const removePageBtn = document.getElementById("removePageBtn");
const clearBtn = document.getElementById("clearBtn");
const pageNumberInput = document.getElementById("pageNumber");

let files = [];
const BATCH_SIZE = 5;
const BATCH_DELAY = 500;

// Utility functions
function setLoading(isLoading, text = "Processing...") {
  loading.classList.toggle("hidden", !isLoading);
  loadingText.textContent = text;
  document.querySelectorAll("#controls button").forEach(btn => btn.disabled = isLoading);
  dropZone.style.pointerEvents = isLoading ? "none" : "auto";
  dropZone.style.opacity = isLoading ? "0.5" : "1";
}

function showStatus(message, type = "info") {
  status.textContent = message;
  status.className = type;
  if (type === "success" || type === "info") {
    setTimeout(() => { status.textContent = ""; status.className = ""; }, 4000);
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Drag & Drop
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  addFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

function addFiles(selectedFiles) {
  let added = 0;
  let skipped = 0;
  
  for (let file of selectedFiles) {
    if (file.type === "application/pdf") {
      files.push(file);
      added++;
    } else {
      skipped++;
    }
  }
  
  renderList();
  
  if (skipped > 0) {
    showStatus(`${skipped} non-PDF file(s) skipped. Only PDFs are supported.`, "info");
  } else if (added > 0) {
    showStatus(`${added} file(s) added.`, "success");
  }
}

function renderList() {
  fileList.innerHTML = "";
  files.forEach((file, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="drag-handle">☰</span>
      <span class="file-name">${index + 1}. ${file.name}</span>
      <span class="file-size">${formatFileSize(file.size)}</span>
    `;
    li.dataset.index = index;
    fileList.appendChild(li);
  });
  
  fileCount.textContent = files.length > 0 
    ? `${files.length} file(s) loaded • Drag to reorder` 
    : "";
}

// Enable drag-reorder
new Sortable(fileList, {
  animation: 150,
  handle: ".drag-handle",
  onEnd: () => {
    const reordered = [];
    document.querySelectorAll("#fileList li").forEach(li => {
      reordered.push(files[parseInt(li.dataset.index)]);
    });
    files = reordered;
    renderList();
  }
});

// Clear all files
clearBtn.addEventListener("click", () => {
  files = [];
  renderList();
  showStatus("All files cleared.", "info");
});

// Merge PDFs
mergeBtn.addEventListener("click", async () => {
  if (files.length === 0) return showStatus("Please upload files first.", "error");
  if (files.length === 1) return showStatus("Need at least 2 files to merge.", "error");
  
  setLoading(true, "Merging PDFs...");
  
  try {
    const pdfDoc = await PDFLib.PDFDocument.create();
    let totalPages = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setLoading(true, `Processing file ${i + 1} of ${files.length}...`);
      
      try {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => pdfDoc.addPage(p));
        totalPages += pages.length;
      } catch (e) {
        showStatus(`Error loading ${file.name}: ${e.message}`, "error");
        setLoading(false);
        return;
      }
    }
    
    setLoading(true, "Generating merged PDF...");
    const merged = await pdfDoc.save();
    download(merged, "merged.pdf", "application/pdf");
    showStatus(`Merged ${files.length} files (${totalPages} pages) successfully!`, "success");
  } catch (e) {
    showStatus(`Merge failed: ${e.message}`, "error");
  } finally {
    setLoading(false);
  }
});

// Split PDFs with batching
splitBtn.addEventListener("click", async () => {
  if (files.length === 0) return showStatus("Please upload files first.", "error");
  
  setLoading(true, "Splitting PDFs...");
  
  try {
    let totalDownloads = 0;
    
    for (let file of files) {
      let bytes, pdf;
      
      try {
        bytes = await file.arrayBuffer();
        pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch (e) {
        showStatus(`Error loading ${file.name}: ${e.message}`, "error");
        setLoading(false);
        return;
      }
      
      const totalPages = pdf.getPageCount();
      const baseName = file.name.replace(/\.pdf$/i, "");
      
      for (let i = 0; i < totalPages; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, totalPages);
        setLoading(true, `Splitting ${file.name}: pages ${i + 1}-${batchEnd} of ${totalPages}...`);
        
        for (let j = i; j < batchEnd; j++) {
          const newPdf = await PDFLib.PDFDocument.create();
          const [page] = await newPdf.copyPages(pdf, [j]);
          newPdf.addPage(page);
          const pdfBytes = await newPdf.save();
          download(pdfBytes, `${baseName}_page_${j + 1}.pdf`, "application/pdf");
          totalDownloads++;
        }
        
        // Pause between batches to prevent browser blocking
        if (batchEnd < totalPages) {
          await sleep(BATCH_DELAY);
        }
      }
    }
    
    showStatus(`Split complete! ${totalDownloads} pages downloaded.`, "success");
  } catch (e) {
    showStatus(`Split failed: ${e.message}`, "error");
  } finally {
    setLoading(false);
  }
});

// Rotate page
rotateBtn.addEventListener("click", async () => {
  const pageNum = parseInt(pageNumberInput.value) - 1;
  if (isNaN(pageNum) || pageNum < 0) return showStatus("Enter a valid page number.", "error");
  if (files.length === 0) return showStatus("Please upload files first.", "error");
  
  setLoading(true, "Rotating page...");
  
  try {
    for (let file of files) {
      let bytes, pdf;
      
      try {
        bytes = await file.arrayBuffer();
        pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch (e) {
        showStatus(`Error loading ${file.name}: ${e.message}`, "error");
        setLoading(false);
        return;
      }
      
      if (pageNum >= pdf.getPageCount()) {
        showStatus(`Page ${pageNum + 1} doesn't exist in ${file.name} (${pdf.getPageCount()} pages).`, "error");
        setLoading(false);
        return;
      }
      
      const page = pdf.getPage(pageNum);
      const currentRotation = page.getRotation().angle;
      page.setRotation(PDFLib.degrees((currentRotation + 90) % 360));
      
      const pdfBytes = await pdf.save();
      const baseName = file.name.replace(/\.pdf$/i, "");
      download(pdfBytes, `${baseName}_rotated.pdf`, "application/pdf");
    }
    
    showStatus(`Page ${pageNum + 1} rotated 90° clockwise.`, "success");
  } catch (e) {
    showStatus(`Rotation failed: ${e.message}`, "error");
  } finally {
    setLoading(false);
  }
});

// Remove page
removePageBtn.addEventListener("click", async () => {
  const pageNum = parseInt(pageNumberInput.value) - 1;
  if (isNaN(pageNum) || pageNum < 0) return showStatus("Enter a valid page number.", "error");
  if (files.length === 0) return showStatus("Please upload files first.", "error");
  
  setLoading(true, "Removing page...");
  
  try {
    for (let file of files) {
      let bytes, pdf;
      
      try {
        bytes = await file.arrayBuffer();
        pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch (e) {
        showStatus(`Error loading ${file.name}: ${e.message}`, "error");
        setLoading(false);
        return;
      }
      
      if (pageNum >= pdf.getPageCount()) {
        showStatus(`Page ${pageNum + 1} doesn't exist in ${file.name} (${pdf.getPageCount()} pages).`, "error");
        setLoading(false);
        return;
      }
      
      if (pdf.getPageCount() === 1) {
        showStatus(`Cannot remove the only page in ${file.name}.`, "error");
        setLoading(false);
        return;
      }
      
      pdf.removePage(pageNum);
      
      const pdfBytes = await pdf.save();
      const baseName = file.name.replace(/\.pdf$/i, "");
      download(pdfBytes, `${baseName}_removed.pdf`, "application/pdf");
    }
    
    showStatus(`Page ${pageNum + 1} removed successfully.`, "success");
  } catch (e) {
    showStatus(`Remove failed: ${e.message}`, "error");
  } finally {
    setLoading(false);
  }
});

// Download helper
function download(data, filename, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
