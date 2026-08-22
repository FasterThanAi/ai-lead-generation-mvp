import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import api from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";

const DEFAULT_NEW_ATTR = {
  key: "",
  label: "",
  data_type: "string",
  unit_family: "none",
  allowed_values: [],
  required: false,
  min: null,
  max: null,
};

function Schema() {
  const [catalogs, setCatalogs] = useState([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [schemas, setSchemas] = useState([]);
  const [activeSchema, setActiveSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New Category Modal
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // JSON Modal
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState("");

  // Fetch Catalogs
  useEffect(() => {
    api.get("/catalogs/")
      .then((res) => {
        const list = res.data?.data || [];
        setCatalogs(list);
        if (list.length > 0) {
          setSelectedCatalogId(String(list[0].id));
        }
      })
      .catch((err) => console.error("Error loading catalogs:", err));
  }, []);

  // Fetch Schemas for selected catalog
  const fetchSchemas = async () => {
    if (!selectedCatalogId) return;
    try {
      setLoading(true);
      const res = await api.get(`/catalogs/${selectedCatalogId}/schemas`);
      const list = res.data?.data || [];
      setSchemas(list);
      if (list.length > 0) {
        let parsedAttrs = [];
        try {
          parsedAttrs = typeof list[0].attributes === "string" ? JSON.parse(list[0].attributes) : list[0].attributes;
        } catch {
          parsedAttrs = [];
        }
        setActiveSchema({ ...list[0], attributesList: parsedAttrs });
      } else {
        setActiveSchema(null);
      }
    } catch (err) {
      console.error("Failed fetching schemas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemas();
  }, [selectedCatalogId]);

  const selectSchema = (s) => {
    let parsedAttrs = [];
    try {
      parsedAttrs = typeof s.attributes === "string" ? JSON.parse(s.attributes) : s.attributes;
    } catch {
      parsedAttrs = [];
    }
    setActiveSchema({ ...s, attributesList: parsedAttrs });
  };

  // Add attribute row to active schema
  const handleAddAttribute = () => {
    if (!activeSchema) return;
    const nextList = [...activeSchema.attributesList, { ...DEFAULT_NEW_ATTR, key: `attr_${activeSchema.attributesList.length + 1}` }];
    setActiveSchema({ ...activeSchema, attributesList: nextList });
  };

  // Update specific attribute in active schema
  const handleUpdateAttribute = (idx, field, value) => {
    if (!activeSchema) return;
    const nextList = [...activeSchema.attributesList];
    nextList[idx] = { ...nextList[idx], [field]: value };
    setActiveSchema({ ...activeSchema, attributesList: nextList });
  };

  // Remove attribute from active schema
  const handleRemoveAttribute = (idx) => {
    if (!activeSchema) return;
    const nextList = activeSchema.attributesList.filter((_, i) => i !== idx);
    setActiveSchema({ ...activeSchema, attributesList: nextList });
  };

  // Save active schema to backend
  const handleSaveSchema = async () => {
    if (!activeSchema || !selectedCatalogId) return;
    try {
      setSaving(true);
      await api.post(`/catalogs/${selectedCatalogId}/schemas`, {
        category_name: activeSchema.category_name,
        attributes: activeSchema.attributesList,
      });
      alert("✓ Schema saved successfully!");
      fetchSchemas();
    } catch (err) {
      console.error("Save schema failed:", err);
      alert("Failed saving schema.");
    } finally {
      setSaving(false);
    }
  };

  // Create new category schema
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim() || !selectedCatalogId) return;
    try {
      await api.post(`/catalogs/${selectedCatalogId}/schemas`, {
        category_name: newCatName.trim(),
        attributes: [
          { key: "body_material", label: "Body Material", data_type: "string", unit_family: "none", required: true },
          { key: "pressure_rating", label: "Pressure Rating", data_type: "number", unit_family: "pressure", required: true },
          { key: "size_nominal", label: "Nominal Size", data_type: "number", unit_family: "length", required: true },
        ],
      });
      setNewCatName("");
      setShowNewCatModal(false);
      fetchSchemas();
    } catch (err) {
      console.error("Create category schema failed:", err);
    }
  };

  // JSON Export / Import
  const handleOpenJsonExport = () => {
    if (!activeSchema) return;
    setJsonText(JSON.stringify(activeSchema.attributesList, null, 2));
    setShowJsonModal(true);
  };

  const handleApplyJsonImport = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array of attribute objects");
      setActiveSchema({ ...activeSchema, attributesList: parsed });
      setShowJsonModal(false);
    } catch (err) {
      alert("Invalid JSON format: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxonomy & Attribute Schemas"
        description="Define category specifications, canonical unit families, bounding ranges, and extraction constraints."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleOpenJsonExport} disabled={!activeSchema}>
              { } JSON Import / Export
            </Button>
            <Button variant="primary" onClick={() => setShowNewCatModal(true)} disabled={!selectedCatalogId}>
              + New Category Schema
            </Button>
          </div>
        }
      />

      {/* Catalog Selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-muted">Active Catalog:</label>
        <select
          value={selectedCatalogId}
          onChange={(e) => setSelectedCatalogId(e.target.value)}
          className="field text-xs font-semibold min-w-[220px]"
        >
          {catalogs.map((c) => (
            <option key={c.id} value={c.id}>
              📁 {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Category List Left Rail */}
          <Card className="glass p-4 lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between border-b line-1 pb-2">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                Categories ({schemas.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCatModal(true)}
                className="text-xs text-accent hover:underline font-semibold"
              >
                + Add
              </button>
            </div>

            {schemas.length === 0 ? (
              <p className="text-faint text-xs py-4">No categories defined. Click + Add above.</p>
            ) : (
              <div className="space-y-1">
                {schemas.map((s) => {
                  const isSelected = activeSchema && activeSchema.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectSchema(s)}
                      className={`w-full text-left p-2.5 rounded text-xs transition-colors flex items-center justify-between ${
                        isSelected
                          ? "bg-accent-soft text-accent font-semibold"
                          : "hover:bg-surface-sunk/60 text-muted"
                      }`}
                    >
                      <span className="truncate">{s.category_name}</span>
                      <span className="text-[10px] text-faint">
                        {Array.isArray(s.attributes) ? s.attributes.length : "Def"} attrs
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Category Schema Editor */}
          <div className="lg:col-span-3 space-y-4">
            {activeSchema ? (
              <Card className="glass p-6 space-y-5">
                <div className="flex items-center justify-between border-b line-1 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-ink tracking-tight">
                      {activeSchema.category_name}
                    </h2>
                    <p className="text-muted text-xs">
                      {activeSchema.attributesList.length} defined attributes for extraction and normalization.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={handleAddAttribute}>
                      + Add Attribute
                    </Button>
                    <Button size="sm" variant="primary" onClick={handleSaveSchema} disabled={saving}>
                      {saving ? "Saving..." : "Save Schema"}
                    </Button>
                  </div>
                </div>

                {/* Attribute Fields Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b line-1 text-faint uppercase text-eyebrow bg-surface-sunk/40">
                        <th className="p-2.5">Key *</th>
                        <th className="p-2.5">Label</th>
                        <th className="p-2.5">Data Type</th>
                        <th className="p-2.5">Unit Family</th>
                        <th className="p-2.5">Required</th>
                        <th className="p-2.5">Bounds (Min / Max)</th>
                        <th className="p-2.5 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y line-1">
                      {activeSchema.attributesList.map((attr, idx) => (
                        <tr key={idx} className="hover:bg-surface-sunk/40">
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={attr.key || ""}
                              onChange={(e) => handleUpdateAttribute(idx, "key", e.target.value)}
                              placeholder="e.g. pressure_rating"
                              className="field font-mono text-xs py-1 w-32"
                            />
                          </td>

                          <td className="p-2.5">
                            <input
                              type="text"
                              value={attr.label || ""}
                              onChange={(e) => handleUpdateAttribute(idx, "label", e.target.value)}
                              placeholder="e.g. Pressure Rating"
                              className="field text-xs py-1 w-32"
                            />
                          </td>

                          <td className="p-2.5">
                            <select
                              value={attr.data_type || "string"}
                              onChange={(e) => handleUpdateAttribute(idx, "data_type", e.target.value)}
                              className="field text-xs py-1"
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="boolean">Boolean</option>
                              <option value="enum">Enum</option>
                            </select>
                          </td>

                          <td className="p-2.5">
                            <select
                              value={attr.unit_family || "none"}
                              onChange={(e) => handleUpdateAttribute(idx, "unit_family", e.target.value)}
                              className="field text-xs py-1"
                            >
                              <option value="none">None</option>
                              <option value="pressure">Pressure (psi)</option>
                              <option value="length">Length (mm)</option>
                              <option value="temperature">Temperature (°C)</option>
                              <option value="mass">Mass (kg)</option>
                            </select>
                          </td>

                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(attr.required)}
                              onChange={(e) => handleUpdateAttribute(idx, "required", e.target.checked)}
                              className="rounded border-line-2 bg-surface-1"
                            />
                          </td>

                          <td className="p-2.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={attr.min ?? ""}
                                onChange={(e) => handleUpdateAttribute(idx, "min", e.target.value ? Number(e.target.value) : null)}
                                placeholder="Min"
                                className="field text-xs py-1 w-16"
                              />
                              <span className="text-faint">-</span>
                              <input
                                type="number"
                                value={attr.max ?? ""}
                                onChange={(e) => handleUpdateAttribute(idx, "max", e.target.value ? Number(e.target.value) : null)}
                                placeholder="Max"
                                className="field text-xs py-1 w-16"
                              />
                            </div>
                          </td>

                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveAttribute(idx)}
                              className="text-faint hover:text-danger p-1 transition-colors"
                              title="Delete attribute"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <EmptyState
                title="No Category Selected"
                description="Select a category from the left or create a new category schema."
              />
            )}
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {showNewCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass w-full max-w-md p-6 rounded-panel relative space-y-4"
          >
            <h3 className="text-ink text-base font-bold">New Category Schema</h3>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="label mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ball Valves, Centrifugal Pumps, Fasteners"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="field w-full text-xs"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowNewCatModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Create Category
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* JSON Import/Export Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass w-full max-w-2xl p-6 rounded-panel relative space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-ink text-base font-bold">Schema JSON Editor</h3>
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                className="btn btn-ghost btn-sm p-1"
              >
                ✕
              </button>
            </div>

            <textarea
              rows="14"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="field font-mono text-xs w-full resize-none leading-relaxed"
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowJsonModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleApplyJsonImport}>
                Apply JSON Changes
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default Schema;
