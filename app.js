const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const mergeBtn = document.getElementById("mergeBtn");
const dropZone = document.getElementById("drop-zone");

let files = [];

// Drag & drop upload
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.style.background = "#eef3ff";
});

dropZone.addEventListener("dragleave", () => {
  dropZone.style.background = "#fff";
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.style.background = "#fff";
  addFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
});

function addFiles(selectedFiles) {
  for (let file of selectedFiles) {
    files.push(file);
  }
  renderList();
}

// Render file list with numbering
function renderList() {
  fileList.innerHTML = "";

  files.forEach((file, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${file.name}`;
    li.dataset.index = index;
    fileList.appendChild(li);
  });
}

// Enable drag reorder
new Sortable(fileList, {
  animation: 150,
  onEnd: () => {
    const reordered = [];
    document.querySelectorAll("#fileList li").forEach((li) => {
      reordered.push(files[li.dataset.index]);
    });
    files = reordered;
    renderList();
  }
});

// Merge respecting order
mergeBtn.addEventListener("click", async () => {
  if (files.length === 0) {
    alert("Please upload files first.");
    return;
  }

  const pdfDoc = await PDFLib.PDFDocument.create();

  for (let file of files) {
    if (file.type === "application/pdf") {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(bytes);
      const pages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => pdfDoc.addPage(p));
    }
  }

  const finalPdf = await pdfDoc.save();
  download(finalPdf, "merged.pdf", "application/pdf");
});

function download(data, filename, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
