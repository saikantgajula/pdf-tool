const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const mergeBtn = document.getElementById("mergeBtn");
const dropZone = document.getElementById("drop-zone");

let files = [];

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

function renderList() {
  fileList.innerHTML = "";
  files.forEach((file) => {
    const li = document.createElement("li");
    li.textContent = file.name;
    fileList.appendChild(li);
  });
}

mergeBtn.addEventListener("click", async () => {
  if (files.length === 0) {
    alert("Please add files first.");
    return;
  }

  const pdfDoc = await PDFLib.PDFDocument.create();

  for (let file of files) {
    if (file.type === "application/pdf") {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(bytes);
      const pages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => pdfDoc.addPage(p));
    } else if (file.type.startsWith("image/")) {
      const imgBytes = await file.arrayBuffer();
      let img;
      if (file.type === "image/jpeg") {
        img = await pdfDoc.embedJpg(imgBytes);
      } else {
        img = await pdfDoc.embedPng(imgBytes);
      }
      const page = pdfDoc.addPage([600, 600]);
      page.drawImage(img, { x: 0, y: 0, width: 600, height: 600 });
    }
  }

  const finalPdf = await pdfDoc.save();
  download(finalPdf, "merged_document.pdf", "application/pdf");
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
