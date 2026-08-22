import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Skeleton from "../components/ui/Skeleton";

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);

  // Drawer state for Document Provenance
  const [activeDrawerDoc, setActiveDrawerDoc] = useState(null);

  // Document Upload
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Conflict Resolution
  const [resolvingConflictId, setResolvingConflictId] = useState(null);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/products/${id}`);
      setProduct(res.data?.data || null);
    } catch (err) {
      console.error("Failed fetching product:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const handleEnrichSingle = async () => {
    try {
      setEnriching(true);
      await api.post(`/catalogs/enrich-product/${id}`);
      await fetchProduct();
    } catch (err) {
      console.error("Single product enrichment failed:", err);
      alert(err.response?.data?.detail || "Enrichment failed.");
    } finally {
      setEnriching(false);
    }
  };

  const handleDocumentUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("files", uploadFile);

      await api.post(`/products/${id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadFile(null);
      await fetchProduct();
    } catch (err) {
      console.error("Document upload failed:", err);
      alert(err.response?.data?.detail || "Document upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleResolveConflict = async (conflictId, chosenValue) => {
    try {
      setResolvingConflictId(conflictId);
      await api.patch(`/products/${id}/conflicts/${conflictId}`, {
        resolved_value: chosenValue,
      });
      await fetchProduct();
    } catch (err) {
      console.error("Failed resolving conflict:", err);
      alert(err.response?.data?.detail || "Conflict resolution failed.");
    } finally {
      setResolvingConflictId(null);
    }
  };

  const gradeTone = {
    A: "success",
    B: "info",
    C: "warn",
    D: "danger",
  };

  const statusTone = {
    approved: "success",
    needs_review: "warn",
    enriching: "info",
    pending: "neutral",
    failed: "danger",
    proposed: "info",
    rejected: "danger",
    conflicted: "warn",
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <Card className="glass p-8 text-center">
        <h2 className="text-ink text-lg font-semibold">Product Not Found</h2>
        <p className="text-muted text-xs mt-1 mb-4">The product ID #{id} does not exist.</p>
        <Link to="/products" className="btn btn-primary btn-sm">
          ← Back to Products
        </Link>
      </Card>
    );
  }

  const attributes = product.attributes || [];
  const conflicts = product.conflicts || [];
  const sources = product.sources || [];
  const comp = product.completeness_score ?? 0;
  const conf = product.confidence_score ?? 0;
  const grade = product.quality_grade || "D";

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-faint">
        <Link to="/products" className="hover:text-ink transition-colors">
          Products
        </Link>
        <span>/</span>
        <span className="text-ink font-semibold">{product.part_number}</span>
      </div>

      {/* Header Profile Card */}
      <Card className="glass p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-ink text-2xl font-bold tracking-tight">
                {product.part_number}
              </h1>
              <Badge tone={gradeTone[grade] || "neutral"} variant="solid" className="text-sm px-2.5 py-0.5">
                Grade {grade}
              </Badge>
              <Badge tone={statusTone[product.status] || "neutral"} variant="soft">
                {product.status}
              </Badge>
            </div>

            <p className="text-muted text-sm mt-1">
              {product.manufacturer ? `${product.manufacturer} • ` : ""}
              {product.category || "General Equipment"}
            </p>

            {product.canonical_name && (
              <p className="text-ink-2 text-xs mt-2 font-medium">
                {product.canonical_name}
              </p>
            )}
          </div>

          {/* Right Metrics & Action */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="well p-3 rounded-lg text-xs min-w-[140px]">
              <div className="flex justify-between text-faint mb-1">
                <span>Completeness</span>
                <span className="font-semibold text-ink">{comp}%</span>
              </div>
              <div className="h-1.5 w-full bg-surface-sunk rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${Math.min(100, comp)}%` }}
                />
              </div>
            </div>

            <div className="well p-3 rounded-lg text-xs min-w-[120px]">
              <div className="text-faint mb-1">Avg Confidence</div>
              <div className="text-lg font-bold text-ink">{conf}%</div>
            </div>

            <Button
              onClick={handleEnrichSingle}
              disabled={enriching}
              variant="primary"
            >
              {enriching ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-1.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Enriching...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Re-Enrich Specs
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Unresolved Conflicts Alert Section */}
      {conflicts.length > 0 && (
        <Card className="glass border-warn-soft p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-warn text-base">⚠️</span>
            <h3 className="text-ink text-sm font-semibold">
              Multi-Source Conflicts Detected ({conflicts.length})
            </h3>
          </div>
          <p className="text-muted text-xs">
            Different technical documents disagree on normalized specs. Choose the authoritative value to resolve.
          </p>

          <div className="space-y-3">
            {conflicts.map((conflict) => {
              let candidates = [];
              try {
                candidates = typeof conflict.candidates === "string" ? JSON.parse(conflict.candidates) : conflict.candidates;
              } catch {
                candidates = [];
              }

              return (
                <div key={conflict.id} className="well p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink text-xs uppercase tracking-wide">
                      Key: {conflict.key}
                    </span>
                    <Badge tone={conflict.resolution === "unresolved" ? "warn" : "success"} variant="soft">
                      {conflict.resolution === "unresolved" ? "Unresolved" : `Resolved (${conflict.resolution})`}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {candidates.map((cand, idx) => (
                      <div
                        key={idx}
                        className="glass p-3 rounded border line-1 flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-ink font-semibold text-sm">
                            {cand.value_norm || cand.value_raw} {cand.unit || ""}
                          </div>
                          <div className="text-faint text-[11px] mt-1">
                            Raw: "{cand.value_raw}"
                          </div>
                          <div className="text-faint text-[11px]">
                            Source #{cand.source_id} • Confidence: {cand.confidence}%
                          </div>
                        </div>

                        {conflict.resolution === "unresolved" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="mt-3 w-full text-xs"
                            disabled={resolvingConflictId === conflict.id}
                            onClick={() => handleResolveConflict(conflict.id, cand.value_norm || cand.value_raw)}
                          >
                            ✓ Accept This Value
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Attributes Specification Table */}
      <Card className="glass overflow-hidden">
        <div className="p-4 border-b line-1 flex items-center justify-between">
          <div>
            <h3 className="text-ink text-sm font-semibold">Technical Specifications & Provenance</h3>
            <p className="text-faint text-xs">Every extracted attribute is linked to its exact document receipt.</p>
          </div>
          <span className="text-xs text-muted font-medium">
            {attributes.length} {attributes.length === 1 ? "Attribute" : "Attributes"}
          </span>
        </div>

        {attributes.length === 0 ? (
          <div className="p-8 text-center text-muted text-xs">
            No attributes extracted yet. Click <strong>Re-Enrich Specs</strong> or attach a PDF spec sheet below.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b line-1 text-faint uppercase text-eyebrow bg-surface-sunk/40">
                  <th className="p-3.5">Attribute Key</th>
                  <th className="p-3.5">Raw Value (Verbatim)</th>
                  <th className="p-3.5 text-center w-8">→</th>
                  <th className="p-3.5">Normalized Spec</th>
                  <th className="p-3.5">Confidence</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Document Provenance</th>
                  <th className="p-3.5">Validation Flags</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y line-1">
                {attributes.map((attr) => {
                  let flags = [];
                  try {
                    flags = typeof attr.validation_flags === "string" ? JSON.parse(attr.validation_flags) : (attr.validation_flags || []);
                  } catch {
                    flags = [];
                  }

                  const matchingSource = sources.find((s) => s.id === attr.source_id);

                  return (
                    <tr key={attr.id} className="hover:bg-surface-sunk/60 transition-colors">
                      <td className="p-3.5 font-semibold text-ink">
                        {attr.key}
                      </td>

                      <td className="p-3.5 font-mono text-muted text-[11px]">
                        {attr.value_raw || <span className="text-faint italic">null</span>}
                      </td>

                      <td className="p-3.5 text-center text-faint font-semibold">
                        →
                      </td>

                      <td className="p-3.5 font-semibold text-ink">
                        {attr.value_norm !== null && attr.value_norm !== undefined ? (
                          <span>
                            {attr.value_norm}{" "}
                            {attr.unit && <span className="text-accent font-normal">{attr.unit}</span>}
                          </span>
                        ) : (
                          <span className="text-faint italic">unresolved</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="tabular-nums font-semibold text-ink">
                          {attr.confidence ?? "—"}%
                        </span>
                      </td>

                      <td className="p-3.5">
                        <Badge
                          tone={attr.extraction_method === "vision" ? "violet" : "info"}
                          variant="soft"
                        >
                          {attr.extraction_method || "pdf"}
                        </Badge>
                      </td>

                      <td className="p-3.5">
                        {matchingSource ? (
                          <button
                            type="button"
                            onClick={() => setActiveDrawerDoc({ ...matchingSource, page_number: attr.page_number || matchingSource.page_number })}
                            className="text-accent hover:underline inline-flex items-center gap-1 font-medium"
                          >
                            📄 {matchingSource.filename || `Doc #${matchingSource.id}`}
                            {attr.page_number && (
                              <span className="text-[10px] bg-accent-soft px-1 rounded">
                                p.{attr.page_number}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-faint">Catalog Metadata</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {flags && flags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {flags.map((f, i) => (
                              <span
                                key={i}
                                className="inline-block bg-danger-soft text-danger text-[10px] px-1.5 py-0.5 rounded font-mono"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-success text-[11px]">✓ clean</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <Badge tone={statusTone[attr.status] || "neutral"} variant="soft">
                          {attr.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Attached Source Documents Section */}
      <Card className="glass p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-ink text-sm font-semibold">Attached Source Documents</h3>
            <p className="text-muted text-xs">PDF spec sheets, engineering drawings, and catalog pages.</p>
          </div>

          <form onSubmit={handleDocumentUpload} className="flex items-center gap-2">
            <input
              type="file"
              accept=".pdf, .png, .jpg, .jpeg, .html, .txt"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="text-xs text-muted"
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={uploading || !uploadFile}
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </Button>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {sources.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setActiveDrawerDoc(doc)}
              className="well p-3.5 rounded-lg cursor-pointer hover:border-accent transition-colors flex items-start justify-between group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">📄</span>
                  <span className="text-xs font-semibold text-ink truncate">
                    {doc.filename || `Doc #${doc.id}`}
                  </span>
                </div>
                <div className="text-faint text-[11px] mt-1">
                  Type: {doc.doc_type || "pdf"} {doc.page_number ? `• Page ${doc.page_number}` : ""}
                </div>
              </div>

              <span className="text-accent opacity-0 group-hover:opacity-100 text-xs">
                Inspect →
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Document Provenance Drawer (Right Side Overlay) */}
      <AnimatePresence>
        {activeDrawerDoc && (
          <>
            {/* Backdrop Scrim */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawerDoc(null)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Slide-over Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-xl glass p-6 shadow-2xl overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between border-b line-1 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📄</span>
                      <h2 className="text-ink text-base font-bold truncate max-w-[380px]">
                        {activeDrawerDoc.filename || "Source Document"}
                      </h2>
                    </div>
                    <p className="text-muted text-xs mt-1">
                      SpecForge Document Provenance Receipt
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveDrawerDoc(null)}
                    className="btn btn-ghost btn-sm p-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Metadata Pills */}
                <div className="grid grid-cols-2 gap-3 well p-3 rounded-lg text-xs">
                  <div>
                    <span className="text-faint block">Format / Type:</span>
                    <span className="font-semibold text-ink uppercase">
                      {activeDrawerDoc.doc_type || "PDF"}
                    </span>
                  </div>
                  <div>
                    <span className="text-faint block">Verified Page:</span>
                    <span className="font-semibold text-ink">
                      {activeDrawerDoc.page_number ? `Page ${activeDrawerDoc.page_number}` : "Page 1 / Text Layer"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-faint block">SHA-256 Content Hash:</span>
                    <span className="font-mono text-muted text-[11px] break-all">
                      {activeDrawerDoc.content_hash || "synthetic_hash"}
                    </span>
                  </div>
                </div>

                {/* Text Snippet / Verbatim Evidence */}
                <div>
                  <h4 className="text-ink text-xs font-semibold uppercase tracking-wider mb-2">
                    Extracted Verbatim Text / Evidence Snippet
                  </h4>
                  <div className="well p-4 rounded-lg font-mono text-xs text-ink whitespace-pre-wrap max-h-96 overflow-y-auto border line-1 leading-relaxed">
                    {activeDrawerDoc.text_snippet || "No verbatim text snippet indexed for this document."}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t line-1 flex justify-end">
                <Button variant="primary" onClick={() => setActiveDrawerDoc(null)}>
                  Close Receipt
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProductDetail;
