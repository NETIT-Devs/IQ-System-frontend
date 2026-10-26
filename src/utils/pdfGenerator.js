// PDF generation utility using html2pdf.js
// Exports element to high-resolution, multi-page professional PDF download.

import html2pdf from "html2pdf.js";

// Ensure html2pdf library instance is available
async function getHtml2Pdf() {
  if (html2pdf && typeof html2pdf === "function") {
    return html2pdf;
  }

  if (window.html2pdf && typeof window.html2pdf === "function") {
    return window.html2pdf;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/html2pdf.bundle.min.js";
    script.onload = () => {
      if (window.html2pdf) {
        resolve(window.html2pdf);
      } else {
        reject(new Error("html2pdf library loaded but not available on window."));
      }
    };
    script.onerror = () =>
      reject(new Error("Could not load /html2pdf.bundle.min.js"));
    document.head.appendChild(script);
  });
}

/**
 * Generate and download a PDF from a DOM element
 * @param {HTMLElement} element - The root container element of the quotation template
 * @param {string} filename - Output PDF filename (e.g. QUO-2026-0001.pdf)
 */
export async function downloadQuotationPdf(element, filename = "Quotation.pdf") {
  if (!element) {
    throw new Error("No quotation document element provided for PDF generation.");
  }

  const pdfLib = await getHtml2Pdf();
  if (!pdfLib) {
    throw new Error("PDF generator library is not available.");
  }

  // Sanitize filename
  const cleanFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  // Clone element into a clean, off-screen container to avoid measurement issues
  const clone = element.cloneNode(true);
  clone.style.width = "800px";
  clone.style.margin = "0";
  clone.style.boxSizing = "border-box";
  clone.style.backgroundColor = "#ffffff";

  // Prevent html2canvas crashes on broken or 404 images
  const images = clone.querySelectorAll("img");
  images.forEach((img) => {
    if (!img.src || img.style.display === "none" || (img.complete && img.naturalWidth === 0)) {
      img.remove();
    }
  });

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "0";
  wrapper.style.top = "0";
  wrapper.style.width = "800px";
  wrapper.style.zIndex = "-99999";
  wrapper.style.opacity = "1";
  wrapper.style.pointerEvents = "none";
  wrapper.style.backgroundColor = "#ffffff";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const options = {
      margin: [8, 8, 10, 8], // top, left, bottom, right in mm
      filename: cleanFilename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2, // 2x resolution for crisp text and graphics
        useCORS: true,
        allowTaint: true,
        logging: false,
        letterRendering: true,
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      },
      pagebreak: {
        mode: ["avoid-all", "css", "legacy"],
        avoid: [
          ".pdf-no-break",
          ".pdf-table-row",
          ".pdf-summary-box",
          ".pdf-signature-section",
        ],
      },
    };

    await pdfLib().set(options).from(clone).save();
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
}
