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

const emptyUploadForm = {
  category: "Product Details",
  tags: "",
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function getPreviewText(value, maxLength = 260) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function getSourceLabel(entry) {
  return String(entry?.source_type || "manual").toLowerCase() === "document" ? "Document" : "Manual";
}

function getDocumentStatusVariant(status) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "processed") {
    return "success";
  }

  if (normalizedStatus === "failed") {
    return "danger";
  }

  return "warning";
}

function Knowledge() {
  const [entries, setEntries] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentDetail, setDocumentDetail] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isLoadingDocumentDetail, setIsLoadingDocumentDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [deactivatingDocumentId, setDeactivatingDocumentId] = useState(null);
  const [reactivatingDocumentId, setReactivatingDocumentId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(emptyForm);
  const [uploadFormValues, setUploadFormValues] = useState(emptyUploadForm);
  const [uploadFile, setUploadFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeCount = useMemo(
    () => entries.filter((entry) => entry.is_active).length,
    [entries]
  );
  const entriesSectionTitle = activeSearch
    ? `Search Results for ${activeSearch}`
    : "Knowledge Entries";
  const entriesSectionSummary = activeSearch
    ? `${entries.length} ${entries.length === 1 ? "result" : "results"} found`
    : `${entries.length} shown, ${activeCount} active.`;

  const loadKnowledge = async ({
    queryText = activeSearch,
    nextCategoryFilter = categoryFilter,
    nextActiveOnly = activeOnly,
  } = {}) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const trimmedQuery = String(queryText || "").trim();
      const res = trimmedQuery
        ? await api.get("/knowledge/search/relevant", {
          params: {
            q: trimmedQuery,
            limit: 10,
          },
        })
        : await api.get("/knowledge/", {
          params: {
            category: nextCategoryFilter || undefined,
            active_only: nextActiveOnly,
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

  const loadDocuments = async () => {
    setIsLoadingDocuments(true);

    try {
      const res = await api.get("/knowledge/documents");
      setDocuments(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Could not load uploaded documents. Please try again."));
      console.error(err);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const refreshKnowledgeAndDocuments = async () => {
    await Promise.all([
      loadKnowledge(),
      loadDocuments(),
    ]);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshKnowledgeAndDocuments();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, activeOnly]);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const trimmedSearch = search.trim();

    if (!trimmedSearch) {
      setActiveSearch("");
      setCategoryFilter("");
      setActiveOnly(true);
      await loadKnowledge({
        queryText: "",
        nextCategoryFilter: "",
        nextActiveOnly: true,
      });
      return;
    }

    setActiveSearch(trimmedSearch);
    await loadKnowledge({ queryText: trimmedSearch });
  };

  const handleClearSearch = async () => {
    setSearch("");
    setActiveSearch("");
    setCategoryFilter("");
    setActiveOnly(true);
    await loadKnowledge({
      queryText: "",
      nextCategoryFilter: "",
      nextActiveOnly: true,
    });
  };

  const updateFormValue = (field, value) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateUploadFormValue = (field, value) => {
    setUploadFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setFormValues(emptyForm);
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadFormValues(emptyUploadForm);
    setFileInputKey((current) => current + 1);
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

  const handleUploadSubmit = async (e) => {
    e.preventDefault();

    if (!uploadFile) {
      setErrorMessage("Please choose a document to upload.");
      return;
    }

    if (uploadFile.size > MAX_UPLOAD_BYTES) {
      setErrorMessage("File is too large. Max size is 5 MB.");
      return;
    }

    setIsUploading(true);
    setStatusMessage("");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("category", uploadFormValues.category);

    if (uploadFormValues.tags.trim()) {
      formData.append("tags", uploadFormValues.tags.trim());
    }

    try {
      const res = await api.post("/knowledge/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const totalChunks = res.data?.data?.total_chunks ?? 0;

      setStatusMessage(`Document processed successfully. ${totalChunks} knowledge chunks created.`);
      resetUploadForm();
      await refreshKnowledgeAndDocuments();
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Upload failed. Please try again.", "knowledge-upload"));
      console.error(err);
    } finally {
      setIsUploading(false);
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

  const handleViewDocumentChunks = async (documentId) => {
    if (selectedDocumentId === documentId) {
      setSelectedDocumentId(null);
      setDocumentDetail(null);
      return;
    }

    setSelectedDocumentId(documentId);
    setDocumentDetail(null);
    setIsLoadingDocumentDetail(true);
    setErrorMessage("");

    try {
      const res = await api.get(`/knowledge/documents/${documentId}`);
      setDocumentDetail(res.data.data || null);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Could not load document chunks. Please try again."));
      console.error(err);
    } finally {
      setIsLoadingDocumentDetail(false);
    }
  };

  const handleDeactivateDocument = async (documentId) => {
    setDeactivatingDocumentId(documentId);
    setStatusMessage("");
    setErrorMessage("");

    try {
      await api.delete(`/knowledge/documents/${documentId}`);
      setStatusMessage("Document knowledge deactivated successfully.");
      setDocumentDetail(null);
      setSelectedDocumentId(null);
      await refreshKnowledgeAndDocuments();
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Document knowledge could not be deactivated."));
      console.error(err);
    } finally {
      setDeactivatingDocumentId(null);
    }
  };

  const handleReactivateDocument = async (documentId) => {
    setReactivatingDocumentId(documentId);
    setStatusMessage("");
    setErrorMessage("");

    try {
      await api.post(`/knowledge/documents/${documentId}/reactivate`);
      setStatusMessage("Document knowledge reactivated successfully.");
      await refreshKnowledgeAndDocuments();

      if (selectedDocumentId === documentId) {
        const res = await api.get(`/knowledge/documents/${documentId}`);
        setDocumentDetail(res.data.data || null);
      }
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Document knowledge could not be reactivated."));
      console.error(err);
    } finally {
      setReactivatingDocumentId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Knowledge"
        description="Store company facts, product notes, pricing guidance, FAQs, demo scripts, and uploaded documents for AI drafts to use when relevant."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <div className="space-y-6">
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

          <Card>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                Upload Knowledge Document
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Supported: PDF, DOCX, TXT, MD. Max 5 MB.
              </p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleUploadSubmit}>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="knowledge-document-file">
                  File
                </label>
                <input
                  key={fileInputKey}
                  id="knowledge-document-file"
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="mt-2 w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="knowledge-upload-category">
                  Category
                </label>
                <select
                  id="knowledge-upload-category"
                  value={uploadFormValues.category}
                  onChange={(e) => updateUploadFormValue("category", e.target.value)}
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
                <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="knowledge-upload-tags">
                  Tags
                </label>
                <input
                  id="knowledge-upload-tags"
                  type="text"
                  value={uploadFormValues.tags}
                  onChange={(e) => updateUploadFormValue("tags", e.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                  placeholder="pricing, demo, onboarding"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isUploading}>
                {isUploading ? "Uploading..." : "Upload Document"}
              </Button>
            </form>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="order-1">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">Company Knowledge Base</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Search manual entries and uploaded document chunks.
                </p>
              </div>

              <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto_auto] lg:min-w-[720px]" onSubmit={handleSearchSubmit}>
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
                {(search || activeSearch) && (
                  <Button type="button" variant="ghost" onClick={handleClearSearch}>
                    Clear Search
                  </Button>
                )}
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

          <Card className="order-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">Uploaded Documents</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {documents.length} documents uploaded.
                </p>
              </div>
            </div>

            {isLoadingDocuments ? (
              <p className="mt-4 text-sm text-slate-600">Loading uploaded documents...</p>
            ) : documents.length === 0 ? (
              <div className="mt-4 border border-dashed border-slate-200 p-6 text-center">
                <h3 className="font-medium text-slate-800">No uploaded documents yet.</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Upload TXT, Markdown, PDF, or DOCX files to turn them into searchable knowledge chunks.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {documents.map((document) => {
                  const activeChunks = Number(document.active_chunks ?? document.total_chunks ?? 0);
                  const totalChunks = Number(document.total_chunks ?? 0);
                  const isDocumentActive = activeChunks > 0;
                  const isSelected = selectedDocumentId === document.id;

                  return (
                    <article key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={getDocumentStatusVariant(document.status)}>
                              {document.status || "processed"}
                            </Badge>
                            <Badge variant="neutral">
                              {String(document.file_type || "").toUpperCase()}
                            </Badge>
                            {document.category && <Badge variant="neutral">{document.category}</Badge>}
                          </div>
                          <h4 className="mt-3 break-words text-base font-semibold text-slate-950">
                            {document.original_filename || document.filename}
                          </h4>
                          {document.tags && (
                            <p className="mt-1 break-words text-xs font-medium text-slate-500">
                              {document.tags}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 space-y-1 text-xs text-slate-600">
                        <p>Chunks: {activeChunks} active / {totalChunks} total</p>
                        <p>Uploaded: {formatDateTimeIST(document.uploaded_at)}</p>
                        {document.error_message && (
                          <p className="text-red-700">{document.error_message}</p>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleViewDocumentChunks(document.id)}
                        >
                          {isSelected ? "Hide Chunks" : "View Chunks"}
                        </Button>
                        {isDocumentActive ? (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={deactivatingDocumentId === document.id}
                            onClick={() => handleDeactivateDocument(document.id)}
                          >
                            {deactivatingDocumentId === document.id ? "Deactivating..." : "Deactivate"}
                          </Button>
                        ) : totalChunks > 0 && (
                          <Button
                            type="button"
                            variant="success"
                            size="sm"
                            disabled={reactivatingDocumentId === document.id}
                            onClick={() => handleReactivateDocument(document.id)}
                          >
                            {reactivatingDocumentId === document.id ? "Reactivating..." : "Reactivate"}
                          </Button>
                        )}
                      </div>

                      {isSelected && (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                          {isLoadingDocumentDetail ? (
                            <p className="text-sm text-slate-600">Loading chunks...</p>
                          ) : documentDetail?.chunks?.length ? (
                            <div className="space-y-3">
                              {documentDetail.chunks.map((chunk) => (
                                <div key={chunk.id} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={chunk.is_active ? "success" : "neutral"}>
                                      {chunk.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                    <Badge variant="neutral">Chunk {chunk.chunk_index || chunk.id}</Badge>
                                  </div>
                                  <p className="mt-2 break-words text-sm font-medium text-slate-900">
                                    {chunk.title}
                                  </p>
                                  <p className="mt-1 whitespace-pre-line break-words text-xs leading-5 text-slate-600">
                                    {getPreviewText(chunk.content_preview || chunk.content, 220)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-600">No chunks found for this document.</p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="order-2 space-y-4">
            <Card>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                    {entriesSectionTitle}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {entriesSectionSummary}
                  </p>
                </div>
              </div>
            </Card>

          {isLoading ? (
            <Card>
              <p className="text-sm text-slate-600">Loading knowledge entries...</p>
            </Card>
          ) : entries.length === 0 ? (
            <Card>
              <div className="border border-dashed border-slate-200 p-6 text-center">
                <h3 className="font-medium text-slate-800">
                  {activeSearch ? "No knowledge found for this search." : "No knowledge entries found."}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {activeSearch
                    ? "Try another term or clear the search to browse all active knowledge."
                    : "Add product details, pricing notes, FAQs, demo scripts, or uploaded documents to make AI drafts more specific."}
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {entries.map((entry) => {
                const sourceLabel = getSourceLabel(entry);

                return (
                  <article key={entry.id} className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={entry.is_active ? "success" : "neutral"}>
                            {entry.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="neutral">{entry.category}</Badge>
                          <Badge variant={sourceLabel === "Document" ? "sent" : "neutral"}>
                            {sourceLabel}
                          </Badge>
                        </div>
                        <h4 className="mt-3 break-words text-lg font-semibold text-slate-950">
                          {entry.title}
                        </h4>
                        {entry.tags && (
                          <p className="mt-1 break-words text-xs font-medium text-slate-500">
                            {entry.tags}
                          </p>
                        )}
                        {sourceLabel === "Document" && (
                          <p className="mt-2 break-words text-xs text-slate-500">
                            Source: Document - {entry.document_filename || `Document ID ${entry.document_id || "unknown"}`}
                            {entry.chunk_index ? ` - Chunk ${entry.chunk_index}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="mt-4 whitespace-pre-line break-words text-sm leading-6 text-slate-700">
                      {getPreviewText(entry.content_preview || entry.content)}
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
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Knowledge;
