import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";

function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCatalogId = searchParams.get("catalog_id") || "";

  const [catalogs, setCatalogs] = useState([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState(initialCatalogId);
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Async Enrichment Job Polling
  const [activeJob, setActiveJob] = useState(null);
  const [enrichingCatalog, setEnrichingCatalog] = useState(false);
  const pollIntervalRef = useRef(null);

  // Fetch catalogs
  useEffect(() => {
    api.get("/catalogs/")
      .then((res) => {
        const list = res.data?.data || [];
        setCatalogs(list);
        if (!selectedCatalogId && list.length > 0) {
          setSelectedCatalogId(String(list[0].id));
        }
      })
      .catch((err) => console.error("Error loading catalogs:", err));
  }, []);

  // Sync selected catalog with search params
  const handleCatalogChange = (catId) => {
    setSelectedCatalogId(catId);
    if (catId) {
      setSearchParams({ catalog_id: catId });
    } else {
      setSearchParams({});
    }
  };

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (selectedCatalogId) params.catalog_id = selectedCatalogId;
      if (statusFilter) params.status = statusFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (needsReviewOnly) params.needs_review = true;

      const res = await api.get("/products/", { params });
      let data = res.data?.data || [];

      if (gradeFilter) {
        data = data.filter((p) => (p.quality_grade || "D") === gradeFilter);
      }

      setProducts(data);
      setTotalCount(res.data?.total || data.length);
    } catch (err) {
      console.error("Failed fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCatalogId, statusFilter, gradeFilter, needsReviewOnly]);

  // Polling for active enrichment job
  const pollJobStatus = async (jobId) => {
    try {
      const res = await api.get(`/catalogs/enrichment-job/${jobId}`);
      const jobData = res.data?.data;
      setActiveJob(jobData);

      if (jobData?.status === "completed" || jobData?.status === "failed") {
        clearInterval(pollIntervalRef.current);
        setEnrichingCatalog(false);
        fetchProducts();
      }
    } catch (err) {
      console.error("Error polling enrichment job:", err);
    }
  };

  const handleStartEnrichment = async () => {
    if (!selectedCatalogId) return;
    try {
      setEnrichingCatalog(true);
      const res = await api.post(`/catalogs/${selectedCatalogId}/enrich-async?limit=100`);
      const jobId = res.data?.job_id;
      if (jobId) {
        pollJobStatus(jobId);
        pollIntervalRef.current = setInterval(() => pollJobStatus(jobId), 3000);
      }
    } catch (err) {
      console.error("Failed starting enrichment:", err);
      setEnrichingCatalog(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleCSVImport = async (e) => {
    e.preventDefault();
    if (!importFile || !selectedCatalogId) return;

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("catalog_id", selectedCatalogId);

      const res = await api.post("/products/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(res.data);
      fetchProducts();
    } catch (err) {
      console.error("Import failed:", err);
      alert(err.response?.data?.detail || "Import failed. Please check file format.");
    } finally {
      setImporting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
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
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Intelligence"
        description="Unified industrial product catalog with automated spec extraction, confidence, and provenance."
        action={
          <div className="flex items-center gap-2">
            <Button onClick={() => { setImportResult(null); setShowImportModal(true); }} variant="secondary">
              <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import CSV / XLSX
            </Button>
            <Button
              onClick={handleStartEnrichment}
              disabled={enrichingCatalog || !selectedCatalogId}
              variant="primary"
            >
              {enrichingCatalog ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-1.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Enriching Catalog...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Enrich Catalog
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Active Job Progress Banner */}
      <AnimatePresence>
        {activeJob && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="glass border-accent-soft p-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    Enrichment Pipeline Running: {activeJob.processed || 0} / {activeJob.total || 0} products
                  </span>
                </div>
                <Badge tone={activeJob.status === "completed" ? "success" : "info"}>
                  {activeJob.status}
                </Badge>
              </div>

              <div className="h-2 w-full bg-surface-sunk rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-500 rounded-full"
                  style={{
                    width: `${activeJob.total > 0 ? Math.round((activeJob.processed / activeJob.total) * 100) : 10}%`,
                  }}
                />
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Bar */}
      <Card className="glass p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Catalog Selector */}
          <div className="min-w-[200px]">
            <select
              value={selectedCatalogId}
              onChange={(e) => handleCatalogChange(e.target.value)}
              className="field w-full text-xs font-semibold"
            >
              {catalogs.map((c) => (
                <option key={c.id} value={c.id}>
                  📁 {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <input
              type="text"
              placeholder="Search part #, brand, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchProducts()}
              className="field w-full text-xs pl-8"
            />
            <svg className="h-3.5 w-3.5 text-faint absolute left-2.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="field text-xs min-w-[130px]"
          >
            <option value="">All Statuses</option>
            <option value="needs_review">Needs Review</option>
            <option value="approved">Approved</option>
            <option value="enriching">Enriching</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          {/* Grade Filter */}
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="field text-xs min-w-[120px]"
          >
            <option value="">All Grades</option>
            <option value="A">Grade A (≥90%)</option>
            <option value="B">Grade B (≥75%)</option>
            <option value="C">Grade C (≥50%)</option>
            <option value="D">Grade D</option>
          </select>

          {/* Needs Review Toggle */}
          <button
            type="button"
            onClick={() => setNeedsReviewOnly(!needsReviewOnly)}
            className={`btn btn-sm ${needsReviewOnly ? "btn-primary" : "btn-secondary"}`}
          >
            ⚠️ Review Backlog
          </button>
        </div>
      </Card>

      {/* Products Table */}
      <Card className="glass overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title="No Products Found"
            description="Import a CSV/XLSX file or adjust your filters."
            action={
              <Button onClick={() => setShowImportModal(true)} variant="primary">
                Import Products
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b line-1 text-faint uppercase text-eyebrow bg-surface-sunk/40">
                  <th className="p-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === products.length && products.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-line-2 bg-surface-1"
                    />
                  </th>
                  <th className="p-3.5">Part Number</th>
                  <th className="p-3.5">Manufacturer</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5 min-w-[140px]">Completeness</th>
                  <th className="p-3.5">Confidence</th>
                  <th className="p-3.5">Grade</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y line-1">
                {products.map((product) => {
                  const comp = product.completeness_score ?? 0;
                  const conf = product.confidence_score ?? 0;
                  const grade = product.quality_grade || "D";
                  const isSelected = selectedIds.has(product.id);

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-surface-sunk/60 transition-colors ${
                        isSelected ? "bg-accent-soft/30" : ""
                      }`}
                    >
                      <td className="p-3.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(product.id)}
                          className="rounded border-line-2 bg-surface-1"
                        />
                      </td>
                      <td className="p-3.5 font-semibold text-ink">
                        <Link
                          to={`/products/${product.id}`}
                          className="hover:text-accent hover:underline flex items-center gap-1.5"
                        >
                          {product.part_number}
                        </Link>
                        {product.canonical_name && (
                          <div className="text-[11px] text-faint font-normal line-clamp-1">
                            {product.canonical_name}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-muted">{product.manufacturer || "—"}</td>
                      <td className="p-3.5 text-muted">{product.category || "—"}</td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-surface-sunk rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full"
                              style={{ width: `${Math.min(100, comp)}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-ink font-medium">{comp}%</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="tabular-nums font-semibold text-ink">{conf}%</span>
                      </td>
                      <td className="p-3.5">
                        <Badge tone={gradeTone[grade] || "neutral"} variant="solid">
                          {grade}
                        </Badge>
                      </td>
                      <td className="p-3.5">
                        <Badge tone={statusTone[product.status] || "neutral"} variant="soft">
                          {product.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-right">
                        <Link
                          to={`/products/${product.id}`}
                          className="btn btn-sm btn-ghost inline-flex items-center gap-1 text-accent"
                        >
                          Specs & Sources →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* CSV / XLSX Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass w-full max-w-lg p-6 rounded-panel relative"
          >
            <h3 className="text-ink text-lg font-semibold mb-1">Import Products (CSV or XLSX)</h3>
            <p className="text-muted text-xs mb-4">
              Upload raw product catalogs. SpecForge will fuzzy-match messy headers (Part #, SKU, Brand, Desc) automatically.
            </p>

            {importResult ? (
              <div className="space-y-4">
                <div className="well p-4 rounded-lg space-y-2 text-xs">
                  <div className="text-success font-semibold text-sm">✓ Ingestion Completed</div>
                  <div className="flex justify-between">
                    <span className="text-faint">Products Created:</span>
                    <span className="font-semibold text-ink">{importResult.created}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-faint">Products Updated:</span>
                    <span className="font-semibold text-ink">{importResult.updated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-faint">Rows Rejected (No Part #):</span>
                    <span className="font-semibold text-danger">{importResult.rejected}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="primary" onClick={() => setShowImportModal(false)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCSVImport} className="space-y-4">
                <div>
                  <label className="label mb-1">Target Catalog *</label>
                  <select
                    value={selectedCatalogId}
                    onChange={(e) => setSelectedCatalogId(e.target.value)}
                    required
                    className="field w-full text-xs"
                  >
                    {catalogs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label mb-1">Select CSV or XLSX File *</label>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    required
                    onChange={(e) => setImportFile(e.target.files[0])}
                    className="field w-full text-xs p-2"
                  />
                  <p className="text-faint text-[11px] mt-1">
                    Supports .csv, .xlsx. Max file size: 25 MB.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setShowImportModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={importing || !importFile}>
                    {importing ? "Processing..." : "Start Ingestion"}
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default Products;
