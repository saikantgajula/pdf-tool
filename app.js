const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const dropZone = document.getElementById("drop-zone");

const mergeBtn = document.getElementById("mergeBtn");
const splitBtn = document.getElementById("splitBtn");
const rotateBtn = document.getElementById("rotateBtn");
const removePageBtn = document.getElementById("removePageBtn");
const pageNumberInput = document.getElementById("pageNumber");

let files = [];

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

fileInput.addEventListener("change", () => addFiles(fileInput.files));

function addFiles(selectedFiles) {
  for (let file of selectedFiles) files.push(file);
  renderList();
}

// Render list with numbers
function renderList() {
  fileList.innerHTML = "";
  files.forEach((file, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${file.name}`;
    li.dataset.index = index;
    fileList.appendChild(li);
  });
}

// Enable drag-reorder
new Sortable(fileList, {
  animation: 150,
  onEnd: () => {
    const reordered = [];
    document.querySelectorAll("#fileList li").forEach(li => reordered.push(files[li.dataset.index]));
    files = reordered;
    renderList();
  }
});

// Merge PDFs
mergeBtn.addEventListener("click", async () => {
  if (files.length === 0) return alert("Upload files first");
  const pdfDoc = await PDFLib.PDFDocument.create();
  for (let file of files) {
    if (file.type === "application/pdf") {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(bytes);
      const pages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(p => pdfDoc.addPage(p));
    }
  }
  const merged = await pdfDoc.save();
  download(merged, "merged.pdf", "application/pdf");
});

// Split PDFs
splitBtn.addEventListener("click", async () => {
  if (files.length === 0) return alert("Upload PDFs first");
  for (let file of files) {
    if (file.type === "application/pdf") {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(bytes);
      for (let i = 0; i < pdf.getPageCount(); i++) {
        const newPdf = await PDFLib.PDFDocument.create();
        const [page] = await newPdf.copyPages(pdf, [i]);
        newPdf.addPage(page);
        const pdfBytes = await newPdf.save();
        download(pdfBytes, `${file.name.replace(".pdf","")}_page_${i+1}.pdf`, "application/pdf");
      }
    }
  }
});

// Rotate page
rotateBtn.addEventListener("click", async () => {
  const pageNum = parseInt(pageNumberInput.value) - 1;
  if (isNaN(pageNum)) return alert("Enter valid page number");
  if (files.length === 0) return alert("Upload PDFs first");

  for (let file of files) {
    if (file.type === "application/pdf") {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(bytes);
      if (pageNum >= pdf.getPageCount()) return alert("Page number out of range");
      const page = pdf.getPage(pageNum);
      page.setRotation((page.getRotation().angle + 90) % 360);
      const pdfBytes = await pdf.save();
      download(pdfBytes, `${file.name.replace(".pdf","")}_rotated.pdf`, "application/pdf");
    }
  }
});

// Remove page
removePageBtn.addEventListener("click", async () => {
  const pageNum = parseInt(pageNumberInput.value) - 1;
  if (isNaN(pageNum)) return alert("Enter valid page number");
  if (files.length === 0) return alert("Upload PDFs first");

  for (let file of files) {
    if (file.type === "application/pdf") {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(bytes);
      if (pageNum >= pdf.getPageCount()) return alert("Page number out of range");
      pdf.removePage(pageNum);
      const pdfBytes = await pdf.save();
      download(pdfBytes, `${file.name.replace(".pdf","")}_removed.pdf`, "application/pdf");
    }
  }
});

// Download helper
function download(data, filename, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
