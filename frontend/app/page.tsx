"use client";

import React, { useMemo, useState, ChangeEvent, useEffect } from "react";

type BBox = {
  x: number; // 0–1
  y: number; // 0–1
  width: number; // 0–1
  height: number; // 0–1
};

type Damage = {
  id: string;
  imageType: "before" | "after";
  area: string;
  type: string;
  severity: string; // "minor" | "moderate" | "severe"
  bbox: BBox;
};

type DamageImageProps = {
  imageUrl: string | null;
  damages: Damage[];
};

function getSeverityClasses(severity: string) {
  const s = severity.toLowerCase();

  if (s === "minor") {
    return {
      border: "border-emerald-400/80",
      badge: "bg-emerald-500 text-slate-950",
      text: "text-emerald-300",
      chip: "bg-emerald-500/10 text-emerald-200 border-emerald-500/40",
    };
  }

  if (s === "moderate") {
    return {
      border: "border-orange-400/80",
      badge: "bg-orange-500 text-slate-950",
      text: "text-orange-300",
      chip: "bg-orange-500/10 text-orange-200 border-orange-500/40",
    };
  }

  if (s === "severe") {
    return {
      border: "border-red-500/80",
      badge: "bg-red-500 text-slate-50",
      text: "text-red-300",
      chip: "bg-red-500/10 text-red-200 border-red-500/40",
    };
  }

  // fallback
  return {
    border: "border-slate-500/80",
    badge: "bg-slate-300 text-slate-900",
    text: "text-slate-200",
    chip: "bg-slate-500/10 text-slate-200 border-slate-500/40",
  };
}

// Cost table – placeholder values (will later come from company)
const COST_TABLE: Record<
  string,
  { minor: number; moderate: number; severe: number }
> = {
  "Glass Shatter": { minor: 150, moderate: 350, severe: 700 },
  Scratch: { minor: 80, moderate: 180, severe: 350 },
  Dent: { minor: 120, moderate: 300, severe: 600 },
  "Bumper Damage": { minor: 200, moderate: 450, severe: 900 },
};

function getDamageCost(damage: Damage): number {
  const severityKey = damage.severity.toLowerCase() as
    | "minor"
    | "moderate"
    | "severe";

  const typeEntry = COST_TABLE[damage.type];
  if (!typeEntry) {
    if (severityKey === "minor") return 100;
    if (severityKey === "moderate") return 300;
    if (severityKey === "severe") return 700;
    return 0;
  }
  return typeEntry[severityKey] ?? 0;
}

/**
 * Helpers for cropping images to bbox (used in HTML thumbnails + PDF)
 */
function cropBBoxToDataUrl(
  image: HTMLImageElement,
  bbox: BBox,
  targetSize = 80
): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const sw = image.naturalWidth * bbox.width;
  const sh = image.naturalHeight * bbox.height;
  const sx = image.naturalWidth * bbox.x;
  const sy = image.naturalHeight * bbox.y;

  canvas.width = targetSize;
  canvas.height = targetSize;

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, targetSize, targetSize);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function fullImageToDataUrl(image: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Full image with overlay boxes
 */
function DamageImageWithBoxes({ imageUrl, damages }: DamageImageProps) {
  if (!imageUrl) return null;

  return (
    <div className="relative mt-2 w-full h-64 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-inner">
      <img
        src={imageUrl}
        alt="Vehicle"
        className="h-full w-full object-contain"
      />

      {damages.map((d) => {
        const severityClasses = getSeverityClasses(d.severity);

        return (
          <div
            key={d.id}
            className={`absolute rounded-md border-2 ${severityClasses.border} transition-transform duration-300 hover:scale-[1.01]`}
            style={{
              left: `${d.bbox.x * 100}%`,
              top: `${d.bbox.y * 100}%`,
              width: `${d.bbox.width * 100}%`,
              height: `${d.bbox.height * 100}%`,
            }}
          >
            <div
              className={`absolute top-0 left-0 text-[10px] px-1 rounded-br-md ${severityClasses.badge}`}
            >
              {d.type} · {d.severity}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Thumbnail = ONLY the bbox region, cropped via canvas.
 */
function DamageThumbnail({
  imageUrl,
  damage,
}: {
  imageUrl: string | null;
  damage: Damage;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!imageUrl) {
      setThumbUrl(null);
      return;
    }

    (async () => {
      try {
        const img = await loadImage(imageUrl);
        if (cancelled) return;
        const url = cropBBoxToDataUrl(img, damage.bbox, 80);
        setThumbUrl(url);
      } catch (err) {
        console.error("Error creating thumbnail:", err);
        if (!cancelled) setThumbUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    imageUrl,
    damage.bbox.x,
    damage.bbox.y,
    damage.bbox.width,
    damage.bbox.height,
  ]);

  if (!thumbUrl) {
    return (
      <div className="w-20 h-20 rounded-md border border-slate-700 bg-slate-900 animate-pulse" />
    );
  }

  return (
    <div className="w-20 h-20 rounded-md border border-slate-700 bg-slate-950 overflow-hidden">
      <img
        src={thumbUrl}
        alt="Damage crop"
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export default function HomePage() {
  const [beforeImage, setBeforeImage] = useState<File | null>(null);
  const [afterImage, setAfterImage] = useState<File | null>(null);
  const [damages, setDamages] = useState<Damage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportGeneratedAt, setReportGeneratedAt] = useState<Date | null>(null);

  // which info panel is active under the comparison
  const [activeInfo, setActiveInfo] = useState<
    "none" | "assumptions" | "future"
  >("none");

  const beforeUrl = useMemo(
    () => (beforeImage ? URL.createObjectURL(beforeImage) : null),
    [beforeImage]
  );

  const afterUrl = useMemo(
    () => (afterImage ? URL.createObjectURL(afterImage) : null),
    [afterImage]
  );

  const handleBeforeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setBeforeImage(file);
    setShowReport(false);
  };

  const handleAfterChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAfterImage(file);
    setShowReport(false);
  };

  async function handleAnalyze() {
    if (!beforeImage || !afterImage) {
      alert("Please upload both BEFORE and AFTER images.");
      return;
    }
    setStatusMessage(null);
    setIsAnalyzing(true);
    setDamages([]);
    setShowReport(false);
    setActiveInfo("none");

    try {
      const formData = new FormData();
      formData.append("before", beforeImage, "before.jpg");
      formData.append("after", afterImage, "after.jpg");

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error("API error:", await res.text());
        alert("Analysis failed.");
        return;
      }

      const data = await res.json();
      console.log("AI result:", data);
      setDamages(data.damages ?? []);
      setStatusMessage(data.message ?? "Analysis completed.");
    } catch (err) {
      console.error(err);
      alert("Failed to call analysis API.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleGenerateReport() {
    setShowReport(true);
    setReportGeneratedAt(new Date());
  }

  /**
   * PDF generation:
   * - loads before/after images
   * - applies matching logic (same type+severity = pre-existing)
   * - cost table
   * - BEFORE/AFTER comparison table (images + bbox rows + totals)
   * - all text in black
   */
  async function handleDownloadPdf() {
    const { jsPDF } = await import("jspdf");

    const beforeDamages = damages.filter((d) => d.imageType === "before");
    const afterDamages = damages.filter((d) => d.imageType === "after");

    // Matching: same type + severity in before/after → pre-existing
    const beforeCountMap: Record<string, number> = {};
    beforeDamages.forEach((d) => {
      const key = `${d.type.toLowerCase()}__${d.severity.toLowerCase()}`;
      beforeCountMap[key] = (beforeCountMap[key] ?? 0) + 1;
    });

    const preExistingAfterDamages: Damage[] = [];
    const chargeableAfterDamages: Damage[] = [];

    afterDamages.forEach((d) => {
      const key = `${d.type.toLowerCase()}__${d.severity.toLowerCase()}`;
      const count = beforeCountMap[key] ?? 0;
      if (count > 0) {
        preExistingAfterDamages.push(d);
        beforeCountMap[key] = count - 1;
      } else {
        chargeableAfterDamages.push(d);
      }
    });

    const beforeTotal = beforeDamages.reduce(
      (sum, d) => sum + getDamageCost(d),
      0
    );
    const chargeableAfterTotal = chargeableAfterDamages.reduce(
      (sum, d) => sum + getDamageCost(d),
      0
    );

    let scenario: "both" | "afterOnly" | "beforeOnly" | "none" = "none";
    if (beforeDamages.length > 0 && afterDamages.length > 0) {
      scenario = "both";
    } else if (beforeDamages.length === 0 && afterDamages.length > 0) {
      scenario = "afterOnly";
    } else if (beforeDamages.length > 0 && afterDamages.length === 0) {
      scenario = "beforeOnly";
    } else {
      scenario = "none";
    }

    let chargeableTotal = chargeableAfterTotal;
    if (scenario === "beforeOnly") {
      chargeableTotal = 0;
    }

    const pdf = new jsPDF("p", "mm", "a4");
    let y = 10;

    // Always black text
    pdf.setTextColor(0, 0, 0);

    // Load images once for cropping & full versions
    const beforeImg =
      beforeUrl && (beforeDamages.length > 0 || scenario !== "none")
        ? await loadImage(beforeUrl)
        : null;
    const afterImg =
      afterUrl && (afterDamages.length > 0 || scenario !== "none")
        ? await loadImage(afterUrl)
        : null;

    pdf.setFontSize(14);
    pdf.text("Vehicle Damage Assessment Report", 10, y);
    y += 8;

    if (reportGeneratedAt) {
      pdf.setFontSize(9);
      pdf.text(
        `Generated on ${reportGeneratedAt.toLocaleString()}`,
        10,
        y
      );
      y += 6;
    }

    pdf.setFontSize(8);
    pdf.text("AI Damage Classifier v1.0 – Internal prototype", 10, y);
    y += 4;
    pdf.text("Not final pricing – for internal testing only", 10, y);
    y += 6;

    // Short assumptions
    pdf.setFontSize(10);
    pdf.text("Assumptions (summary)", 10, y);
    y += 5;
    pdf.setFontSize(8);
    const assumptions = [
      "Both images are of the same vehicle before and after the rental.",
      "Images are taken from approximately the same side / viewpoint.",
      "Costs are placeholder values and will be replaced by company pricing.",
    ];
    assumptions.forEach((line) => {
      pdf.text(`• ${line}`, 10, y);
      y += 4;
    });
    y += 4;

    // Cost table with header + borders, all black text
    pdf.setFontSize(10);
    pdf.text("Cost table (current placeholder values)", 10, y);
    y += 5;

    const costTableX = 10;
    const costTableWidth = 180;
    const costRowHeight = 6;

    const costColWidths = [100, 26, 27, 27];

    // header background light gray, text black
    pdf.setFillColor(230, 230, 230);
    pdf.setDrawColor(0, 0, 0);
    pdf.rect(costTableX, y, costTableWidth, costRowHeight, "FD");
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 0);

    let colX = costTableX + 2;
    pdf.text("Damage type", colX, y + 4);
    colX += costColWidths[0];

    pdf.text("Minor", colX + 2, y + 4);
    colX += costColWidths[1];

    pdf.text("Moderate", colX + 2, y + 4);
    colX += costColWidths[2];

    pdf.text("Severe", colX + 2, y + 4);
    y += costRowHeight;

    // rows (borders + black text)
    pdf.setDrawColor(0, 0, 0);
    pdf.setTextColor(0, 0, 0);

    Object.entries(COST_TABLE).forEach(([type, vals]) => {
      pdf.rect(costTableX, y, costTableWidth, costRowHeight);

      let cx = costTableX + 2;
      pdf.text(type, cx, y + 4);
      cx += costColWidths[0];

      pdf.text(`$${vals.minor}`, cx + 2, y + 4);
      cx += costColWidths[1];

      pdf.text(`$${vals.moderate}`, cx + 2, y + 4);
      cx += costColWidths[2];

      pdf.text(`$${vals.severe}`, cx + 2, y + 4);

      y += costRowHeight;
    });

    y += 8;
    pdf.setTextColor(0, 0, 0); // ensure stays black

    const pageHeight = pdf.internal.pageSize.getHeight();
    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 10) {
        pdf.addPage();
        pdf.setTextColor(0, 0, 0);
        y = 10;
      }
    };

    // BEFORE / AFTER comparison table
    const hasAnyDamage =
      (beforeDamages.length > 0 || afterDamages.length > 0) &&
      (beforeImg || afterImg);

    if (hasAnyDamage) {
      ensureSpace(90);
      pdf.setFontSize(10);
      pdf.text("Before / After comparison", 10, y);
      y += 5;

      const tableX = 10;
      const tableWidth = 190;
      const colWidth = tableWidth / 2;

      pdf.setFontSize(8);
      pdf.setDrawColor(0, 0, 0);

      // Header row (labels)
      const headerHeight = 6;
      pdf.rect(tableX, y, colWidth, headerHeight);
      pdf.rect(tableX + colWidth, y, colWidth, headerHeight);
      pdf.text("Before image", tableX + 2, y + 4);
      pdf.text("After image", tableX + colWidth + 2, y + 4);
      y += headerHeight;

      // Row 1: full images
      const imgRowHeight = 60;
      pdf.rect(tableX, y, colWidth, imgRowHeight);
      pdf.rect(tableX + colWidth, y, colWidth, imgRowHeight);

      if (beforeImg) {
        const fullBefore = fullImageToDataUrl(beforeImg);
        const ratioB = beforeImg.naturalHeight / beforeImg.naturalWidth;
        const imgW = colWidth - 4;
        const imgH = Math.min(imgRowHeight - 4, imgW * ratioB);
        pdf.addImage(
          fullBefore,
          "JPEG",
          tableX + 2,
          y + 2,
          imgW,
          imgH
        );
      }

      if (afterImg) {
        const fullAfter = fullImageToDataUrl(afterImg);
        const ratioA = afterImg.naturalHeight / afterImg.naturalWidth;
        const imgW = colWidth - 4;
        const imgH = Math.min(imgRowHeight - 4, imgW * ratioA);
        pdf.addImage(
          fullAfter,
          "JPEG",
          tableX + colWidth + 2,
          y + 2,
          imgW,
          imgH
        );
      }

      y += imgRowHeight;

      // Rows for damages
      const rowsCount = Math.max(
        beforeDamages.length,
        afterDamages.length
      );
      const damageRowHeight = 20;

      const afterChargeStatus: Record<
        string,
        "chargeable" | "preExisting"
      > = {};
      chargeableAfterDamages.forEach((d) => {
        afterChargeStatus[d.id] = "chargeable";
      });
      preExistingAfterDamages.forEach((d) => {
        afterChargeStatus[d.id] = "preExisting";
      });

      pdf.setFontSize(7);
      pdf.setTextColor(0, 0, 0);

      for (let i = 0; i < rowsCount; i++) {
        ensureSpace(damageRowHeight + 2);
        pdf.rect(tableX, y, colWidth, damageRowHeight);
        pdf.rect(tableX + colWidth, y, colWidth, damageRowHeight);

        const b = beforeDamages[i];
        const a = afterDamages[i];

        if (b && beforeImg) {
          const crop = cropBBoxToDataUrl(beforeImg, b.bbox, 50);
          pdf.addImage(crop, "JPEG", tableX + 2, y + 2, 14, 14);
          pdf.text(
            `${b.type} (${b.severity.toLowerCase()})`,
            tableX + 18,
            y + 8
          );
          pdf.text(
            `~ $${getDamageCost(b).toFixed(0)} (owner)`,
            tableX + 18,
            y + 13
          );
        }

        if (a && afterImg) {
          const crop = cropBBoxToDataUrl(afterImg, a.bbox, 50);
          pdf.addImage(
            crop,
            "JPEG",
            tableX + colWidth + 2,
            y + 2,
            14,
            14
          );
          const status = afterChargeStatus[a.id];
          const statusLabel =
            status === "chargeable"
              ? "chargeable"
              : status === "preExisting"
              ? "pre-existing"
              : "unknown";

          pdf.text(
            `${a.type} (${a.severity.toLowerCase()})`,
            tableX + colWidth + 18,
            y + 8
          );
          pdf.text(
            `~ $${getDamageCost(a).toFixed(0)} (${statusLabel})`,
            tableX + colWidth + 18,
            y + 13
          );
        }

        y += damageRowHeight;
      }

      // Final row: totals (merged columns)
      const totalsHeight = 10;
      ensureSpace(totalsHeight + 4);
      pdf.rect(tableX, y, tableWidth, totalsHeight);
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text(
        `Owner-side indicative value (before): $${beforeTotal.toFixed(
          0
        )}   |   Chargeable to renter (after): $${chargeableTotal.toFixed(
          0
        )}`,
        tableX + 2,
        y + 6
      );
      y += totalsHeight + 6;
    }

    // Matching logic note
    ensureSpace(16);
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text("Current matching logic", 10, y);
    y += 5;
    pdf.setFontSize(8);
    pdf.text(
      "If the same damage type and severity appear in both images,",
      10,
      y
    );
    y += 4;
    pdf.text(
      "that damage is treated as pre-existing and is not charged to the renter.",
      10,
      y
    );
    y += 8;

    // Totals
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    if (scenario === "beforeOnly") {
      pdf.text(
        "Chargeable cost to renter: $0 (only owner damage detected).",
        10,
        y
      );
    } else if (scenario === "afterOnly" || scenario === "both") {
      pdf.text(
        `Chargeable cost to renter: $${chargeableTotal.toFixed(0)}`,
        10,
        y
      );
    } else {
      pdf.text("No damage detected in either image.", 10, y);
    }

    pdf.save("vehicle-damage-report.pdf");
  }

  const beforeDamages = damages.filter((d) => d.imageType === "before");
  const afterDamages = damages.filter((d) => d.imageType === "after");

  // Matching logic reused for HTML report
  const beforeCountMap: Record<string, number> = {};
  beforeDamages.forEach((d) => {
    const key = `${d.type.toLowerCase()}__${d.severity.toLowerCase()}`;
    beforeCountMap[key] = (beforeCountMap[key] ?? 0) + 1;
  });

  const preExistingAfterDamages: Damage[] = [];
  const chargeableAfterDamages: Damage[] = [];

  afterDamages.forEach((d) => {
    const key = `${d.type.toLowerCase()}__${d.severity.toLowerCase()}`;
    const count = beforeCountMap[key] ?? 0;
    if (count > 0) {
      preExistingAfterDamages.push(d);
      beforeCountMap[key] = count - 1;
    } else {
      chargeableAfterDamages.push(d);
    }
  });

  const beforeTotal = beforeDamages.reduce(
    (sum, d) => sum + getDamageCost(d),
    0
  );
  const chargeableAfterTotal = chargeableAfterDamages.reduce(
    (sum, d) => sum + getDamageCost(d),
    0
  );

  let scenario: "both" | "afterOnly" | "beforeOnly" | "none" = "none";
  if (beforeDamages.length > 0 && afterDamages.length > 0) {
    scenario = "both";
  } else if (beforeDamages.length === 0 && afterDamages.length > 0) {
    scenario = "afterOnly";
  } else if (beforeDamages.length > 0 && afterDamages.length === 0) {
    scenario = "beforeOnly";
  } else {
    scenario = "none";
  }

  let chargeableTotal = chargeableAfterTotal;
  if (scenario === "beforeOnly") {
    chargeableTotal = 0;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              AI-Powered Vehicle Condition Assessment
            </h1>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl">
              Upload <span className="font-medium">before</span> and{" "}
              <span className="font-medium">after</span> images of a
              vehicle to automatically detect damages, estimate severity,
              and generate a professional PDF report.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Minor</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
              <span>Moderate</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              <span>Severe</span>
            </div>
          </div>
        </header>

        {/* Upload section */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl shadow-black/40 backdrop-blur">
            <h2 className="text-sm font-semibold mb-1">Before image</h2>
            <p className="text-xs text-slate-400 mb-3">
              Upload a photo of the vehicle before the rental.
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all">
              <span>Choose image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBeforeChange}
              />
            </label>

            {beforeUrl && (
              <div className="mt-3 w-full h-64 rounded-xl border border-slate-800 bg-slate-950/40 flex items-center justify-center overflow-hidden">
                <img
                  src={beforeUrl}
                  alt="Before"
                  className="h-full w-full object-contain"
                />
              </div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl shadow-black/40 backdrop-blur">
            <h2 className="text-sm font-semibold mb-1">After image</h2>
            <p className="text-xs text-slate-400 mb-3">
              Upload a photo of the vehicle after the damage or after
              the rental return.
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all">
              <span>Choose image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAfterChange}
              />
            </label>

            {afterUrl && (
              <div className="mt-3 w-full h-64 rounded-xl border border-slate-800 bg-slate-950/40 flex items-center justify-center overflow-hidden">
                <img
                  src={afterUrl}
                  alt="After"
                  className="h-full w-full object-contain"
                />
              </div>
            )}
          </div>
        </section>

        {/* Analyze + status */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !beforeImage || !afterImage}
              className="px-5 py-2 rounded-2xl bg-emerald-500 text-slate-950 text-sm font-semibold shadow-lg shadow-emerald-500/30 disabled:bg-emerald-900 disabled:text-slate-400 disabled:shadow-none transition-all hover:-translate-y-0.5 hover:shadow-emerald-400/40"
            >
              {isAnalyzing ? "Running AI analysis..." : "Run AI analysis"}
            </button>
            {statusMessage && (
              <p className="text-xs text-slate-300">{statusMessage}</p>
            )}
          </div>

          {damages.length > 0 && scenario !== "none" && (
            <button
              onClick={handleGenerateReport}
              className="px-4 py-2 rounded-2xl bg-slate-800 text-xs font-semibold border border-slate-600 hover:border-emerald-400 hover:bg-slate-700 transition-all flex items-center gap-2"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Generate detailed report
            </button>
          )}
        </section>

        {/* Visual overlay section */}
        {damages.length > 0 && (
          <section className="grid md:grid-cols-2 gap-6 mt-2">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg shadow-black/40">
              <h2 className="font-semibold mb-2 text-sm">
                Before image (with detections)
              </h2>
              <DamageImageWithBoxes
                imageUrl={beforeUrl}
                damages={beforeDamages}
              />
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg shadow-black/40">
              <h2 className="font-semibold mb-2 text-sm">
                After image (with detections)
              </h2>
              <DamageImageWithBoxes
                imageUrl={afterUrl}
                damages={afterDamages}
              />
            </div>
          </section>
        )}

        {/* Damage lists (no numbering) */}
        {damages.length > 0 && (
          <section className="mt-2 grid md:grid-cols-2 gap-6 text-sm">
            <div className="bg-slate-900/70 rounded-2xl p-4 border border-slate-800 shadow-inner">
              <h2 className="font-semibold mb-2">Before image damages</h2>
              {beforeDamages.length === 0 ? (
                <p className="text-slate-400 text-xs">
                  No damage detected.
                </p>
              ) : (
                <ul className="space-y-2">
                  {beforeDamages.map((d) => {
                    const classes = getSeverityClasses(d.severity);
                    const cost = getDamageCost(d);
                    return (
                      <li
                        key={d.id}
                        className="flex justify-between items-center bg-slate-900/70 rounded-xl px-3 py-2 border border-slate-800"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-xs">
                            {d.type}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full border ${classes.chip}`}
                          >
                            {d.severity}
                          </span>
                          <span className="text-[11px] text-slate-200">
                            ~ ${cost.toFixed(0)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="bg-slate-900/70 rounded-2xl p-4 border border-slate-800 shadow-inner">
              <h2 className="font-semibold mb-2">After image damages</h2>
              {afterDamages.length === 0 ? (
                <p className="text-slate-400 text-xs">
                  No damage detected.
                </p>
              ) : (
                <ul className="space-y-2">
                  {afterDamages.map((d) => {
                    const classes = getSeverityClasses(d.severity);
                    const cost = getDamageCost(d);
                    return (
                      <li
                        key={d.id}
                        className="flex justify-between items-center bg-slate-900/70 rounded-xl px-3 py-2 border border-slate-800"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-xs">
                            {d.type}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full border ${classes.chip}`}
                          >
                            {d.severity}
                          </span>
                          <span className="text-[11px] text-slate-200">
                            ~ ${cost.toFixed(0)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Report card */}
        {showReport && damages.length > 0 && scenario !== "none" && (
          <section className="mt-6">
            <div
              className="rounded-3xl px-6 py-6 shadow-[0_0_40px_rgba(16,185,129,0.25)]"
              style={{
                backgroundColor: "#020617",
                border: "1px solid rgba(16,185,129,0.4)",
                color: "#e5e7eb",
              }}
            >
              <div className="space-y-4 text-sm">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Vehicle Damage Assessment Report
                    </h2>
                    {reportGeneratedAt && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Generated on{" "}
                        {reportGeneratedAt.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <p>AI Damage Classifier v1.0</p>
                    <p>Internal prototype – not final pricing</p>
                  </div>
                </div>

                {/* Before / After analysis (with cropped thumbnails, no numbering) */}
                <div className="grid md:grid-cols-2 gap-4">
                  {beforeDamages.length > 0 && (
                    <div
                      className="rounded-2xl px-3 py-3"
                      style={{
                        border: "1px solid #1f2937",
                        backgroundColor: "#020617",
                      }}
                    >
                      <p className="text-[11px] font-semibold mb-2 uppercase">
                        Before image – owner-side damages
                      </p>
                      <div className="space-y-3 text-[11px]">
                        {beforeDamages.map((d) => {
                          const cost = getDamageCost(d);
                          return (
                            <div
                              key={d.id}
                              className="flex items-center gap-2"
                            >
                              <DamageThumbnail
                                imageUrl={beforeUrl}
                                damage={d}
                              />
                              <div>
                                <div>
                                  <strong>{d.type}</strong>{" "}
                                  ({d.severity.toLowerCase()})
                                </div>
                                <div className="text-slate-400">
                                  Approx. ${cost.toFixed(0)} (owner side)
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-slate-300 mt-1">
                          Total indicative owner-side value:{" "}
                          <span className="font-semibold">
                            ${beforeTotal.toFixed(0)}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* After card (without buttons now) */}
                  
                    <div
                      className="rounded-2xl px-3 py-3"
                      style={{
                        border: "1px solid #1f2937",
                        backgroundColor: "#020617",
                      }}
                    >
                      <div className="mb-2">
                        <p className="text-[11px] font-semibold uppercase">
                          After image – renter-side analysis
                        </p>
                      </div>

                      {afterDamages.length === 0 && (
                        <p className="text-[11px] text-slate-400 mb-2">
                          No visible damage detected in the after image.
                        </p>
                      )}

                      {chargeableAfterDamages.length > 0 && (
                        <>
                          <p className="text-[11px] mb-2">
                            Chargeable damages:
                          </p>
                          <div className="space-y-3 text-[11px]">
                            {chargeableAfterDamages.map((d) => {
                              const cost = getDamageCost(d);
                              return (
                                <div
                                  key={d.id}
                                  className="flex items-center gap-2"
                                >
                                  <DamageThumbnail
                                    imageUrl={afterUrl}
                                    damage={d}
                                  />
                                  <div>
                                    <div>
                                      <strong>{d.type}</strong>{" "}
                                      ({d.severity.toLowerCase()})
                                    </div>
                                    <div className="text-slate-400">
                                      Approx. ${cost.toFixed(0)} (chargeable)
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-slate-300 mt-2">
                            Total chargeable damage estimate:{" "}
                            <span className="font-semibold">
                              ${chargeableAfterTotal.toFixed(0)}
                            </span>
                          </p>
                        </>
                      )}

                      {preExistingAfterDamages.length > 0 && (
                        <>
                          <p className="text-[11px] mt-3 mb-2">
                            Pre-existing damages (also seen in before image –
                            not charged):
                          </p>
                          <div className="space-y-3 text-[11px]">
                            {preExistingAfterDamages.map((d) => {
                              const cost = getDamageCost(d);
                              return (
                                <div
                                  key={d.id}
                                  className="flex items-center gap-2"
                                >
                                  <DamageThumbnail
                                    imageUrl={afterUrl}
                                    damage={d}
                                  />
                                  <div>
                                    <div>
                                      <strong>{d.type}</strong>{" "}
                                      ({d.severity.toLowerCase()})
                                    </div>
                                    <div className="text-slate-400">
                                      Approx. ${cost.toFixed(
                                        0
                                      )} (pre-existing, not charged)
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  
                </div>

                {/* BUTTONS BELOW BOTH CARDS */}
                <div className="flex flex-wrap gap-3 justify-end mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveInfo((prev) =>
                        prev === "assumptions" ? "none" : "assumptions"
                      )
                    }
                    className={`inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border transition-all duration-300 ${
                      activeInfo === "assumptions"
                        ? "border-emerald-400/80 bg-emerald-500/10 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.5)] scale-[1.02]"
                        : "border-emerald-500/40 bg-slate-900/70 text-slate-200 hover:bg-slate-900 hover:border-emerald-400/70"
                    } active:scale-95`}
                  >
                    <span className="text-emerald-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        className="h-3 w-3"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-9.5a.75.75 0 011.5 0v5a.75.75 0 01-1.5 0v-5zm.75-3a1 1 0 100 2 1 1 0 000-2z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <span>Assumptions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveInfo((prev) =>
                        prev === "future" ? "none" : "future"
                      )
                    }
                    className={`inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border transition-all duration-300 ${
                      activeInfo === "future"
                        ? "border-sky-400/80 bg-sky-500/10 text-sky-200 shadow-[0_0_0_1px_rgba(56,189,248,0.5)] scale-[1.02]"
                        : "border-sky-500/40 bg-slate-900/70 text-slate-200 hover:bg-slate-900 hover:border-sky-400/70"
                    } active:scale-95`}
                  >
                    <span className="text-sky-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        className="h-3 w-3"
                        fill="currentColor"
                      >
                        <path d="M5 2a1 1 0 011 1v1.382a1 1 0 01-.553.894L4 6l1.447.724A1 1 0 016 7.618V9a1 1 0 11-2 0V7.618l-1.447-.724A1 1 0 012 6l1.553-.724A1 1 0 014 4.382V3a1 1 0 011-1zM13 2a1 1 0 011 1v2.382a1 1 0 00.553.894L16 7l-1.447.724A1 1 0 0014 8.618V11a1 1 0 11-2 0V8.618l-1.447-.724A1 1 0 0110 7l1.553-.724A1 1 0 0012 5.382V3a1 1 0 011-1zM6 12a1 1 0 011 1v1.382a1 1 0 00.553.894L9 16l-1.447.724A1 1 0 007 17.618V19a1 1 0 11-2 0v-1.382l-1.447-.724A1 1 0 013 16l1.553-.724A1 1 0 005 14.382V13a1 1 0 011-1zM14 12a1 1 0 011 1v2.382a1 1 0 01-.553.894L13 17l1.447.724A1 1 0 0115 18.618V19a1 1 0 11-2 0v-.382l-1.447-.724A1 1 0 0111 17l1.553-.724A1 1 0 0013 15.382V13a1 1 0 011-1z" />
                      </svg>
                    </span>
                    <span>Future logic</span>
                  </button>
                </div>

                {/* EXPANDING PANELS BELOW BUTTONS */}
                <div className="mt-2 text-[11px]">
                  {/* Assumptions */}
                  <div
                    className={`overflow-hidden transition-all duration-300 transform ${
                      activeInfo === "assumptions"
                        ? "opacity-100 max-h-40 translate-y-0"
                        : "opacity-0 max-h-0 -translate-y-1"
                    }`}
                  >
                    <div className="text-slate-300 space-y-1">
                      <p>
                        • Both images are assumed to show the same vehicle
                        before and after the rental period.
                      </p>
                      <p>
                        • Camera angle is assumed to be approximately the same
                        (same side / view) in both images.
                      </p>
                      <p>
                        • Cost values are placeholders and will be replaced by
                        the company&apos;s official pricing table.
                      </p>
                    </div>
                  </div>

                  {/* Future logic */}
                  <div
                    className={`overflow-hidden transition-all duration-300 transform ${
                      activeInfo === "future"
                        ? "opacity-100 max-h-40 translate-y-0"
                        : "opacity-0 max-h-0 -translate-y-1"
                    }`}
                  >
                    <div className="text-slate-300 space-y-1">
                      <p>
                        • The current version compares damages based on their
                        type and severity only.
                      </p>
                      <p>
                        • If the same damage type and severity appear in both
                        images, that damage is treated as pre-existing and not
                        charged to the renter.
                      </p>
                      <p>
                        • Future versions will also track the exact body panel /
                        region to make this matching more precise.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-[11px] text-slate-300">
                    {scenario === "beforeOnly" && (
                      <p>
                        Only pre-existing damage was detected (before image).
                        No new damage was found after the rental.
                      </p>
                    )}
                    {scenario === "afterOnly" && (
                      <p>
                        No damage was detected before the rental. All indicative
                        costs are associated with damages in the after image.
                      </p>
                    )}
                    {scenario === "both" && (
                      <p>
                        Some damages are pre-existing (seen in both images) and
                        excluded from renter charges. Only unmatched damages in
                        the after image are billed.
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {scenario === "beforeOnly" && (
                      <>
                        <p className="text-[11px] text-slate-400">
                          Chargeable cost to renter
                        </p>
                        <p className="text-2xl font-semibold text-emerald-400">
                          $0
                        </p>
                      </>
                    )}
                    {(scenario === "afterOnly" || scenario === "both") && (
                      <>
                        <p className="text-[11px] text-slate-400">
                          Chargeable cost to renter
                        </p>
                        <p className="text-2xl font-semibold text-emerald-400">
                          ${chargeableTotal.toFixed(0)}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                onClick={handleDownloadPdf}
                className="px-4 py-2 rounded-2xl bg-emerald-500 text-slate-950 text-xs font-semibold shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 hover:shadow-emerald-400/50 transition-all"
              >
                Download report as PDF
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
