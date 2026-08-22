import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";

function Sources() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);

  const fetchSources = async () => {
    try {
      setLoading(true);
      const res = await api.get("/sources/");
      setSources(res.data?.data || []);
    } catch (err) {
      console.error("Failed fetching source documents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const filtered = sources.filter((s) => {
    const term = search.toLowerCase();
    return (
      (s.filename || "").toLowerCase().includes(term) ||
      (s.part_number || "").toLowerCase().includes(term) ||
      (s.doc_type || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Source Document Repository"
        description="Every uploaded PDF, drawing, catalog sheet, and web page serving as immutable provenance."
        action={
          <Button variant="secondary" onClick={fetchSources}>
            ↻ Refresh Repository
          </Button>
        }
      />

      {/* Filter Bar */}
      <Card className="glass p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Filter by document filename, SKU, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field w-full text-xs pl-8"
            />
            <svg className="h-3.5 w-3.5 text-faint absolute left-2.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="text-xs text-muted font-medium">
            {filtered.length} {filtered.length === 1 ? "Document" : "Documents"}
          </span>
        </div>
      </Card>

      {/* Sources Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-panel" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Documents Registered"
          description="Documents attached to products or imported will automatically index here with SHA-256 deduplication."
          action={
            <Link to="/products" className="btn btn-primary">
              Go to Products
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <motion.div
              key={doc.id}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                onClick={() => setSelectedDoc(doc)}
                className="glass-hover p-4 cursor-pointer flex flex-col justify-between h-full space-y-3 relative group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">📄</span>
                      <h4 className="text-ink font-semibold text-xs truncate">
                        {doc.filename || `Doc #${doc.id}`}
                      </h4>
                    </div>
                    <Badge tone="info" variant="soft" className="uppercase text-[10px]">
                      {doc.doc_type || "pdf"}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-[11px] text-faint">
                    <div>
                      Associated SKU:{" "}
                      <Link
                        to={`/products/${doc.product_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-accent font-semibold hover:underline"
                      >
                        {doc.part_number}
                      </Link>
                    </div>
                    <div>
                      Verified Page:{" "}
                      <span className="text-ink font-medium">
                        {doc.page_number ? `p.${doc.page_number}` : "Page 1"}
                      </span>
                    </div>
                  </div>

                  {doc.text_snippet && (
                    <div className="well p-2 rounded text-[10px] font-mono text-muted line-clamp-3 mt-3">
                      {doc.text_snippet}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t line-1 flex items-center justify-between text-[11px]">
                  <span className="text-faint font-mono truncate max-w-[150px]">
                    {doc.content_hash ? doc.content_hash.slice(0, 16) + "..." : ""}
                  </span>
                  <span className="text-accent font-semibold group-hover:underline">
                    View Receipt →
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Document Provenance Modal */}
      <AnimatePresence>
        {selectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass w-full max-w-2xl p-6 rounded-panel relative space-y-4 max-h-[90vh] flex flex-col justify-between"
            >
              <div className="space-y-4 overflow-y-auto pr-1">
                <div className="flex items-start justify-between border-b line-1 pb-3">
                  <div>
                    <h3 className="text-ink font-bold text-base flex items-center gap-2">
                      <span>📄</span> {selectedDoc.filename || "Source Document"}
                    </h3>
                    <p className="text-muted text-xs mt-0.5">
                      Target SKU: <span className="text-accent font-semibold">{selectedDoc.part_number}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDoc(null)}
                    className="btn btn-ghost btn-sm p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 well p-3 rounded-lg text-xs">
                  <div>
                    <span className="text-faint block">Format:</span>
                    <span className="font-semibold text-ink uppercase">{selectedDoc.doc_type || "pdf"}</span>
                  </div>
                  <div>
                    <span className="text-faint block">Page Number:</span>
                    <span className="font-semibold text-ink">
                      {selectedDoc.page_number ? `Page ${selectedDoc.page_number}` : "Page 1"}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-faint block">Created At:</span>
                    <span className="font-semibold text-ink">
                      {selectedDoc.created_at ? new Date(selectedDoc.created_at).toLocaleDateString() : "Recent"}
                    </span>
                  </div>
                  <div className="col-span-full">
                    <span className="text-faint block">SHA-256 Hash:</span>
                    <span className="font-mono text-muted text-[11px] break-all">
                      {selectedDoc.content_hash || "N/A"}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                    Indexed Text Snippet / Evidence Content
                  </h4>
                  <div className="well p-4 rounded-lg font-mono text-xs text-ink whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed border line-1">
                    {selectedDoc.text_snippet || "No verbatim text indexed for this document."}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t line-1">
                <Button variant="primary" onClick={() => setSelectedDoc(null)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Sources;
