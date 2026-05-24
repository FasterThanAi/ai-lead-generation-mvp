import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { formatDateTimeIST } from "../utils/dateUtils";
import { getFriendlyErrorMessage } from "../utils/errorMessages";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";

const KNOWLEDGE_CATEGORIES = [
  "Company Profile",
  "Product Details",
  "Pricing",
  "FAQ",
  "Case Study",
  "Demo Script",
  "Objection Handling",
  "Email Template",
  "Other",
];

const emptyForm = {
  title: "",
  category: "Product Details",
  tags: "",
  content: "",
  is_active: true,
};

function getPreviewText(value, maxLength = 260) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function Knowledge() {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(emptyForm);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeCount = useMemo(
    () => entries.filter((entry) => entry.is_active).length,
    [entries]
  );

  const loadKnowledge = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await api.get("/knowledge/", {
        params: {
          category: categoryFilter || undefined,
          active_only: activeOnly,
          search: search || undefined,
        },
      });
      setEntries(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Could not load company knowledge. Please try again."));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadKnowledge();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, activeOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadKnowledge();
  };

  const updateFormValue = (field, value) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setFormValues(emptyForm);
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setFormValues({
      title: entry.title || "",
      category: entry.category || "Other",
      tags: entry.tags || "",
      content: entry.content || "",
      is_active: Boolean(entry.is_active),
    });
    setStatusMessage("");
    setErrorMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formValues.title.trim() || !formValues.category.trim() || !formValues.content.trim()) {
      setErrorMessage("Title, category, and content are required.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    const payload = {
      title: formValues.title.trim(),
      category: formValues.category,
      content: formValues.content.trim(),
      tags: formValues.tags.trim() || null,
      is_active: Boolean(formValues.is_active),
    };

    try {
      if (editingId) {
        await api.patch(`/knowledge/${editingId}`, payload);
        setStatusMessage("Knowledge entry updated successfully.");
      } else {
        await api.post("/knowledge/", payload);
        setStatusMessage("Knowledge entry created successfully.");
      }

      resetForm();
      await loadKnowledge();
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Knowledge entry could not be saved. Please try again."));
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (entryId) => {
    setDeactivatingId(entryId);
    setStatusMessage("");
    setErrorMessage("");

    try {
      await api.delete(`/knowledge/${entryId}`);
      setStatusMessage("Knowledge entry deactivated.");
      await loadKnowledge();
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Knowledge entry could not be deactivated."));
      console.error(err);
    } finally {
      setDeactivatingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Knowledge"
        description="Store company facts, product notes, pricing guidance, FAQs, and demo scripts for AI drafts to use when relevant."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                {editingId ? "Edit Knowledge" : "Add Knowledge"}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Keep entries specific and factual. AI uses these as context, not as automatic send instructions.
              </p>
            </div>
            {editingId && (
              <Button type="button" variant="secondary" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="knowledge-title">
                Title
              </label>
              <input
                id="knowledge-title"
                type="text"
                value={formValues.title}
                onChange={(e) => updateFormValue("title", e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                placeholder="Pricing Overview"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="knowledge-category">
                Category
              </label>
              <select
                id="knowledge-category"
                value={formValues.category}
                onChange={(e) => updateFormValue("category", e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
              >
                {KNOWLEDGE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="knowledge-tags">
                Tags
              </label>
              <input
                id="knowledge-tags"
                type="text"
                value={formValues.tags}
                onChange={(e) => updateFormValue("tags", e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                placeholder="pricing, pilot, demo"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="knowledge-content">
                Content
              </label>
              <textarea
                id="knowledge-content"
                value={formValues.content}
                onChange={(e) => updateFormValue("content", e.target.value)}
                className="mt-2 min-h-56 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                placeholder="Add concise, verified company information."
              />
              <p className="mt-2 text-xs text-slate-500">
                Max 10,000 characters. Shorter entries are easier for AI to use cleanly.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formValues.is_active}
                onChange={(e) => updateFormValue("is_active", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Active
            </label>

            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Save Changes" : "Add Knowledge"}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">Company Knowledge Base</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {entries.length} shown, {activeCount} active.
                </p>
              </div>

              <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto] lg:min-w-[640px]" onSubmit={handleSearchSubmit}>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                  placeholder="Search knowledge"
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                >
                  <option value="">All categories</option>
                  {KNOWLEDGE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="secondary">
                  Search
                </Button>
              </form>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Show active entries only
            </label>

            {(statusMessage || errorMessage) && (
              <div className="mt-4 space-y-2">
                {statusMessage && (
                  <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    {statusMessage}
                  </p>
                )}
                {errorMessage && (
                  <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {errorMessage}
                  </p>
                )}
              </div>
            )}
          </Card>

          {isLoading ? (
            <Card>
              <p className="text-sm text-slate-600">Loading knowledge entries...</p>
            </Card>
          ) : entries.length === 0 ? (
            <Card>
              <div className="border border-dashed border-slate-200 p-6 text-center">
                <h3 className="font-medium text-slate-800">No knowledge entries found.</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Add product details, pricing notes, FAQs, or demo scripts to make AI drafts more specific.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {entries.map((entry) => (
                <article key={entry.id} className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={entry.is_active ? "success" : "neutral"}>
                          {entry.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="neutral">{entry.category}</Badge>
                      </div>
                      <h4 className="mt-3 break-words text-lg font-semibold text-slate-950">
                        {entry.title}
                      </h4>
                      {entry.tags && (
                        <p className="mt-1 break-words text-xs font-medium text-slate-500">
                          {entry.tags}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="mt-4 whitespace-pre-line break-words text-sm leading-6 text-slate-700">
                    {getPreviewText(entry.content)}
                  </p>

                  <div className="mt-4 space-y-1 text-xs text-slate-500">
                    <p>Created: {formatDateTimeIST(entry.created_at)}</p>
                    {entry.updated_at && <p>Updated: {formatDateTimeIST(entry.updated_at)}</p>}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => handleEdit(entry)}>
                      Edit
                    </Button>
                    {entry.is_active && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={deactivatingId === entry.id}
                        onClick={() => handleDeactivate(entry.id)}
                      >
                        {deactivatingId === entry.id ? "Deactivating..." : "Deactivate"}
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Knowledge;
