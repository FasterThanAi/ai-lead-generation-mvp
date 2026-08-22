import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";

function Catalogs() {
  const [catalogs, setCatalogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", vertical: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchCatalogs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/catalogs/");
      const catList = res.data?.data || [];
      // Fetch summaries
      const withSummaries = await Promise.all(
        catList.map(async (cat) => {
          try {
            const sumRes = await api.get(`/catalogs/${cat.id}/summary`);
            return { ...cat, summary: sumRes.data?.data };
          } catch {
            return { ...cat, summary: null };
          }
        })
      );
      setCatalogs(withSummaries);
    } catch (err) {
      console.error("Failed fetching catalogs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogs();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    try {
      setSubmitting(true);
      await api.post("/catalogs/", formData);
      setFormData({ name: "", vertical: "", description: "" });
      setShowModal(false);
      fetchCatalogs();
    } catch (err) {
      console.error("Failed creating catalog:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this catalog and all its products?")) return;
    try {
      await api.delete(`/catalogs/${id}`);
      fetchCatalogs();
    } catch (err) {
      console.error("Failed deleting catalog:", err);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Catalogs"
        description="Organize industrial product lines, taxonomy schemas, and spec-sheet provenance."
        action={
          <Button onClick={() => setShowModal(true)} variant="primary">
            <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Catalog
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass p-5 rounded-panel space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : catalogs.length === 0 ? (
        <EmptyState
          title="No Catalogs Found"
          description="Create your first catalog to import industrial CSVs, spec-sheet PDFs, and run AI attribute extraction."
          action={
            <Button onClick={() => setShowModal(true)} variant="primary">
              Create Catalog
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {catalogs.map((catalog) => {
            const sum = catalog.summary || {};
            const total = sum.total_products || 0;
            const completeness = sum.mean_completeness || 0;
            const confidence = sum.mean_confidence || 0;

            return (
              <motion.div
                key={catalog.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="glass-hover flex flex-col justify-between h-full p-5 relative overflow-hidden group">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="text-ink text-base font-semibold tracking-tight">{catalog.name}</h3>
                        {catalog.vertical && (
                          <span className="text-faint text-xs">{catalog.vertical}</span>
                        )}
                      </div>
                      <Badge tone="info" variant="soft">
                        {total} {total === 1 ? "Product" : "Products"}
                      </Badge>
                    </div>

                    <p className="text-muted text-xs line-clamp-2 mb-4">
                      {catalog.description || "No description provided."}
                    </p>

                    {/* Metric Bars */}
                    <div className="space-y-2.5 well p-3 rounded-lg text-xs mb-4">
                      <div>
                        <div className="flex justify-between text-faint mb-1">
                          <span>Completeness</span>
                          <span className="font-semibold text-ink">{completeness}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-sunk rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, completeness)}%`,
                              background: "rgb(var(--accent-from))"
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-faint mb-1">
                          <span>Avg Confidence</span>
                          <span className="font-semibold text-ink">{confidence}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-sunk rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, confidence)}%`,
                              background: "rgb(var(--t-success))"
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t line-1">
                    <Link
                      to={`/products?catalog_id=${catalog.id}`}
                      className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                    >
                      View Products
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(catalog.id, e)}
                      className="text-faint hover:text-danger p-1 rounded transition-colors"
                      title="Delete catalog"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass w-full max-w-md p-6 rounded-panel relative"
          >
            <h3 className="text-ink text-lg font-semibold mb-1">Create Catalog</h3>
            <p className="text-muted text-xs mb-4">Add a new catalog for products, schemas, and documents.</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label mb-1">Catalog Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Industrial Valves & Fittings"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="field w-full"
                />
              </div>

              <div>
                <label className="label mb-1">Vertical / Industry</label>
                <input
                  type="text"
                  placeholder="e.g. Plumbing, HVAC, Fluid Power"
                  value={formData.vertical}
                  onChange={(e) => setFormData({ ...formData, vertical: e.target.value })}
                  className="field w-full"
                />
              </div>

              <div>
                <label className="label mb-1">Description</label>
                <textarea
                  rows="3"
                  placeholder="Brief summary of parts or manufacturer scope..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="field w-full resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Creating..." : "Save Catalog"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default Catalogs;
