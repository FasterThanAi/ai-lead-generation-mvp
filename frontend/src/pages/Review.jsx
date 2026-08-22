import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";

function Review() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [bulkMinConfidence, setBulkMinConfidence] = useState(85);
  const [toast, setToast] = useState(null);

  const activeRef = useRef(null);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await api.get("/products/review-queue/items?limit=200");
      setItems(res.data?.data || []);
      setActiveIndex(0);
    } catch (err) {
      console.error("Error fetching review queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const showToast = (msg, tone = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  // Optimistic single attribute resolution
  const handleResolve = async (id, newStatus, customNorm = null, customUnit = null) => {
    const targetItem = items.find((it) => it.id === id);
    if (!targetItem) return;

    // Optimistic removal from queue
    const originalItems = [...items];
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (editingId === id) setEditingId(null);

    try {
      const payload = { status: newStatus };
      if (customNorm !== null) payload.value_norm = customNorm;
      if (customUnit !== null) payload.unit = customUnit;

      await api.patch(`/products/attributes/${id}`, payload);
      showToast(
        newStatus === "approved"
          ? `✓ Approved "${targetItem.key}" on ${targetItem.part_number}`
          : `✗ Rejected "${targetItem.key}" on ${targetItem.part_number}`,
        newStatus === "approved" ? "success" : "neutral"
      );
    } catch (err) {
      console.error("Failed resolving attribute:", err);
      // Rollback
      setItems(originalItems);
      showToast("Failed to save changes. Rolled back.", "danger");
    }
  };

  // Bulk Approval
  const handleBulkApprove = async () => {
    const toApprove = items.filter((it) => it.confidence >= bulkMinConfidence && it.status === "proposed");
    if (toApprove.length === 0) {
      alert(`No proposed attributes found with confidence >= ${bulkMinConfidence}%.`);
      return;
    }

    const ids = toApprove.map((it) => it.id);
    const originalItems = [...items];
    setItems((prev) => prev.filter((it) => !ids.includes(it.id)));

    try {
      await api.post("/products/attributes/bulk-approve", { attribute_ids: ids });
      showToast(`✓ Bulk approved ${ids.length} high-confidence attributes!`, "success");
    } catch (err) {
      console.error("Bulk approve failed:", err);
      setItems(originalItems);
      showToast("Bulk approve failed. Rolled back.", "danger");
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (items.length === 0) return;

      const currentItem = items[activeIndex];

      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(items.length - 1, prev + 1));
      } else if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
      } else if ((e.key === "a" || e.key === "A") && currentItem) {
        e.preventDefault();
        handleResolve(currentItem.id, "approved");
      } else if ((e.key === "r" || e.key === "R") && currentItem) {
        e.preventDefault();
        handleResolve(currentItem.id, "rejected");
      } else if ((e.key === "e" || e.key === "E") && currentItem) {
        e.preventDefault();
        setEditingId(currentItem.id);
        setEditValue(currentItem.value_norm || currentItem.value_raw || "");
        setEditUnit(currentItem.unit || "");
      }
    },
    [items, activeIndex]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Human Review Queue"
        description="Low-confidence extractions, validation rule flags, and multi-source conflicts needing curator sign-off."
        action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 well p-1.5 rounded-lg text-xs">
              <span className="text-faint pl-1">Threshold:</span>
              <select
                value={bulkMinConfidence}
                onChange={(e) => setBulkMinConfidence(Number(e.target.value))}
                className="field text-xs py-1"
              >
                <option value={90}>≥ 90%</option>
                <option value={85}>≥ 85%</option>
                <option value={80}>≥ 80%</option>
                <option value={75}>≥ 75%</option>
              </select>
              <Button size="sm" variant="primary" onClick={handleBulkApprove}>
                ⚡ Bulk Approve (≥{bulkMinConfidence}%)
              </Button>
            </div>

            <Button size="sm" variant="secondary" onClick={fetchQueue}>
              ↻ Refresh
            </Button>
          </div>
        }
      />

      {/* Review Queue Items */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-panel" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Review Backlog Clean 🎉"
          description="All extracted attributes have been approved, resolved, or exceed the confidence bar."
          action={
            <Link to="/products" className="btn btn-primary">
              View Catalog Products
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            let flags = [];
            try {
              flags = typeof item.validation_flags === "string" ? JSON.parse(item.validation_flags) : (item.validation_flags || []);
            } catch {
              flags = [];
            }

            const isActive = idx === activeIndex;
            const isEditing = editingId === item.id;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onClick={() => setActiveIndex(idx)}
                className={`glass p-4 rounded-panel cursor-pointer transition-all duration-200 ${
                  isActive
                    ? "ring-2 ring-accent border-accent-soft shadow-lg bg-surface-1/80"
                    : "hover:bg-surface-sunk/40"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Product & Attribute Details */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/products/${item.product_id}`}
                        className="text-xs font-bold text-accent hover:underline font-mono"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.part_number}
                      </Link>
                      <span className="text-faint text-xs">•</span>
                      <span className="text-xs text-muted font-medium">
                        {item.manufacturer || item.category || "General"}
                      </span>
                      <span className="text-faint text-xs">•</span>
                      <span className="text-xs font-bold text-ink bg-surface-sunk px-2 py-0.5 rounded">
                        {item.key}
                      </span>
                      {item.extraction_method && (
                        <Badge tone={item.extraction_method === "vision" ? "violet" : "info"} variant="soft">
                          {item.extraction_method}
                          {item.page_number ? ` p.${item.page_number}` : ""}
                        </Badge>
                      )}
                    </div>

                    {/* Value Transformation */}
                    <div className="flex items-center gap-3 pt-1 text-sm">
                      <div className="font-mono text-muted text-xs bg-surface-sunk/60 px-2 py-1 rounded">
                        Raw: <span className="text-ink font-semibold">"{item.value_raw || "null"}"</span>
                      </div>
                      <span className="text-accent font-bold">→</span>

                      {isEditing ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="Normalized value"
                            className="field text-xs py-1 w-32"
                            autoFocus
                          />
                          <input
                            type="text"
                            value={editUnit}
                            onChange={(e) => setEditUnit(e.target.value)}
                            placeholder="Unit (e.g. psi, mm)"
                            className="field text-xs py-1 w-20"
                          />
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleResolve(item.id, "approved", editValue, editUnit)}
                          >
                            ✓ Save & Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="font-semibold text-ink">
                          {item.value_norm ? (
                            <span>
                              {item.value_norm}{" "}
                              {item.unit && <span className="text-accent font-normal">{item.unit}</span>}
                            </span>
                          ) : (
                            <span className="text-warn italic font-normal">Normalization Pending</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Flags & Source */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {flags.map((f, i) => (
                        <span
                          key={i}
                          className="inline-block bg-danger-soft text-danger text-[10px] px-1.5 py-0.5 rounded font-mono"
                        >
                          ⚠️ {f}
                        </span>
                      ))}

                      {item.source_filename && (
                        <span className="text-faint text-[11px]">
                          Receipt: {item.source_filename}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Confidence Score & Review Actions */}
                  <div className="flex items-center gap-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="text-right">
                      <div className="text-[11px] text-faint">Confidence</div>
                      <div
                        className={`text-base font-bold tabular-nums ${
                          item.confidence >= 80
                            ? "text-success"
                            : item.confidence >= 60
                            ? "text-warn"
                            : "text-danger"
                        }`}
                      >
                        {item.confidence ?? "—"}%
                      </div>
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditValue(item.value_norm || item.value_raw || "");
                            setEditUnit(item.unit || "");
                          }}
                          title="Edit normalized spec inline (E)"
                        >
                          ✎ Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-danger hover:bg-danger-soft"
                          onClick={() => handleResolve(item.id, "rejected")}
                          title="Reject attribute (R)"
                        >
                          ✕ Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleResolve(item.id, "approved")}
                          title="Approve attribute (A)"
                        >
                          ✓ Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Floating Keyboard Shortcut Hint Bar */}
      <div className="fixed bottom-4 inset-x-0 z-40 flex justify-center pointer-events-none px-4">
        <div className="glass shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-4 text-xs font-semibold text-ink pointer-events-auto border line-1">
          <div className="flex items-center gap-1.5">
            <kbd className="bg-surface-sunk border line-1 px-1.5 py-0.5 rounded text-[11px] font-mono">A</kbd>
            <span className="text-success font-medium">Approve</span>
          </div>
          <span className="text-faint">•</span>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-surface-sunk border line-1 px-1.5 py-0.5 rounded text-[11px] font-mono">R</kbd>
            <span className="text-danger font-medium">Reject</span>
          </div>
          <span className="text-faint">•</span>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-surface-sunk border line-1 px-1.5 py-0.5 rounded text-[11px] font-mono">E</kbd>
            <span className="text-muted font-medium">Edit</span>
          </div>
          <span className="text-faint">•</span>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-surface-sunk border line-1 px-1.5 py-0.5 rounded text-[11px] font-mono">J</kbd>
            <kbd className="bg-surface-sunk border line-1 px-1.5 py-0.5 rounded text-[11px] font-mono">K</kbd>
            <span className="text-muted font-medium">Navigate</span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-16 right-6 z-50 p-3 rounded-lg shadow-xl text-xs font-semibold glass border ${
              toast.tone === "danger" ? "border-danger text-danger" : "border-success text-success"
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Review;
